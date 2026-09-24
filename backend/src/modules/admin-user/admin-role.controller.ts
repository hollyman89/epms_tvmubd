import { Controller, Get, UseGuards } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminUserService } from './admin-user.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Admin Role Management')
@Controller('admin/roles')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminRoleController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all available system roles from database (SUPER_ADMIN only)' })
  getRoles() {
    return this.adminUserService.getRoles();
  }
}
