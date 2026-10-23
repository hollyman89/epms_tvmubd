import { Injectable, Logger, Optional } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, In } from 'typeorm';
import { WorkflowEngineService } from '../workflow-engine/workflow-engine.service';
import { NotificationService } from '../notification/notification.service';
import { FinanceService } from '../finance/finance.service';
import { Contract, LegalStatus } from '../../entities/contract.entity';
import { Tender, TenderStage, GoNoGoStatus } from '../../entities/tender.entity';
import { PaymentRequest, PaymentRequestStatus } from '../../entities/payment-request.entity';
import { ProjectProgressLog } from '../../entities/project-progress-log.entity';
import { ServiceClaim, ServiceClaimStatus } from '../../entities/service-claim.entity';
import { ProjectClosure, ProjectClosureStatus } from '../../entities/project-closure.entity';
import { WorkflowTask, WorkflowTaskStatus } from '../../entities/workflow-task.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { Rfq } from '../../entities/rfq.entity';
import { TodoReadModelDto, InboxSummaryDto, HistoryItemDto } from './inbox.dto';
import { evaluateMarketingActionItem } from '../marketing/marketing-action-item.predicate';

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
    @InjectRepository(PaymentRequest)
    private readonly paymentRequestRepo: Repository<PaymentRequest>,
    @InjectRepository(ProjectProgressLog)
    private readonly progressLogRepo: Repository<ProjectProgressLog>,
    @InjectRepository(ServiceClaim)
    private readonly claimRepo: Repository<ServiceClaim>,
    @InjectRepository(ProjectClosure)
    private readonly closureRepo: Repository<ProjectClosure>,
    @InjectRepository(WorkflowTask)
    private readonly taskRepo: Repository<WorkflowTask>,
    @Optional()
    @InjectRepository(PurchaseRequest)
    private readonly purchaseRequestRepo?: Repository<PurchaseRequest>,
    @Optional()
    @InjectRepository(Rfq)
    private readonly rfqRepo?: Repository<Rfq>,
    @Optional()
    private readonly financeService?: FinanceService,
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
        let description: string | undefined;
        let ctaLabel: string | undefined;
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
        } else if (entityType === 'CONTRACT') {
          let resolvedTenderId = task.workflowInstance?.context?.tenderId
            ? Number(task.workflowInstance.context.tenderId)
            : undefined;
          let contractNumber = task.workflowInstance?.context?.contractNumber;

          if (!resolvedTenderId || !contractNumber) {
            try {
              const contract = await this.contractRepo.findOne({
                where: { id: entityId },
                relations: ['proposal'],
              });
              if (contract) {
                resolvedTenderId = contract.tender_id || contract.proposal?.tender_id;
                contractNumber = contract.contract_number;
              }
            } catch (err: any) {
              this.logger.warn(`Could not resolve contract context for contract #${entityId}: ${err?.message}`);
            }
          }

          if (task.taskKey === 'LEGAL_DOCUMENT_REVISION' || task.nodeId === 'node_marketing_revision') {
            actionType = 'LEGAL_DOCUMENT_REVISION';
            actionTarget = resolvedTenderId ? `/sales?tab=1&tenderId=${resolvedTenderId}` : null;
            title = `Revisi Dokumen SPK / Kontrak #${contractNumber || entityId}`;

            if (resolvedTenderId) {
              const context = await this.enrichTenderBusinessContext(
                resolvedTenderId,
                task.workflowInstance?.id ? Number(task.workflowInstance.id) : undefined,
              );
              projectName = context.projectName;
              customerName = context.customerName;
              returnedByName = context.returnedByName;
              returnReason = context.returnReason;
            }
          } else if (task.taskKey === 'LEGAL_REVIEW' || task.nodeId === 'node_legal_review') {
            actionType = 'LEGAL_REVIEW';
            actionTarget = `/legal/review?contractId=${entityId}`;
            title = `Review Legal Kontrak #${contractNumber || entityId}`;
          } else {
            actionType = task.taskKey || 'WORKFLOW_TASK';
            actionTarget = null;
            title = `Tugas Kontrak: ${task.taskKey || task.id}`;
          }
        } else if (entityType === 'PROJECT_CLOSURE') {
          let resolvedProjectId =
            task.workflowInstance?.context?.projectId &&
            !isNaN(Number(task.workflowInstance.context.projectId)) &&
            Number(task.workflowInstance.context.projectId) > 0
              ? Number(task.workflowInstance.context.projectId)
              : undefined;

          let resolvedProjectName =
            task.workflowInstance?.context?.projectName ||
            (task.workflowInstance as any)?.project?.name;

          let closureRecord: ProjectClosure | null = null;
          if (entityId > 0 && this.closureRepo) {
            try {
              closureRecord = await this.closureRepo.findOne({
                where: { id: entityId },
                relations: ['project', 'submittedBy'],
              });
              if (closureRecord?.project?.name) {
                resolvedProjectName = closureRecord.project.name;
              }
              if (closureRecord?.project?.id) {
                resolvedProjectId = closureRecord.project.id;
              }
              if (closureRecord?.submittedBy?.fullName && !submittedByName) {
                submittedByName = closureRecord.submittedBy.fullName;
              }
            } catch (err: any) {
              this.logger.warn(`Could not resolve closure context for closure #${entityId}: ${err?.message}`);
            }
          }

          projectId = resolvedProjectId;
          const safeProjectName =
            resolvedProjectName && !resolvedProjectName.match(/^Proyek\s*#\d+$/i)
              ? resolvedProjectName
              : undefined;
          projectName = safeProjectName;
          const displayProjectName = safeProjectName || 'proyek ini';

          const isHooReview =
            task.nodeId === 'node_hoo_review' ||
            task.taskKey === 'HOO_REVIEW' ||
            task.taskKey === 'PROJECT_CLOSURE_HOO_REVIEW';

          const isDirectorApproval =
            task.nodeId === 'node_director_approval' ||
            task.taskKey === 'DIRECTOR_APPROVAL' ||
            task.taskKey === 'PROJECT_CLOSURE_DIRECTOR_APPROVAL';

          if (isHooReview) {
            actionType = 'PROJECT_CLOSURE_HOO_REVIEW';
            actionTarget =
              resolvedProjectId && task.id
                ? `/governance/tasks?taskId=${task.id}&projectId=${resolvedProjectId}`
                : null;
            title = 'Penutupan Proyek Menunggu Peninjauan';
            description = `PM telah mengajukan penutupan proyek "${displayProjectName}". Silakan tinjau kelengkapan pengajuan sebelum diteruskan ke Direktur.`;
            ctaLabel = 'Tinjau Pengajuan';
          } else if (isDirectorApproval) {
            actionType = 'PROJECT_CLOSURE_DIRECTOR_APPROVAL';
            actionTarget =
              resolvedProjectId && task.id
                ? `/governance/tasks?taskId=${task.id}&projectId=${resolvedProjectId}`
                : null;
            title = 'Penutupan Proyek Menunggu Persetujuan Anda';
            description = `Head of Operations telah menyelesaikan peninjauan penutupan proyek "${displayProjectName}" dan meneruskannya kepada Anda untuk keputusan akhir.`;
            ctaLabel = 'Tinjau & Beri Keputusan';
          } else if (task.nodeId?.includes('revision') || task.taskKey?.includes('REVISION')) {
            actionType = 'PROJECT_CLOSURE_REVISION';
            actionTarget = resolvedProjectId
              ? `/project-delivery?view=workspace&projectId=${resolvedProjectId}&section=closure`
              : null;
            title = 'Pengajuan Penutupan Proyek Perlu Diperbaiki';
            description = `Pengajuan penutupan proyek "${displayProjectName}" dikembalikan untuk diperbaiki. Silakan lihat catatan reviewer, lakukan perbaikan, lalu ajukan kembali.`;
            ctaLabel = 'Lihat Catatan & Perbaiki';
          } else {
            actionType = task.taskKey || 'WORKFLOW_TASK';
            actionTarget =
              resolvedProjectId && task.id
                ? `/governance/tasks?taskId=${task.id}&projectId=${resolvedProjectId}`
                : null;
            title = `Tugas Penutupan Proyek: ${task.taskKey || task.id}`;
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
          description: description || task.comments || undefined,
          ctaLabel,
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

    // 4. Authoritative Domain Queue: Payment Requests (Finance & Director)
    const isDirector = normalizedRoles.some((r) => r === 'DIRECTOR' || r === 'SUPER_ADMIN');
    const isFinance = normalizedRoles.some((r) => r === 'FINANCE' || r === 'SUPER_ADMIN');

    if (isDirector) {
      try {
        const pendingApprovalRequests = await this.paymentRequestRepo.find({
          where: { status: PaymentRequestStatus.PENDING_DIRECTOR_APPROVAL },
          relations: ['invoice', 'invoice.purchaseOrder', 'invoice.purchaseOrder.vendor', 'requester'],
          order: { id: 'DESC' },
        });

        for (const prq of pendingApprovalRequests) {
          todos.push({
            todoId: `prq-${prq.id}`,
            sourceType: 'DOMAIN_PAYMENT_REQUEST',
            sourceId: String(prq.id),
            assignedRole: 'DIRECTOR',
            entityType: 'PEMBAYARAN',
            entityId: Number(prq.id),
            actionType: 'PAYMENT_REQUEST_APPROVAL',
            actionTarget: `/finance/payments?tab=approvals&requestId=${prq.id}`,
            title: `Persetujuan Pembayaran`,
            description: `Pengajuan pembayaran ${prq.requestNumber} untuk invoice ${prq.invoice?.invoiceNumber || '#' + prq.invoiceId} menunggu persetujuan Direktur.`,
            status: prq.status,
            createdAt: prq.submittedAt ? new Date(prq.submittedAt).toISOString() : new Date().toISOString(),
            projectName: prq.invoice?.purchaseOrder?.poNumber || undefined,
            customerName: prq.invoice?.purchaseOrder?.vendor?.name || undefined,
            submittedByName: prq.requester?.fullName || 'Finance User',
          });
        }
      } catch (err: any) {
        this.logger.error(`Failed to fetch pending approval payment requests: ${err.message}`, err.stack);
      }
    }

    if (isFinance) {
      try {
        const financeActionableRequests = await this.paymentRequestRepo.find({
          where: {
            status: In([
              PaymentRequestStatus.NEEDS_REVISION,
              PaymentRequestStatus.APPROVED_FOR_PAYMENT,
            ]),
          },
          relations: ['invoice', 'invoice.purchaseOrder', 'invoice.purchaseOrder.vendor', 'requester', 'approver'],
          order: { id: 'DESC' },
        });

        for (const prq of financeActionableRequests) {
          if (prq.status === PaymentRequestStatus.NEEDS_REVISION) {
            todos.push({
              todoId: `prq-rev-${prq.id}`,
              sourceType: 'DOMAIN_PAYMENT_REQUEST',
              sourceId: String(prq.id),
              assignedRole: 'FINANCE',
              entityType: 'PEMBAYARAN',
              entityId: Number(prq.id),
              actionType: 'PAYMENT_REQUEST_REVISION',
              actionTarget: `/finance/payments?tab=requests&requestId=${prq.id}`,
              title: `Revisi Pengajuan Pembayaran`,
              description: prq.revisionNotes ? `${prq.requestNumber}: ${prq.revisionNotes}` : `Revisi pengajuan pembayaran ${prq.requestNumber}`,
              status: prq.status,
              createdAt: prq.returnedAt ? new Date(prq.returnedAt).toISOString() : new Date().toISOString(),
              projectName: prq.invoice?.purchaseOrder?.poNumber || undefined,
              customerName: prq.invoice?.purchaseOrder?.vendor?.name || undefined,
              returnedByName: prq.approver?.fullName || 'Direktur',
              returnReason: prq.revisionNotes || undefined,
            });
          } else if (prq.status === PaymentRequestStatus.APPROVED_FOR_PAYMENT) {
            todos.push({
              todoId: `prq-pay-${prq.id}`,
              sourceType: 'DOMAIN_PAYMENT_REQUEST',
              sourceId: String(prq.id),
              assignedRole: 'FINANCE',
              entityType: 'PEMBAYARAN',
              entityId: Number(prq.id),
              actionType: 'PROCESS_PAYMENT',
              actionTarget: `/finance/payments?tab=ready_to_pay&requestId=${prq.id}`,
              title: `Proses Pembayaran`,
              description: `Tagihan ${prq.requestNumber} (${prq.invoice?.invoiceNumber || ''}) siap diproses pembayaran setelah disetujui Direktur.`,
              status: prq.status,
              createdAt: prq.approvedAt ? new Date(prq.approvedAt).toISOString() : new Date().toISOString(),
              projectName: prq.invoice?.purchaseOrder?.poNumber || undefined,
              customerName: prq.invoice?.purchaseOrder?.vendor?.name || undefined,
            });
          }
        }
      } catch (err: any) {
        this.logger.error(`Failed to fetch finance actionable payment requests: ${err.message}`, err.stack);
      }

      // 4.b Authoritative Domain Queue: Eligible Invoicing Obligations (Material PO with GR & Approved Service Claims)
      if (this.financeService) {
        try {
          const eligibleObligations = await this.financeService.getEligibleInvoiceObligations();
          for (const obl of eligibleObligations) {
            if (obl.orderType === 'MATERIAL') {
              todos.push({
                todoId: `finance-invoice-po-${obl.poId}-term-${obl.paymentTermId || 'full'}`,
                sourceType: 'DOMAIN_INVOICE',
                sourceId: `po-${obl.poId}-term-${obl.paymentTermId || 'full'}`,
                assignedRole: 'FINANCE',
                entityType: 'PURCHASE_ORDER',
                entityId: Number(obl.poId),
                projectId: obl.projectId ? Number(obl.projectId) : undefined,
                actionType: 'CREATE_INVOICE',
                actionTarget: obl.actionTarget,
                title: `Buat Invoice PO ${obl.poNumber}`,
                description: obl.paymentTermName
                  ? `PO material telah memenuhi syarat penagihan (${obl.paymentTermName} - Rp ${Number(obl.amount || 0).toLocaleString('id-ID')}).`
                  : `PO material ${obl.poNumber} telah selesai pengiriman dan siap ditagihkan.`,
                status: 'READY_TO_INVOICE',
                createdAt: obl.eligibleAt ? new Date(obl.eligibleAt).toISOString() : new Date().toISOString(),
                projectName: obl.projectName,
                customerName: obl.vendorName,
                ctaLabel: 'Buat Invoice',
              });
            } else if (obl.orderType === 'SERVICE') {
              todos.push({
                todoId: `finance-invoice-claim-${obl.serviceClaimId}`,
                sourceType: 'DOMAIN_SERVICE_CLAIM',
                sourceId: `claim-${obl.serviceClaimId}`,
                assignedRole: 'FINANCE',
                entityType: 'SERVICE_CLAIM',
                entityId: Number(obl.serviceClaimId),
                projectId: obl.projectId ? Number(obl.projectId) : undefined,
                actionType: 'CREATE_INVOICE',
                actionTarget: obl.actionTarget,
                title: `Buat Invoice Klaim Jasa ${obl.serviceClaimNumber || '#' + obl.serviceClaimId}`,
                description: `Klaim jasa senilai Rp ${Number(obl.amount || 0).toLocaleString('id-ID')} telah disetujui komersial untuk penagihan.`,
                status: 'APPROVED_FOR_INVOICE',
                createdAt: obl.eligibleAt ? new Date(obl.eligibleAt).toISOString() : new Date().toISOString(),
                projectName: obl.projectName,
                customerName: obl.vendorName,
                ctaLabel: 'Buat Invoice',
              });
            }
          }
        } catch (err: any) {
          this.logger.error(`Failed to fetch eligible invoice obligations for Finance: ${err.message}`, err.stack);
        }
      }
    }

    // 5. Authoritative Domain Queue: Project Progress Claim Verification (HEAD_OF_OPERATIONS & PMO)
    const isProgressReviewer = normalizedRoles.some((role) =>
      ['HEAD_OF_OPERATIONS', 'PMO', 'SUPER_ADMIN'].includes(role),
    );
    if (isProgressReviewer && this.progressLogRepo) {
      try {
        const pendingClaims = await this.progressLogRepo
          .createQueryBuilder('log')
          .leftJoinAndSelect('log.task', 'task')
          .leftJoinAndSelect('log.submitter', 'submitter')
          .leftJoinAndSelect('log.project', 'project')
          .where('log.status = :status', { status: 'PENDING_VERIFICATION' })
          .orderBy('log.id', 'DESC')
          .getMany();

        for (const claim of pendingClaims) {
          // Segregation of Duties: Submitter cannot verify their own claim
          if (Number(claim.submitted_by) === Number(userId)) {
            continue;
          }

          const projectName = claim.project?.name || `Proyek #${claim.project_id}`;
          const taskName = claim.task?.name || `Task #${claim.task_id}`;
          const prevProg = Number(claim.previous_progress);
          const repProg = Number(claim.reported_progress);

          todos.push({
            todoId: `progress-claim-${claim.id}`,
            sourceType: 'DOMAIN_PROGRESS_CLAIM',
            sourceId: String(claim.id),
            taskId: Number(claim.task_id),
            assignedRole: 'HEAD_OF_OPERATIONS',
            entityType: 'PROJECT_PROGRESS_CLAIM',
            entityId: Number(claim.id),
            projectId: Number(claim.project_id),
            actionType: 'PROGRESS_CLAIM_VERIFICATION',
            actionTarget: `/project-delivery?view=workspace&projectId=${claim.project_id}&section=tasks&progressClaimId=${claim.id}`,
            title: `Verifikasi Klaim Progres: ${taskName} (${prevProg}% → ${repProg}%)`,
            description: claim.reason || 'Klaim progres kritis menunggu verifikasi',
            status: claim.status,
            createdAt: claim.created_at ? new Date(claim.created_at).toISOString() : new Date().toISOString(),
            updatedAt: claim.updated_at ? new Date(claim.updated_at).toISOString() : undefined,
            projectName,
            submittedByName: claim.submitter?.fullName || undefined,
          });
        }
      } catch (err: any) {
        this.logger.error(`Failed to fetch pending progress claims: ${err.message}`, err.stack);
      }
    }

    // 6. Authoritative Domain Queue: Service Claims (PM Technical Verification & Procurement Commercial Approval)
    const isProcurementRole = normalizedRoles.some((role) =>
      ['PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN'].includes(role),
    );

    if (this.claimRepo) {
      try {
        const actionableClaims = await this.claimRepo.find({
          where: {
            status: In([
              ServiceClaimStatus.SUBMITTED,
              ServiceClaimStatus.PM_VERIFIED,
              ServiceClaimStatus.NEEDS_REVISION,
            ]),
          },
          relations: ['project', 'purchaseOrder'],
          order: { id: 'DESC' },
        });

        for (const claim of actionableClaims) {
          // Transitional Deduplication with WORKFLOW_TASK
          const hasMatchingWfTask = todos.some(
            (t) =>
              t.sourceType === 'WORKFLOW_TASK' &&
              t.entityType === 'SERVICE_CLAIM' &&
              Number(t.entityId) === Number(claim.id),
          );
          if (hasMatchingWfTask) continue;

          const projectName = claim.project?.name || undefined;
          const poNumber = claim.purchaseOrder?.poNumber || String(claim.poId);

          // 6.1 SUBMITTED -> PM Technical Verification (assigned PM or SUPER_ADMIN)
          if (claim.status === ServiceClaimStatus.SUBMITTED) {
            const isAssignedPm =
              claim.project?.managerId !== undefined &&
              claim.project?.managerId !== null &&
              Number(claim.project.managerId) === Number(userId);

            if (isAssignedPm || normalizedRoles.includes('SUPER_ADMIN')) {
              todos.push({
                todoId: `service-claim-${claim.id}`,
                sourceType: 'DOMAIN_SERVICE_CLAIM',
                sourceId: String(claim.id),
                assignedUserId: claim.project?.managerId ? Number(claim.project.managerId) : undefined,
                assignedRole: 'PROJECT_MANAGER',
                entityType: 'SERVICE_CLAIM',
                entityId: Number(claim.id),
                projectId: Number(claim.projectId),
                actionType: 'SERVICE_CLAIM_VERIFICATION',
                actionTarget: `/project-delivery?projectId=${claim.projectId}&serviceClaimId=${claim.id}`,
                title: `Verifikasi Teknis Klaim Jasa #${claim.claimNumber}`,
                description: `Klaim jasa senilai Rp ${Number(claim.totalClaimAmount || 0).toLocaleString('id-ID')} untuk PO #${poNumber} menunggu verifikasi teknis PM.`,
                status: claim.status,
                createdAt: claim.submittedAt ? new Date(claim.submittedAt).toISOString() : (claim.createdAt ? new Date(claim.createdAt).toISOString() : new Date().toISOString()),
                updatedAt: claim.updatedAt ? new Date(claim.updatedAt).toISOString() : undefined,
                projectName,
              });
            }
          }

          // 6.2 PM_VERIFIED -> Procurement Commercial Approval (PROCUREMENT / PURCHASING / SUPER_ADMIN)
          if (claim.status === ServiceClaimStatus.PM_VERIFIED && isProcurementRole) {
            todos.push({
              todoId: `service-claim-comm-${claim.id}`,
              sourceType: 'DOMAIN_SERVICE_CLAIM',
              sourceId: String(claim.id),
              assignedRole: 'PROCUREMENT',
              entityType: 'SERVICE_CLAIM',
              entityId: Number(claim.id),
              projectId: Number(claim.projectId),
              actionType: 'SERVICE_CLAIM_COMMERCIAL_APPROVAL',
              actionTarget: `/procurement?tab=po&poId=${claim.poId}&action=service-claim`,
              title: `Persetujuan Komersial Klaim Jasa #${claim.claimNumber}`,
              description: `Klaim jasa senilai Rp ${Number(claim.totalClaimAmount || 0).toLocaleString('id-ID')} untuk PO #${poNumber} telah diverifikasi PM dan menunggu persetujuan komersial.`,
              status: claim.status,
              createdAt: claim.pmVerifiedAt ? new Date(claim.pmVerifiedAt).toISOString() : (claim.updatedAt ? new Date(claim.updatedAt).toISOString() : new Date().toISOString()),
              updatedAt: claim.updatedAt ? new Date(claim.updatedAt).toISOString() : undefined,
              projectName,
            });
          }

          // 6.3 NEEDS_REVISION -> Submitter revision
          if (claim.status === ServiceClaimStatus.NEEDS_REVISION) {
            const isSubmitter = Number(claim.submittedBy) === Number(userId);
            if (isSubmitter || normalizedRoles.includes('SUPER_ADMIN')) {
              todos.push({
                todoId: `service-claim-rev-${claim.id}`,
                sourceType: 'DOMAIN_SERVICE_CLAIM',
                sourceId: String(claim.id),
                assignedUserId: claim.submittedBy ? Number(claim.submittedBy) : undefined,
                entityType: 'SERVICE_CLAIM',
                entityId: Number(claim.id),
                projectId: Number(claim.projectId),
                actionType: 'SERVICE_CLAIM_REVISION',
                actionTarget: `/project-delivery?projectId=${claim.projectId}&serviceClaimId=${claim.id}`,
                title: `Revisi Klaim Jasa #${claim.claimNumber}`,
                description: claim.notes || 'Klaim jasa memerlukan revisi.',
                status: claim.status,
                createdAt: claim.updatedAt ? new Date(claim.updatedAt).toISOString() : new Date().toISOString(),
                projectName,
                returnReason: claim.notes || undefined,
              });
            }
          }
        }
      } catch (err: any) {
        this.logger.error(`Failed to fetch pending service claims: ${err.message}`, err.stack);
      }
    }

    // 7. Authoritative Domain Queue: Project Closures (HOO Review, Director Approval, PM Revision)
    const isHooRole = normalizedRoles.some((role) =>
      ['HEAD_OF_OPERATIONS', 'SUPER_ADMIN'].includes(role),
    );
    const isDirectorApprovalRole = normalizedRoles.some((role) =>
      ['DIRECTOR', 'SUPER_ADMIN'].includes(role),
    );

    if (this.closureRepo) {
      try {
        const allClosures = await this.closureRepo.find({
          relations: ['project', 'submittedBy', 'returnActor'],
          order: { id: 'DESC' },
        });

        // Canonical Rule DASH-REC-001: Group by project_id and select only the CURRENT/LATEST closure cycle
        const latestClosureByProject = new Map<number, ProjectClosure>();

        for (const closure of allClosures) {
          const resolvedPId = Number(closure.projectId ?? (closure as any).project_id);
          if (!resolvedPId || isNaN(resolvedPId) || resolvedPId <= 0) continue;

          const currentLatest = latestClosureByProject.get(resolvedPId);
          if (!currentLatest) {
            latestClosureByProject.set(resolvedPId, closure);
            continue;
          }

          // Authority order:
          // 1. Highest cycleNumber
          const currentCycle = Number(closure.cycleNumber ?? (closure as any).cycle_number);
          const latestCycle = Number(currentLatest.cycleNumber ?? (currentLatest as any).cycle_number);

          const hasValidCurrentCycle = !isNaN(currentCycle) && currentCycle > 0;
          const hasValidLatestCycle = !isNaN(latestCycle) && latestCycle > 0;

          if (hasValidCurrentCycle && hasValidLatestCycle) {
            if (currentCycle > latestCycle) {
              latestClosureByProject.set(resolvedPId, closure);
            } else if (currentCycle === latestCycle) {
              // Tie-breaker: latest row ID / created_at
              if (Number(closure.id) > Number(currentLatest.id)) {
                latestClosureByProject.set(resolvedPId, closure);
              }
            }
          } else if (hasValidCurrentCycle && !hasValidLatestCycle) {
            latestClosureByProject.set(resolvedPId, closure);
          } else if (!hasValidCurrentCycle && !hasValidLatestCycle) {
            if (Number(closure.id) > Number(currentLatest.id)) {
              latestClosureByProject.set(resolvedPId, closure);
            }
          }
        }

        const ACTIONABLE_STATUSES: string[] = [
          ProjectClosureStatus.PENDING_HOO_REVIEW,
          ProjectClosureStatus.PENDING_DIRECTOR_APPROVAL,
          ProjectClosureStatus.RETURNED,
        ];

        for (const closure of latestClosureByProject.values()) {
          // Only actionable status of the CURRENT closure cycle can project an action
          if (!ACTIONABLE_STATUSES.includes(String(closure.status))) {
            continue;
          }

          const closureProjectId = Number(closure.projectId ?? (closure as any).project_id);

          // Transitional Deduplication with WORKFLOW_TASK
          const hasMatchingWfTask = todos.some(
            (t) =>
              t.sourceType === 'WORKFLOW_TASK' &&
              t.entityType === 'PROJECT_CLOSURE' &&
              (Number(t.entityId) === Number(closure.id) ||
                (t.projectId && closureProjectId && Number(t.projectId) === closureProjectId)),
          );
          if (hasMatchingWfTask) continue;

          const rawProjectName = closure.project?.name;
          const safeProjectName =
            rawProjectName && !rawProjectName.match(/^Proyek\s*#\d+$/i)
              ? rawProjectName
              : undefined;
          const projectName = safeProjectName;
          const displayProjectName = safeProjectName || 'proyek ini';

          // 7.1 PENDING_HOO_REVIEW -> HEAD_OF_OPERATIONS / SUPER_ADMIN
          if (closure.status === ProjectClosureStatus.PENDING_HOO_REVIEW && isHooRole) {
            todos.push({
              todoId: `closure-hoo-${closure.id}`,
              sourceType: 'DOMAIN_PROJECT_CLOSURE',
              sourceId: String(closure.id),
              assignedRole: 'HEAD_OF_OPERATIONS',
              entityType: 'PROJECT_CLOSURE',
              entityId: Number(closure.id),
              projectId: Number(closure.projectId),
              actionType: 'PROJECT_CLOSURE_HOO_REVIEW',
              actionTarget: `/governance/tasks?projectId=${closure.projectId}`,
              title: safeProjectName
                ? `Penutupan Proyek Menunggu Peninjauan: ${safeProjectName}`
                : `Penutupan Proyek Menunggu Peninjauan`,
              description: `PM telah mengajukan penutupan proyek "${displayProjectName}". Silakan tinjau kelengkapan pengajuan sebelum diteruskan ke Direktur.`,
              status: closure.status,
              createdAt: closure.submittedAt ? new Date(closure.submittedAt).toISOString() : new Date().toISOString(),
              projectName: safeProjectName,
              submittedByName: closure.submittedBy?.fullName || undefined,
            });
          }

          // 7.2 PENDING_DIRECTOR_APPROVAL -> DIRECTOR / SUPER_ADMIN
          if (closure.status === ProjectClosureStatus.PENDING_DIRECTOR_APPROVAL && isDirectorApprovalRole) {
            todos.push({
              todoId: `closure-dir-${closure.id}`,
              sourceType: 'DOMAIN_PROJECT_CLOSURE',
              sourceId: String(closure.id),
              assignedRole: 'DIRECTOR',
              entityType: 'PROJECT_CLOSURE',
              entityId: Number(closure.id),
              projectId: Number(closure.projectId),
              actionType: 'PROJECT_CLOSURE_DIRECTOR_APPROVAL',
              actionTarget: `/governance/tasks?projectId=${closure.projectId}`,
              title: safeProjectName
                ? `Penutupan Proyek Menunggu Persetujuan Anda: ${safeProjectName}`
                : `Penutupan Proyek Menunggu Persetujuan Anda`,
              description: `Head of Operations telah menyelesaikan peninjauan penutupan proyek "${displayProjectName}" dan meneruskannya kepada Anda untuk keputusan akhir.`,
              status: closure.status,
              createdAt: closure.hooReviewedAt ? new Date(closure.hooReviewedAt).toISOString() : (closure.submittedAt ? new Date(closure.submittedAt).toISOString() : new Date().toISOString()),
              projectName: safeProjectName,
              submittedByName: closure.submittedBy?.fullName || undefined,
            });
          }

          // 7.3 RETURNED -> PM Revision (assigned PM of project, or submitter, or SUPER_ADMIN)
          if (closure.status === ProjectClosureStatus.RETURNED) {
            const isAssignedPm =
              closure.project?.managerId !== undefined &&
              closure.project?.managerId !== null &&
              Number(closure.project.managerId) === Number(userId);
            const isSubmitter = Number(closure.submittedById) === Number(userId);

            if (isAssignedPm || isSubmitter || normalizedRoles.includes('SUPER_ADMIN')) {
              const reviewerRoleOrName = closure.returnActor?.fullName || 'Head of Operations';
              const returnDesc = closure.returnReason
                ? `${reviewerRoleOrName} mengembalikan pengajuan penutupan proyek "${displayProjectName}" untuk diperbaiki. Catatan: ${closure.returnReason}`
                : `${reviewerRoleOrName} mengembalikan pengajuan penutupan proyek "${displayProjectName}" untuk diperbaiki. Silakan lihat catatan reviewer, lakukan perbaikan, lalu ajukan kembali.`;

              todos.push({
                todoId: `closure-ret-${closure.id}`,
                sourceType: 'DOMAIN_PROJECT_CLOSURE',
                sourceId: String(closure.id),
                assignedUserId: closure.submittedById ? Number(closure.submittedById) : undefined,
                assignedRole: 'PROJECT_MANAGER',
                entityType: 'PROJECT_CLOSURE',
                entityId: Number(closure.id),
                projectId: Number(closure.projectId),
                actionType: 'PROJECT_CLOSURE_REVISION',
                actionTarget: `/project-delivery?view=workspace&projectId=${closure.projectId}&section=closure`,
                title: safeProjectName
                  ? `Pengajuan Penutupan Proyek Perlu Diperbaiki: ${safeProjectName}`
                  : `Pengajuan Penutupan Proyek Perlu Diperbaiki`,
                description: returnDesc,
                status: closure.status,
                createdAt: closure.returnTimestamp ? new Date(closure.returnTimestamp).toISOString() : new Date().toISOString(),
                projectName: safeProjectName,
                returnedByName: closure.returnActor?.fullName || undefined,
                returnReason: closure.returnReason || undefined,
              });
            }
          }
        }
      } catch (err: any) {
        this.logger.error(`Failed to fetch pending project closures: ${err.message}`, err.stack);
      }
    }

    // 8. Authoritative Domain Queue: Marketing Tender Follow-Up
    const isMarketingRole = normalizedRoles.some((role) => role === 'MARKETING' || role === 'SUPER_ADMIN');
    if (isMarketingRole) {
      try {
        const actionableTenders = await this.tenderRepo
          .createQueryBuilder('tender')
          .leftJoinAndSelect('tender.customer', 'customer')
          .where('tender.status NOT IN (:...terminalStatuses)', { terminalStatuses: ['WON', 'LOST'] })
          .andWhere('tender.stage NOT IN (:...terminalStages)', { terminalStages: ['WON', 'LOST'] })
          .andWhere(
            '(tender.marketing_pic_id = :userId OR (tender.marketing_pic_id IS NULL AND tender.created_by = :userId))',
            { userId },
          )
          .andWhere('tender.deleted_at IS NULL')
          .orderBy('tender.id', 'DESC')
          .getMany();

        for (const tender of actionableTenders) {
          const evaluation = evaluateMarketingActionItem(tender);
          if (evaluation.isActionItem) {
            todos.push({
              todoId: `tender-followup-${tender.id}`,
              sourceType: 'DOMAIN_TENDER',
              sourceId: String(tender.id),
              assignedRole: 'MARKETING',
              assignedUserId: userId,
              entityType: 'TENDER',
              entityId: Number(tender.id),
              actionType: 'MARKETING_FOLLOWUP',
              actionTarget: `/sales?tab=1&tenderId=${tender.id}`,
              title: `Tindak Lanjut Tender: ${tender.title}`,
              description: evaluation.reason,
              status: evaluation.conditionType || 'ACTION_REQUIRED',
              dueAt: tender.bid_submission_deadline
                ? new Date(tender.bid_submission_deadline).toISOString()
                : undefined,
              createdAt: tender.created_at
                ? new Date(tender.created_at).toISOString()
                : ((tender as any).createdAt ? new Date((tender as any).createdAt).toISOString() : new Date(0).toISOString()),
              projectName: tender.title,
              customerName: tender.customer?.name || undefined,
            });
          }
        }
      } catch (err: any) {
        this.logger.error(`Failed to fetch actionable marketing follow-up tenders: ${err.message}`, err.stack);
      }
    }

    // 9. Authoritative Domain Queue: Purchase Requests Ready for RFQ Creation (PROCUREMENT / PURCHASING / SUPER_ADMIN)
    const isProcurementUser = normalizedRoles.some((role) =>
      ['PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN'].includes(role),
    );
    if (isProcurementUser) {
      try {
        const approvedPrs = await this.purchaseRequestRepo
          .createQueryBuilder('pr')
          .leftJoinAndSelect('pr.project', 'project')
          .where('pr.status = :prStatus', { prStatus: 'APPROVED' })
          .andWhere('pr.deleted_at IS NULL')
          .andWhere((qb) => {
            const subQuery = qb
              .subQuery()
              .select('1')
              .from(Rfq, 'rfq')
              .where('rfq.pr_id = pr.id')
              .andWhere('rfq.status != :cancelledStatus', { cancelledStatus: 'CANCELLED' })
              .andWhere('rfq.deleted_at IS NULL')
              .getQuery();
            return `NOT EXISTS ${subQuery}`;
          })
          .orderBy('pr.created_at', 'DESC')
          .getMany();

        for (const pr of approvedPrs) {
          todos.push({
            todoId: `domain-pr-${pr.id}`,
            sourceType: 'DOMAIN_PURCHASE_REQUEST',
            sourceId: String(pr.id),
            assignedRole: 'PROCUREMENT',
            entityType: 'PURCHASE_REQUEST',
            entityId: pr.id,
            projectId: pr.projectId || pr.project?.id,
            projectName: pr.project?.name,
            actionType: 'CREATE_RFQ',
            actionTarget: `/procurement?tab=pr&prId=${pr.id}`,
            title: `Buat RFQ: PR ${pr.prNumber || pr.id}`,
            description: `Purchase Request ${pr.prNumber || pr.id} telah disetujui Direktur. Siap untuk proses pembuatan RFQ.`,
            status: 'PENDING',
            priority: 'HIGH',
            ctaLabel: 'Buat RFQ',
            createdAt: pr.createdAt ? new Date(pr.createdAt).toISOString() : new Date().toISOString(),
          });
        }
      } catch (err: any) {
        this.logger.error(`Failed to fetch approved PRs for RFQ creation: ${err.message}`, err.stack);
      }
    }

    // 10. Deterministic Ordering:
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
   * Retrieves historical completed workflow and domain tasks for current authenticated user.
   * Strictly read-only projection: respects user role scoping and returns completed, returned,
   * and rejected decisions newest first.
   */
  async getHistory(userId: number, roles: string[] = []): Promise<HistoryItemDto[]> {
    const history: HistoryItemDto[] = [];
    const normalizedRoles = roles.map((r) => String(r).toUpperCase());
    const isSuperAdmin = normalizedRoles.includes('SUPER_ADMIN');

    // 1. Authoritative Decided / Completed Workflow Tasks
    if (this.taskRepo) {
      try {
        const query = this.taskRepo
          .createQueryBuilder('task')
          .leftJoinAndSelect('task.workflowInstance', 'instance')
          .leftJoinAndSelect('instance.workflowDefinition', 'definition')
          .leftJoinAndSelect('task.assigneeRole', 'role')
          .leftJoinAndSelect('task.decidedByUser', 'decidedUser')
          .where('task.status IN (:...statuses)', {
            statuses: [
              WorkflowTaskStatus.COMPLETED,
              WorkflowTaskStatus.RETURNED,
              WorkflowTaskStatus.REJECTED,
              WorkflowTaskStatus.CANCELED,
            ],
          });

        if (!isSuperAdmin) {
          query.andWhere(
            '(task.decided_by = :userId OR task.assignee_user_id = :userId OR role.name IN (:...roles))',
            { userId, roles: normalizedRoles.length > 0 ? normalizedRoles : ['__NONE__'] },
          );
        }

        const tasks = await query.orderBy('task.updatedAt', 'DESC').getMany();

        for (const task of tasks) {
          // Strict PM Scoping: Project Manager only sees their own assigned project history
          const isPmOnly =
            normalizedRoles.includes('PROJECT_MANAGER') &&
            !isSuperAdmin &&
            !normalizedRoles.some((r) =>
              ['DIRECTOR', 'GENERAL_MANAGER', 'PMO', 'HEAD_OF_OPERATIONS'].includes(r),
            );
          const instanceAny = task.workflowInstance as any;
          const projectManagerId = instanceAny?.project?.managerId ?? instanceAny?.context?.managerId;
          if (isPmOnly && projectManagerId) {
            const assignedPmId = Number(projectManagerId);
            const isAssignedPm = assignedPmId === Number(userId);
            const isActor =
              Number(task.decidedBy) === Number(userId) ||
              Number(task.assigneeUserId) === Number(userId);
            if (!isAssignedPm && !isActor) {
              continue;
            }
          }

          const entityType = task.workflowInstance?.entityType || 'WORKFLOW';
          const entityId = Number(task.workflowInstance?.entityId || 0);
          let projectId: number | undefined;
          let projectName: string | undefined;
          let customerName: string | undefined;

          if (entityType === 'PROJECT') {
            projectId = entityId > 0 ? entityId : Number(task.workflowInstance?.context?.projectId || 0) || undefined;
          } else if (entityType === 'PURCHASE_REQUEST') {
            projectId = Number(task.workflowInstance?.context?.projectId || 0) || undefined;
          } else if (entityType === 'TENDER') {
            const context = await this.enrichTenderBusinessContext(entityId);
            projectName = context.projectName;
            customerName = context.customerName;
          } else if (entityType === 'PROJECT_CLOSURE') {
            projectId = Number(task.workflowInstance?.context?.projectId || 0) || undefined;
            let resolvedPName = task.workflowInstance?.context?.projectName;
            if (!resolvedPName && entityId > 0 && this.closureRepo) {
              try {
                const closure = await this.closureRepo.findOne({
                  where: { id: entityId },
                  relations: ['project'],
                });
                if (closure?.project?.name) resolvedPName = closure.project.name;
                if (!projectId && closure?.projectId) projectId = closure.projectId;
              } catch {}
            }
            projectName = resolvedPName && !resolvedPName.match(/^Proyek\s*#\d+$/i) ? resolvedPName : undefined;
          }

          let historyTitle = task.taskKey || `Tugas #${task.id}`;
          if (entityType === 'PROJECT_CLOSURE') {
            const isHoo =
              task.nodeId === 'node_hoo_review' ||
              task.taskKey === 'HOO_REVIEW' ||
              task.taskKey === 'PROJECT_CLOSURE_HOO_REVIEW';
            const isDirector =
              task.nodeId === 'node_director_approval' ||
              task.taskKey === 'DIRECTOR_APPROVAL' ||
              task.taskKey === 'PROJECT_CLOSURE_DIRECTOR_APPROVAL';

            if (isHoo) {
              historyTitle =
                task.status === 'RETURNED'
                  ? 'Head of Operations mengembalikan pengajuan ke PM untuk diperbaiki.'
                  : 'Head of Operations menyetujui hasil peninjauan dan meneruskan pengajuan ke Direktur.';
            } else if (isDirector) {
              historyTitle =
                task.status === 'RETURNED'
                  ? 'Direktur mengembalikan pengajuan ke PM untuk diperbaiki.'
                  : 'Direktur menyetujui penutupan proyek.';
            }
          }

          history.push({
            historyId: `task-history-${task.id}`,
            taskId: Number(task.id),
            workflowInstanceId: Number(task.workflowInstanceId),
            workflowKey: task.workflowInstance?.workflowDefinition?.workflowKey,
            taskKey: task.taskKey,
            entityType,
            entityId,
            projectId,
            projectName,
            customerName,
            title: historyTitle,
            status: task.status,
            action: task.action || undefined,
            decidedBy: task.decidedBy ? Number(task.decidedBy) : undefined,
            decidedByName: task.decidedByUser?.fullName || undefined,
            decidedAt: task.decidedAt ? new Date(task.decidedAt).toISOString() : undefined,
            comments: task.comments || undefined,
            dueAt: task.dueAt ? new Date(task.dueAt).toISOString() : undefined,
            createdAt: task.createdAt ? new Date(task.createdAt).toISOString() : new Date().toISOString(),
            completedAt: task.decidedAt
              ? new Date(task.decidedAt).toISOString()
              : task.updatedAt
              ? new Date(task.updatedAt).toISOString()
              : undefined,
          });
        }
      } catch (err: any) {
        this.logger.error(`Failed to fetch workflow history: ${err.message}`, err.stack);
      }
    }

    // 2. Authoritative Domain Completed Tasks: Payment Requests (for Finance & Director)
    const isDirector = normalizedRoles.some((r) => r === 'DIRECTOR' || r === 'SUPER_ADMIN');
    const isFinance = normalizedRoles.some((r) => r === 'FINANCE' || r === 'SUPER_ADMIN');
    if (this.paymentRequestRepo && (isDirector || isFinance)) {
      try {
        const decidedPaymentRequests = await this.paymentRequestRepo.find({
          where: {
            status: In([
              PaymentRequestStatus.APPROVED_FOR_PAYMENT,
              PaymentRequestStatus.PAID,
              PaymentRequestStatus.REJECTED,
            ]),
          },
          relations: ['invoice', 'invoice.purchaseOrder', 'invoice.purchaseOrder.vendor', 'approver'],
          order: { id: 'DESC' },
          take: 50,
        });

        for (const prq of decidedPaymentRequests) {
          history.push({
            historyId: `prq-history-${prq.id}`,
            taskId: Number(prq.id),
            workflowInstanceId: 0,
            taskKey: 'PAYMENT_REQUEST_DECISION',
            entityType: 'PEMBAYARAN',
            entityId: Number(prq.id),
            projectName: prq.invoice?.purchaseOrder?.poNumber || undefined,
            customerName: prq.invoice?.purchaseOrder?.vendor?.name || undefined,
            title: `Pengajuan Pembayaran #${prq.requestNumber}`,
            status: prq.status,
            action: prq.status === PaymentRequestStatus.REJECTED ? 'REJECT' : 'APPROVE',
            decidedBy: prq.approvedBy ? Number(prq.approvedBy) : undefined,
            decidedByName: prq.approver?.fullName || undefined,
            decidedAt: prq.approvedAt ? new Date(prq.approvedAt).toISOString() : undefined,
            createdAt: prq.createdAt ? new Date(prq.createdAt).toISOString() : new Date().toISOString(),
            completedAt: prq.approvedAt
              ? new Date(prq.approvedAt).toISOString()
              : prq.updatedAt
              ? new Date(prq.updatedAt).toISOString()
              : undefined,
          });
        }
      } catch (err: any) {
        this.logger.error(`Failed to fetch payment request history: ${err.message}`, err.stack);
      }
    }

    // 3. Authoritative Domain Completed Tasks: Project Closures (for HOO, Director, PM)
    const isHooOrDirector = normalizedRoles.some((r) =>
      ['HEAD_OF_OPERATIONS', 'DIRECTOR', 'PMO', 'SUPER_ADMIN'].includes(r),
    );
    if (this.closureRepo && (isHooOrDirector || normalizedRoles.includes('PROJECT_MANAGER'))) {
      try {
        const decidedClosures = await this.closureRepo.find({
          where: {
            status: In([ProjectClosureStatus.APPROVED, 'CLOSED']),
          },
          relations: ['project', 'directorApprover'],
          order: { id: 'DESC' },
          take: 50,
        });

        for (const cl of decidedClosures) {
          if (!isSuperAdmin && !isHooOrDirector) {
            // If PM: only show if assigned PM of this project
            if (
              Number(cl.project?.managerId) !== Number(userId) &&
              Number(cl.submittedById) !== Number(userId)
            ) {
              continue;
            }
          }
          history.push({
            historyId: `closure-history-${cl.id}`,
            taskId: Number(cl.id),
            workflowInstanceId: 0,
            taskKey: 'PROJECT_CLOSURE_APPROVAL',
            entityType: 'PROJECT_CLOSURE',
            entityId: Number(cl.id),
            projectId: Number(cl.projectId),
            projectName: cl.project?.name || undefined,
            title: 'Direktur menyetujui penutupan proyek.',
            status: cl.status,
            action: 'APPROVE',
            decidedBy: cl.directorApproverId ? Number(cl.directorApproverId) : undefined,
            decidedByName: cl.directorApprover?.fullName || undefined,
            decidedAt: cl.directorApprovedAt ? new Date(cl.directorApprovedAt).toISOString() : undefined,
            createdAt: cl.createdAt ? new Date(cl.createdAt).toISOString() : new Date().toISOString(),
            completedAt: cl.directorApprovedAt
              ? new Date(cl.directorApprovedAt).toISOString()
              : cl.updatedAt
              ? new Date(cl.updatedAt).toISOString()
              : undefined,
          });
        }
      } catch (err: any) {
        this.logger.error(`Failed to fetch project closure history: ${err.message}`, err.stack);
      }
    }

    // Sort history: newest completed/updated first
    history.sort((a, b) => {
      const timeA = new Date(a.completedAt || a.createdAt).getTime();
      const timeB = new Date(b.completedAt || b.createdAt).getTime();
      return timeB - timeA;
    });

    return history;
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
