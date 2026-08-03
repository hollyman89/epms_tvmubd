import { Controller, Post, Body, UseGuards, Request, Get, Param } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';

@ApiTags('Finance')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('finance')
export class FinanceController {
  constructor(private readonly financeService: FinanceService) {}

  @Post('invoices')
  @ApiOperation({ summary: 'Create a new Invoice (Triggers 3-Way Matching)' })
  @ApiResponse({ status: 201, description: 'Invoice successfully created.' })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g. PO is not COMPLETED).' })
  async createInvoice(@Body() dto: CreateInvoiceDto, @Request() req) {
    const invoice = await this.financeService.createInvoice(dto, req.user.id);
    return {
      message: 'Invoice created successfully',
      data: invoice
    };
  }

  @Post('payments')
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
  @ApiOperation({ summary: 'Get all Invoices' })
  async getInvoices() {
    const invoices = await this.financeService.getInvoices();
    return {
      message: 'Invoices retrieved successfully',
      data: invoices
    };
  }

  @Get('payments')
  @ApiOperation({ summary: 'Get all Payments' })
  async getPayments() {
    const payments = await this.financeService.getPayments();
    return {
      message: 'Payments retrieved successfully',
      data: payments
    };
  }
}
