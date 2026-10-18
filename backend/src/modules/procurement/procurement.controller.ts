import { Controller, Post, Get, Put, Patch, Delete, Param, Body, Query, UseGuards, Request, ParseIntPipe, NotFoundException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProcurementService } from './procurement.service';
import { ProcurementPackageService } from './procurement-package.service';
import { ServiceClaimService } from './service-claim.service';
import { CreatePurchaseRequestDto } from './dto/create-pr.dto';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { CreateQuotationDto } from './dto/create-quotation.dto';
import { SubmitVendorComparisonDto } from './dto/vendor-comparison.dto';
import { CreatePurchaseOrderDto } from './dto/create-po.dto';
import { CreateGoodsReceiptDto } from './dto/create-gr.dto';
import { CreateVendorDto, UpdateVendorDto, VendorQueryDto } from './dto/vendor.dto';
import {
  CreatePackageDraftDto,
  UpdatePackageDraftDto,
  ReturnPackageDto,
  CancelPackageDto,
  QueryPackageDto,
} from './dto/procurement-package.dto';
import { CreateServiceClaimDto } from './dto/create-service-claim.dto';
import { UpdateServiceClaimDto } from './dto/update-service-claim.dto';
import { QueryServiceClaimDto } from './dto/query-service-claim.dto';
import { CancelServiceClaimDto } from './dto/cancel-service-claim.dto';
import { TechnicalVerificationDto } from './dto/technical-verification.dto';
import { CommercialVerificationDto } from './dto/commercial-verification.dto';
import {
  CreateServiceOrderDto,
  UpdateServiceOrderDto,
  CancelServiceOrderDto,
  QueryServiceOrderDto,
} from './dto/service-order.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles, DenyRoles } from '../auth/decorators/roles.decorator';

@ApiTags('Procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('procurement')
export class ProcurementController {
  constructor(
    private readonly procurementService: ProcurementService,
    private readonly packageService: ProcurementPackageService,
    private readonly serviceClaimService: ServiceClaimService,
  ) {}

  @Get('summary')
  @Roles('PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS', 'FINANCE')
  @ApiOperation({ summary: 'Get Procurement Dashboard summary counts' })
  async getDashboardSummary() {
    return this.procurementService.getDashboardSummary();
  }

  @Get('pr')
  @Roles('PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS', 'FINANCE')
  @ApiOperation({ summary: 'Get all Purchase Requests' })
  async getAllPurchaseRequests() {
    return this.procurementService.getAllPurchaseRequests();
  }

  @Get('pr/:id')
  @Roles('PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS', 'FINANCE')
  @ApiOperation({ summary: 'Get Purchase Request by ID' })
  async getPurchaseRequestById(@Param('id', ParseIntPipe) id: number) {
    return this.procurementService.getPurchaseRequestById(id);
  }

  @Post('pr')
  @Roles('PROJECT_MANAGER', 'PMO', 'PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN', 'ADMIN', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Create a new Purchase Request and Submit to Workflow' })
  async createAndSubmitPurchaseRequest(@Request() req, @Body() dto: CreatePurchaseRequestDto) {
    const userId = req.user.userId;
    return this.procurementService.createAndSubmitPurchaseRequest(userId, dto);
  }

  @Post('pr/:id/cancel')
  @Roles('PURCHASING', 'PROCUREMENT', 'SUPER_ADMIN', 'ADMIN', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Cancel a Purchase Request and synchronize linked package' })
  async cancelPurchaseRequest(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason: string,
  ) {
    const userId = Number(req.user?.userId || req.user?.id || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.procurementService.cancelPurchaseRequest(id, userId, roles, reason);
  }

  @Get('rfqs')
  @Roles('PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS', 'FINANCE')
  @ApiOperation({ summary: 'Get all RFQs' })
  async getAllRfqs() {
    return this.procurementService.getAllRfqs();
  }

  @Get('rfqs/:rfqId')
  @Roles('PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS', 'FINANCE')
  @ApiOperation({ summary: 'Get RFQ details by ID' })
  async getRfqById(@Param('rfqId', ParseIntPipe) rfqId: number) {
    return this.procurementService.getRfqById(rfqId);
  }

  @Post('rfqs/:id/cancel')
  @Roles('PURCHASING', 'PROCUREMENT')
  @DenyRoles('ADMIN', 'SUPER_ADMIN', 'PROJECT_MANAGER', 'DIRECTOR', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Cancel an RFQ' })
  async cancelRfq(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason: string,
  ) {
    const userId = Number(req.user?.userId || req.user?.id || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.procurementService.cancelRfq(id, userId, roles, reason);
  }

  @Get('rfqs/:rfqId/quotations')
  @Roles('PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS', 'FINANCE')
  @ApiOperation({ summary: 'Get all quotations for an RFQ' })
  async getQuotationsByRfq(@Param('rfqId', ParseIntPipe) rfqId: number) {
    return this.procurementService.getQuotationsByRfq(rfqId);
  }

  @Get('quotations/:quotationId')
  @Roles('PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS', 'FINANCE')
  @ApiOperation({ summary: 'Get quotation details by ID' })
  async getQuotationById(@Param('quotationId', ParseIntPipe) quotationId: number) {
    return this.procurementService.getQuotationById(quotationId);
  }

  @Post('quotations')
  @Roles('PROCUREMENT', 'PURCHASING')
  @ApiOperation({ summary: 'Submit a new vendor quotation for an RFQ' })
  async createQuotation(@Request() req, @Body() dto: CreateQuotationDto) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.procurementService.createQuotation(dto, userId);
  }

  @Get('vendors')
  @Roles('PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS', 'FINANCE')
  @ApiOperation({ summary: 'Get all Vendor Master records (with optional search and pagination)' })
  async getAllVendors(@Query() query: VendorQueryDto) {
    return this.procurementService.getAllVendors(query);
  }

  @Get('vendors/:vendorId')
  @Roles('PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS', 'FINANCE')
  @ApiOperation({ summary: 'Get Vendor Master record detail by ID' })
  async getVendorById(@Param('vendorId', ParseIntPipe) vendorId: number) {
    return this.procurementService.getVendorById(vendorId);
  }

  @Post('vendors')
  @Roles('PROCUREMENT', 'PURCHASING', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new Vendor Master record' })
  async createVendor(@Request() req, @Body() dto: CreateVendorDto) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.procurementService.createVendor(dto, userId);
  }

  @Patch('vendors/:vendorId')
  @Roles('PROCUREMENT', 'PURCHASING', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update an existing Vendor Master record' })
  async updateVendor(
    @Request() req,
    @Param('vendorId', ParseIntPipe) vendorId: number,
    @Body() dto: UpdateVendorDto,
  ) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.procurementService.updateVendor(vendorId, dto, userId);
  }

  @Put('vendors/:vendorId')
  @Roles('PROCUREMENT', 'PURCHASING', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update an existing Vendor Master record (PUT compatibility)' })
  async updateVendorPut(
    @Request() req,
    @Param('vendorId', ParseIntPipe) vendorId: number,
    @Body() dto: UpdateVendorDto,
  ) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.procurementService.updateVendor(vendorId, dto, userId);
  }

  @Delete('vendors/:vendorId')
  @Roles('PROCUREMENT', 'PURCHASING', 'ADMIN', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Soft-delete a Vendor Master record' })
  async deleteVendor(
    @Request() req,
    @Param('vendorId', ParseIntPipe) vendorId: number,
  ) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.procurementService.softDeleteVendor(vendorId, userId);
  }

  @Post('rfqs')
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Create a new RFQ from a Purchase Request' })
  async createRfq(@Request() req, @Body() dto: CreateRfqDto) {
    return this.procurementService.createRfq(dto);
  }


  @Post('vendor-comparison')
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Submit vendor comparison for an RFQ (min 3 vendors)' })
  async submitVendorComparison(@Body() dto: SubmitVendorComparisonDto) {
    return this.procurementService.submitVendorComparison(dto.rfqId, dto.vendors);
  }

  @Get('purchase-orders')
  @Roles('PROCUREMENT', 'PURCHASING', 'FINANCE', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Get all Purchase Orders' })
  async getAllPurchaseOrders() {
    return this.procurementService.getAllPurchaseOrders();
  }

  @Post('purchase-orders')
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Create a new Purchase Order' })
  async createPurchaseOrder(@Request() req, @Body() dto: CreatePurchaseOrderDto) {
    const userId = req.user.userId;
    return this.procurementService.createPurchaseOrder(userId, dto);
  }

  @Get('purchase-orders/:purchaseOrderId')
  @Roles('PROCUREMENT', 'PURCHASING', 'FINANCE', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Get Purchase Order details by ID' })
  async getPurchaseOrderById(@Param('purchaseOrderId', ParseIntPipe) purchaseOrderId: number) {
    return this.procurementService.getPurchaseOrderById(purchaseOrderId);
  }

  @Post('goods-receipts')
  @Roles('PROCUREMENT', 'PURCHASING')
  @ApiOperation({ summary: 'Create a new Goods Receipt for a Purchase Order' })
  async createGoodsReceipt(@Request() req, @Body() dto: CreateGoodsReceiptDto) {
    const userId = req.user.userId;
    return this.procurementService.createGoodsReceipt(dto, userId);
  }

  @Get('goods-receipts')
  @Roles('PROCUREMENT', 'PURCHASING', 'FINANCE', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Get all Goods Receipts' })
  async getAllGoodsReceipts() {
    return this.procurementService.getAllGoodsReceipts();
  }

  @Get('goods-receipts/:goodsReceiptId')
  @Roles('PROCUREMENT', 'PURCHASING', 'FINANCE', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Get Goods Receipt details by ID' })
  async getGoodsReceiptById(@Param('goodsReceiptId', ParseIntPipe) goodsReceiptId: number) {
    return this.procurementService.getGoodsReceiptById(goodsReceiptId);
  }

  // --- PROCUREMENT PACKAGES ENDPOINTS (PHASE 2 CANONICAL) ---

  @Post('packages')
  @Roles('PROJECT_MANAGER')
  @ApiOperation({ summary: 'Create a new Procurement Package draft (PM)' })
  async createPackageDraft(@Request() req, @Body() dto: CreatePackageDraftDto) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.createDraft(userId, roles, dto);
  }

  @Get('packages')
  @Roles('PROJECT_MANAGER', 'PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'List Procurement Packages (Pure Read, PM scoped by project)' })
  async getPackages(@Request() req, @Query() query: QueryPackageDto) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.findAll(userId, roles, query);
  }

  @Get('packages/:id')
  @Roles('PROJECT_MANAGER', 'PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get Procurement Package detail by ID (Pure Read)' })
  async getPackageById(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.findOne(id, userId, roles);
  }

  @Put('packages/:id')
  @Roles('PROJECT_MANAGER')
  @ApiOperation({ summary: 'Update a draft Procurement Package (PM)' })
  async updatePackageDraft(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePackageDraftDto,
  ) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.updateDraft(id, userId, roles, dto);
  }

  @Patch('packages/:id')
  @Roles('PROJECT_MANAGER')
  @ApiOperation({ summary: 'Update a draft Procurement Package (PM - PATCH compatibility)' })
  async updatePackageDraftPatch(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePackageDraftDto,
  ) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.updateDraft(id, userId, roles, dto);
  }

  @Delete('packages/:id')
  @Roles('PROJECT_MANAGER')
  @ApiOperation({ summary: 'Delete a draft Procurement Package (PM)' })
  async deletePackageDraft(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.deleteDraft(id, userId, roles);
  }

  @Post('packages/:id/submit')
  @Roles('PROJECT_MANAGER')
  @ApiOperation({ summary: 'Submit a Procurement Package to Procurement Intake (PM)' })
  async submitPackage(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.submitPackage(id, userId, roles);
  }

  @Post('packages/:id/resubmit')
  @Roles('PROJECT_MANAGER')
  @ApiOperation({ summary: 'Resubmit a RETURNED Procurement Package (PM)' })
  async resubmitPackage(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.resubmitPackage(id, userId, roles);
  }

  @Post('packages/:id/return')
  @Roles('PROCUREMENT', 'PURCHASING')
  @ApiOperation({ summary: 'Return a Procurement Package to PM for revision (Procurement / Purchasing)' })
  async returnPackage(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ReturnPackageDto,
  ) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.returnPackage(id, userId, roles, dto);
  }

  @Post('packages/:id/cancel')
  @Roles('PROJECT_MANAGER')
  @ApiOperation({ summary: 'Cancel a Procurement Package (PM)' })
  async cancelPackage(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelPackageDto,
  ) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.cancelPackage(id, userId, roles, dto);
  }

  @Post('packages/:id/create-pr')
  @Roles('PROCUREMENT', 'PURCHASING')
  @ApiOperation({ summary: 'Create a Purchase Request from a submitted Procurement Package' })
  async createPrFromPackage(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.createPrFromPackage(id, userId, roles);
  }

  @Post('packages/create-and-submit')
  @Roles('PROJECT_MANAGER')
  @ApiOperation({ summary: 'Create and submit a Procurement Package in one step (PM)' })
  async createAndSubmitPackage(@Request() req, @Body() dto: CreatePackageDraftDto) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.saveAndSubmit(userId, roles, dto);
  }

  @Post('packages/:id/update-and-submit')
  @Roles('PROJECT_MANAGER')
  @ApiOperation({ summary: 'Update and submit a Procurement Package in one step (PM)' })
  async updateAndSubmitPackage(@Request() req, @Param('id', ParseIntPipe) id: number, @Body() dto: UpdatePackageDraftDto) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.saveAndSubmit(userId, roles, dto, id);
  }

  @Get('projects/:projectId/eligible-cost-items')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Get eligible RAB cost items for package drafting' })
  async getEligibleCostItems(@Request() req, @Param('projectId', ParseIntPipe) projectId: number) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.getEligibleCostItems(projectId, userId, roles);
  }

  // =============================================================
  // SERVICE CLAIM ENDPOINTS (PHASE 21 R1)
  // =============================================================

  @Post('service-claims')
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new Service Claim draft' })
  async createServiceClaim(@Request() req, @Body() dto: CreateServiceClaimDto) {
    const userId = Number(req.user?.userId || req.user?.id || req.user?.sub);
    return this.serviceClaimService.createDraft(dto, userId);
  }

  @Get('service-claims')
  @Roles('PROCUREMENT', 'PURCHASING', 'FINANCE', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'List Service Claims with filters' })
  async getServiceClaims(@Query() query: QueryServiceClaimDto) {
    return this.serviceClaimService.listClaims(query);
  }

  @Get('service-claims/po/:poId/balance')
  @Roles('PROCUREMENT', 'PURCHASING', 'FINANCE', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Get Service PO balance and cumulative claim quantities' })
  async getServicePoBalance(@Param('poId', ParseIntPipe) poId: number) {
    return this.serviceClaimService.getPoBalance(poId);
  }

  @Get('service-claims/:id')
  @Roles('PROCUREMENT', 'PURCHASING', 'FINANCE', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Get Service Claim details by ID' })
  async getServiceClaimById(@Param('id', ParseIntPipe) id: number) {
    const claim = await this.serviceClaimService.getClaim(id);
    if (!claim) {
      throw new NotFoundException(`Klaim Jasa #${id} tidak ditemukan.`);
    }
    return claim;
  }

  @Patch('service-claims/:id')
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update a draft Service Claim' })
  async updateServiceClaim(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceClaimDto,
  ) {
    const userId = Number(req.user?.userId || req.user?.id || req.user?.sub);
    return this.serviceClaimService.updateDraft(id, dto, userId);
  }

  @Post('service-claims/:id/submit')
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Submit or resubmit a Service Claim for technical verification' })
  async submitServiceClaim(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const userId = Number(req.user?.userId || req.user?.id || req.user?.sub);
    return this.serviceClaimService.submit(id, userId);
  }

  @Post('service-claims/:id/verify-technical')
  @Roles('PROJECT_MANAGER')
  @ApiOperation({ summary: 'Technical verification of a submitted Service Claim (assigned PM only)' })
  async verifyTechnicalClaim(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: TechnicalVerificationDto,
  ) {
    const userId = Number(req.user?.userId || req.user?.id || req.user?.sub);
    const userRoles: string[] = Array.isArray(req.user?.roles)
      ? req.user.roles
      : [req.user?.role || ''].filter(Boolean);
    return this.serviceClaimService.verifyTechnical(id, dto, userId, userRoles);
  }

  @Post('service-claims/:id/verify-commercial')
  @Roles('PROCUREMENT', 'PURCHASING')
  @ApiOperation({ summary: 'Commercial verification and final approval for invoicing' })
  async verifyCommercialClaim(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CommercialVerificationDto,
  ) {
    const userId = Number(req.user?.userId || req.user?.id || req.user?.sub);
    const userRoles: string[] = Array.isArray(req.user?.roles)
      ? req.user.roles
      : [req.user?.role || ''].filter(Boolean);
    return this.serviceClaimService.verifyCommercial(id, dto, userId, userRoles);
  }

  @Post('service-claims/:id/cancel')
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Cancel a Service Claim' })
  async cancelServiceClaim(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelServiceClaimDto,
  ) {
    const userId = Number(req.user?.userId || req.user?.id || req.user?.sub);
    return this.serviceClaimService.cancel(id, dto, userId);
  }

  // =============================================================
  // SERVICE ORDER (SPK / WORK ORDER) ENDPOINTS
  // =============================================================

  @Post('service-orders')
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new Service Order (SPK / Work Order) draft' })
  async createServiceOrder(@Request() req, @Body() dto: CreateServiceOrderDto) {
    const userId = Number(req.user?.userId || req.user?.id || req.user?.sub);
    return this.procurementService.createServiceOrder(userId, dto);
  }

  @Get('service-orders')
  @Roles('PROCUREMENT', 'PURCHASING', 'FINANCE', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'List Service Orders with optional filters' })
  async getServiceOrders(@Query() query: QueryServiceOrderDto) {
    return this.procurementService.getServiceOrders(query);
  }

  @Get('service-orders/by-po/:poId')
  @Roles('PROCUREMENT', 'PURCHASING', 'FINANCE', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Get Service Orders linked to a Purchase Order' })
  async getServiceOrdersByPo(@Param('poId', ParseIntPipe) poId: number) {
    return this.procurementService.getServiceOrdersByPo(poId);
  }

  @Get('service-orders/:id')
  @Roles('PROCUREMENT', 'PURCHASING', 'FINANCE', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS')
  @ApiOperation({ summary: 'Get Service Order by ID' })
  async getServiceOrderById(@Param('id', ParseIntPipe) id: number) {
    return this.procurementService.getServiceOrderById(id);
  }

  @Patch('service-orders/:id')
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update a draft Service Order' })
  async updateServiceOrder(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateServiceOrderDto,
  ) {
    const userId = Number(req.user?.userId || req.user?.id || req.user?.sub);
    return this.procurementService.updateServiceOrder(id, userId, dto);
  }

  @Post('service-orders/:id/issue')
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Issue a draft Service Order' })
  async issueServiceOrder(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const userId = Number(req.user?.userId || req.user?.id || req.user?.sub);
    return this.procurementService.issueServiceOrder(id, userId);
  }

  @Post('service-orders/:id/cancel')
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Cancel a Service Order' })
  async cancelServiceOrder(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: CancelServiceOrderDto,
  ) {
    const userId = Number(req.user?.userId || req.user?.id || req.user?.sub);
    return this.procurementService.cancelServiceOrder(id, userId, dto);
  }
}

