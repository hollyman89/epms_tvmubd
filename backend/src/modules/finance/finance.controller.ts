import { Controller, Post, Body, UseGuards, Request, Get, Param, ParseIntPipe, Query, Patch } from '@nestjs/common';
import { FinanceService } from './finance.service';
import { CreateInvoiceDto, CreateInvoiceTaxDto } from './dto/create-invoice.dto';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { VerifyInvoiceDto } from './dto/verify-invoice.dto';
import { SubmitPaymentRequestDto } from './dto/submit-payment-request.dto';
import { DecidePaymentRequestDto, DirectorDecisionAction } from './dto/decide-payment-request.dto';
import { ResubmitPaymentRequestDto } from './dto/resubmit-payment-request.dto';
import {
  CreateCompanyBankAccountDto,
  UpdateCompanyBankAccountDto,
  ChangeCompanyBankAccountStatusDto,
  QueryCompanyBankAccountDto,
} from './dto/company-bank-account.dto';
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
  @Roles('FINANCE')
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

  @Get('invoices/:id/tax')
  @ApiOperation({ summary: 'Get tax administration details for an invoice (PPN & PPh)' })
  @ApiResponse({ status: 200, description: 'Tax information retrieved successfully.' })
  async getInvoiceTax(@Param('id', ParseIntPipe) id: number) {
    const data = await this.financeService.getInvoiceTaxDetails(id);
    return {
      message: 'Tax information retrieved successfully',
      data,
    };
  }

  @Patch('invoices/:id/tax')
  @Roles('FINANCE')
  @ApiOperation({ summary: 'Update or record tax administration data for an existing invoice (PPN & PPh)' })
  @ApiResponse({ status: 200, description: 'Tax information updated successfully.' })
  async updateInvoiceTax(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CreateInvoiceTaxDto,
    @Request() req,
  ) {
    const invoice = await this.financeService.updateInvoiceTax(id, dto, req.user.id);
    return {
      message: 'Tax information updated successfully',
      data: invoice,
    };
  }

  @Post('invoices/:id/verify')
  @Roles('FINANCE', 'DIRECTOR')
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
  @Roles('FINANCE')
  @ApiOperation({ summary: 'Create a new Payment for an Invoice (Finance only)' })
  @ApiResponse({ status: 201, description: 'Payment successfully processed.' })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g. Invoice not MATCHED, or already PAID).' })
  async createPayment(@Body() dto: CreatePaymentDto, @Request() req) {
    const payment = await this.financeService.createPayment(dto, req.user.id);
    return {
      message: 'Payment processed successfully',
      data: payment
    };
  }

  @Post('payment-requests')
  @Roles('FINANCE')
  @ApiOperation({ summary: 'Submit a new Payment Request for Director Approval (Finance only)' })
  @ApiResponse({ status: 201, description: 'Payment Request successfully submitted.' })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g. Invoice not VERIFIED, already PAID, or active request exists).' })
  async submitPaymentRequest(@Body() dto: SubmitPaymentRequestDto, @Request() req) {
    const result = await this.financeService.submitPaymentRequest(dto, req.user.id);
    return {
      message: 'Payment request submitted successfully',
      data: result,
    };
  }

  @Get('payment-requests')
  @Roles('FINANCE', 'DIRECTOR', 'SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER')
  @ApiOperation({ summary: 'Get all Payment Requests' })
  @ApiResponse({ status: 200, description: 'Payment Requests retrieved successfully.' })
  async getPaymentRequests(@Query('status') status?: string) {
    const result = await this.financeService.getPaymentRequests(status);
    return {
      message: 'Payment requests retrieved successfully',
      data: result,
    };
  }

  @Get('payment-requests/:id')
  @Roles('FINANCE', 'DIRECTOR', 'SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER')
  @ApiOperation({ summary: 'Get Payment Request by ID' })
  @ApiResponse({ status: 200, description: 'Payment Request retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Payment Request not found.' })
  async getPaymentRequestById(@Param('id', ParseIntPipe) id: number) {
    const result = await this.financeService.getPaymentRequestById(id);
    return {
      message: 'Payment request retrieved successfully',
      data: result,
    };
  }

  @Post('payment-requests/:id/decide')
  @Roles('DIRECTOR')
  @ApiOperation({ summary: 'Director Decision on Payment Request (APPROVE, RETURN, REJECT)' })
  @ApiResponse({ status: 200, description: 'Payment Request decision recorded successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g. invalid action, missing revision notes).' })
  async decidePaymentRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: DecidePaymentRequestDto,
    @Request() req,
  ) {
    const result = await this.financeService.decidePaymentRequest(id, dto, req.user.id);
    return {
      message: `Payment request ${dto.action} successfully`,
      data: result,
    };
  }

  @Post('payment-requests/:id/approve')
  @Roles('DIRECTOR')
  @ApiOperation({ summary: 'Director Approve Payment Request' })
  async approvePaymentRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<DecidePaymentRequestDto>,
    @Request() req,
  ) {
    const result = await this.financeService.decidePaymentRequest(
      id,
      { ...dto, action: DirectorDecisionAction.APPROVE } as DecidePaymentRequestDto,
      req.user.id,
    );
    return {
      message: 'Payment request approved successfully',
      data: result,
    };
  }

  @Post('payment-requests/:id/return')
  @Roles('DIRECTOR')
  @ApiOperation({ summary: 'Director Return Payment Request for Revision' })
  async returnPaymentRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<DecidePaymentRequestDto>,
    @Request() req,
  ) {
    const result = await this.financeService.decidePaymentRequest(
      id,
      { ...dto, action: DirectorDecisionAction.RETURN } as DecidePaymentRequestDto,
      req.user.id,
    );
    return {
      message: 'Payment request returned for revision successfully',
      data: result,
    };
  }

  @Post('payment-requests/:id/reject')
  @Roles('DIRECTOR')
  @ApiOperation({ summary: 'Director Reject Payment Request' })
  async rejectPaymentRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: Partial<DecidePaymentRequestDto>,
    @Request() req,
  ) {
    const result = await this.financeService.decidePaymentRequest(
      id,
      { ...dto, action: DirectorDecisionAction.REJECT } as DecidePaymentRequestDto,
      req.user.id,
    );
    return {
      message: 'Payment request rejected successfully',
      data: result,
    };
  }

  @Post('payment-requests/:id/resubmit')
  @Roles('FINANCE')
  @ApiOperation({ summary: 'Finance Resubmit returned Payment Request' })
  @ApiResponse({ status: 200, description: 'Payment Request resubmitted successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request (e.g. status is not NEEDS_REVISION).' })
  async resubmitPaymentRequest(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ResubmitPaymentRequestDto,
    @Request() req,
  ) {
    const result = await this.financeService.resubmitPaymentRequest(id, dto, req.user.id);
    return {
      message: 'Payment request resubmitted successfully',
      data: result,
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

  // =========================================================================
  // COMPANY BANK ACCOUNT MASTER DATA ENDPOINTS
  // =========================================================================

  @Post('company-bank-accounts')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Create new Company Bank Account (SUPER_ADMIN / ADMIN only)' })
  @ApiResponse({ status: 201, description: 'Company bank account created successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request (validation failure or missing reason).' })
  @ApiResponse({ status: 409, description: 'Conflict (duplicate account per legal entity).' })
  async createCompanyBankAccount(@Body() dto: CreateCompanyBankAccountDto, @Request() req) {
    const result = await this.financeService.createCompanyBankAccount(dto, req.user.id);
    return {
      message: 'Rekening bank perusahaan berhasil didaftarkan',
      data: result,
    };
  }

  @Get('company-bank-accounts/eligible')
  @Roles('SUPER_ADMIN', 'ADMIN', 'FINANCE')
  @ApiOperation({ summary: 'Get eligible active Company Bank Accounts for payment execution' })
  @ApiResponse({ status: 200, description: 'Eligible accounts retrieved successfully.' })
  async getEligibleCompanyBankAccounts(@Query('companyCode') companyCode?: string) {
    const result = await this.financeService.getEligibleCompanyBankAccounts(companyCode);
    return {
      message: 'Daftar rekening bank perusahaan yang eligible berhasil diambil',
      data: result,
    };
  }

  @Get('company-bank-accounts')
  @Roles('SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'FINANCE', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Get list of Company Bank Accounts' })
  @ApiResponse({ status: 200, description: 'Company bank accounts retrieved successfully.' })
  async getCompanyBankAccounts(@Query() query: QueryCompanyBankAccountDto) {
    const result = await this.financeService.getCompanyBankAccounts(query);
    return {
      message: 'Daftar rekening bank perusahaan berhasil diambil',
      data: result,
    };
  }

  @Get('company-bank-accounts/:id')
  @Roles('SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'FINANCE', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Get Company Bank Account by ID' })
  @ApiResponse({ status: 200, description: 'Account retrieved successfully.' })
  @ApiResponse({ status: 404, description: 'Account not found.' })
  async getCompanyBankAccountById(@Param('id', ParseIntPipe) id: number) {
    const result = await this.financeService.getCompanyBankAccountById(id);
    return {
      message: 'Detail rekening bank perusahaan berhasil diambil',
      data: result,
    };
  }

  @Patch('company-bank-accounts/:id')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Update Company Bank Account metadata (SUPER_ADMIN / ADMIN only)' })
  @ApiResponse({ status: 200, description: 'Account updated successfully.' })
  @ApiResponse({ status: 400, description: 'Bad Request (validation error or missing change reason).' })
  @ApiResponse({ status: 409, description: 'Conflict (duplicate account).' })
  async updateCompanyBankAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateCompanyBankAccountDto,
    @Request() req,
  ) {
    const result = await this.financeService.updateCompanyBankAccount(id, dto, req.user.id);
    return {
      message: 'Data rekening bank perusahaan berhasil diperbarui',
      data: result,
    };
  }

  @Post('company-bank-accounts/:id/activate')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Activate Company Bank Account' })
  async activateCompanyBankAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeCompanyBankAccountStatusDto,
    @Request() req,
  ) {
    const result = await this.financeService.activateCompanyBankAccount(id, dto.changeReason, req.user.id);
    return {
      message: 'Rekening bank perusahaan berhasil diaktifkan',
      data: result,
    };
  }

  @Post('company-bank-accounts/:id/deactivate')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Deactivate Company Bank Account' })
  async deactivateCompanyBankAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeCompanyBankAccountStatusDto,
    @Request() req,
  ) {
    const result = await this.financeService.deactivateCompanyBankAccount(id, dto.changeReason, req.user.id);
    return {
      message: 'Rekening bank perusahaan berhasil dinonaktifkan',
      data: result,
    };
  }

  @Post('company-bank-accounts/:id/block')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Block Company Bank Account' })
  async blockCompanyBankAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeCompanyBankAccountStatusDto,
    @Request() req,
  ) {
    const result = await this.financeService.blockCompanyBankAccount(id, dto.changeReason, req.user.id);
    return {
      message: 'Rekening bank perusahaan berhasil diblokir',
      data: result,
    };
  }

  @Post('company-bank-accounts/:id/set-default')
  @Roles('SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Designate default Company Bank Account for legal entity' })
  async setDefaultCompanyBankAccount(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ChangeCompanyBankAccountStatusDto,
    @Request() req,
  ) {
    const result = await this.financeService.setDefaultCompanyBankAccount(id, dto.changeReason, req.user.id);
    return {
      message: 'Rekening utama (default) berhasil ditetapkan',
      data: result,
    };
  }

  @Get('company-bank-accounts/:id/history')
  @Roles('SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'FINANCE', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Get audit history for Company Bank Account' })
  async getCompanyBankAccountHistory(@Param('id', ParseIntPipe) id: number) {
    const result = await this.financeService.getCompanyBankAccountHistory(id);
    return {
      message: 'Riwayat perubahan rekening bank perusahaan berhasil diambil',
      data: result,
    };
  }
}

