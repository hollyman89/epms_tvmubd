import { Controller, Post, Body, UseGuards, Request, Get, Param, ParseIntPipe, Query } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyInvoiceDto } from './dto/verify-invoice.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('invoices')
  @Roles('FINANCE', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Create a new Invoice (Term-Based or Legacy 3-Way Matching)' })
  @ApiResponse({ status: 201, description: 'Invoice successfully created.' })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g. PO is not COMPLETED or invalid term).' })
  async createInvoice(@Body() dto: CreateInvoiceDto, @Request() req) {
    const invoice = await this.financeService.createInvoice(dto, req.user.id);
    return {
      message: 'Invoice created successfully',
      data: invoice
    };
  }

  @Post('invoices/:id/verify')
  @Roles('FINANCE', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR')
  @ApiOperation({ summary: 'Finance Verification for Invoice (Term-Based or Legacy)' })
  @ApiResponse({ status: 200, description: 'Invoice verification evaluated successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g. already verified, invalid term, or missing prerequisite).' })
  async verifyInvoice(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: VerifyInvoiceDto,
    @Request() req,
  ) {
    const result = await this.financeService.verifyInvoice(id, dto, req.user.id);
    return {
      message: dto.approved ? 'Invoice verification approved successfully' : 'Invoice verification rejected',
      data: result,
    };
  }

  @Get('invoices/:id/matching')
  @Roles('FINANCE', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR')
  @ApiOperation({ summary: 'Get Read-Only Invoice Matching and Verification Preview' })
  @ApiResponse({ status: 200, description: 'Invoice matching preview retrieved successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g. invoice not found).' })
  async getInvoiceMatchingData(
    @Param('id', ParseIntPipe) id: number,
    @Query('vendorId') vendorId?: number,
    @Query('goodsReceiptId') goodsReceiptId?: number,
    @Query('evidenceRef') evidenceRef?: string,
  ) {
    const result = (goodsReceiptId !== undefined || evidenceRef !== undefined)
      ? await this.financeService.getInvoiceMatchingData(
          id,
          vendorId ? Number(vendorId) : undefined,
          goodsReceiptId ? Number(goodsReceiptId) : undefined,
          evidenceRef,
        )
      : await this.financeService.getInvoiceMatchingData(
          id,
          vendorId ? Number(vendorId) : undefined,
        );
    return {
      message: 'Invoice matching data retrieved successfully',
      data: result,
    };
  }

  @Post('payments')
  @Roles('FINANCE', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER')
  @ApiOperation({ summary: 'Create a new Payment for an Invoice' })
  @ApiResponse({ status: 201, description: 'Payment successfully processed.' })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g. Invoice not MATCHED, or already PAID).' })
  async createPayment(@Body() dto: CreatePaymentDto, @Request() req) {
    const payment = await this.financeService.createPayment(dto, req.user.id);
    return {
      message: 'Payment processed successfully',
      data: payment
    };
  }

  @Get('invoices')
  @Roles('FINANCE', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER')
  @ApiOperation({ summary: 'Get all Invoices' })
  async getInvoices() {
    const invoices = await this.financeService.getInvoices();
    return {
      message: 'Invoices retrieved successfully',
      data: invoices
    };
  }

  @Get('invoices/:id')
  @Roles('FINANCE', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER')
  @ApiOperation({ summary: 'Get Invoice by ID' })
  async getInvoiceById(@Param('id', ParseIntPipe) id: number) {
    const invoice = await this.financeService.getInvoiceById(id);
    return {
      message: 'Invoice retrieved successfully',
      data: invoice
    };
  }

  @Get('payments')
  @Roles('FINANCE', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'PROJECT_MANAGER')
  @ApiOperation({ summary: 'Get all Payments' })
  async getPayments() {
    const payments = await this.financeService.getPayments();
    return {
      message: 'Payments retrieved successfully',
      data: payments
    };
  }

  @Get('purchase-orders/:id/payment-summary')
  @Roles('FINANCE', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER')
  @ApiOperation({ summary: 'Get PO payment summary (total paid, outstanding, paid percentage)' })
  async getPoPaymentSummary(@Param('id', ParseIntPipe) id: number) {
    const summary = await this.financeService.getPoPaymentSummary(id);
    return {
      message: 'PO payment summary retrieved successfully',
      data: summary,
    };
  }
}

