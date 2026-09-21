import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcurementController } from './procurement.controller';
import { ProcurementService } from './procurement.service';
import { ProcurementPackageService } from './procurement-package.service';
import { ProcurementReconciliationService } from './procurement-reconciliation.service';
import { ProcurementEventListener } from './procurement-event.listener';
import { WorkflowModule } from '../workflow-engine/workflow.module';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { Rfq } from '../../entities/rfq.entity';
import { VendorComparison } from '../../entities/vendor-comparison.entity';
import { Vendor } from '../../entities/vendor.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { GoodsReceiptItem } from '../../entities/goods-receipt-item.entity';
import { Quotation } from '../../entities/quotation.entity';
import { QuotationItem } from '../../entities/quotation-item.entity';
import { PoPaymentTerm } from '../../entities/po-payment-term.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { ProcurementPackage } from '../../entities/procurement-package.entity';
import { ProcurementPackageItem } from '../../entities/procurement-package-item.entity';
import { ProcurementReconciliation } from '../../entities/procurement-reconciliation.entity';
import { Project } from '../../entities/project.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { WorkflowDefinition } from '../../entities/workflow-definition.entity';
import { WorkflowInstance } from '../../entities/workflow-instance.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      ProcurementPackage,
      ProcurementPackageItem,
      ProcurementReconciliation,
      PurchaseRequest,
      PurchaseRequestItem,
      Rfq,
      Vendor,
      Quotation,
      QuotationItem,
      VendorComparison,
      PurchaseOrder,
      PurchaseOrderItem,
      PoPaymentTerm,
      GoodsReceipt,
      GoodsReceiptItem,
      AuditLog,
      Project,
      CostItem,
      ProjectCostEstimate,
      WorkBreakdownStructure,
      WorkflowDefinition,
      WorkflowInstance,
    ]),
    WorkflowModule,
  ],
  controllers: [ProcurementController],
  providers: [
    ProcurementService,
    ProcurementPackageService,
    ProcurementReconciliationService,
    ProcurementEventListener,
  ],
  exports: [
    ProcurementService,
    ProcurementPackageService,
    ProcurementReconciliationService,
  ],
})
export class ProcurementModule {}
