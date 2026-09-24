import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards, Request, HttpStatus, Query, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { LegalService } from './legal.service';
import { SlaGraceService } from './sla-grace.service';
import { LegalReviewDto } from './dto/legal-review.dto';

@ApiTags('Legal & SLA Grace Engine')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('legal')
export class LegalController {
  constructor(
    private readonly legalService: LegalService,
    private readonly slaGraceService: SlaGraceService,
  ) {}

  @Get('contracts/pending')
  @Roles('LEGAL', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR')
  @ApiOperation({ summary: 'Get contracts for legal review with optional status filter (ALL, PENDING, APPROVED, REJECTED, REVISION_REQUESTED)' })
  @ApiQuery({ name: 'status', required: false, enum: ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED'] })
  async getPendingContracts(@Query('status') status?: string) {
    return await this.legalService.getPendingContracts(status);
  }

  @Get('contracts')
  @Roles('LEGAL', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR')
  @ApiOperation({ summary: 'RESTful endpoint to get contracts filtered by status' })
  @ApiQuery({ name: 'status', required: false, enum: ['ALL', 'PENDING', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED'] })
  async getContracts(@Query('status') status?: string) {
    return await this.legalService.getContractsByStatus(status);
  }

  @Post('contracts/review')
  @Roles('LEGAL', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR')
  @ApiOperation({ summary: 'Submit a legal review for a contract/proposal (Legal/Admin only)' })
  async reviewContract(@Body() dto: LegalReviewDto, @Request() req: any) {
    const userId = req.user?.sub || req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    return await this.legalService.reviewContract(dto, userId);
  }

  @Post('review')
  @Roles('LEGAL', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR')
  @ApiOperation({ summary: 'Submit a legal review for a contract/proposal (alias)' })
  async reviewContractAlias(@Body() dto: LegalReviewDto, @Request() req: any) {
    const userId = req.user?.sub || req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    return await this.legalService.reviewContract(dto, userId);
  }

  @Post('contracts/:id/grace-extension')
  @Roles('MARKETING', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Request SLA grace deadline extension (+3 days max 3x limit)' })
  @ApiResponse({ status: 200, description: 'Grace SLA deadline extended successfully' })
  @ApiResponse({ status: 400, description: 'Maksimal perpanjangan Grace SLA (3x) telah tercapai' })
  async requestGraceExtension(
    @Param('id', ParseIntPipe) id: number,
    @Body('daysToAdd') daysToAdd: number = 3,
    @Body('reason') reason: string,
    @Request() req: any,
  ) {
    const userId = req.user?.sub || req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    return await this.slaGraceService.requestGraceExtension(id, daysToAdd || 3, userId, reason);
  }

  @Get('sla/grace-widget')
  @ApiOperation({ summary: 'Fetch active SLA grace extensions for dashboard widget' })
  async getActiveGraceWidget() {
    const activeExtensions = await this.slaGraceService.getActiveGraceExtensions();
    return {
      statusCode: HttpStatus.OK,
      message: 'Active SLA grace extensions retrieved successfully',
      data: activeExtensions,
    };
  }

  @Get('contracts/:id/pdf-generation-status')
  @ApiOperation({ summary: 'Polling status asinkron PDF Generation' })
  async getPdfGenerationStatus(@Param('id', ParseIntPipe) id: number) {
    // Mock implementation for staging to force fallback to clean PDF dummy
    return {
      statusCode: HttpStatus.OK,
      data: {
        status: 'FAILED',
        downloadUrl: null,
        retryAfter: 2,
        errorDetails: 'S3 not configured in staging. Fallback to clean dummy.'
      }
    };
  }

  @Post('start-project')
  @Roles('PMO', 'PROJECT_MANAGER', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR')
  @ApiOperation({ summary: 'Inisiasi Proyek Operasional dari SPK (PMO Handover)' })
  async startProject(@Body() dto: { tenderId: number; managerId?: number }, @Request() req: any) {
    const userId = req.user?.sub || req.user?.userId || req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('Identitas pengguna tidak ditemukan pada token');
    }
    return await this.legalService.startProject(dto, userId);
  }
}
