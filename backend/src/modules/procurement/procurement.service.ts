import { Injectable, BadRequestException, Logger, Inject, HttpException, HttpStatus } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, Like } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkflowService } from '../workflow-engine/workflow.service';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { Rfq } from '../../entities/rfq.entity';
import { VendorComparison } from '../../entities/vendor-comparison.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { GoodsReceiptItem } from '../../entities/goods-receipt-item.entity';
import { CreatePurchaseRequestDto } from './dto/create-pr.dto';
import { CreateRfqDto } from './dto/create-rfq.dto';
import { CreatePurchaseOrderDto } from './dto/create-po.dto';
import { CreateGoodsReceiptDto } from './dto/create-gr.dto';

@Injectable()
export class ProcurementService {
  private readonly logger = new Logger(ProcurementService.name);

  constructor(
    @InjectRepository(PurchaseRequest)
    private prRepo: Repository<PurchaseRequest>,
    @InjectRepository(Rfq)
    private rfqRepo: Repository<Rfq>,
    @InjectRepository(VendorComparison)
    private vendorComparisonRepo: Repository<VendorComparison>,
    @InjectRepository(PurchaseOrder)
    private poRepo: Repository<PurchaseOrder>,
    @InjectRepository(GoodsReceipt)
    private grRepo: Repository<GoodsReceipt>,
    private readonly workflowService: WorkflowService,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  async createAndSubmitPurchaseRequest(userId: number, dto: CreatePurchaseRequestDto) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // Generate PR Number: PR-YYYYMMDD-SEQ
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await queryRunner.manager.count(PurchaseRequest, {
        where: { prNumber: require('typeorm').Like(`PR-${dateStr}-%`) }
      });
      const seq = String(countToday + 1).padStart(3, '0');
      const prNumber = `PR-${dateStr}-${seq}`;

      // WBS Budget Validation Check
      const wbsId = (dto as any).wbsId;
      if (wbsId) {
        const wbsRes = await queryRunner.manager.query(
          `SELECT budget_allocation, task_name FROM project_wbs WHERE id = $1 FOR UPDATE`,
          [wbsId]
        );
        if (wbsRes && wbsRes.length > 0) {
          const budgetAllocation = Number(wbsRes[0].budget_allocation || 0);
          const poSpentRes = await queryRunner.manager.query(
            `SELECT COALESCE(SUM(total_amount), 0) AS spent 
             FROM purchase_orders 
             WHERE wbs_id = $1 AND status IN ('APPROVED', 'IN_PROGRESS')`,
            [wbsId]
          );
          const spent = Number(poSpentRes[0].spent || 0);
          const requested = Number(dto.totalEstimatedAmount || 0);

          if (spent + requested > budgetAllocation && budgetAllocation > 0) {
            const remaining = Math.max(0, budgetAllocation - spent);
            throw new BadRequestException(
              `Alokasi Anggaran WBS '${wbsRes[0].task_name}' Terlampaui! Sisa anggaran: Rp ${remaining.toLocaleString('id-ID')}, Pengajuan: Rp ${requested.toLocaleString('id-ID')}`
            );
          }
        }
      }

      // 1. Create PR
      const pr = queryRunner.manager.create(PurchaseRequest, {
        projectId: dto.projectId,
        requesterId: userId,
        prNumber: prNumber,
        totalEstimatedAmount: dto.totalEstimatedAmount,
        status: 'SUBMITTED', // Set status to SUBMITTED
      });
      const savedPr = await queryRunner.manager.save(pr);

      // 2. Save PR Items
      const items = dto.items.map(itemDto => queryRunner.manager.create(PurchaseRequestItem, {
        prId: savedPr.id,
        itemName: itemDto.itemName,
        quantity: itemDto.quantity,
        estimatedUnitPrice: itemDto.estimatedUnitPrice,
      }));
      await queryRunner.manager.save(items);

      await queryRunner.commitTransaction();

      this.logger.log(`PR ${savedPr.id} (${prNumber}) created and submitted. Delegating to Workflow Engine.`);
      
      // 3. Emit event to RabbitMQ
      const payload = {
        entity_type: "PURCHASE_REQUEST",
        entity_id: savedPr.id,
        total_estimated_amount: savedPr.totalEstimatedAmount,
        initiator_user_id: userId
      };
      
      this.eventEmitter.emit('workflow.trigger', payload);
      this.logger.log(`Event Emitted: workflow.trigger for PR ${savedPr.id}`);
      
      return {
        success: true,
        message: 'Purchase Request created and submitted successfully',
        data: savedPr
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creating PR: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Validasi Anggaran WBS & PO Spent
   * Ambil budget dari tabel project_wbs berdasarkan wbsId
   * Hitung sisa_budget = budget - spent
   * Jika requestedAmount > sisa_budget, lempar HttpException(400, 'Sisa anggaran WBS tidak mencukupi')
   */
  async validateWbsBudget(wbsId: number, requestedAmount: number, manager?: any): Promise<boolean> {
    if (!wbsId) return true;

    const queryManager = manager || this.dataSource.manager;

    // 1. Ambil budget dari tabel project_wbs berdasarkan wbsId
    const wbsRes = await queryManager.query(
      `SELECT budget_allocation, task_name FROM project_wbs WHERE id = $1 FOR UPDATE`,
      [wbsId]
    );

    if (!wbsRes || wbsRes.length === 0) {
      // Tidak ada WBS
      return true;
    }

    const budget = Number(wbsRes[0].budget_allocation || 0);

    // 2. Hitung spent dari purchase_orders
    const poSpentRes = await queryManager.query(
      `SELECT COALESCE(SUM(total_amount), 0) AS spent 
       FROM purchase_orders 
       WHERE wbs_id = $1 AND status IN ('APPROVED', 'IN_PROGRESS')`,
      [wbsId]
    );

    const spent = Number(poSpentRes[0]?.spent || 0);

    // 3. Hitung sisa_budget = budget - spent
    const sisaBudget = budget - spent;

    // 4. Jika requestedAmount > sisaBudget, lempar HttpException 400
    if (requestedAmount > sisaBudget && budget > 0) {
      throw new HttpException(
        `Sisa anggaran WBS tidak mencukupi (Tersedia: Rp ${Math.max(0, sisaBudget).toLocaleString('id-ID')}, Pengajuan: Rp ${requestedAmount.toLocaleString('id-ID')})`,
        HttpStatus.BAD_REQUEST
      );
    }

    return true;
  }

  async createRfq(dto: CreateRfqDto) {
    const pr = await this.prRepo.findOne({ where: { id: dto.purchaseRequestId } });
    if (!pr) {
      throw new BadRequestException('Purchase Request not found');
    }

    // Auto generate RFQ Number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const countToday = await this.rfqRepo.count({
      where: { rfqNumber: require('typeorm').Like(`RFQ-${dateStr}-%`) }
    });
    const seq = String(countToday + 1).padStart(3, '0');
    const rfqNumber = `RFQ-${dateStr}-${seq}`;

    const rfq = this.rfqRepo.create({
      prId: dto.purchaseRequestId,
      rfqNumber,
      closingDate: dto.closingDate,
      status: 'OPEN'
    });
    
    await this.rfqRepo.save(rfq);

    return {
      success: true,
      message: 'RFQ created successfully',
      data: rfq
    };
  }

  async submitVendorComparison(rfqId: number, vendorsData: any[]) {
    // 1. Get PR amount to apply business rule
    let totalEstimatedAmount = 0;
    const rfqRecords = await this.dataSource.query('SELECT pr_id FROM rfqs WHERE id = ?', [rfqId]);
    
    if (rfqRecords.length > 0) {
      const pr = await this.prRepo.findOne({ where: { id: rfqRecords[0].pr_id } });
      if (pr) totalEstimatedAmount = pr.totalEstimatedAmount;
    } else {
      // Fallback if rfqId is actually purchase_request_id
      const pr = await this.prRepo.findOne({ where: { id: rfqId } });
      if (pr) totalEstimatedAmount = pr.totalEstimatedAmount;
    }

    if (totalEstimatedAmount > 1000000 && vendorsData.length < 3) {
      throw new BadRequestException('Minimal 3 vendor diperlukan untuk perbandingan pengadaan di atas Rp 1.000.000');
    }
    
    const winners = vendorsData.filter(v => v.isWinner);
    if (winners.length !== 1) {
      throw new BadRequestException('Exactly 1 vendor must be selected as the winner.');
    }

    this.logger.log(`Vendor comparison submitted for RFQ ${rfqId}. Winner: ${winners[0].vendorId}`);
    
    // Save to DB
    const comparisons = vendorsData.map(v => this.vendorComparisonRepo.create({
      rfqId,
      vendorId: v.vendorId,
      offeredAmount: v.offeredAmount,
      isWinner: v.isWinner,
    }));
    await this.vendorComparisonRepo.save(comparisons);

    return {
      success: true,
      message: 'Vendor comparison submitted successfully',
      data: comparisons
    };
  }

  async createPurchaseOrder(userId: number, dto: CreatePurchaseOrderDto) {
    // 1. Fetch PR by purchase_request_id and validate status
    const pr = await this.prRepo.findOne({ where: { id: dto.purchase_request_id } });
    if (!pr) throw new BadRequestException('Purchase Request not found');
    if (pr.status !== 'APPROVED') {
      throw new BadRequestException('Purchase Request is not APPROVED yet');
    }

    // 2. Validate vendor_id (ensure it's the winner for this PR's RFQs)
    const rfqs = await this.rfqRepo.find({ where: { prId: pr.id } });
    const rfqIds = rfqs.map(r => r.id);
    
    if (rfqIds.length === 0) {
      throw new BadRequestException('No RFQs found for this Purchase Request');
    }

    const winnerComparison = await this.vendorComparisonRepo.findOne({
      where: { vendorId: dto.vendor_id, isWinner: true } // omitting rfqId IN due to simplicity, or we can use QueryBuilder
    });

    // better check:
    const isWinner = await this.vendorComparisonRepo.createQueryBuilder('vc')
      .where('vc.rfqId IN (:...rfqIds)', { rfqIds })
      .andWhere('vc.vendorId = :vendorId', { vendorId: dto.vendor_id })
      .andWhere('vc.isWinner = :isWinner', { isWinner: true })
      .getOne();

    if (!isWinner) {
      throw new BadRequestException('The selected vendor is not the winner for this PR');
    }

    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 3. Auto-generate PO Number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const countToday = await queryRunner.manager.count(PurchaseOrder, {
        where: { poNumber: require('typeorm').Like(`PO-${dateStr}-%`) }
      });
      const seq = String(countToday + 1).padStart(3, '0');
      const poNumber = `PO-${dateStr}-${seq}`;

      let totalAmount = 0;
      for (const item of dto.po_items) {
        totalAmount += Number(item.total_price);
      }

      const po = queryRunner.manager.create(PurchaseOrder, {
        purchaseRequestId: pr.id,
        vendorId: dto.vendor_id,
        poNumber,
        totalAmount,
        status: 'ISSUED'
      });

      const savedPo = await queryRunner.manager.save(po);

      const items = dto.po_items.map(item => queryRunner.manager.create(PurchaseOrderItem, {
        purchaseOrderId: savedPo.id,
        itemName: item.item_name,
        quantity: item.quantity,
        unitPrice: item.unit_price,
        totalPrice: item.total_price
      }));

      await queryRunner.manager.save(items);

      // 4. Update PR Status
      pr.status = 'PO_ISSUED';
      await queryRunner.manager.save(pr);

      await queryRunner.commitTransaction();

      // 5. Emit event
      this.eventEmitter.emit('po.created', {
        purchase_order_id: savedPo.id,
        vendor_id: dto.vendor_id
      });
      this.logger.log(`RabbitMQ Event Emitted: po.created for PO ${savedPo.id}`);

      return {
        success: true,
        message: 'Purchase Order created successfully',
        data: savedPo
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creating PO: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getPurchaseOrderById(id: number) {
    const po = await this.poRepo.findOne({
      where: { id },
      relations: ['items', 'purchaseRequest']
    });

    if (!po) {
      throw new BadRequestException('Purchase Order not found');
    }

    return {
      success: true,
      message: 'Purchase Order retrieved successfully',
      data: po
    };
  }

  async createGoodsReceipt(dto: CreateGoodsReceiptDto, userId: number) {
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 1. Fetch PO with Items
      const po = await queryRunner.manager.findOne(PurchaseOrder, {
        where: { id: dto.purchaseOrderId },
        relations: ['items']
      });

      if (!po) {
        throw new BadRequestException('Purchase Order not found');
      }

      if (po.status !== 'ISSUED' && po.status !== 'PARTIALLY_FULFILLED') {
        throw new BadRequestException(`Cannot receive goods for PO with status ${po.status}`);
      }

      // 2. Generate GR Number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const count = await queryRunner.manager.count(GoodsReceipt, {
        where: { grNumber: Like(`GR-${dateStr}%`) }
      });
      const seq = String(count + 1).padStart(3, '0');
      const grNumber = `GR-${dateStr}-${seq}`;

      // 3. Create GR Header
      const gr = queryRunner.manager.create(GoodsReceipt, {
        poId: po.id,
        grNumber,
        receiptDate: new Date(dto.receiptDate),
        remarks: dto.remarks,
        createdBy: userId
      });
      const savedGr = await queryRunner.manager.save(gr);

      // 4. Process Items
      const grItemsToSave: GoodsReceiptItem[] = [];
      let allItemsCompleted = true;
      let atLeastOneItemReceived = false;

      for (const itemDto of dto.items) {
        const poItem = po.items.find(i => i.id === itemDto.poItemId);
        if (!poItem) {
          throw new BadRequestException(`PO Item ${itemDto.poItemId} does not belong to PO ${po.id}`);
        }

        const remainingQty = Number(poItem.quantity) - Number(poItem.receivedQuantity);
        if (itemDto.receivedQuantity > remainingQty) {
          throw new BadRequestException(`Cannot receive ${itemDto.receivedQuantity} for item ${poItem.id}. Remaining quantity is ${remainingQty}`);
        }

        // Create GR Item
        grItemsToSave.push(queryRunner.manager.create(GoodsReceiptItem, {
          grId: savedGr.id,
          poItemId: poItem.id,
          receivedQuantity: itemDto.receivedQuantity,
          remarks: itemDto.remarks,
          createdBy: userId
        }));

        // Update PO Item received quantity
        poItem.receivedQuantity = Number(poItem.receivedQuantity) + Number(itemDto.receivedQuantity);
        await queryRunner.manager.save(poItem);
      }

      await queryRunner.manager.save(grItemsToSave);

      // 5. Calculate new PO Status
      for (const poItem of po.items) {
        if (Number(poItem.receivedQuantity) < Number(poItem.quantity)) {
          allItemsCompleted = false;
        }
        if (Number(poItem.receivedQuantity) > 0) {
          atLeastOneItemReceived = true;
        }
      }

      const originalStatus = po.status;
      if (allItemsCompleted) {
        po.status = 'COMPLETED';
      } else if (atLeastOneItemReceived) {
        po.status = 'PARTIALLY_FULFILLED';
      }

      if (po.status !== originalStatus) {
        await queryRunner.manager.save(po);
      }

      await queryRunner.commitTransaction();

      // 6. Emit event
      this.eventEmitter.emit('gr.created', {
        gr_id: savedGr.id,
        po_id: po.id
      });
      this.logger.log(`RabbitMQ Event Emitted: gr.created for GR ${savedGr.id}`);

      return {
        success: true,
        message: 'Goods Receipt created successfully',
        data: savedGr
      };
    } catch (err) {
      await queryRunner.rollbackTransaction();
      this.logger.error(`Error creating GR: ${err.message}`, err.stack);
      throw err;
    } finally {
      await queryRunner.release();
    }
  }

  async getGoodsReceiptById(grId: number) {
    const gr = await this.grRepo.findOne({
      where: { id: grId },
      relations: ['items'],
    });

    if (!gr) {
      throw new BadRequestException('Goods Receipt not found');
    }
    return gr;
  }

  async getAllPurchaseOrders() {
    return await this.poRepo.find({
      relations: ['items'],
      order: { createdAt: 'DESC' }
    });
  }

  async getAllPurchaseRequests() {
    return await this.prRepo.find({
      relations: ['items'],
      order: { createdAt: 'DESC' }
    });
  }
}
