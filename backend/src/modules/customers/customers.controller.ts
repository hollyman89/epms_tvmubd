import { Controller, Post, Get, Patch, Delete, Body, Param, Query, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { CustomersService } from './customers.service';
import { CreateCustomerDto, UpdateCustomerDto, CustomerQueryDto } from './dto/customer.dto';

@ApiTags('Customers')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Post()
  @Roles('MARKETING', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new Customer' })
  async create(@Body() dto: CreateCustomerDto, @Request() req) {
    return await this.customersService.create(dto, req.user.userId);
  }

  @Get()
  @Roles('MARKETING', 'SUPER_ADMIN', 'DIRECTOR')
  @ApiOperation({ summary: 'Get all customers with pagination and filters' })
  async findAll(@Query() query: CustomerQueryDto) {
    return await this.customersService.findAll(query);
  }

  @Get('export')
  @Roles('MARKETING', 'SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR')
  @ApiOperation({ summary: 'Export customers list' })
  async export() {
    return await this.customersService.exportCustomers();
  }

  @Post('import')
  @Roles('MARKETING', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Import customers list' })
  async import(@Body() body: { items: any[] }, @Request() req) {
    return await this.customersService.importCustomers(body.items || [], req.user?.userId || req.user?.id);
  }

  @Get(':id')
  @Roles('MARKETING', 'SUPER_ADMIN', 'DIRECTOR')
  @ApiOperation({ summary: 'Get details of a specific customer' })
  async findOne(@Param('id') id: number) {
    return await this.customersService.findOne(id);
  }

  @Patch(':id')
  @Roles('MARKETING', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update customer details' })
  async update(@Param('id') id: number, @Body() dto: UpdateCustomerDto, @Request() req) {
    return await this.customersService.update(id, dto, req.user.userId);
  }

  @Delete(':id')
  @Roles('SUPER_ADMIN')
  @ApiOperation({ summary: 'Soft delete a customer' })
  async remove(@Param('id') id: number, @Request() req) {
    return await this.customersService.remove(id, req.user.userId);
  }
}
