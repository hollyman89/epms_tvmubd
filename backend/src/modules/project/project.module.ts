import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ProjectController } from './project.controller';
import { ProjectService } from './project.service';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { Project } from '../../entities/project.entity';
import { Contract } from '../../entities/contract.entity';
import { User } from '../../entities/user.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { ProjectCostEstimate } from '../../entities/project-cost-estimate.entity';
import { CostItem } from '../../entities/cost-item.entity';
import { ProjectInitialCondition } from '../../entities/project-initial-condition.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { CostEstimateValidator } from './cost-estimate.validator';
import { ScheduleValidator } from './schedule.validator';
import { OperationalReadinessValidator } from './operational-readiness.validator';
import { InitialConditionValidator } from './initial-condition.validator';
import { ManagementReviewValidator } from './management-review.validator';
import { ProjectBaseline } from '../../entities/project-baseline.entity';
import { ProjectBaselineWbsItem } from '../../entities/project-baseline-wbs-item.entity';
import { ProjectProgressLog } from '../../entities/project-progress-log.entity';
import { ProjectProgressEvidence } from '../../entities/project-progress-evidence.entity';
import { Document } from '../../entities/document.entity';
import { WorkflowInstance } from '../../entities/workflow-instance.entity';
import { WorkflowTask } from '../../entities/workflow-task.entity';
import { WorkflowTransition } from '../../entities/workflow-transition.entity';

import { ProjectEventListener } from './project-event.listener';
import { ManagementReviewSyncService } from './management-review-sync.service';
import { ProjectWorkflowProjectionService } from './project-workflow-projection.service';
import { ProjectIssueRiskController } from './project-issue-risk.controller';
import { ProjectIssueService } from './project-issue.service';
import { ProjectRiskService } from './project-risk.service';
import { ProjectIssue } from '../../entities/project-issue.entity';
import { ProjectRisk } from '../../entities/project-risk.entity';
import { ProjectClosure } from '../../entities/project-closure.entity';
import { ProjectClosureService } from './project-closure.service';
import { WorkflowModule } from '../workflow-engine/workflow.module';
import { OutboxEvent } from '../../entities/outbox-event.entity';

@Module({
  imports: [
    WorkflowModule,
    TypeOrmModule.forFeature([
      WorkBreakdownStructure,
      Task,
      Project,
      Contract,
      User,
      AuditLog,
      ProjectCostEstimate,
      CostItem,
      ProjectInitialCondition,
      ProjectManagementReview,
      PurchaseRequest,
      ProjectBaseline,
      ProjectBaselineWbsItem,
      ProjectProgressLog,
      ProjectProgressEvidence,
      Document,
      WorkflowInstance,
      WorkflowTask,
      WorkflowTransition,
      ProjectIssue,
      ProjectRisk,
      ProjectClosure,
      OutboxEvent,
    ]),
  ],
  controllers: [ProjectController, ProjectIssueRiskController],
  providers: [
    ProjectService,
    CostEstimateValidator,
    ScheduleValidator,
    OperationalReadinessValidator,
    InitialConditionValidator,
    ManagementReviewValidator,
    ProjectEventListener,
    ManagementReviewSyncService,
    ProjectWorkflowProjectionService,
    ProjectIssueService,
    ProjectRiskService,
    ProjectClosureService,
  ],
  exports: [
    ProjectService,
    CostEstimateValidator,
    ScheduleValidator,
    OperationalReadinessValidator,
    InitialConditionValidator,
    ManagementReviewValidator,
    ManagementReviewSyncService,
    ProjectWorkflowProjectionService,
    ProjectIssueService,
    ProjectRiskService,
    ProjectClosureService,
  ],
})
export class ProjectModule {}
