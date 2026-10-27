import { Controller, Get, Query, Request, HttpStatus, UseGuards, UseInterceptors } from '@nestjs/common';
import { DashboardService } from './dashboard.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { CacheInterceptor, CacheKey, CacheTTL } from '@nestjs/cache-manager';
import { GetExecutiveSummaryDto } from './dto/get-executive-summary.dto';

@ApiTags('Dashboard')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('dashboard')
export class DashboardController {
  constructor(private readonly dashboardService: DashboardService) {}

  @Get('divisions')
  @Roles('ADMIN', 'SUPER_ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'GM_MARKETING')
  @ApiOperation({ summary: 'Get Authorized Divisions for Executive Filtering' })
  @ApiResponse({ status: 200, description: 'Authorized divisions retrieved successfully.' })
  async getDivisions(@Request() req: any) {
    const rawRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const roles: string[] = rawRoles.map((r: any) =>
      typeof r === 'string' ? r : r?.name || String(r),
    );
    const data = await this.dashboardService.getAuthorizedDivisions(roles);
    return {
      statusCode: HttpStatus.OK,
      message: 'Authorized divisions retrieved successfully',
      data,
    };
  }

  @Get('executive-summary')
  @Roles('ADMIN', 'SUPER_ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'GM_MARKETING')
  @ApiOperation({ summary: 'Get Executive Management Summary (Aggregated Cross-Module Real KPI)' })
  @ApiResponse({ status: 200, description: 'Executive summary retrieved successfully.' })
  @ApiResponse({ status: 400, description: 'Invalid division identifier or unsupported division scope.' })
  @ApiResponse({ status: 403, description: 'Forbidden. Accessible only by authorized management roles.' })
  async getExecutiveSummary(@Query() query: GetExecutiveSummaryDto, @Request() req: any) {
    const userId = Number(req.user?.userId ?? req.user?.id ?? req.user?.sub);
    const rawRoles = req.user?.roles || (req.user?.role ? [req.user.role] : []);
    const roles: string[] = rawRoles.map((r: any) =>
      typeof r === 'string' ? r : r?.name || String(r),
    );

    const requestedScope = query.scope || query.divisionId;

    // CP1 & CP2: Validate division parameter against authorized organizational scope
    await this.dashboardService.validateDivision(requestedScope, roles);

    const data = await this.dashboardService.getExecutiveSummary(
      { ...query, divisionId: requestedScope },
      userId,
      roles,
    );
    return {
      statusCode: HttpStatus.OK,
      message: 'Executive summary retrieved successfully',
      data,
    };
  }

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
