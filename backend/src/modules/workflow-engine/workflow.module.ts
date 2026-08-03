import { Module } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
import { WorkflowController } from './workflow.controller';
import { NotificationModule } from '../notification/notification.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [NotificationModule, QueueModule],
  controllers: [WorkflowController],
  providers: [WorkflowService],
  exports: [WorkflowService],
})
export class WorkflowModule {}
