import { Controller, Get, Post, Body, Patch, Param, Delete, UseGuards, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { AdminUserService } from './admin-user.service';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateRoleDto } from './dto/update-role.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Admin User Management')
@Controller('admin/users')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
export class AdminUserController {
  constructor(private readonly adminUserService: AdminUserService) {}

  @Get('roles')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all available system roles from database (SUPER_ADMIN only)' })
  getRoles() {
    return this.adminUserService.getRoles();
  }

  @Get()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Get all users with pagination' })
  findAll(
    @Query('role') role?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    const pageNum = page ? parseInt(page, 10) : 1;
    const limitNum = limit ? parseInt(limit, 10) : 10;
    return this.adminUserService.findAll(role, pageNum, limitNum);
  }

  @Post()
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Create new user (SUPER_ADMIN only)' })
  create(@Body() createUserDto: CreateUserDto) {
    return this.adminUserService.createUser(createUserDto);
  }

  @Patch(':id/roles')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Update user role (SUPER_ADMIN only)' })
  updateRole(@Param('id') id: string, @Body() updateRoleDto: UpdateRoleDto) {
    return this.adminUserService.updateRole(+id, updateRoleDto);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Soft delete a user (SUPER_ADMIN only)' })
  remove(@Param('id') id: string) {
    return this.adminUserService.removeUser(+id);
  }
}
