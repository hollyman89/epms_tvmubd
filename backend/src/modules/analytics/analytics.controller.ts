import { Controller, Get, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { AnalyticsService } from './analytics.service';
import { GetAnalyticsQueryDto } from './dto/get-analytics.dto';

@ApiTags('Analytics')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('analytics') // Sesuai Amandemen 2 (dikombinasikan dengan global prefix /api/v1)
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('dashboard')
  @ApiOperation({ summary: 'Get Dashboard Analytics Data' })
  async getDashboardAnalytics(@Query() query: GetAnalyticsQueryDto, @Request() req) {
    const data = await this.analyticsService.getDashboardAnalytics(query, req.user.userId, req.user.roles);
    return {
      status: 'success',
      data,
    };
  }

  @Get('marketing-performance')
  @UseGuards(RolesGuard)
  @Roles('SUPER_ADMIN', 'DIRECTOR', 'MANAGER', 'GENERAL_MANAGER')
  @ApiOperation({ summary: 'Get Marketing Performance Breakdown per PIC' })
  async getMarketingPerformance(@Query() query: GetAnalyticsQueryDto) {
    const data = await this.analyticsService.getMarketingPerformance(query);
    return {
      status: 'success',
      data,
    };
  }
}
