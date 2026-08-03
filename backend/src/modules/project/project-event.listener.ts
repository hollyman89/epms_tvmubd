import { Injectable, Logger } from '@nestjs/common';
import { OnEvent } from '@nestjs/event-emitter';
import { ProjectService } from './project.service';

@Injectable()
export class ProjectEventListener {
  private readonly logger = new Logger(ProjectEventListener.name);

  constructor(private readonly projectService: ProjectService) {}

  @OnEvent('finance.payment_processed')
  async handlePaymentProcessed(payload: { invoiceId: number; paymentAmount: number; poId?: number }) {
    this.logger.log(`🔥 [ProjectEventListener] Payment Processed Event Received: Invoice ${payload.invoiceId}, Amount: ${payload.paymentAmount}`);
    if (payload.poId) {
      await this.projectService.recalculateWbsBudgetFromPo(payload.poId, payload.paymentAmount);
    }
  }
}
