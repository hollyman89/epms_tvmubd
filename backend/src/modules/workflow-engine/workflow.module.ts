import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { WorkflowService } from './workflow.service';
import { WorkflowDefinitionService } from './workflow-definition.service';
import { WorkflowEngineService } from './workflow-engine.service';
import { WorkflowController } from './workflow.controller';
import { NotificationModule } from '../notification/notification.module';
import { QueueModule } from '../queue/queue.module';
import { WorkflowDefinition } from '../../entities/workflow-definition.entity';
import { WorkflowVersion } from '../../entities/workflow-version.entity';
import { WorkflowInstance } from '../../entities/workflow-instance.entity';
import { WorkflowTask } from '../../entities/workflow-task.entity';
import { WorkflowTransition } from '../../entities/workflow-transition.entity';
import { Role } from '../../entities/role.entity';
import { OutboxEvent } from '../../entities/outbox-event.entity';
import { AuditLog } from '../../entities/audit-log.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      WorkflowDefinition,
      WorkflowVersion,
      WorkflowInstance,
      WorkflowTask,
      WorkflowTransition,
      Role,
      OutboxEvent,
      AuditLog,
    ]),
    NotificationModule,
    QueueModule,
  ],
  controllers: [WorkflowController],
  providers: [WorkflowService, WorkflowDefinitionService, WorkflowEngineService],
  exports: [WorkflowService, WorkflowDefinitionService, WorkflowEngineService],
})
export class WorkflowModule {}
