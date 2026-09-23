import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProcurementPackageService } from './procurement-package.service';

@Injectable()
export class ProcurementEventListener {
  private readonly logger = new Logger(ProcurementEventListener.name);

  constructor(
    private readonly procurementPackageService: ProcurementPackageService,
  ) {}

  @OnEvent('finance.payment_processed')
  async handlePaymentProcessed(payload: { poId?: number }) {
    if (payload?.poId) await this.closePackageForPo(Number(payload.poId));
  }

  @OnEvent('gr.created')
  async handleGoodsReceived(payload: { po_id?: number }) {
    if (payload?.po_id) await this.closePackageForPo(Number(payload.po_id));
  }

  private async closePackageForPo(poId: number) {
    try { await this.procurementPackageService.closeCompletedPackageForPo(poId); }
    catch (error) { this.logger.error(`Gagal mengevaluasi penutupan paket PO #${poId}: ${error.message}`); }
  }

  @OnEvent('internal.workflow.instance.completed')
  async handleWorkflowInstanceCompleted(payload: {
    instanceId: number;
    entityType: string;
    entityId: number | string;
    finalStatus: string;
  }): Promise<void> {
    if (
      String(payload?.entityType).toUpperCase() === 'PURCHASE_REQUEST' &&
      String(payload?.finalStatus).toUpperCase() === 'REJECTED'
    ) {
      this.logger.log(
        `[ProcurementEventListener] Terminal REJECTED event received for PURCHASE_REQUEST #${payload.entityId} (Instance #${payload.instanceId}). Synchronizing linked package...`,
      );
      try {
        await this.procurementPackageService.handlePrRejection(
          Number(payload.entityId),
          Number(payload.instanceId),
        );
      } catch (err: any) {
        this.logger.error(
          `Failed to synchronize package rejection for PR #${payload.entityId}: ${err?.message}`,
          err?.stack,
        );
      }
    }
  }
}
