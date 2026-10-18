import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProcurementController } from './procurement.controller';
import { ProcurementService } from './procurement.service';
import { WorkflowModule } from '../workflow-engine/workflow.module';
import { NotificationModule } from '../notification/notification.module';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { PurchaseRequestItem } from '../../entities/purchase-request-item.entity';
import { Rfq } from '../../entities/rfq.entity';
import { VendorComparison } from '../../entities/vendor-comparison.entity';
import { Vendor } from '../../entities/vendor.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseOrderItem } from '../../entities/purchase-order-item.entity';
import { PoPaymentTerm } from '../../entities/po-payment-term.entity';
import { ServiceOrder } from '../../entities/service-order.entity';
import { GoodsReceipt } from '../../entities/goods-receipt.entity';
import { GoodsReceiptItem } from '../../entities/goods-receipt-item.entity';
import { Quotation } from '../../entities/quotation.entity';
import { QuotationItem } from '../../entities/quotation-item.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { ProcurementPackage } from '../../entities/procurement-package.entity';
import { ProcurementPackageItem } from '../../entities/procurement-package-item.entity';
import { Project } from '../../entities/project.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { WorkflowDefinition } from '../../entities/workflow-definition.entity';
import { WorkflowInstance } from '../../entities/workflow-instance.entity';
import { ServiceClaim } from '../../entities/service-claim.entity';
import { ServiceClaimItem } from '../../entities/service-claim-item.entity';
import { Invoice } from '../../entities/invoice.entity';
import { OutboxEvent } from '../../entities/outbox-event.entity';
import { ProcurementPackageService } from './procurement-package.service';
import { ServiceClaimService } from './service-claim.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      PurchaseRequest,
      PurchaseRequestItem,
      Rfq,
      Vendor,
      VendorComparison,
      PurchaseOrder,
      PurchaseOrderItem,
      PoPaymentTerm,
      ServiceOrder,
      GoodsReceipt,
      GoodsReceiptItem,
      Quotation,
      QuotationItem,
      AuditLog,
      ProcurementPackage,
      ProcurementPackageItem,
      Project,
      CostItem,
      ProjectCostEstimate,
      WorkflowDefinition,
      WorkflowInstance,
      ServiceClaim,
      ServiceClaimItem,
      Invoice,
      OutboxEvent,
    ]),
    WorkflowModule,
    NotificationModule,
  ],
  controllers: [ProcurementController],
  providers: [ProcurementService, ProcurementPackageService, ServiceClaimService],
  exports: [ProcurementService, ProcurementPackageService, ServiceClaimService],
})
export class ProcurementModule {}
