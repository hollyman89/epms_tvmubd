import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { ModuleRef } from '@nestjs/core';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import { Project } from '../../entities/project.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { User } from '../../entities/user.entity';
import { WorkflowInstance } from '../../entities/workflow-instance.entity';
import { WorkflowTask } from '../../entities/workflow-task.entity';
import { WorkflowTransition } from '../../entities/workflow-transition.entity';
import { ProjectWorkflowProjectionService } from './project-workflow-projection.service';

export interface SyncManagementReviewPayload {
  workflowInstanceId?: number;
  taskId?: number;
  projectId?: number | string;
  entityType?: string;
  fromNode?: string;
  toNode?: string;
  action?: string;
  decidedBy?: number;
  decidedAt?: Date | string;
  comments?: string;
  transitionId?: number;
}

export interface SyncManagementReviewResult {
  synchronized: boolean;
  reviewId?: number;
  status?: string;
  alreadySynced?: boolean;
  reason?: string;
}

@Injectable()
export class ManagementReviewSyncService {
  private readonly logger = new Logger(ManagementReviewSyncService.name);

  constructor(
    @InjectRepository(ProjectManagementReview)
    private readonly reviewRepo: Repository<ProjectManagementReview>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(AuditLog)
    private readonly auditRepo: Repository<AuditLog>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(WorkflowInstance)
    private readonly instanceRepo: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowTask)
    private readonly taskRepo: Repository<WorkflowTask>,
    @InjectRepository(WorkflowTransition)
    private readonly transitionRepo: Repository<WorkflowTransition>,
    private readonly dataSource: DataSource,
    private readonly moduleRef: ModuleRef,
    @Optional()
    private projectionService?: ProjectWorkflowProjectionService,
  ) {}

  private getProjectionService(): ProjectWorkflowProjectionService {
    if (this.projectionService) {
      return this.projectionService;
    }
    try {
      this.projectionService = this.moduleRef.get(ProjectWorkflowProjectionService, { strict: false });
      return this.projectionService;
    } catch {
      return new ProjectWorkflowProjectionService();
    }
  }

  /**
   * Centralized atomic projection synchronization from Workflow Engine to ProjectManagementReview.
   * Enforces strict idempotency, prevents duplicate transitions/audits, and retains single source of truth.
   */
  async syncManagementReviewFromWorkflow(
    payload: SyncManagementReviewPayload,
  ): Promise<SyncManagementReviewResult> {
    const entityType = String(payload.entityType || '').toUpperCase();
    if (entityType !== 'PROJECT') {
      return { synchronized: false, reason: `Ignored: entityType '${entityType}' is not PROJECT.` };
    }

    const projectId = Number(payload.projectId);
    if (!projectId || isNaN(projectId) || projectId <= 0) {
      return { synchronized: false, reason: `Invalid projectId: ${payload.projectId}` };
    }

    const action = String(payload.action || '').toUpperCase();
    const fromNode = payload.fromNode || '';
    const toNode = payload.toNode || '';
    const actorId = payload.decidedBy ? Number(payload.decidedBy) : null;
    const decisionDate = payload.decidedAt ? new Date(payload.decidedAt) : new Date();

    let instance: WorkflowInstance | null = null;
    let relatedTask: WorkflowTask | null = null;
    let relatedTransition: WorkflowTransition | null = null;

    if (payload.workflowInstanceId) {
      instance = await this.instanceRepo.findOne({
        where: { id: Number(payload.workflowInstanceId) },
        relations: ['tasks', 'transitions'],
      });
    } else if (projectId) {
      instance = await this.instanceRepo.findOne({
        where: { entityType: 'PROJECT', entityId: projectId },
        relations: ['tasks', 'transitions'],
        order: { id: 'DESC' },
      });
    }

    const existingReview = await this.reviewRepo.findOne({ where: { projectId } });

    if (!instance && !existingReview) {
      return {
        synchronized: false,
        reason: `Workflow instance and review record for Project #${projectId} not found.`,
      };
    }

    if (instance) {
      if (payload.taskId && Array.isArray(instance.tasks)) {
        relatedTask = instance.tasks.find((t) => Number(t.id) === Number(payload.taskId)) || null;
      }
      if (payload.transitionId && Array.isArray(instance.transitions)) {
        relatedTransition = instance.transitions.find((t) => Number(t.id) === Number(payload.transitionId)) || null;
      } else if (Array.isArray(instance.transitions)) {
        relatedTransition = instance.transitions.find(
          (t) => t.action === action && (fromNode ? t.fromNodeId === fromNode : true),
        ) || null;
      }
    }

    // Resolve authoritative canonical projection from CURRENT Workflow Engine runtime (Phase 2B.1 SSOT)
    const projection = this.getProjectionService().buildProjection(instance, existingReview);
    const targetStatus: string = projection.businessStatus;


    let reviewerRole: string | null = projection.lastApprovedRole || projection.current.ownerRole || null;

    // Resolve actual actor role if possible from User entity
    if (actorId) {
      try {
        const actorUser = await this.userRepo.findOne({
          where: { id: actorId },
          relations: ['roles'],
        });
        if (actorUser && Array.isArray(actorUser.roles)) {
          const roleNames = actorUser.roles.map((r: any) => String(r.name || r).toUpperCase());
          if (reviewerRole && roleNames.includes(reviewerRole)) {
            // Keep mapped canonical role
          } else if (roleNames.length > 0) {
            reviewerRole = roleNames[0];
          }
        }
      } catch (err) {
        this.logger.warn(`Could not resolve roles for actor #${actorId}: ${err}`);
      }
    }

    // Execute atomic transaction for projection update & audit
    return await this.dataSource.transaction(async (manager) => {
      let review = await manager.findOne(ProjectManagementReview, {
        where: { projectId },
        lock: { mode: 'pessimistic_write' },
      });

      const oldStatus = review ? review.status : 'NOT_SUBMITTED';

      // Idempotency Check:
      // If review is already at targetStatus and has decidedBy and decidedAt,
      // and audit log for this task/transition has already been recorded, avoid duplicates.
      if (
        review &&
        review.status === targetStatus &&
        review.decidedBy &&
        Number(review.decidedBy) === actorId
      ) {
        const existingAudits = await manager.find(AuditLog, {
          where: {
            table_name: 'project_management_reviews',
            record_id: review.id,
          },
          order: { id: 'DESC' },
          take: 20,
        });

        const alreadyAudited = existingAudits.some((a) => {
          let val = a.new_value;
          if (typeof val === 'string') {
            try {
              val = JSON.parse(val);
            } catch {
              val = null;
            }
          }
          if (!val) return false;
          if (payload.taskId && Number(val.taskId) === Number(payload.taskId)) return true;
          if (payload.transitionId && Number(val.transitionId) === Number(payload.transitionId)) return true;
          if (val.status === targetStatus && Number(val.decidedBy) === actorId) return true;
          return false;
        });

        if (alreadyAudited) {
          this.logger.log(
            `[Idempotency] Projection for Project #${projectId} (Review #${review.id}) already synchronized for Task #${payload.taskId || 'N/A'}. Skipping duplicate projection.`,
          );
          return {
            synchronized: true,
            reviewId: review.id,
            status: review.status,
            alreadySynced: true,
          };
        }
      }

      if (review) {
        review.status = targetStatus;
        review.decidedBy = actorId;
        review.decidedAt = decisionDate;
        review.reviewerRole = reviewerRole;
        if (payload.comments) {
          review.revisionNotes = payload.comments;
        }
        review.updatedBy = actorId;
        review = await manager.save(ProjectManagementReview, review);
      } else {
        review = manager.create(ProjectManagementReview, {
          projectId,
          status: targetStatus,
          decidedBy: actorId,
          decidedAt: decisionDate,
          reviewerRole,
          revisionNotes: payload.comments || null,
          createdBy: actorId,
          updatedBy: actorId,
        });
        review = await manager.save(ProjectManagementReview, review);
      }

      // Write exactly ONE audit log record
      const auditAction =
        targetStatus === 'READY_FOR_PROCUREMENT' || targetStatus === 'READY_FOR_KICKOFF'
          ? 'PROJECT_PLAN_APPROVED'
          : targetStatus === 'NEEDS_REVISION'
          ? 'PROJECT_PLAN_REVISION_REQUESTED'
          : 'PROJECT_PLAN_STATUS_SYNCED';

      const audit = manager.create(AuditLog, {
        table_name: 'project_management_reviews',
        record_id: review.id,
        action: auditAction,
        old_value: { status: oldStatus },
        new_value: {
          status: targetStatus,
          decidedBy: actorId,
          decidedAt: decisionDate.toISOString(),
          reviewerRole,
          taskId: payload.taskId || relatedTask?.id || null,
          transitionId: payload.transitionId || relatedTransition?.id || null,
          fromNode,
          toNode,
        },
        created_by: actorId || 1,
      });
      await manager.save(AuditLog, audit);

      this.logger.log(
        `[ManagementReviewSyncService] Synchronized Project #${projectId} to '${targetStatus}' (Decided by: ${actorId}, Role: ${reviewerRole}).`,
      );

      return {
        synchronized: true,
        reviewId: review.id,
        status: review.status,
        alreadySynced: false,
      };
    });
  }

  /**
   * Explicit, idempotent repair method for past out-of-sync projects (e.g. Project #6).
   * Runs in an audited transaction and projects the latest Workflow Engine state into project_management_reviews.
   */
  async repairProjectManagementReviewProjection(
    projectId: number,
    operatorUserId: number = 1,
  ): Promise<ProjectManagementReview> {
    const instance = await this.instanceRepo.findOne({
      where: {
        entityType: 'PROJECT',
        entityId: Number(projectId),
      },
      relations: ['tasks', 'transitions'],
    });

    if (!instance) {
      throw new Error(`Workflow instance for Project #${projectId} not found.`);
    }

    const existingReview = await this.reviewRepo.findOne({ where: { projectId: Number(projectId) } });
    const projection = this.getProjectionService().buildProjection(instance, existingReview);

    const transitions = await this.transitionRepo.find({
      where: { instanceId: instance.id },
      order: { id: 'DESC' },
    });
    const latestApprove = transitions.find((t) => t.action === 'APPROVE');

    const decidedBy = latestApprove?.actorId || projection.lastApprovedBy?.id || operatorUserId;
    const decidedAt = latestApprove?.createdAt
      ? new Date(latestApprove.createdAt)
      : projection.lastApprovedAt
      ? new Date(projection.lastApprovedAt)
      : new Date();
    const comments = latestApprove?.reason || 'Repaired projection from canonical Workflow Engine state';


    return await this.dataSource.transaction(async (manager) => {
      let review = await manager.findOne(ProjectManagementReview, {
        where: { projectId: Number(projectId) },
        lock: { mode: 'pessimistic_write' },
      });

      const oldStatus = review ? review.status : 'NOT_SUBMITTED';

      if (review) {
        review.status = projection.businessStatus;
        review.reviewerRole = projection.lastApprovedRole || projection.current.ownerRole;
        if (decidedBy) review.decidedBy = decidedBy;
        if (decidedAt) review.decidedAt = decidedAt;
        if (comments) review.revisionNotes = comments;
        review = await manager.save(ProjectManagementReview, review);
      } else {
        review = manager.create(ProjectManagementReview, {
          projectId: Number(projectId),
          status: projection.businessStatus,
          reviewerRole: projection.lastApprovedRole || projection.current.ownerRole,
          decidedBy,
          decidedAt,
          revisionNotes: comments,
        });
        review = await manager.save(ProjectManagementReview, review);
      }

      // Record repair audit log
      const audit = manager.create(AuditLog, {
        table_name: 'project_management_reviews',
        record_id: review.id,
        action: 'PROJECT_PLAN_PROJECTION_REPAIRED',
        user_id: operatorUserId,
        old_value: { status: oldStatus },
        new_value: {
          status: projection.businessStatus,
          currentNodeId: instance.currentNodeId,
          repairedBy: operatorUserId,
        },
        performed_at: new Date(),
      });
      await manager.save(AuditLog, audit);

      this.logger.log(
        `[ManagementReviewSyncService] Repaired Project #${projectId} projection to '${projection.businessStatus}' (Current node: ${instance.currentNodeId}).`,
      );

      return review;
    });
  }

}
