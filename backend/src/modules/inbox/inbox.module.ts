import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { WorkflowModule } from '../workflow-engine/workflow.module';
import { NotificationModule } from '../notification/notification.module';
import { Contract } from '../../entities/contract.entity';
import { Tender } from '../../entities/tender.entity';
import { PaymentRequest } from '../../entities/payment-request.entity';
import { ProjectProgressLog } from '../../entities/project-progress-log.entity';
import { ServiceClaim } from '../../entities/service-claim.entity';
import { ProjectClosure } from '../../entities/project-closure.entity';
import { WorkflowTask } from '../../entities/workflow-task.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Contract,
      Tender,
      PaymentRequest,
      ProjectProgressLog,
      ServiceClaim,
      ProjectClosure,
      WorkflowTask,
    ]),
    WorkflowModule,
    NotificationModule,
  ],
  controllers: [InboxController],
  providers: [InboxService],
  exports: [InboxService],
})
export class InboxModule {}
