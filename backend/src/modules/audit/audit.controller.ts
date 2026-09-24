import { Controller, Get, Query, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiResponse } from '@nestjs/swagger';
import { AuditService, PaginatedAuditLogsResponse } from './audit.service';
import { AuditQueryDto } from './dto/audit-query.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Audit Trail')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('audit-logs')
export class AuditController {
  constructor(private readonly auditService: AuditService) {}

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get paginated audit logs with filtering and search (SUPER_ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Paginated audit logs retrieved successfully.' })
  @ApiResponse({ status: 401, description: 'Unauthorized - Missing or invalid JWT token.' })
  @ApiResponse({ status: 403, description: 'Forbidden - User does not have SUPER_ADMIN role.' })
  async getAuditLogs(@Query() query: AuditQueryDto): Promise<PaginatedAuditLogsResponse> {
    return this.auditService.getAuditLogs(query);
  }
}
