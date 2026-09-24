import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { InboxController } from './inbox.controller';
import { InboxService } from './inbox.service';
import { WorkflowModule } from '../workflow-engine/workflow.module';
import { NotificationModule } from '../notification/notification.module';
import { Contract } from '../../entities/contract.entity';
import { Tender } from '../../entities/tender.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([Contract, Tender]),
    WorkflowModule,
    NotificationModule,
  ],
  controllers: [InboxController],
  providers: [InboxService],
  exports: [InboxService],
})
export class InboxModule {}
