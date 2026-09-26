import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { NotificationService } from '../notification/notification.service';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { Tender, TenderStage, GoNoGoStatus } from '../../entities/tender.entity';
import { TodoReadModelDto, InboxSummaryDto } from './inbox.dto';

const LEGAL_REVIEW_ROLES = ['LEGAL', 'SUPER_ADMIN', 'ADMIN'];
const TENDER_GO_NOGO_ROLES = ['DIRECTOR', 'GENERAL_MANAGER', 'SUPER_ADMIN'];

export const GOVERNANCE_MANAGEMENT_REVIEW_NODES = [
  'node_hops_review',
  'node_procurement_review',
  'node_finance_review',
  'node_director_approval',
];

export const PM_REVISION_NODES = [
  'node_pm_revision_hops',
  'node_pm_revision_procurement',
  'node_pm_revision_finance',
  'node_pm_revision_director',
];

@Injectable()
export class InboxService {
  private readonly logger = new Logger(InboxService.name);

  constructor(
    private readonly workflowEngineService: WorkflowEngineService,
    private readonly notificationService: NotificationService,
    @InjectRepository(Contract)
    private readonly contractRepo: Repository<Contract>,
    @InjectRepository(Tender)
    private readonly tenderRepo: Repository<Tender>,
  ) {}

  /**
   * Retrieves all pending actionable tasks for the current authenticated user and their roles.
   * Aggregates authoritative workflow tasks and domain queues without duplicating data.
   */
  async getTodos(userId: number, roles: string[] = []): Promise<TodoReadModelDto[]> {
    const todos: TodoReadModelDto[] = [];
    const normalizedRoles = roles.map((r) => String(r).toUpperCase());

    // 1. Authoritative Workflow Tasks
    try {
      const workflowTasks = await this.workflowEngineService.getMyTasks(userId, normalizedRoles);
      for (const task of workflowTasks) {
        const entityType = task.workflowInstance?.entityType || 'WORKFLOW';
        const entityId = Number(task.workflowInstance?.entityId || 0);

        let actionType = task.taskKey || 'WORKFLOW_TASK';
        let actionTarget: string | null = null;
        let title = `Tugas Alur Kerja: ${task.taskKey || task.id}`;
        let projectId: number | undefined;
        let projectName: string | undefined;
        let customerName: string | undefined;
        let submittedByName: string | undefined;
        let returnedByName: string | undefined;
        let returnReason: string | undefined;

        if (entityType === 'PURCHASE_REQUEST') {
          actionType = 'PURCHASE_REQUEST_APPROVAL';
          actionTarget = entityId > 0 ? `/procurement?tab=pr&prId=${entityId}` : null;
          title = `Review & Persetujuan Purchase Request #${entityId}`;
          if (task.workflowInstance?.context?.projectId) {
            projectId = Number(task.workflowInstance.context.projectId);
          }
        } else if (entityType === 'PROJECT') {
          const resolvedProjectId =
            entityId > 0
              ? entityId
              : Number(task.workflowInstance?.context?.projectId || 0) || undefined;
          projectId = resolvedProjectId;

          if (task.nodeId && PM_REVISION_NODES.includes(task.nodeId)) {
            actionType = 'PM_REVISION';
            actionTarget = resolvedProjectId
              ? `/project-delivery?projectId=${resolvedProjectId}&action=operational-plan`
              : null;
            title = `Revisi Rencana Operasional Proyek #${entityId}`;
          } else if (task.nodeId && GOVERNANCE_MANAGEMENT_REVIEW_NODES.includes(task.nodeId)) {
            actionType = 'MANAGEMENT_REVIEW';
            actionTarget =
              resolvedProjectId && task.id
                ? `/governance/tasks?taskId=${task.id}&projectId=${resolvedProjectId}`
                : null;
            title = `Review Rencana Operasional Proyek #${entityId}`;
          } else {
            // Unmapped project task node: explicit unresolved state
            actionType = task.taskKey || 'WORKFLOW_TASK';
            actionTarget = null;
            title = `Tugas Proyek: ${task.taskKey || task.id}`;
          }
        } else if (entityType === 'TENDER') {
          if (task.taskKey === 'GO_NOGO_APPROVAL') {
            actionType = 'GO_NOGO_APPROVAL';
            actionTarget = entityId > 0 ? `/sales?tab=1&tenderId=${entityId}&action=go-nogo` : null;
            title = 'Persetujuan GO / NO-GO';

            const context = await this.enrichTenderBusinessContext(
              entityId,
              task.workflowInstance?.id ? Number(task.workflowInstance.id) : undefined,
            );
            projectName = context.projectName;
            customerName = context.customerName;
            submittedByName = context.submittedByName;
          } else if (task.taskKey === 'GO_NOGO_REVISION') {
            actionType = 'GO_NOGO_REVISION';
            actionTarget = entityId > 0 ? `/sales?tab=1&tenderId=${entityId}&action=go-nogo` : null;
            title = 'Revisi GO / NO-GO';

            const context = await this.enrichTenderBusinessContext(
              entityId,
              task.workflowInstance?.id ? Number(task.workflowInstance.id) : undefined,
            );
            projectName = context.projectName;
            customerName = context.customerName;
            returnedByName = context.returnedByName;
            returnReason = context.returnReason;
          } else {
            actionType = task.taskKey || 'WORKFLOW_TASK';
            actionTarget = null;
            title = `Tugas Tender: ${task.taskKey || task.id}`;
          }
        } else {
          // Generic unmapped workflow task: explicit unresolved state (no /inbox fallback)
          actionType = task.taskKey || 'WORKFLOW_TASK';
          actionTarget = null;
        }

        todos.push({
          todoId: `wf-${task.id}`,
          sourceType: 'WORKFLOW_TASK',
          sourceId: String(task.id),
          taskId: Number(task.id),
          assignedUserId: task.assigneeUserId ? Number(task.assigneeUserId) : undefined,
          assignedRole: task.assigneeRole?.name || undefined,
          entityType,
          entityId,
          projectId,
          actionType,
          actionTarget,
          title,
          description: task.comments || undefined,
          status: task.status,
          dueAt: task.dueAt ? new Date(task.dueAt).toISOString() : undefined,
          createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : new Date().toISOString(),
          updatedAt: task.updatedAt ? new Date(task.updatedAt).toISOString() : undefined,
          projectName,
          customerName,
          submittedByName,
          returnedByName,
          returnReason,
        });
      }
    } catch (err: any) {
      this.logger.error(`Failed to fetch workflow tasks: ${err.message}`, err.stack);
    }

    // 2. Authoritative Domain Queue: Legal Review
    const hasLegalRole = normalizedRoles.some((role) => LEGAL_REVIEW_ROLES.includes(role));
    if (hasLegalRole) {
      try {
        const pendingContracts = await this.contractRepo
          .createQueryBuilder('contract')
          .where('contract.status = :status', { status: 'PENDING_LEGAL_REVIEW' })
          .andWhere('contract.legal_status IN (:...legalStatuses)', {
            legalStatuses: [LegalStatus.DRAFT, LegalStatus.ON_REVIEW, LegalStatus.REVISION_REQUESTED],
          })
          .orderBy('contract.id', 'DESC')
          .getMany();

        for (const contract of pendingContracts) {
          todos.push({
            todoId: `contract-${contract.id}`,
            sourceType: 'DOMAIN_CONTRACT',
            sourceId: String(contract.id),
            assignedRole: 'LEGAL',
            entityType: 'CONTRACT',
            entityId: Number(contract.id),
            actionType: 'LEGAL_REVIEW',
            actionTarget: `/legal/review?contractId=${contract.id}`,
            title: `Review Kontrak #${contract.contract_number || contract.id}`,
            description: contract.legal_notes || undefined,
            status: contract.legal_status || 'PENDING_LEGAL_REVIEW',
            dueAt: contract.grace_deadline ? new Date(contract.grace_deadline).toISOString() : undefined,
            createdAt: contract.created_at ? new Date(contract.created_at).toISOString() : new Date().toISOString(),
            updatedAt: contract.updated_at ? new Date(contract.updated_at).toISOString() : undefined,
          });
        }
      } catch (err: any) {
        this.logger.error(`Failed to fetch pending contracts: ${err.message}`, err.stack);
      }
    }

    // 3. Authoritative Domain Queue: Tender Go/No-Go Decision
    const hasGoNoGoRole = normalizedRoles.some((role) => TENDER_GO_NOGO_ROLES.includes(role));
    if (hasGoNoGoRole) {
      try {
        const pendingTenders = await this.tenderRepo
          .createQueryBuilder('tender')
          .where('tender.stage = :stage', { stage: TenderStage.WAITING_GO_NO_GO })
          .andWhere('tender.go_nogo_status = :goNoGoStatus', { goNoGoStatus: GoNoGoStatus.PENDING })
          .orderBy('tender.id', 'DESC')
          .getMany();

        for (const tender of pendingTenders) {
          // Transitional Deduplication: Suppress DOMAIN_TENDER only when WORKFLOW_TASK for the same tender approval is present
          const hasMatchingWorkflowTask = todos.some(
            (t) =>
              t.sourceType === 'WORKFLOW_TASK' &&
              t.entityType === 'TENDER' &&
              Number(t.entityId) === Number(tender.id) &&
              t.actionType === 'GO_NOGO_APPROVAL',
          );
          if (hasMatchingWorkflowTask) {
            continue;
          }

          const context = await this.enrichTenderBusinessContext(tender.id);

          todos.push({
            todoId: `tender-${tender.id}`,
            sourceType: 'DOMAIN_TENDER',
            sourceId: String(tender.id),
            assignedRole: 'DIRECTOR',
            entityType: 'TENDER',
            entityId: Number(tender.id),
            actionType: 'GO_NOGO_APPROVAL',
            actionTarget: `/sales?tab=1&tenderId=${tender.id}&action=go-nogo`,
            title: 'Persetujuan GO / NO-GO',
            description: (tender as any).notes || undefined,
            status: 'WAITING_GO_NO_GO',
            dueAt: tender.submission_deadline ? new Date(tender.submission_deadline).toISOString() : undefined,
            createdAt: tender.created_at ? new Date(tender.created_at).toISOString() : new Date().toISOString(),
            updatedAt: tender.updated_at ? new Date(tender.updated_at).toISOString() : undefined,
            projectName: context.projectName || tender.title || undefined,
            customerName: context.customerName || tender.customer?.name || undefined,
            submittedByName: context.submittedByName,
          });
        }
      } catch (err: any) {
        this.logger.error(`Failed to fetch pending tenders: ${err.message}`, err.stack);
      }
    }

    // 4. Deterministic Ordering:
    // 1st: Overdue tasks (dueAt < now, earliest dueAt first)
    // 2nd: Upcoming due dates (dueAt >= now, earliest dueAt first)
    // 3rd: Newest createdAt (newest created first)
    const now = Date.now();
    todos.sort((a, b) => {
      const dueA = a.dueAt ? new Date(a.dueAt).getTime() : null;
      const dueB = b.dueAt ? new Date(b.dueAt).getTime() : null;

      const isOverdueA = dueA !== null && dueA < now;
      const isOverdueB = dueB !== null && dueB < now;

      if (isOverdueA && !isOverdueB) return -1;
      if (!isOverdueA && isOverdueB) return 1;
      if (isOverdueA && isOverdueB) return (dueA as number) - (dueB as number);

      const hasDueA = dueA !== null;
      const hasDueB = dueB !== null;
      if (hasDueA && !hasDueB) return -1;
      if (!hasDueA && hasDueB) return 1;
      if (hasDueA && hasDueB) {
        const diff = (dueA as number) - (dueB as number);
        if (diff !== 0) return diff;
      }

      const createdA = new Date(a.createdAt).getTime();
      const createdB = new Date(b.createdAt).getTime();
      return createdB - createdA;
    });

    return todos;
  }

  /**
   * Retrieves summary counts: pending To-Dos (actionable) vs unread Notifications (informational).
   */
  async getSummary(userId: number, roles: string[] = []): Promise<InboxSummaryDto> {
    const todos = await this.getTodos(userId, roles);
    const unreadNotificationCount = await this.notificationService.getUnreadCount(userId);

    return {
      todoCount: todos.length,
      unreadNotificationCount,
    };
  }

  /**
   * Authoritative business context enrichment for Tender Go/No-Go To-Do cards.
   * Resolves actual Tender Title (Project Name), Customer Name, authoritative Submitter Name,
   * and authoritative Return Actor / Return Reason (for revisions).
   */
  private async enrichTenderBusinessContext(
    tenderId: number,
    workflowInstanceId?: number,
  ): Promise<{
    projectName?: string;
    customerName?: string;
    submittedByName?: string;
    returnedByName?: string;
    returnReason?: string;
  }> {
    try {
      let projectName: string | undefined;
      let customerName: string | undefined;
      let submittedByName: string | undefined;
      let returnedByName: string | undefined;
      let returnReason: string | undefined;

      let tenderEntity: Tender | null = null;
      if (typeof this.tenderRepo.findOne === 'function') {
        tenderEntity = await this.tenderRepo.findOne({
          where: { id: tenderId },
          relations: ['customer'],
        });
        if (tenderEntity) {
          projectName = tenderEntity.title || undefined;
          customerName = tenderEntity.customer?.name || undefined;
        }
      }

      // --- SUBMISSION ACTOR RESOLUTION (for GO_NOGO_APPROVAL) ---
      // 1. Authoritative transition record (START or RESUBMIT action)
      if (workflowInstanceId && this.tenderRepo.manager && typeof this.tenderRepo.manager.createQueryBuilder === 'function') {
        try {
          const transition = await this.tenderRepo.manager
            .createQueryBuilder('workflow_transitions', 'wt')
            .leftJoin('users', 'u', 'u.id = wt.actor_id')
            .select(['wt.actor_id AS actorId', 'u.full_name AS fullName'])
            .where('wt.instance_id = :instanceId', { instanceId: workflowInstanceId })
            .andWhere('wt.action IN (:...actions)', { actions: ['START', 'RESUBMIT'] })
            .orderBy('wt.id', 'DESC')
            .getRawOne();

          if (transition?.fullName) {
            submittedByName = transition.fullName;
          }
        } catch {
          // ignore error and proceed to fallback
        }
      }

      // 2. Authoritative TenderActivity submission log
      if (!submittedByName && this.tenderRepo.manager && typeof this.tenderRepo.manager.createQueryBuilder === 'function') {
        try {
          const activity = await this.tenderRepo.manager
            .createQueryBuilder('tender_activities', 'ta')
            .leftJoin('users', 'u', 'u.id = ta.user_id')
            .select(['ta.user_id AS userId', 'u.full_name AS fullName'])
            .where('ta.tender_id = :tenderId', { tenderId })
            .andWhere('ta.content LIKE :pattern', { pattern: '%submitted tender for GO / NO GO review%' })
            .orderBy('ta.id', 'DESC')
            .getRawOne();

          if (activity?.fullName) {
            submittedByName = activity.fullName;
          }
        } catch {
          // ignore error and proceed to fallback
        }
      }

      // 3. WorkflowInstance creator fallback
      if (!submittedByName && workflowInstanceId && this.tenderRepo.manager && typeof this.tenderRepo.manager.createQueryBuilder === 'function') {
        try {
          const instance = await this.tenderRepo.manager
            .createQueryBuilder('workflow_instances', 'wi')
            .leftJoin('users', 'u', 'u.id = wi.created_by')
            .select(['wi.created_by AS createdBy', 'u.full_name AS fullName'])
            .where('wi.id = :instanceId', { instanceId: workflowInstanceId })
            .getRawOne();

          if (instance?.fullName) {
            submittedByName = instance.fullName;
          }
        } catch {
          // ignore error
        }
      }

      // --- RETURN ACTOR & RETURN REASON RESOLUTION (for GO_NOGO_REVISION) ---
      // 1. Authoritative transition record (RETURN action)
      if (workflowInstanceId && this.tenderRepo.manager && typeof this.tenderRepo.manager.createQueryBuilder === 'function') {
        try {
          const returnTransition = await this.tenderRepo.manager
            .createQueryBuilder('workflow_transitions', 'wt')
            .leftJoin('users', 'u', 'u.id = wt.actor_id')
            .select(['wt.actor_id AS actorId', 'u.full_name AS fullName', 'wt.reason AS reason'])
            .where('wt.instance_id = :instanceId', { instanceId: workflowInstanceId })
            .andWhere('wt.action = :action', { action: 'RETURN' })
            .orderBy('wt.id', 'DESC')
            .getRawOne();

          if (returnTransition) {
            if (returnTransition.fullName) returnedByName = returnTransition.fullName;
            if (returnTransition.reason) returnReason = returnTransition.reason;
          }
        } catch {
          // ignore error and proceed to fallback
        }
      }

      // 2. Authoritative completed RETURN task fallback
      if ((!returnedByName || !returnReason) && workflowInstanceId && this.tenderRepo.manager && typeof this.tenderRepo.manager.createQueryBuilder === 'function') {
        try {
          const returnTask = await this.tenderRepo.manager
            .createQueryBuilder('workflow_tasks', 'wt')
            .leftJoin('users', 'u', 'u.id = wt.decided_by')
            .select(['wt.decided_by AS actorId', 'u.full_name AS fullName', 'wt.comments AS comments'])
            .where('wt.workflow_instance_id = :instanceId', { instanceId: workflowInstanceId })
            .andWhere('wt.task_key = :taskKey', { taskKey: 'GO_NOGO_APPROVAL' })
            .andWhere('wt.action = :action', { action: 'RETURN' })
            .orderBy('wt.id', 'DESC')
            .getRawOne();

          if (returnTask) {
            if (!returnedByName && returnTask.fullName) returnedByName = returnTask.fullName;
            if (!returnReason && returnTask.comments) returnReason = returnTask.comments;
          }
        } catch {
          // ignore error and proceed to fallback
        }
      }

      // 3. Domain tender go_nogo_notes / go_nogo_by fallback
      if ((!returnedByName || !returnReason) && this.tenderRepo.manager && typeof this.tenderRepo.manager.createQueryBuilder === 'function') {
        try {
          const tenderRow = await this.tenderRepo.manager
            .createQueryBuilder('tenders', 't')
            .leftJoin('users', 'u', 'u.id = t.go_nogo_by')
            .select(['t.go_nogo_by AS goNoGoBy', 'u.full_name AS fullName', 't.go_nogo_notes AS goNoGoNotes'])
            .where('t.id = :tenderId', { tenderId })
            .getRawOne();

          if (tenderRow) {
            if (!returnedByName && tenderRow.fullName) returnedByName = tenderRow.fullName;
            if (!returnReason && tenderRow.goNoGoNotes) returnReason = tenderRow.goNoGoNotes;
          }
        } catch {
          // ignore error
        }
      }

      return { projectName, customerName, submittedByName, returnedByName, returnReason };
    } catch (err: any) {
      this.logger.error(`Failed to enrich tender business context for tender #${tenderId}: ${err.message}`, err.stack);
      return {};
    }
  }
}
