import { Controller, Post, Get, Put, Patch, Delete, Param, Body, Query, UseGuards, Request, ParseIntPipe, UnauthorizedException } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProcurementService } from './procurement.service';
import { ProcurementPackageService } from './procurement-package.service';
import { ProcurementReconciliationService } from './procurement-reconciliation.service';
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
import {
  ReconcileItemDto,
  ExcludeItemDto,
  QueryReconciliationDto,
} from './dto/procurement-reconciliation.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RolesGuard } from '../auth/guards/roles.guard';
import { Roles } from '../auth/decorators/roles.decorator';

@ApiTags('Procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard, RolesGuard)
@Controller('procurement')
export class ProcurementController {
  constructor(
    private readonly procurementService: ProcurementService,
    private readonly packageService: ProcurementPackageService,
    private readonly reconciliationService: ProcurementReconciliationService,
  ) {}

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

  @Get('rfqs')
  @Roles('PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS', 'FINANCE')
  @ApiOperation({ summary: 'Get all RFQs' })
  async getAllRfqs() {
    return this.procurementService.getAllRfqs();
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

  @Get('rfqs/:rfqId')
  @Roles('PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'MANAGER', 'HEAD_OF_OPERATIONS', 'FINANCE')
  @ApiOperation({ summary: 'Get RFQ details by ID' })
  async getRfqById(@Param('rfqId', ParseIntPipe) rfqId: number) {
    return this.procurementService.getRfqById(rfqId);
  }

  @Post('rfqs')
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Create a new RFQ from a Purchase Request' })
  async createRfq(@Request() req, @Body() dto: CreateRfqDto) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.procurementService.createRfq(dto, userId);
  }

  @Post('quotations')
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Submit a new vendor quotation for an RFQ' })
  async createQuotation(@Request() req, @Body() dto: CreateQuotationDto) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    return this.procurementService.createQuotation(dto, userId);
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

  @Post('vendor-comparison')
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Submit vendor comparison for an RFQ (min 3 vendors for high-value)' })
  async submitVendorComparison(@Request() req, @Body() dto: SubmitVendorComparisonDto) {
    const userId = req.user?.userId || req.user?.id || req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('User ID tidak ditemukan pada sesi autentikasi');
    }
    return this.procurementService.submitVendorComparison(dto.rfqId, dto.vendors, Number(userId), dto.remarks);
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
  @Roles('PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER', 'PMO', 'SUPER_ADMIN', 'ADMIN', 'HEAD_OF_OPERATIONS')
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

  // =========================================================================
  // PROCUREMENT PACKAGES ENDPOINTS
  // =========================================================================

  @Post('packages')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a new Procurement Package draft (PM / SUPER_ADMIN)' })
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
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Update a draft Procurement Package (PM / SUPER_ADMIN)' })
  async updatePackageDraft(
    @Request() req,
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdatePackageDraftDto,
  ) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.updateDraft(id, userId, roles, dto);
  }

  @Delete('packages/:id')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Delete a draft Procurement Package (PM / SUPER_ADMIN)' })
  async deletePackageDraft(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.deleteDraft(id, userId, roles);
  }

  @Post('packages/:id/submit')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Submit a Procurement Package to Procurement Intake (PM / SUPER_ADMIN)' })
  async submitPackage(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.submitPackage(id, userId, roles);
  }

  @Post('packages/:id/resubmit')
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Resubmit a RETURNED Procurement Package (PM / SUPER_ADMIN)' })
  async resubmitPackage(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.resubmitPackage(id, userId, roles);
  }

  @Post('packages/:id/return')
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN')
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
  @Roles('PROJECT_MANAGER', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Cancel a Procurement Package (PM / SUPER_ADMIN)' })
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
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN')
  @ApiOperation({ summary: 'Create a Purchase Request from a submitted Procurement Package' })
  async createPrFromPackage(@Request() req, @Param('id', ParseIntPipe) id: number) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.packageService.createPrFromPackage(id, userId, roles);
  }

  // =========================================================================
  // RECONCILIATION ENDPOINTS (PHASE 3)
  // =========================================================================

  @Get('reconciliations/unresolved')
  @Roles('PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'List unresolved historical / AD_HOC PR items' })
  async getUnresolvedReconciliationItems(
    @Request() req,
    @Query() query: QueryReconciliationDto,
  ) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.reconciliationService.getUnresolvedItems(userId, roles, query);
  }

  @Get('reconciliations/items/:prItemId')
  @Roles('PROCUREMENT', 'PURCHASING', 'PROJECT_MANAGER', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Get PR item reconciliation details and candidate CostItems' })
  async getItemReconciliationDetail(
    @Request() req,
    @Param('prItemId', ParseIntPipe) prItemId: number,
  ) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.reconciliationService.getItemReconciliationDetail(userId, roles, prItemId);
  }

  @Post('reconciliations/items/:prItemId/reconcile')
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Reconcile PR item to an approved baseline CostItem (Procurement/Admin only)' })
  async reconcileItem(
    @Request() req,
    @Param('prItemId', ParseIntPipe) prItemId: number,
    @Body() dto: ReconcileItemDto,
  ) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.reconciliationService.reconcileItem(userId, roles, prItemId, dto);
  }

  @Post('reconciliations/items/:prItemId/exclude')
  @Roles('PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN', 'ADMIN')
  @ApiOperation({ summary: 'Exclude PR item from project RAB quota with mandatory reason (Procurement/Admin only)' })
  async excludeItem(
    @Request() req,
    @Param('prItemId', ParseIntPipe) prItemId: number,
    @Body() dto: ExcludeItemDto,
  ) {
    const userId = Number(req.user?.userId || req.user?.sub);
    const roles: string[] = Array.isArray(req.user?.roles) ? req.user.roles : [req.user?.role || ''].filter(Boolean);
    return this.reconciliationService.excludeItem(userId, roles, prItemId, dto);
  }
}
