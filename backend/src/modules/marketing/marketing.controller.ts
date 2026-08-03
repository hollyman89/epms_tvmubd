import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, Request, Query, UseInterceptors, UploadedFile, ParseIntPipe, BadRequestException, Res, NotFoundException } from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { MarketingService } from './marketing.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateTenderDto, UpdateTenderStatusDto, UpdateTenderDto } from './dto/create-tender.dto';
import { TenderDetailResponseDto } from './dto/tender-detail-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTenderActivityDto } from './dto/tender-activity.dto';

import { IsNumber, IsString, IsBoolean, IsOptional } from 'class-validator';

export class NegotiatePriceDto {
  @IsNumber()
  new_price: number;

  @IsString()
  @IsOptional()
  reason?: string;
}

export class ApproveDiscountDto {
  @IsBoolean()
  is_approved: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

export class VerifySpkDto {
  @IsBoolean()
  is_valid: boolean;

  @IsString()
  @IsOptional()
  notes?: string;
}

@ApiTags('Marketing')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('marketing')
export class MarketingController {
  constructor(private readonly marketingService: MarketingService) {}

  @Delete('tenders/:id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Soft delete a Tender (Super Admin only)' })
  async deleteTender(@Param('id', ParseIntPipe) id: number, @Request() req) {
    return await this.marketingService.deleteTender(id, req.user.userId);
  }

  @Post('customers')
  @ApiOperation({ summary: 'Create a new Customer' })
  async createCustomer(@Body() dto: CreateCustomerDto, @Request() req) {
    return await this.marketingService.createCustomer(dto, req.user.userId);
  }

  @Get('customers')
  @ApiOperation({ summary: 'Get all customers' })
  async getCustomers() {
    return await this.marketingService.getCustomers();
  }

  @Get('tenders')
  @ApiOperation({ summary: 'Get all tenders' })
  async getTenders(@Request() req) {
    return await this.marketingService.getTenders(req.user.userId, req.user.roles);
  }

  @Get('tenders/:id')
  @ApiOperation({ summary: 'Get tender by ID' })
  @ApiResponse({ status: 200, description: 'Tender detail retrieved successfully.', type: TenderDetailResponseDto })
  async getTenderById(@Param('id') id: number, @Request() req): Promise<TenderDetailResponseDto> {
    return await this.marketingService.getTenderById(id, req.user.userId, req.user.roles);
  }

  @Post('tenders')
  @ApiOperation({ summary: 'Create a new Tender' })
  async createTender(@Body() dto: CreateTenderDto, @Request() req) {
    return await this.marketingService.createTender(dto, req.user.userId);
  }

  @Get('dashboard/summary')
  @ApiOperation({ summary: 'Get Marketing Dashboard Summary (KPIs)' })
  async getDashboardSummary(@Request() req, @Query('period') period?: string) {
    return await this.marketingService.getDashboardSummary(period, req.user.userId, req.user.roles);
  }

  @Get('pics')
  @ApiOperation({ summary: 'Get Marketing PICs' })
  async getMarketingPics() {
    return await this.marketingService.getMarketingPics();
  }

  @Patch('tenders/:id')
  @Roles('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER')
  @ApiOperation({ summary: 'Update Tender details' })
  async updateTender(@Param('id') id: number, @Body() dto: UpdateTenderDto, @Request() req) {
    return await this.marketingService.updateTender(id, dto, req.user.userId);
  }

  @Patch('tenders/:id/negotiate')
  @Roles('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER')
  @ApiOperation({ summary: 'Negotiate Tender Price' })
  async negotiatePrice(@Param('id') id: number, @Body() dto: NegotiatePriceDto, @Request() req) {
    const userId = req.user?.userId || req.user?.id;
    const userRoles = req.user?.roles || [];
    return await this.marketingService.negotiatePrice(id, dto, userId, userRoles);
  }

  @Patch('tenders/:id/approve-discount')
  @Roles('DIRECTOR', 'SUPER_ADMIN', 'GENERAL_MANAGER')
  @ApiOperation({ summary: 'Approve or Reject Tender Discount' })
  async approveDiscount(@Param('id') id: number, @Body() dto: ApproveDiscountDto, @Request() req) {
    return await this.marketingService.approveDiscount(id, dto, req.user.userId);
  }

  /**
   * ENDPOINT UPLOAD SPK (DISK STORAGE - PERMANEN)
   * Marketing mengupload file SPK langsung ke server, disimpan di uploads/spk/
   * dan URL-nya langsung tertaut ke contract di database.
   */
  @Post('tenders/:id/upload-spk')
  @Roles('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR')
  @ApiOperation({ summary: 'Upload SPK document - simpan permanen ke disk dan update contract.spk_file_url' })
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(process.cwd(), 'uploads', 'contracts');
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `spk-${req.params.id}-${uniqueSuffix}${ext}`);
      }
    }),
    fileFilter: (req, file, cb) => {
      const allowed = ['.pdf', '.doc', '.docx', '.png', '.jpg', '.jpeg'];
      const ext = path.extname(file.originalname).toLowerCase();
      if (allowed.includes(ext)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Hanya file PDF, DOC, atau gambar yang diizinkan'), false);
      }
    },
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
  }))
  async uploadSpk(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) {
      throw new BadRequestException('File SPK wajib diupload');
    }
    const baseUrl = process.env.BACKEND_STORAGE_URL || process.env.APP_URL || 'http://localhost:4000';
    const publicUrl = `${baseUrl}/uploads/contracts/${file.filename}`;
    return await this.marketingService.saveSPKAndUpdateContract(id, file, publicUrl, req.user.userId || req.user.sub);
  }

  @Post('tenders/:id/presigned-url')
  @Roles('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR')
  @ApiOperation({ summary: 'Get Presigned URL for SPK upload (legacy - gunakan upload-spk untuk disk storage)' })
  async getPresignedUrl(@Param('id') id: number, @Body() body: { filename: string }, @Request() req) {
    return await this.marketingService.getPresignedUrl(id, body.filename, req.user.userId || req.user.sub);
  }

  @Post('tenders/:id/verify-spk')
  @Roles('LEGAL', 'SUPER_ADMIN', 'DIRECTOR', 'GENERAL_MANAGER')
  @ApiOperation({ summary: 'Verify SPK document (Admin/Legal/Exec)' })
  async verifySpk(@Param('id') id: number, @Body() dto: VerifySpkDto, @Request() req) {
    return await this.marketingService.verifySpk(id, dto, req.user.userId);
  }

  @Patch('tenders/:id/grace-period')
  @Roles('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR')
  @ApiOperation({ summary: 'Set grace period for tender' })
  async setGracePeriod(@Param('id') id: number, @Request() req) {
    return await this.marketingService.setGracePeriod(id, req.user.userId);
  }

  @Patch('tenders/:id/status')
  @Roles('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR')
  @ApiOperation({ summary: 'Update Tender status (WON/LOST)' })
  async updateTenderStatus(@Param('id') id: number, @Body() dto: UpdateTenderStatusDto, @Request() req) {
    return await this.marketingService.updateTenderStatusTransactionally(id, dto, req.user.userId);
  }

  @Post('tenders/:id/upload-proposal')
  @Roles('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER')
  @ApiOperation({ summary: 'Upload Proposal Document and update stage to PROPOSAL' })
  @UseInterceptors(FileInterceptor('file', {
    storage: diskStorage({
      destination: (req, file, cb) => {
        const uploadPath = path.join(process.cwd(), 'uploads', 'proposals');
        if (!fs.existsSync(uploadPath)) {
          fs.mkdirSync(uploadPath, { recursive: true });
        }
        cb(null, uploadPath);
      },
      filename: (req, file, cb) => {
        const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
        const ext = path.extname(file.originalname);
        cb(null, `proposal-${uniqueSuffix}${ext}`);
      }
    })
  }))
  async uploadProposal(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    return await this.marketingService.uploadProposal(id, file, req.user.userId);
  }

  @Get('tenders/:id/activities')
  @ApiOperation({ summary: 'Get tender activities (Chat-Ops)' })
  async getTenderActivities(@Param('id') id: number, @Request() req) {
    return await this.marketingService.getTenderActivities(id, req.user.userId, req.user.roles);
  }

  @Post('tenders/:id/activities')
  @ApiOperation({ summary: 'Add a new comment/activity' })
  async createTenderActivity(@Param('id') id: number, @Body() dto: CreateTenderActivityDto, @Request() req) {
    return await this.marketingService.createTenderActivity(id, dto, req.user.userId);
  }

  @Get('tenders/proposals/:filename')
  @Roles('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER')
  @ApiOperation({ summary: 'Download or View Proposal Document' })
  downloadProposal(@Param('filename') filename: string, @Res() res: Response) {
    const filePath = path.join(process.cwd(), 'uploads', 'proposals', filename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Proposal document not found');
    }
    return res.sendFile(filePath);
  }
}
