import { Controller, Get, UseGuards, UseInterceptors } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('summary')
  @Roles('SUPER_ADMIN', 'GENERAL_MANAGER', 'ADMIN') // Admin included for testing
  @UseInterceptors(CacheInterceptor)
  @CacheKey('dashboard_summary')
  @CacheTTL(30000) // 30 seconds
  @ApiOperation({ summary: 'Get Dashboard KPI Summary' })
  @ApiResponse({ status: 200, description: 'Summary retrieved successfully.' })
  async getSummary() {
    const data = await this.dashboardService.getSummary();
    return {
      message: 'Dashboard summary retrieved successfully',
      data
    };
  }

  @Get('project-trend')
  @Roles('SUPER_ADMIN', 'GENERAL_MANAGER', 'ADMIN')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('dashboard_project_trend')
  @CacheTTL(60000)
  @ApiOperation({ summary: 'Get Project Trend Chart Data' })
  @ApiResponse({ status: 200, description: 'Trend retrieved successfully.' })
  async getProjectTrend() {
    const data = await this.dashboardService.getProjectTrend();
    return {
      message: 'Project trend retrieved successfully',
      data
    };
  }

  @Get('procurement-pending')
  @Roles('SUPER_ADMIN', 'GENERAL_MANAGER', 'ADMIN')
  @UseInterceptors(CacheInterceptor)
  @CacheKey('dashboard_procurement_pending')
  @CacheTTL(15000)
  @ApiOperation({ summary: 'Get Pending Approvals for Procurement' })
  @ApiResponse({ status: 200, description: 'Pending list retrieved successfully.' })
  async getProcurementPending() {
    const data = await this.dashboardService.getProcurementPending();
    return {
      message: 'Pending approvals retrieved successfully',
      data
    };
  }
}
