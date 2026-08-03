import { Controller, Post, Get, Param, Body, UseGuards, Request, ParseIntPipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth } from '@nestjs/swagger';
import { ProcurementService } from './procurement.service';
import { CreatePurchaseRequestDto } from './dto/create-pr.dto';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { SubmitVendorComparisonDto } from './dto/vendor-comparison.dto';
import { CreatePurchaseOrderDto } from './dto/create-po.dto';
import { CreateGoodsReceiptDto } from './dto/create-gr.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('Procurement')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('procurement')
export class ProcurementController {
  constructor(private readonly procurementService: ProcurementService) {}

  @Get('pr')
  @ApiOperation({ summary: 'Get all Purchase Requests' })
  async getAllPurchaseRequests() {
    return this.procurementService.getAllPurchaseRequests();
  }

  @Post('pr')
  @ApiOperation({ summary: 'Create a new Purchase Request and Submit to Workflow' })
  async createAndSubmitPurchaseRequest(@Request() req, @Body() dto: CreatePurchaseRequestDto) {
    const userId = req.user.userId;
    return this.procurementService.createAndSubmitPurchaseRequest(userId, dto);
  }

  @Post('rfqs')
  @ApiOperation({ summary: 'Create a new RFQ from a Purchase Request' })
  async createRfq(@Request() req, @Body() dto: CreateRfqDto) {
    return this.procurementService.createRfq(dto);
  }

  @Post('vendor-comparison')
  @ApiOperation({ summary: 'Submit vendor comparison for an RFQ (min 3 vendors)' })
  async submitVendorComparison(@Body() dto: SubmitVendorComparisonDto) {
    return this.procurementService.submitVendorComparison(dto.rfqId, dto.vendors);
  }

  @Get('purchase-orders')
  @ApiOperation({ summary: 'Get all Purchase Orders' })
  async getAllPurchaseOrders() {
    return this.procurementService.getAllPurchaseOrders();
  }

  @Post('purchase-orders')
  @ApiOperation({ summary: 'Create a new Purchase Order' })
  async createPurchaseOrder(@Request() req, @Body() dto: CreatePurchaseOrderDto) {
    const userId = req.user.userId;
    return this.procurementService.createPurchaseOrder(userId, dto);
  }

  @Get('purchase-orders/:purchaseOrderId')
  @ApiOperation({ summary: 'Get Purchase Order details by ID' })
  async getPurchaseOrderById(@Param('purchaseOrderId', ParseIntPipe) purchaseOrderId: number) {
    return this.procurementService.getPurchaseOrderById(purchaseOrderId);
  }

  @Post('goods-receipts')
  @ApiOperation({ summary: 'Create a new Goods Receipt for a Purchase Order' })
  async createGoodsReceipt(@Request() req, @Body() dto: CreateGoodsReceiptDto) {
    const userId = req.user.userId;
    return this.procurementService.createGoodsReceipt(dto, userId);
  }

  @Get('goods-receipts/:goodsReceiptId')
  @ApiOperation({ summary: 'Get Goods Receipt details by ID' })
  async getGoodsReceiptById(@Param('goodsReceiptId', ParseIntPipe) goodsReceiptId: number) {
    return this.procurementService.getGoodsReceiptById(goodsReceiptId);
  }
}
