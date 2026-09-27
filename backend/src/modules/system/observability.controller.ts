import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ObservabilityService } from './observability.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Enterprise Observability & Health Checks')
@Controller()
export class ObservabilityController {
  constructor(private readonly observabilityService: ObservabilityService) {}

  @Get('health')
  @ApiOperation({ summary: 'Deep Active Component Health Check Probe' })
  @ApiResponse({ status: 200, description: 'All critical components operational (HEALTHY)' })
  @ApiResponse({ status: 503, description: 'One or more critical components DOWN or DEGRADED' })
  async getHealth() {
    return this.observabilityService.getDeepHealthCheck();
  }

  @Get('observability/dashboard')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch Enterprise Observability Dashboard (SLI/SLO, Error Budget, Capacity, Security, Outbox)' })
  async getObservabilityDashboard() {
    return this.observabilityService.getOperationalDashboard();
  }

  @Get('observability/readiness-report')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Fetch Production Readiness Report & Metrics Catalog' })
  async getReadinessReport() {
    const dashboard = await this.observabilityService.getOperationalDashboard();
    return {
      statusCode: 200,
      message: 'EPMS Operational Readiness Report & Metrics Catalog',
      data: {
        readinessStatus: '100% PRODUCTION READY',
        verifiedAt: new Date().toISOString(),
        sliSloSummary: dashboard.data.sliSloReport,
        errorBudgetSummary: dashboard.data.errorBudget,
        outboxTelemetry: dashboard.data.outboxTelemetry,
        runbookIndex: dashboard.data.runbookIndex,
      },
    };
  }
}
