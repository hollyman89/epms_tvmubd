import { Controller, Post, Get, Patch, Delete, Body, Param, UseGuards, Request, Query, UseInterceptors, UploadedFile, ParseIntPipe, BadRequestException, Res, NotFoundException, HttpException, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { FileInterceptor } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import * as path from 'path';
import * as fs from 'fs';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiConsumes, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MarketingService } from './marketing.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CreateTenderDto, UpdateTenderStatusDto, UpdateTenderDto } from './dto/create-tender.dto';
import { TenderDetailResponseDto } from './dto/tender-detail-response.dto';
import { Roles } from '../auth/decorators/roles.decorator';
import { RolesGuard } from '../auth/guards/roles.guard';
import { CreateTenderActivityDto } from './dto/tender-activity.dto';
import { SubmitGoNoGoReviewDto } from './dto/submit-go-no-go-review.dto';

import { IsNumber, IsString, IsBoolean, IsOptional, IsIn, IsPositive } from 'class-validator';
import { Type } from 'class-transformer';

export class GoNoGoDto {
  @IsString()
  @IsIn(['GO', 'NO_GO'])
  decision: 'GO' | 'NO_GO';

  @IsString()
  @IsOptional()
  notes?: string;
}

export class NegotiatePriceDto {
  @Type(() => Number)
  @IsNumber({ allowNaN: false, allowInfinity: false }, { message: 'Harga negosiasi harus berupa angka valid' })
  @IsPositive({ message: 'Harga negosiasi harus lebih besar dari 0' })
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

function cleanupUploadedFile(filePath: string): void {
  try {
    if (filePath && fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (err) {
    console.warn(`[File Cleanup Warning] Failed to unlink file ${filePath}:`, err);
  }
}

function validateFileSignature(filePath: string, originalName: string, mimeType: string): void {
  const ext = path.extname(originalName).toLowerCase();
  const buffer = Buffer.alloc(512);
  let bytesRead = 0;
  let fd: number | null = null;

  try {
    fd = fs.openSync(filePath, 'r');
    bytesRead = fs.readSync(fd, buffer, 0, 512, 0);
  } catch (readErr) {
    cleanupUploadedFile(filePath);
    throw new BadRequestException('Format file tidak valid.');
  } finally {
    if (fd !== null) {
      try {
        fs.closeSync(fd);
      } catch (closeErr) {}
    }
  }

  if (bytesRead < 4) {
    cleanupUploadedFile(filePath);
    throw new BadRequestException('Format file tidak valid.');
  }

  // Reject Windows Executable header (MZ: 0x4D, 0x5A) immediately
  if (buffer[0] === 0x4D && buffer[1] === 0x5A) {
    cleanupUploadedFile(filePath);
    throw new BadRequestException('Format file tidak valid.');
  }

  let isValid = false;

  if (ext === '.pdf') {
    // PDF Magic Bytes: %PDF- (0x25, 0x50, 0x44, 0x46, 0x2D)
    if (
      bytesRead >= 5 &&
      buffer[0] === 0x25 &&
      buffer[1] === 0x50 &&
      buffer[2] === 0x44 &&
      buffer[3] === 0x46 &&
      buffer[4] === 0x2D
    ) {
      isValid = true;
    }
  } else if (ext === '.doc' || ext === '.xls') {
    // OLE Compound File: D0 CF 11 E0 A1 B1 1A E1
    if (
      bytesRead >= 8 &&
      buffer[0] === 0xD0 &&
      buffer[1] === 0xCF &&
      buffer[2] === 0x11 &&
      buffer[3] === 0xE0 &&
      buffer[4] === 0xA1 &&
      buffer[5] === 0xB1 &&
      buffer[6] === 0x1A &&
      buffer[7] === 0xE1
    ) {
      isValid = true;
    }
  } else if (ext === '.docx' || ext === '.xlsx') {
    // OOXML ZIP container: PK\x03\x04 (0x50, 0x4B, 0x03, 0x04)
    if (
      bytesRead >= 4 &&
      buffer[0] === 0x50 &&
      buffer[1] === 0x4B &&
      buffer[2] === 0x03 &&
      buffer[3] === 0x04
    ) {
      isValid = true;
    }
  }

  if (!isValid) {
    cleanupUploadedFile(filePath);
    throw new BadRequestException('Format file tidak valid.');
  }
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

  @Patch('tenders/:id/send-to-legal')
  @Roles('LEGAL', 'PMO', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'ADMIN', 'MARKETING')
  @ApiOperation({ summary: 'DEPRECATED - Send tender to Legal (Gunakan alur Upload SPK kanonikal)' })
  async sendToLegal(@Param('id') id: number) {
    throw new HttpException(
      'Endpoint send-to-legal telah deprecated. Gunakan alur Upload SPK untuk mengirim dokumen ke Legal.',
      HttpStatus.GONE,
    );
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
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File SPK',
        },
      },
    },
  })
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
      const allowedExts = ['.pdf', '.xls', '.xlsx', '.doc', '.docx'];
      const allowedMimes = [
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      const ext = path.extname(file.originalname).toLowerCase();
      const mime = file.mimetype?.toLowerCase();

      if (allowedExts.includes(ext) && allowedMimes.includes(mime)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Format file SPK harus PDF, Excel, atau Word'), false);
      }
    },
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
  }))
  async uploadSpk(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) {
      throw new BadRequestException('File SPK wajib diupload');
    }
    validateFileSignature(file.path, file.originalname, file.mimetype);
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
  @ApiOperation({ summary: 'DEPRECATED - Verify SPK document (Gunakan modul Legal Review)' })
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
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: 'File Proposal',
        },
      },
    },
  })
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
    }),
    fileFilter: (req, file, cb) => {
      const allowedExts = ['.pdf', '.xls', '.xlsx', '.doc', '.docx'];
      const allowedMimes = [
        'application/pdf',
        'application/vnd.ms-excel',
        'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'application/msword',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      ];
      const ext = path.extname(file.originalname).toLowerCase();
      const mime = file.mimetype?.toLowerCase();

      if (allowedExts.includes(ext) && allowedMimes.includes(mime)) {
        cb(null, true);
      } else {
        cb(new BadRequestException('Format file proposal harus PDF, Excel, atau Word'), false);
      }
    },
    limits: { fileSize: 20 * 1024 * 1024 } // 20MB limit
  }))
  async uploadProposal(@Param('id', ParseIntPipe) id: number, @UploadedFile() file: Express.Multer.File, @Request() req) {
    if (!file) {
      throw new BadRequestException('File is required');
    }
    validateFileSignature(file.path, file.originalname, file.mimetype);
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

  @Post('tenders/:id/submit-go-no-go')
  @Roles('MARKETING', 'GENERAL_MANAGER', 'SUPER_ADMIN', 'DIRECTOR')
  @ApiOperation({ summary: 'Submit Tender for GO / NO GO Review (Marketing)' })
  async submitGoNoGoReview(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: SubmitGoNoGoReviewDto,
    @Request() req,
  ) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    const userRoles: string[] = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    return await this.marketingService.submitGoNoGoReview(id, dto, userId, userRoles);
  }

  @Post('tenders/:id/go-no-go')
  @Roles('DIRECTOR', 'GENERAL_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Submit GO / NO GO decision for a tender (Director/Exec)' })
  async submitGoNoGo(@Param('id', ParseIntPipe) id: number, @Body() dto: GoNoGoDto, @Request() req) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    const userRoles: string[] = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    return await this.marketingService.submitGoNoGo(id, dto, userId, userRoles);
  }

  @Get('tenders/proposals/:filename')
  @Roles('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER')
  @ApiOperation({ summary: 'Download or View Proposal Document' })
  downloadProposal(@Param('filename') filename: string, @Res() res: Response) {
    const safeFilename = path.basename(filename);
    const filePath = path.join(process.cwd(), 'uploads', 'proposals', safeFilename);
    if (!fs.existsSync(filePath)) {
      throw new NotFoundException('Proposal document not found');
    }
    return res.sendFile(filePath);
  }

  @Get('tenders/contracts/:filename')
  @Roles('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER')
  @ApiOperation({ summary: 'Download or View SPK/Contract Document' })
  async downloadContract(@Param('filename') filename: string, @Request() req, @Res() res: Response) {
    const userId = req.user?.userId || req.user?.sub || req.user?.id;
    const roles = req.user?.roles || [];
    const filePath = await this.marketingService.getContractFilePath(filename, userId, roles);
    return res.sendFile(filePath);
  }
}

