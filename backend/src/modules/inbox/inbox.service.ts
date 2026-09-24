import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { NotificationService } from '../notification/notification.service';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { Tender, TenderStage, GoNoGoStatus } from '../../entities/tender.entity';
import { TodoReadModelDto, InboxSummaryDto } from './inbox.dto';

const LEGAL_REVIEW_ROLES = ['LEGAL', 'SUPER_ADMIN', 'ADMIN', 'DIRECTOR'];
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
          todos.push({
            todoId: `tender-${tender.id}`,
            sourceType: 'DOMAIN_TENDER',
            sourceId: String(tender.id),
            assignedRole: 'DIRECTOR',
            entityType: 'TENDER',
            entityId: Number(tender.id),
            actionType: 'GO_NOGO_APPROVAL',
            // TARGET_REQUIRES_ACTION_UI: sales/tenders/[id] lacks actionable Go/No-Go decision UI
            actionTarget: null,
            title: `Persetujuan GO / NO GO: ${tender.title || `Tender #${tender.id}`}`,
            description: (tender as any).notes || undefined,
            status: 'WAITING_GO_NO_GO',
            dueAt: tender.submission_deadline ? new Date(tender.submission_deadline).toISOString() : undefined,
            createdAt: tender.created_at ? new Date(tender.created_at).toISOString() : new Date().toISOString(),
            updatedAt: tender.updated_at ? new Date(tender.updated_at).toISOString() : undefined,
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
}
