import {
  Injectable,
  NotFoundException,
  ForbiddenException,
  ConflictException,
  BadRequestException,
  Logger,
  Optional,
} from "@nestjs/common";
import { DataSource, EntityManager, Repository } from "typeorm";
import { InjectRepository } from "@nestjs/typeorm";
import { ProjectService } from "./project.service";
import { WorkflowEngineService } from "../workflow-engine/workflow-engine.service";
import { Project } from "../../entities/project.entity";
import {
  ProjectClosure,
  ProjectClosureStatus,
} from "../../entities/project-closure.entity";
import {
  WorkflowTask,
  WorkflowTaskStatus,
} from "../../entities/workflow-task.entity";
import { WorkflowInstanceStatus } from "../../entities/workflow-instance.entity";
import { DocumentCategory } from "../../entities/document.entity";
import { ProjectRiskStatus } from "../../entities/project-risk.entity";
import { ProjectIssueStatus } from "../../entities/project-issue.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { OutboxEvent, OutboxStatus } from "../../entities/outbox-event.entity";
import { randomUUID } from "crypto";
import {
  ClosureBlocker,
  ClosureWarning,
  ClosureReadinessResult,
} from "./dto/closure-readiness.dto";
import {
  SubmitClosureDto,
  ApproveClosureDto,
  ReturnClosureDto,
} from "./dto/closure-workflow.dto";

@Injectable()
export class ProjectClosureService {
  private readonly logger = new Logger(ProjectClosureService.name);

  constructor(
    private readonly dataSource: DataSource,
    private readonly projectService: ProjectService,
    @Optional()
    private readonly workflowEngineService?: WorkflowEngineService,
    @Optional()
    @InjectRepository(ProjectClosure)
    private readonly closureRepo?: Repository<ProjectClosure>,
    @Optional()
    @InjectRepository(Project)
    private readonly projectRepo?: Repository<Project>,
  ) {}

  private getClosureRepo(): Repository<ProjectClosure> {
    return this.closureRepo || this.dataSource.getRepository(ProjectClosure);
  }

  private getProjectRepo(): Repository<Project> {
    return this.projectRepo || this.dataSource.getRepository(Project);
  }

  private getWorkflowEngine(): WorkflowEngineService {
    if (!this.workflowEngineService) {
      throw new BadRequestException(
        "WorkflowEngineService tidak terkonfigurasi.",
      );
    }
    return this.workflowEngineService;
  }

  /**
   * Evaluate Project Closure Readiness (Pure Read-Only)
   * Aggregates live SSOT data across all relevant domains without mutating any records.
   * Optionally executes inside caller's transactional EntityManager context.
   */
  async evaluateClosureReadiness(
    projectId: number,
    userId?: number,
    userRoles: string[] = [],
    manager?: EntityManager,
  ): Promise<ClosureReadinessResult> {
    const pId = Number(projectId);
    const queryExecutor = manager || this.dataSource;

    // 1. Fetch Project
    const projectRows = await queryExecutor.query(
      `SELECT p.id, p.code, p.name, p.status, p.manager_id, p.contract_id, p.actual_finish_at, p.closed_at, p.closed_by
       FROM projects p
       WHERE p.id = ? AND p.deleted_at IS NULL`,
      [pId],
    );

    if (!projectRows || projectRows.length === 0) {
      throw new NotFoundException(`Project #${pId} tidak ditemukan.`);
    }

    const project = projectRows[0];

    // RBAC: If requester is Project Manager only, ensure they are the assigned PM
    if (
      userId &&
      userRoles.includes("PROJECT_MANAGER") &&
      !userRoles.some((r) =>
        [
          "SUPER_ADMIN",
          "DIRECTOR",
          "HEAD_OF_OPERATIONS",
          "PMO",
          "GENERAL_MANAGER",
          "PROCUREMENT",
          "FINANCE",
        ].includes(r),
      )
    ) {
      const assignedPmId = project.manager_id
        ? Number(project.manager_id)
        : null;
      if (!assignedPmId || assignedPmId !== Number(userId)) {
        throw new ForbiddenException(
          "Akses ditolak: Anda bukan Project Manager yang ditugaskan untuk proyek ini",
        );
      }
    }

    const blockers: ClosureBlocker[] = [];
    const warnings: ClosureWarning[] = [];

    // Contract Context
    let contractInfo: any = {
      contractId: project.contract_id ? Number(project.contract_id) : null,
      contractNumber: null,
      status: null,
      customer: null,
    };

    if (project.contract_id) {
      const contractRows = await queryExecutor.query(
        `SELECT c.id, c.contract_number, c.status, cust.id AS customer_id, cust.name AS customer_name
         FROM contracts c
         LEFT JOIN proposals prop ON c.proposal_id = prop.id
         LEFT JOIN tenders tend ON prop.tender_id = tend.id
         LEFT JOIN customers cust ON tend.customer_id = cust.id
         WHERE c.id = ? AND c.deleted_at IS NULL`,
        [Number(project.contract_id)],
      );

      if (contractRows && contractRows.length > 0) {
        const cRow = contractRows[0];
        contractInfo = {
          contractId: Number(cRow.id),
          contractNumber: cRow.contract_number,
          status: cRow.status,
          customer: cRow.customer_id
            ? { id: Number(cRow.customer_id), name: cRow.customer_name }
            : null,
        };
      }
    }

    // Eligibility Check
    const isEligible = project.status === "IN_PROGRESS";
    if (!isEligible) {
      blockers.push({
        domain: "PROJECT_STATUS",
        code: "PROJECT_NOT_IN_PROGRESS",
        message: `Status proyek adalah ${project.status}. Evaluasi penutupan proyek hanya berlaku untuk proyek berstatus IN_PROGRESS.`,
      });
    }

    // 2. Physical Progress (Reuse canonical ProjectService.calculateProjectOverallProgress)
    let overallProgress = 0;
    try {
      overallProgress =
        await this.projectService.calculateProjectOverallProgress(pId);
      overallProgress =
        Math.round((overallProgress + Number.EPSILON) * 100) / 100;
    } catch (err: any) {
      this.logger.warn(
        `Failed to calculate overall progress for Project #${pId}: ${err?.message}`,
      );
      overallProgress = 0;
    }

    const isPhysicalComplete = overallProgress === 100.0;
    if (!isPhysicalComplete) {
      blockers.push({
        domain: "PHYSICAL_EXECUTION",
        code: "PHYSICAL_PROGRESS_INCOMPLETE",
        message: `Kemajuan fisik proyek saat ini ${overallProgress}%, belum mencapai 100.00%.`,
        amount: overallProgress,
      });
    }

    // 3. Task Completion & Actual Finish Candidate
    const leafTaskRows = await queryExecutor.query(
      `SELECT
        t.id AS task_id,
        t.name AS task_name,
        t.status AS task_status,
        t.progress AS task_progress,
        t.actual_finish_at,
        bi.wbs_id,
        bi.weight_percentage
      FROM project_baselines b
      JOIN project_baseline_wbs_items bi
        ON bi.baseline_id = b.id AND bi.is_leaf = 1
      JOIN tasks t
        ON t.wbs_id = bi.wbs_id
        AND t.project_id = b.project_id
        AND t.deleted_at IS NULL
      WHERE b.project_id = ?
        AND b.status = 'ACTIVE'`,
      [pId],
    );

    const pendingLogsRows = await queryExecutor.query(
      `SELECT COUNT(*) AS count
       FROM project_progress_logs
       WHERE project_id = ? AND status = 'PENDING_VERIFICATION'`,
      [pId],
    );

    const pendingVerificationCount = Number(pendingLogsRows[0]?.count || 0);

    const totalLeafTasks = leafTaskRows.length;
    let completedLeafTasks = 0;
    let incompleteLeafTasks = 0;
    let missingActualFinishCount = 0;
    let maxFinishTimestamp: number | null = null;
    let candidateActualFinishDate: string | null = null;

    if (totalLeafTasks === 0) {
      incompleteLeafTasks = 1;
      blockers.push({
        domain: "TASKS",
        code: "TASK_INCOMPLETE",
        message:
          "Tidak ditemukan baseline aktif dengan leaf execution tasks pada proyek ini.",
        count: 1,
      });
    } else {
      for (const row of leafTaskRows) {
        const isDone =
          row.task_status === "COMPLETED" && Number(row.task_progress) === 100;
        if (isDone) {
          completedLeafTasks++;
        } else {
          incompleteLeafTasks++;
        }

        if (!row.actual_finish_at) {
          missingActualFinishCount++;
        } else {
          const finishTime = new Date(row.actual_finish_at).getTime();
          if (maxFinishTimestamp === null || finishTime > maxFinishTimestamp) {
            maxFinishTimestamp = finishTime;
            candidateActualFinishDate = new Date(
              row.actual_finish_at,
            ).toISOString();
          }
        }
      }
    }

    if (incompleteLeafTasks > 0) {
      blockers.push({
        domain: "TASKS",
        code: "TASK_INCOMPLETE",
        message: `Terdapat ${incompleteLeafTasks} leaf task yang belum selesai (100% COMPLETED).`,
        count: incompleteLeafTasks,
      });
    }

    if (missingActualFinishCount > 0) {
      blockers.push({
        domain: "TASKS",
        code: "TASK_ACTUAL_FINISH_MISSING",
        message: `Terdapat ${missingActualFinishCount} leaf task yang belum memiliki tanggal aktual selesai (actual_finish_at).`,
        count: missingActualFinishCount,
      });
    }

    if (pendingVerificationCount > 0) {
      blockers.push({
        domain: "TASKS",
        code: "TASK_PROGRESS_VERIFICATION_PENDING",
        message: `Terdapat ${pendingVerificationCount} log progress yang masih menunggu verifikasi (PENDING_VERIFICATION).`,
        count: pendingVerificationCount,
      });
    }

    // Candidate Physical Actual Finish
    const physicalActualFinishCandidate =
      isPhysicalComplete &&
      incompleteLeafTasks === 0 &&
      missingActualFinishCount === 0 &&
      pendingVerificationCount === 0
        ? candidateActualFinishDate
        : null;

    // 4. Issue Clearance
    const issueRows = await queryExecutor.query(
      `SELECT id, issue_number, title, status
       FROM project_issues
       WHERE project_id = ?`,
      [pId],
    );

    let openIssues = 0;
    let inProgressIssues = 0;
    let resolvedIssues = 0;
    let closedIssues = 0;
    let cancelledIssues = 0;
    const blockingIssueIds: number[] = [];

    for (const issue of issueRows) {
      if (issue.status === "OPEN") {
        openIssues++;
        blockingIssueIds.push(Number(issue.id));
      } else if (issue.status === "IN_PROGRESS") {
        inProgressIssues++;
        blockingIssueIds.push(Number(issue.id));
      } else if (issue.status === "RESOLVED") {
        resolvedIssues++;
        blockingIssueIds.push(Number(issue.id));
      } else if (issue.status === "CLOSED") {
        closedIssues++;
      } else if (issue.status === "CANCELLED") {
        cancelledIssues++;
      }
    }

    const blockingIssueCount = openIssues + inProgressIssues + resolvedIssues;
    if (blockingIssueCount > 0) {
      blockers.push({
        domain: "ISSUES",
        code: "OPEN_PROJECT_ISSUES",
        message: `Terdapat ${blockingIssueCount} issue proyek yang belum selesai/closed (${openIssues} OPEN, ${inProgressIssues} IN_PROGRESS, ${resolvedIssues} RESOLVED).`,
        count: blockingIssueCount,
        entityIds: blockingIssueIds,
      });
    }

    // 5. Risk Clearance
    const riskRows = await queryExecutor.query(
      `SELECT r.id, r.risk_number, r.title, r.status, pi.id AS linked_issue_id, pi.status AS linked_issue_status
       FROM project_risks r
       LEFT JOIN project_issues pi ON pi.source_risk_id = r.id
       WHERE r.project_id = ?`,
      [pId],
    );

    let activeRiskCount = 0;
    let materializedRiskCount = 0;
    let unresolvedMaterializedRiskCount = 0;
    let clearedRiskCount = 0;

    for (const risk of riskRows) {
      if (
        risk.status === ProjectRiskStatus.CLOSED ||
        risk.status === ProjectRiskStatus.CANCELLED
      ) {
        clearedRiskCount++;
      } else if (risk.status === ProjectRiskStatus.MATERIALIZED) {
        materializedRiskCount++;
        if (
          !risk.linked_issue_status ||
          risk.linked_issue_status !== ProjectIssueStatus.CLOSED
        ) {
          unresolvedMaterializedRiskCount++;
        } else {
          clearedRiskCount++;
        }
      } else {
        // Active statuses: IDENTIFIED, ASSESSED, MITIGATING, MONITORING
        activeRiskCount++;
      }
    }

    if (activeRiskCount > 0 || unresolvedMaterializedRiskCount > 0) {
      const totalBlockingRisks =
        activeRiskCount + unresolvedMaterializedRiskCount;
      blockers.push({
        domain: "RISKS",
        code: "ACTIVE_PROJECT_RISKS",
        message: `Terdapat ${totalBlockingRisks} risiko proyek yang belum terselesaikan (${activeRiskCount} aktif, ${unresolvedMaterializedRiskCount} termaterialisasi tanpa issue closed).`,
        count: totalBlockingRisks,
      });
    }

    // 6. Material & Service Procurement PR & RFQ Clearance
    const prRows = await queryExecutor.query(
      `SELECT pr.id, pr.pr_number, pr.status,
              COALESCE(
                MAX(CASE 
                  WHEN ci_direct.resource_type = 'SERVICE' THEN 'SERVICE'
                  WHEN ci_direct.resource_type = 'MATERIAL' THEN 'MATERIAL'
                  WHEN ci_direct.category_key IN ('SUBCONTRACTOR', 'SERVICE') THEN 'SERVICE'
                  WHEN ci_direct.category_key = 'MATERIAL' THEN 'MATERIAL'
                  WHEN ci_direct.category_key IN ('EQUIPMENT', 'OPERATIONAL') AND ci_direct.resource_type = 'SERVICE' THEN 'SERVICE'
                END),
                MAX(CASE 
                  WHEN ci_pkg.resource_type = 'SERVICE' THEN 'SERVICE'
                  WHEN ci_pkg.resource_type = 'MATERIAL' THEN 'MATERIAL'
                  WHEN ci_pkg.category_key IN ('SUBCONTRACTOR', 'SERVICE') THEN 'SERVICE'
                  WHEN ci_pkg.category_key = 'MATERIAL' THEN 'MATERIAL'
                  WHEN ci_pkg.category_key IN ('EQUIPMENT', 'OPERATIONAL') AND ci_pkg.resource_type = 'SERVICE' THEN 'SERVICE'
                END),
                'MATERIAL'
              ) AS resource_type
       FROM purchase_requests pr
       LEFT JOIN purchase_request_items pri ON pr.id = pri.pr_id
       LEFT JOIN cost_items ci_direct ON pri.cost_item_id = ci_direct.id
       LEFT JOIN procurement_package_items pki ON pri.package_item_id = pki.id
       LEFT JOIN cost_items ci_pkg ON pki.cost_item_id = ci_pkg.id
       WHERE pr.project_id = ? AND pr.deleted_at IS NULL
       GROUP BY pr.id, pr.pr_number, pr.status`,
      [pId],
    );

    const openPRs = prRows.filter(
      (pr: any) => !["PO_ISSUED", "REJECTED", "CANCELLED"].includes(pr.status),
    );
    const openMaterialPRs = openPRs.filter((pr: any) => pr.resource_type === 'MATERIAL');
    const openServicePRs = openPRs.filter((pr: any) => pr.resource_type === 'SERVICE');

    const openMaterialPRCount = openMaterialPRs.length;
    const openServicePRCount = openServicePRs.length;

    if (openMaterialPRCount > 0) {
      blockers.push({
        domain: "MATERIAL_PROCUREMENT",
        code: "MATERIAL_PR_OPEN",
        message: `Terdapat ${openMaterialPRCount} Purchase Request Material yang belum selesai/diterbitkan PO.`,
        count: openMaterialPRCount,
        entityIds: openMaterialPRs.map((pr: any) => Number(pr.id)),
      });
    }

    if (openServicePRCount > 0) {
      blockers.push({
        domain: "SERVICE_PROCUREMENT",
        code: "SERVICE_PR_OPEN",
        message: `Terdapat ${openServicePRCount} Purchase Request Jasa yang belum selesai/diterbitkan SPK/PO.`,
        count: openServicePRCount,
        entityIds: openServicePRs.map((pr: any) => Number(pr.id)),
      });
    }

    // RFQs linked through PRs of this project
    const rfqRows = await queryExecutor.query(
      `SELECT rfq.id, rfq.rfq_number, rfq.status, rfq.pr_id,
              COALESCE(
                MAX(CASE 
                  WHEN ci_direct.resource_type = 'SERVICE' THEN 'SERVICE'
                  WHEN ci_direct.resource_type = 'MATERIAL' THEN 'MATERIAL'
                  WHEN ci_direct.category_key IN ('SUBCONTRACTOR', 'SERVICE') THEN 'SERVICE'
                  WHEN ci_direct.category_key = 'MATERIAL' THEN 'MATERIAL'
                  WHEN ci_direct.category_key IN ('EQUIPMENT', 'OPERATIONAL') AND ci_direct.resource_type = 'SERVICE' THEN 'SERVICE'
                END),
                MAX(CASE 
                  WHEN ci_pkg.resource_type = 'SERVICE' THEN 'SERVICE'
                  WHEN ci_pkg.resource_type = 'MATERIAL' THEN 'MATERIAL'
                  WHEN ci_pkg.category_key IN ('SUBCONTRACTOR', 'SERVICE') THEN 'SERVICE'
                  WHEN ci_pkg.category_key = 'MATERIAL' THEN 'MATERIAL'
                  WHEN ci_pkg.category_key IN ('EQUIPMENT', 'OPERATIONAL') AND ci_pkg.resource_type = 'SERVICE' THEN 'SERVICE'
                END),
                'MATERIAL'
              ) AS resource_type
       FROM rfqs rfq
       JOIN purchase_requests pr ON rfq.pr_id = pr.id
       LEFT JOIN purchase_request_items pri ON pr.id = pri.pr_id
       LEFT JOIN cost_items ci_direct ON pri.cost_item_id = ci_direct.id
       LEFT JOIN procurement_package_items pki ON pri.package_item_id = pki.id
       LEFT JOIN cost_items ci_pkg ON pki.cost_item_id = ci_pkg.id
       WHERE pr.project_id = ? AND rfq.deleted_at IS NULL AND pr.deleted_at IS NULL
       GROUP BY rfq.id, rfq.rfq_number, rfq.status, rfq.pr_id`,
      [pId],
    );

    const openRFQs = rfqRows.filter(
      (rfq: any) => !["EVALUATED", "CANCELLED"].includes(rfq.status),
    );
    const openMaterialRFQs = openRFQs.filter((rfq: any) => rfq.resource_type === 'MATERIAL');
    const openServiceRFQs = openRFQs.filter((rfq: any) => rfq.resource_type === 'SERVICE');

    const openMaterialRFQCount = openMaterialRFQs.length;
    const openServiceRFQCount = openServiceRFQs.length;

    if (openMaterialRFQCount > 0) {
      blockers.push({
        domain: "MATERIAL_PROCUREMENT",
        code: "MATERIAL_RFQ_OPEN",
        message: `Terdapat ${openMaterialRFQCount} RFQ Material yang masih terbuka/belum selesai evaluasi.`,
        count: openMaterialRFQCount,
        entityIds: openMaterialRFQs.map((rfq: any) => Number(rfq.id)),
      });
    }

    if (openServiceRFQCount > 0) {
      blockers.push({
        domain: "SERVICE_PROCUREMENT",
        code: "SERVICE_RFQ_OPEN",
        message: `Terdapat ${openServiceRFQCount} RFQ Jasa yang masih terbuka/belum selesai evaluasi.`,
        count: openServiceRFQCount,
        entityIds: openServiceRFQs.map((rfq: any) => Number(rfq.id)),
      });
    }

    // Material POs & Goods Receipts
    const materialPoRows = await queryExecutor.query(
      `SELECT po.id, po.po_number, po.status, po.total_amount,
              COALESCE(SUM(gr.total_received_amount), 0) AS total_received
       FROM purchase_orders po
       JOIN purchase_requests pr ON po.pr_id = pr.id
       LEFT JOIN goods_receipts gr ON gr.po_id = po.id AND gr.deleted_at IS NULL
       WHERE pr.project_id = ?
         AND po.order_type IN ('MATERIAL', 'LEGACY_MIXED')
         AND po.deleted_at IS NULL
       GROUP BY po.id, po.po_number, po.status, po.total_amount`,
      [pId],
    );

    let unfulfilledMaterialPOCount = 0;
    let pendingGRCount = 0;

    for (const po of materialPoRows) {
      if (po.status === "CANCELLED") continue;

      if (po.status !== "COMPLETED") {
        unfulfilledMaterialPOCount++;
      }

      const poAmount = Number(po.total_amount || 0);
      const receivedAmount = Number(po.total_received || 0);
      if (po.status !== "COMPLETED" || receivedAmount < poAmount) {
        pendingGRCount++;
      }
    }

    if (unfulfilledMaterialPOCount > 0) {
      blockers.push({
        domain: "MATERIAL_PROCUREMENT",
        code: "MATERIAL_PO_UNFULFILLED",
        message: `Terdapat ${unfulfilledMaterialPOCount} Material Purchase Order yang belum berstatus COMPLETED.`,
        count: unfulfilledMaterialPOCount,
      });
    }

    if (pendingGRCount > 0) {
      blockers.push({
        domain: "MATERIAL_PROCUREMENT",
        code: "MATERIAL_GR_OUTSTANDING",
        message: `Terdapat ${pendingGRCount} Material Purchase Order dengan Goods Receipt yang belum terpenuhi 100%.`,
        count: pendingGRCount,
      });
    }

    // 7. Service Procurement (NO Goods Receipt) & Scope Reconciliation
    const servicePoRows = await queryExecutor.query(
      `SELECT po.id, po.po_number, po.status, po.total_amount,
              po.service_scope_reconciled_at, po.service_scope_reconciled_by,
              po.service_scope_released_amount, po.service_scope_reconciliation_reason
       FROM purchase_orders po
       JOIN purchase_requests pr ON po.pr_id = pr.id
       WHERE pr.project_id = ?
         AND po.order_type = 'SERVICE'
         AND po.deleted_at IS NULL`,
      [pId],
    );

    const servicePOCount = servicePoRows.length;
    let totalServiceCommitted = 0;
    for (const po of servicePoRows) {
      if (po.status !== "CANCELLED") {
        totalServiceCommitted += Number(po.total_amount || 0);
      }
    }

    // Service Orders
    const soRows = await queryExecutor.query(
      `SELECT so.id, so.service_order_number, so.status
       FROM service_orders so
       WHERE so.project_id = ? AND so.deleted_at IS NULL`,
      [pId],
    );

    const openServiceOrders = soRows.filter(
      (so: any) => so.status !== "CANCELLED",
    );
    const openServiceOrderCount = openServiceOrders.length;
    const draftServiceOrders = soRows.filter(
      (so: any) => so.status === "DRAFT",
    );

    if (draftServiceOrders.length > 0) {
      blockers.push({
        domain: "SERVICE_PROCUREMENT",
        code: "SERVICE_ORDER_DRAFT_PENDING",
        message: `Terdapat ${draftServiceOrders.length} Service Order (SPK) berstatus DRAFT yang belum diterbitkan atau dibatalkan.`,
        count: draftServiceOrders.length,
        entityIds: draftServiceOrders.map((so: any) => Number(so.id)),
      });
    }

    // Service Claims
    const serviceClaimRows = await queryExecutor.query(
      `SELECT sc.id, sc.claim_number, sc.status, sc.total_claim_amount, sc.approved_claim_amount, sc.po_id
       FROM service_claims sc
       WHERE sc.project_id = ? AND sc.deleted_at IS NULL`,
      [pId],
    );

    let approvedClaimedValue = 0;
    let pendingClaimCount = 0;
    const pendingClaimIds: number[] = [];
    const approvedClaims: any[] = [];

    for (const sc of serviceClaimRows) {
      if (
        ["DRAFT", "SUBMITTED", "NEEDS_REVISION", "PM_VERIFIED"].includes(
          sc.status,
        )
      ) {
        pendingClaimCount++;
        pendingClaimIds.push(Number(sc.id));
      } else if (sc.status === "APPROVED_FOR_INVOICE") {
        approvedClaimedValue += Number(sc.approved_claim_amount || 0);
        approvedClaims.push(sc);
      }
    }

    const remainingServiceScope = Math.max(
      0,
      Math.round(
        (totalServiceCommitted - approvedClaimedValue + Number.EPSILON) * 100,
      ) / 100,
    );

    // Canonical Service Clearance Rule (GAP-SERVICE-SCOPE-R1 Authoritative PO State)
    const serviceScopeClearanceSupported = true;
    if (servicePOCount > 0 && remainingServiceScope > 0) {
      // Primary authoritative reconciliation state is on purchase_orders
      let totalReleasedAmount = 0;
      for (const po of servicePoRows) {
        if (po.status !== "CANCELLED" && po.service_scope_reconciled_at) {
          totalReleasedAmount += Number(po.service_scope_released_amount || 0);
        }
      }

      const reconciled =
        Math.round((totalReleasedAmount + Number.EPSILON) * 100) / 100;
      if (reconciled < remainingServiceScope) {
        const unreconciledAmount = remainingServiceScope - reconciled;
        blockers.push({
          domain: "SERVICE_PROCUREMENT",
          code: "SERVICE_SCOPE_RECONCILIATION_REQUIRED",
          message: `Terdapat sisa komitmen PO Jasa sebesar Rp ${unreconciledAmount.toLocaleString("id-ID")} yang belum direkonsiliasi/dilepaskan oleh tim Procurement.`,
          amount: unreconciledAmount,
        });
      }
    }

    if (pendingClaimCount > 0) {
      blockers.push({
        domain: "SERVICE_CLAIMS",
        code: "SERVICE_CLAIM_PENDING",
        message: `Terdapat ${pendingClaimCount} klaim jasa yang masih dalam proses verifikasi/approval.`,
        count: pendingClaimCount,
        entityIds: pendingClaimIds,
      });
    }

    // Check if approved_for_invoice claims are invoiced
    let approvedUninvoicedCount = 0;
    let approvedUninvoicedValue = 0;

    for (const claim of approvedClaims) {
      const invRows = await queryExecutor.query(
        `SELECT id, invoice_number, status
         FROM invoices
         WHERE service_claim_id = ? AND deleted_at IS NULL`,
        [Number(claim.id)],
      );

      if (!invRows || invRows.length === 0) {
        approvedUninvoicedCount++;
        approvedUninvoicedValue += Number(claim.approved_claim_amount || 0);
      }
    }

    if (approvedUninvoicedCount > 0) {
      blockers.push({
        domain: "SERVICE_CLAIMS",
        code: "SERVICE_CLAIM_UNINVOICED",
        message: `Terdapat ${approvedUninvoicedCount} klaim jasa berstatus APPROVED_FOR_INVOICE yang belum diterbitkan invoice vendor.`,
        count: approvedUninvoicedCount,
        amount: approvedUninvoicedValue,
      });
    }

    // 8. Finance / Vendor AP Clearance (VENDOR AP ONLY, NOT CUSTOMER AR)
    const invoiceRows = await queryExecutor.query(
      `SELECT DISTINCT i.id, i.invoice_number, i.total_amount, i.match_status, i.payment_status, i.status
       FROM invoices i
       LEFT JOIN purchase_orders po ON i.po_id = po.id
       LEFT JOIN purchase_requests pr ON po.pr_id = pr.id
       LEFT JOIN service_claims sc ON i.service_claim_id = sc.id
       WHERE (pr.project_id = ? OR sc.project_id = ?)
         AND i.deleted_at IS NULL`,
      [pId, pId],
    );

    const totalVendorInvoices = invoiceRows.length;
    let unverifiedVendorInvoiceCount = 0;
    let unpaidVendorInvoiceCount = 0;
    let outstandingVendorPayable = 0;

    for (const inv of invoiceRows) {
      if (inv.match_status !== "VERIFIED") {
        unverifiedVendorInvoiceCount++;
      }
      if (inv.payment_status !== "PAID" && inv.status !== "PAID") {
        unpaidVendorInvoiceCount++;
        outstandingVendorPayable += Number(inv.total_amount || 0);
      }
    }

    if (unverifiedVendorInvoiceCount > 0) {
      blockers.push({
        domain: "VENDOR_AP",
        code: "VENDOR_INVOICE_UNVERIFIED",
        message: `Terdapat ${unverifiedVendorInvoiceCount} invoice vendor yang belum lolos verifikasi 3-way matching.`,
        count: unverifiedVendorInvoiceCount,
      });
    }

    if (unpaidVendorInvoiceCount > 0) {
      blockers.push({
        domain: "VENDOR_AP",
        code: "VENDOR_INVOICE_UNPAID",
        message: `Terdapat ${unpaidVendorInvoiceCount} invoice vendor yang belum lunas (outstanding: IDR ${outstandingVendorPayable.toLocaleString("id-ID")}).`,
        count: unpaidVendorInvoiceCount,
        amount: outstandingVendorPayable,
      });
    }

    // Payment Requests linked to project invoices
    const prqRows = await queryExecutor.query(
      `SELECT prq.id, prq.request_number, prq.status, prq.requested_amount
       FROM payment_requests prq
       JOIN invoices i ON prq.invoice_id = i.id
       LEFT JOIN purchase_orders po ON i.po_id = po.id
       LEFT JOIN purchase_requests pr ON po.pr_id = pr.id
       LEFT JOIN service_claims sc ON i.service_claim_id = sc.id
       WHERE (pr.project_id = ? OR sc.project_id = ?)
         AND prq.deleted_at IS NULL
         AND i.deleted_at IS NULL`,
      [pId, pId],
    );

    const pendingPaymentRequests = prqRows.filter(
      (prq: any) => !["PAID", "REJECTED"].includes(prq.status),
    );
    const pendingPaymentRequestCount = pendingPaymentRequests.length;

    if (pendingPaymentRequestCount > 0) {
      blockers.push({
        domain: "VENDOR_AP",
        code: "PAYMENT_REQUEST_PENDING",
        message: `Terdapat ${pendingPaymentRequestCount} pengajuan pembayaran vendor (Payment Request) yang belum tuntas.`,
        count: pendingPaymentRequestCount,
      });
    }

    // Retention Check (Section 13)
    const retentionRows = await queryExecutor.query(
      `SELECT pt.id, pt.term_name, pt.amount, pt.status
       FROM po_payment_terms pt
       JOIN purchase_orders po ON pt.po_id = po.id
       JOIN purchase_requests pr ON po.pr_id = pr.id
       WHERE pr.project_id = ?
         AND (pt.is_retention = 1 OR pt.term_type = 'RETENTION')
         AND pt.deleted_at IS NULL`,
      [pId],
    );

    const unsettledRetentionTerms = retentionRows.filter(
      (pt: any) => pt.status !== "PAID",
    );

    if (unsettledRetentionTerms.length > 0) {
      warnings.push({
        domain: "VENDOR_AP",
        code: "RETENTION_CLEARANCE_NOT_AUTHORITATIVE",
        message:
          "Terdapat klausul retensi vendor yang belum lunas. Model saat ini belum membedakan retensi dalam masa pemeliharaan (warranty hold) dengan kewajiban jatuh tempo.",
        count: unsettledRetentionTerms.length,
      });
    }

    // 9. Acceptance Documents Clearance (Section 15 & 16)
    const docRows = await queryExecutor.query(
      `SELECT id, file_name, file_size, category, created_at
       FROM documents
       WHERE entity_type = 'PROJECT' AND entity_id = ? AND deleted_at IS NULL`,
      [pId],
    );

    const isNonZeroDoc = (d: any) => {
      if (d.file_size !== undefined && d.file_size !== null) {
        return Number(d.file_size) > 0;
      }
      return true;
    };

    const bastDoc = docRows.find(
      (d: any) => d.category === DocumentCategory.CUSTOMER_BAST && isNonZeroDoc(d),
    );
    const finalReportDoc = docRows.find(
      (d: any) => d.category === DocumentCategory.FINAL_REPORT && isNonZeroDoc(d),
    );
    const handoverDoc = docRows.find(
      (d: any) => d.category === DocumentCategory.INTERNAL_HANDOVER && isNonZeroDoc(d),
    );

    const customerBastPresent = !!bastDoc;
    const finalReportPresent = !!finalReportDoc;
    const internalHandoverPresent = !!handoverDoc;

    if (!customerBastPresent) {
      blockers.push({
        domain: "DOCUMENTS",
        code: "CUSTOMER_ACCEPTANCE_MISSING",
        message:
          "Dokumen Berita Acara Serah Terima (CUSTOMER_BAST) dari pelanggan belum diunggah.",
      });
    }

    if (!finalReportPresent) {
      blockers.push({
        domain: "DOCUMENTS",
        code: "FINAL_REPORT_MISSING",
        message: "Dokumen Laporan Akhir Proyek (FINAL_REPORT) belum diunggah.",
      });
    }

    // Final Readiness Decision
    const isReady = blockers.length === 0;

    return {
      project: {
        id: Number(project.id),
        code: project.code,
        name: project.name,
        status: project.status,
        eligible: isEligible,
        contract: contractInfo,
      },
      ready: isReady,
      summary: {
        blockerCount: blockers.length,
        warningCount: warnings.length,
      },
      physical: {
        overallProgress,
        requiredProgress: 100,
        isComplete: isPhysicalComplete,
      },
      tasks: {
        totalLeafTasks,
        completedLeafTasks,
        incompleteLeafTasks,
        missingActualFinishCount,
        pendingVerificationCount,
      },
      issues: {
        totalIssues: issueRows.length,
        openIssues,
        inProgressIssues,
        resolvedIssues,
        closedIssues,
        cancelledIssues,
        blockingIssueCount,
      },
      risks: {
        totalRisks: riskRows.length,
        activeRiskCount,
        materializedRiskCount,
        unresolvedMaterializedRiskCount,
        clearedRiskCount,
      },
      procurement: {
        material: {
          openPRCount: openMaterialPRCount,
          openRFQCount: openMaterialRFQCount,
          unfulfilledMaterialPOCount,
          pendingGRCount,
        },
        service: {
          openPRCount: openServicePRCount,
          openRFQCount: openServiceRFQCount,
          servicePOCount,
          openServiceOrderCount,
          totalServiceCommitted,
          approvedClaimedValue,
          remainingServiceScope,
          serviceScopeClearanceSupported,
        },
      },
      serviceClaims: {
        totalClaims: serviceClaimRows.length,
        pendingClaimCount,
        approvedUninvoicedCount,
        approvedUninvoicedValue,
      },
      finance: {
        vendorAP: {
          totalVendorInvoices,
          unverifiedVendorInvoiceCount,
          unpaidVendorInvoiceCount,
          pendingPaymentRequestCount,
          outstandingVendorPayable,
        },
        customerAR: {
          modeled: false,
          blocking: false,
        },
      },
      documents: {
        customerBastPresent,
        customerBastDocumentId: bastDoc ? Number(bastDoc.id) : null,
        finalReportPresent,
        finalReportDocumentId: finalReportDoc
          ? Number(finalReportDoc.id)
          : null,
        internalHandoverPresent,
        internalHandoverDocumentId: handoverDoc ? Number(handoverDoc.id) : null,
        activeDocumentsCount: docRows.length,
        authoritativeLimitationNotes:
          "Verifikasi dokumen didasarkan pada keberadaan dokumen aktif berlabel kategori SSOT. Siklus persetujuan dokumen belum dimodelkan pada entitas Document.",
      },
      physicalActualFinishCandidate,
      blockers,
      warnings,
    };
  }

  // ==============================================================
  // PROJECT CLOSURE GOVERNANCE WORKFLOW (R1-C3)
  // ==============================================================

  /**
   * PM Submit Closure
   * Validates assigned PM authority, evaluates live readiness within same transaction,
   * creates immutable ProjectClosure cycle, starts PROJECT_CLOSURE workflow instance.
   */
  async submitClosure(
    projectId: number,
    dto: SubmitClosureDto,
    userId: number,
    userRoles: string[] = [],
  ): Promise<ProjectClosure> {
    const pId = Number(projectId);
    if (!pId || isNaN(pId) || pId <= 0) {
      throw new BadRequestException("Parameter projectId tidak valid.");
    }
    if (!userId) {
      throw new ForbiddenException("Identitas pengguna tidak ditemukan.");
    }

    // Section 14 & 38: Administrative roles receive no ordinary Closure business authority.
    if (
      userRoles.includes("ADMIN") ||
      userRoles.includes("SUPER_ADMIN") ||
      userRoles.includes("HEAD_OF_OPERATIONS") ||
      userRoles.includes("DIRECTOR") ||
      userRoles.includes("FINANCE") ||
      userRoles.includes("PROCUREMENT")
    ) {
      throw new ForbiddenException(
        "Hanya Project Manager yang ditugaskan pada proyek ini yang berhak mengajukan penutupan proyek.",
      );
    }

    if (!userRoles.includes("PROJECT_MANAGER")) {
      throw new ForbiddenException(
        "Hanya Project Manager yang ditugaskan pada proyek ini yang berhak mengajukan penutupan proyek.",
      );
    }

    return await this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. Lock Project row
      const project = await manager.findOne(Project, {
        where: { id: pId },
        lock: { mode: "pessimistic_write" },
      });

      if (!project) {
        throw new NotFoundException(`Proyek #${pId} tidak ditemukan.`);
      }

      if (project.status !== "IN_PROGRESS") {
        throw new BadRequestException(
          `Pengajuan penutupan hanya dapat dilakukan saat status proyek IN_PROGRESS. Status saat ini: ${project.status}`,
        );
      }

      // Check assigned PM
      if (!project.managerId || Number(project.managerId) !== Number(userId)) {
        throw new ForbiddenException(
          "Akses ditolak: Anda bukan Project Manager yang ditugaskan untuk proyek ini.",
        );
      }

      // 2. Check active cycle & determine cycle_number
      const latestClosure = await manager.findOne(ProjectClosure, {
        where: { projectId: pId },
        order: { cycleNumber: "DESC" },
        lock: { mode: "pessimistic_write" },
      });

      if (latestClosure) {
        if (
          latestClosure.status === ProjectClosureStatus.PENDING_HOO_REVIEW ||
          latestClosure.status ===
            ProjectClosureStatus.PENDING_DIRECTOR_APPROVAL
        ) {
          throw new ConflictException(
            `Terdapat siklus penutupan proyek (#${latestClosure.cycleNumber}) yang masih aktif (${latestClosure.status}). Pengajuan baru ditolak.`,
          );
        }
        if (latestClosure.status === ProjectClosureStatus.APPROVED) {
          throw new ConflictException(
            "Proyek ini telah disetujui penutupannya. Pengajuan baru ditolak.",
          );
        }
      }

      const cycleNumber = latestClosure ? latestClosure.cycleNumber + 1 : 1;

      // 3. Evaluate live readiness in the SAME transaction
      const readiness = await this.evaluateClosureReadiness(
        pId,
        userId,
        userRoles,
        manager,
      );
      if (!readiness.ready) {
        throw new ConflictException({
          statusCode: 409,
          error: "Conflict",
          message:
            "Proyek belum memenuhi kriteria kesiapan penutupan (Closure Readiness).",
          blockers: readiness.blockers,
        });
      }

      // 4. Derive authoritative documents
      const bastDocId = readiness.documents.customerBastDocumentId;
      const finalReportDocId = readiness.documents.finalReportDocumentId;
      if (!bastDocId || !finalReportDocId) {
        throw new ConflictException(
          "Dokumen BAST Pelanggan atau Laporan Akhir tidak ditemukan pada evaluasi kesiapan.",
        );
      }

      // 5. Create ProjectClosure cycle
      const closure = manager.create(ProjectClosure, {
        projectId: pId,
        cycleNumber,
        status: ProjectClosureStatus.PENDING_HOO_REVIEW,
        submittedById: userId,
        submittedAt: new Date(),
        submissionNotes: dto?.submissionNotes?.trim() || null,
        readinessSnapshot: JSON.parse(JSON.stringify(readiness)),
        acceptanceDocumentId: bastDocId,
        finalReportDocumentId: finalReportDocId,
        version: 1,
      });
      const savedClosure = await manager.save(ProjectClosure, closure);

      // 6. Start Workflow Engine instance bound to ProjectClosure
      const instance = await this.getWorkflowEngine().startInstance(
        {
          workflowKey: "PROJECT_CLOSURE",
          entityType: "PROJECT_CLOSURE",
          entityId: savedClosure.id,
          context: {
            projectId: pId,
            projectCode: project.code,
            cycleNumber,
            submittedById: userId,
          },
        },
        userId,
        manager,
      );

      // 7. AuditLog (Section 8 & 11)
      const audit = manager.create(AuditLog, {
        table_name: "project_closures",
        record_id: savedClosure.id,
        action: "PROJECT_CLOSURE_SUBMITTED",
        old_value: null,
        new_value: {
          projectId: pId,
          cycleNumber,
          status: ProjectClosureStatus.PENDING_HOO_REVIEW,
          submittedById: userId,
          submittedAt: savedClosure.submittedAt,
          submissionNotes: savedClosure.submissionNotes,
          acceptanceDocumentId: bastDocId,
          finalReportDocumentId: finalReportDocId,
          workflowInstanceId: instance.id,
        },
        created_by: userId,
      });
      await manager.save(AuditLog, audit);

      // 8. OutboxEvent (Section 8 & 10)
      const outbox = manager.create(OutboxEvent, {
        event_id: randomUUID(),
        event_name: "project.closure.submitted",
        event_version: "1.0",
        aggregate_type: "ProjectClosure",
        aggregate_id: Number(savedClosure.id),
        correlation_id: `closure-${savedClosure.id}-c${cycleNumber}`,
        payload: {
          projectId: pId,
          projectCode: project.code,
          closureId: savedClosure.id,
          cycleNumber,
          workflowInstanceId: instance.id,
          actor: { userId, roles: userRoles },
          occurredAt: savedClosure.submittedAt.toISOString(),
          businessPayload: {
            projectId: pId,
            projectCode: project.code,
            closureId: savedClosure.id,
            cycleNumber,
            workflowInstanceId: instance.id,
            actorId: userId,
            actorRole: "PROJECT_MANAGER",
            submittedAt: savedClosure.submittedAt,
            submissionNotes: savedClosure.submissionNotes,
          },
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await manager.save(OutboxEvent, outbox);

      return savedClosure;
    });
  }

  /**
   * HOO Approve Closure
   * Re-evaluates live readiness within transaction, advances workflow to DIRECTOR,
   * updates ProjectClosure to PENDING_DIRECTOR_APPROVAL, project remains IN_PROGRESS.
   */
  async hooApprove(
    projectId: number,
    closureId: number,
    dto: ApproveClosureDto,
    userId: number,
    userRoles: string[] = [],
  ): Promise<ProjectClosure> {
    const pId = Number(projectId);
    const cId = Number(closureId);

    if (userRoles.includes("SUPER_ADMIN") || userRoles.includes("ADMIN")) {
      throw new ForbiddenException(
        "Peran administratif dilarang melakukan aksi bisnis persetujuan penutupan proyek.",
      );
    }
    if (!userRoles.includes("HEAD_OF_OPERATIONS")) {
      throw new ForbiddenException(
        "Hanya Head of Operations yang berwenang menyetujui tahap peninjauan ini.",
      );
    }

    return await this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. Lock Project row & Closure row
      const project = await manager.findOne(Project, {
        where: { id: pId },
        lock: { mode: "pessimistic_write" },
      });
      if (!project)
        throw new NotFoundException(`Proyek #${pId} tidak ditemukan.`);
      if (project.status !== "IN_PROGRESS") {
        throw new ConflictException(
          `Proyek harus berstatus IN_PROGRESS. Status saat ini: ${project.status}`,
        );
      }

      const closure = await manager.findOne(ProjectClosure, {
        where: { id: cId },
        lock: { mode: "pessimistic_write" },
      });
      if (!closure)
        throw new NotFoundException(`Closure #${cId} tidak ditemukan.`);
      if (Number(closure.projectId) !== pId) {
        throw new BadRequestException(
          `Closure #${cId} bukan milik Proyek #${pId}.`,
        );
      }
      if (closure.status !== ProjectClosureStatus.PENDING_HOO_REVIEW) {
        throw new ConflictException(
          `Siklus penutupan #${closure.cycleNumber} tidak dalam status PENDING_HOO_REVIEW (Status saat ini: ${closure.status}).`,
        );
      }

      // Check if closure is the latest cycle
      const latestClosure = await manager.findOne(ProjectClosure, {
        where: { projectId: pId },
        order: { cycleNumber: "DESC" },
      });
      if (latestClosure && latestClosure.id !== closure.id) {
        throw new ConflictException(
          `Closure #${cId} bukan merupakan siklus penutupan aktif terbaru.`,
        );
      }

      // 2. Re-evaluate live readiness inside SAME transaction
      const readiness = await this.evaluateClosureReadiness(
        pId,
        userId,
        userRoles,
        manager,
      );
      if (!readiness.ready) {
        throw new ConflictException({
          statusCode: 409,
          error: "Conflict",
          message:
            "Kesiapan penutupan proyek tidak terpenuhi saat revalidasi persetujuan HOO.",
          blockers: readiness.blockers,
        });
      }

      // 3. Resolve active Workflow task for node_hoo_review
      const activeTask = await manager
        .createQueryBuilder(WorkflowTask, "task")
        .innerJoin("task.workflowInstance", "instance")
        .where("instance.entity_type = :entityType", {
          entityType: "PROJECT_CLOSURE",
        })
        .andWhere("instance.entity_id = :entityId", { entityId: closure.id })
        .andWhere("instance.status = :instanceStatus", {
          instanceStatus: WorkflowInstanceStatus.IN_PROGRESS,
        })
        .andWhere("task.status = :taskStatus", {
          taskStatus: WorkflowTaskStatus.PENDING,
        })
        .andWhere("task.node_id = :nodeId", { nodeId: "node_hoo_review" })
        .getOne();

      if (!activeTask) {
        throw new ConflictException(
          "Tugas alur kerja aktif untuk Head of Operations tidak ditemukan atau sudah selesai.",
        );
      }

      // 4. Complete task via Workflow Engine
      await this.getWorkflowEngine().completeTask(
        activeTask.id,
        {
          action: "APPROVE",
          reason: dto?.notes?.trim() || "Disetujui oleh Head of Operations",
        },
        userId,
        userRoles,
        manager,
      );

      // 5. Update ProjectClosure state
      closure.status = ProjectClosureStatus.PENDING_DIRECTOR_APPROVAL;
      closure.hooReviewerId = userId;
      closure.hooReviewedAt = new Date();
      closure.hooNotes = dto?.notes?.trim() || null;
      const savedClosure = await manager.save(ProjectClosure, closure);

      // 6. AuditLog (Section 8 & 11)
      const audit = manager.create(AuditLog, {
        table_name: "project_closures",
        record_id: savedClosure.id,
        action: "PROJECT_CLOSURE_HOO_APPROVED",
        old_value: {
          status: ProjectClosureStatus.PENDING_HOO_REVIEW,
        },
        new_value: {
          status: ProjectClosureStatus.PENDING_DIRECTOR_APPROVAL,
          hooReviewerId: userId,
          hooReviewedAt: savedClosure.hooReviewedAt,
          hooNotes: savedClosure.hooNotes,
          workflowInstanceId: activeTask.workflowInstanceId,
        },
        created_by: userId,
      });
      await manager.save(AuditLog, audit);

      // 7. OutboxEvent (Section 8 & 10)
      const outbox = manager.create(OutboxEvent, {
        event_id: randomUUID(),
        event_name: "project.closure.hoo.approved",
        event_version: "1.0",
        aggregate_type: "ProjectClosure",
        aggregate_id: Number(savedClosure.id),
        correlation_id: `closure-${savedClosure.id}-c${savedClosure.cycleNumber}`,
        payload: {
          projectId: pId,
          projectCode: project.code,
          closureId: savedClosure.id,
          cycleNumber: savedClosure.cycleNumber,
          workflowInstanceId: activeTask.workflowInstanceId,
          actor: { userId, roles: userRoles },
          occurredAt: savedClosure.hooReviewedAt.toISOString(),
          businessPayload: {
            projectId: pId,
            projectCode: project.code,
            closureId: savedClosure.id,
            cycleNumber: savedClosure.cycleNumber,
            workflowInstanceId: activeTask.workflowInstanceId,
            actorId: userId,
            actorRole: "HEAD_OF_OPERATIONS",
            hooReviewedAt: savedClosure.hooReviewedAt,
            notes: savedClosure.hooNotes,
          },
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await manager.save(OutboxEvent, outbox);

      return savedClosure;
    });
  }

  /**
   * HOO Return Closure
   * Transitions workflow to RETURNED (TERMINATED), updates ProjectClosure to RETURNED with mandatory reason.
   */
  async hooReturn(
    projectId: number,
    closureId: number,
    dto: ReturnClosureDto,
    userId: number,
    userRoles: string[] = [],
  ): Promise<ProjectClosure> {
    const pId = Number(projectId);
    const cId = Number(closureId);

    if (userRoles.includes("SUPER_ADMIN") || userRoles.includes("ADMIN")) {
      throw new ForbiddenException(
        "Peran administratif dilarang melakukan aksi pengembalian penutupan proyek.",
      );
    }
    if (!userRoles.includes("HEAD_OF_OPERATIONS")) {
      throw new ForbiddenException(
        "Hanya Head of Operations yang berwenang mengembalikan penutupan proyek pada tahap ini.",
      );
    }
    if (
      !dto?.reason ||
      typeof dto.reason !== "string" ||
      dto.reason.trim().length === 0
    ) {
      throw new BadRequestException(
        "Alasan pengembalian (reason) wajib diisi.",
      );
    }

    return await this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. Lock Project row & Closure row
      const project = await manager.findOne(Project, {
        where: { id: pId },
        lock: { mode: "pessimistic_write" },
      });
      if (!project)
        throw new NotFoundException(`Proyek #${pId} tidak ditemukan.`);
      if (project.status !== "IN_PROGRESS") {
        throw new ConflictException(
          `Proyek harus berstatus IN_PROGRESS. Status saat ini: ${project.status}`,
        );
      }

      const closure = await manager.findOne(ProjectClosure, {
        where: { id: cId },
        lock: { mode: "pessimistic_write" },
      });
      if (!closure)
        throw new NotFoundException(`Closure #${cId} tidak ditemukan.`);
      if (Number(closure.projectId) !== pId) {
        throw new BadRequestException(
          `Closure #${cId} bukan milik Proyek #${pId}.`,
        );
      }
      if (closure.status !== ProjectClosureStatus.PENDING_HOO_REVIEW) {
        throw new ConflictException(
          `Siklus penutupan #${closure.cycleNumber} tidak dalam status PENDING_HOO_REVIEW (Status saat ini: ${closure.status}).`,
        );
      }

      // 2. Resolve active Workflow task for node_hoo_review
      const activeTask = await manager
        .createQueryBuilder(WorkflowTask, "task")
        .innerJoin("task.workflowInstance", "instance")
        .where("instance.entity_type = :entityType", {
          entityType: "PROJECT_CLOSURE",
        })
        .andWhere("instance.entity_id = :entityId", { entityId: closure.id })
        .andWhere("instance.status = :instanceStatus", {
          instanceStatus: WorkflowInstanceStatus.IN_PROGRESS,
        })
        .andWhere("task.status = :taskStatus", {
          taskStatus: WorkflowTaskStatus.PENDING,
        })
        .andWhere("task.node_id = :nodeId", { nodeId: "node_hoo_review" })
        .getOne();

      if (!activeTask) {
        throw new ConflictException(
          "Tugas alur kerja aktif untuk Head of Operations tidak ditemukan atau sudah selesai.",
        );
      }

      const returnTs = new Date();
      const reason = dto.reason.trim();

      // 3. Complete task via Workflow Engine with action RETURN
      await this.getWorkflowEngine().completeTask(
        activeTask.id,
        { action: "RETURN", reason },
        userId,
        userRoles,
        manager,
      );

      // 4. Update ProjectClosure
      closure.status = ProjectClosureStatus.RETURNED;
      closure.hooReviewerId = userId;
      closure.hooReviewedAt = returnTs;
      closure.returnActorId = userId;
      closure.returnRole = "HEAD_OF_OPERATIONS";
      closure.returnTimestamp = returnTs;
      closure.returnReason = reason;
      const savedClosure = await manager.save(ProjectClosure, closure);

      // 5. AuditLog (Section 8 & 11)
      const audit = manager.create(AuditLog, {
        table_name: "project_closures",
        record_id: savedClosure.id,
        action: "PROJECT_CLOSURE_HOO_RETURNED",
        old_value: {
          status: ProjectClosureStatus.PENDING_HOO_REVIEW,
        },
        new_value: {
          status: ProjectClosureStatus.RETURNED,
          returnActorId: userId,
          returnRole: "HEAD_OF_OPERATIONS",
          returnTimestamp: returnTs,
          returnReason: reason,
          workflowInstanceId: activeTask.workflowInstanceId,
        },
        created_by: userId,
      });
      await manager.save(AuditLog, audit);

      // 6. OutboxEvent (Section 8 & 10)
      const outbox = manager.create(OutboxEvent, {
        event_id: randomUUID(),
        event_name: "project.closure.hoo.returned",
        event_version: "1.0",
        aggregate_type: "ProjectClosure",
        aggregate_id: Number(savedClosure.id),
        correlation_id: `closure-${savedClosure.id}-c${savedClosure.cycleNumber}`,
        payload: {
          projectId: pId,
          projectCode: project.code,
          closureId: savedClosure.id,
          cycleNumber: savedClosure.cycleNumber,
          workflowInstanceId: activeTask.workflowInstanceId,
          actor: { userId, roles: userRoles },
          occurredAt: returnTs.toISOString(),
          businessPayload: {
            projectId: pId,
            projectCode: project.code,
            closureId: savedClosure.id,
            cycleNumber: savedClosure.cycleNumber,
            workflowInstanceId: activeTask.workflowInstanceId,
            actorId: userId,
            actorRole: "HEAD_OF_OPERATIONS",
            returnTimestamp: returnTs,
            returnReason: reason,
          },
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await manager.save(OutboxEvent, outbox);

      return savedClosure;
    });
  }

  /**
   * Director Final Approve
   * Re-evaluates live readiness within transaction, completes workflow, sets Closure APPROVED,
   * transitions Project IN_PROGRESS -> CLOSED, sets actualFinishAt, closedAt, closedBy.
   */
  async directorApprove(
    projectId: number,
    closureId: number,
    dto: ApproveClosureDto,
    userId: number,
    userRoles: string[] = [],
  ): Promise<{ closure: ProjectClosure; project: Project }> {
    const pId = Number(projectId);
    const cId = Number(closureId);

    if (userRoles.includes("SUPER_ADMIN") || userRoles.includes("ADMIN")) {
      throw new ForbiddenException(
        "Peran administratif dilarang melakukan aksi persetujuan penutupan proyek.",
      );
    }
    if (!userRoles.includes("DIRECTOR")) {
      throw new ForbiddenException(
        "Hanya Direktur yang berwenang memberikan persetujuan akhir penutupan proyek.",
      );
    }

    return await this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. Lock Project row & Closure row
      const project = await manager.findOne(Project, {
        where: { id: pId },
        lock: { mode: "pessimistic_write" },
      });
      if (!project)
        throw new NotFoundException(`Proyek #${pId} tidak ditemukan.`);
      if (project.status !== "IN_PROGRESS") {
        throw new ConflictException(
          `Proyek harus berstatus IN_PROGRESS. Status saat ini: ${project.status}`,
        );
      }

      const closure = await manager.findOne(ProjectClosure, {
        where: { id: cId },
        lock: { mode: "pessimistic_write" },
      });
      if (!closure)
        throw new NotFoundException(`Closure #${cId} tidak ditemukan.`);
      if (Number(closure.projectId) !== pId) {
        throw new BadRequestException(
          `Closure #${cId} bukan milik Proyek #${pId}.`,
        );
      }
      if (closure.status !== ProjectClosureStatus.PENDING_DIRECTOR_APPROVAL) {
        throw new ConflictException(
          `Siklus penutupan #${closure.cycleNumber} tidak dalam status PENDING_DIRECTOR_APPROVAL (Status saat ini: ${closure.status}).`,
        );
      }

      if (!closure.hooReviewerId || !closure.hooReviewedAt) {
        throw new ConflictException(
          "Bukti persetujuan Head of Operations belum lengkap pada siklus ini.",
        );
      }

      // Check if closure is the latest cycle
      const latestClosure = await manager.findOne(ProjectClosure, {
        where: { projectId: pId },
        order: { cycleNumber: "DESC" },
      });
      if (latestClosure && latestClosure.id !== closure.id) {
        throw new ConflictException(
          `Closure #${cId} bukan merupakan siklus penutupan aktif terbaru.`,
        );
      }

      // 2. Re-evaluate live readiness inside SAME transaction
      const readiness = await this.evaluateClosureReadiness(
        pId,
        userId,
        userRoles,
        manager,
      );
      if (!readiness.ready) {
        throw new ConflictException({
          statusCode: 409,
          error: "Conflict",
          message:
            "Kesiapan penutupan proyek tidak terpenuhi saat revalidasi persetujuan Direktur.",
          blockers: readiness.blockers,
        });
      }
      if (!readiness.physicalActualFinishCandidate) {
        throw new ConflictException(
          "Kandidat tanggal penyelesaian fisik proyek (physicalActualFinishCandidate) tidak valid.",
        );
      }

      // 3. Resolve active Workflow task for node_director_approval
      const activeTask = await manager
        .createQueryBuilder(WorkflowTask, "task")
        .innerJoin("task.workflowInstance", "instance")
        .where("instance.entity_type = :entityType", {
          entityType: "PROJECT_CLOSURE",
        })
        .andWhere("instance.entity_id = :entityId", { entityId: closure.id })
        .andWhere("instance.status = :instanceStatus", {
          instanceStatus: WorkflowInstanceStatus.IN_PROGRESS,
        })
        .andWhere("task.status = :taskStatus", {
          taskStatus: WorkflowTaskStatus.PENDING,
        })
        .andWhere("task.node_id = :nodeId", {
          nodeId: "node_director_approval",
        })
        .getOne();

      if (!activeTask) {
        throw new ConflictException(
          "Tugas alur kerja aktif untuk Direktur tidak ditemukan atau sudah selesai.",
        );
      }

      const approvalTimestamp = new Date();

      // 4. Complete task via Workflow Engine (advances to node_end_approved -> COMPLETED)
      await this.getWorkflowEngine().completeTask(
        activeTask.id,
        {
          action: "APPROVE",
          reason: dto?.notes?.trim() || "Disetujui oleh Direktur",
        },
        userId,
        userRoles,
        manager,
      );

      // 5. Update ProjectClosure
      closure.status = ProjectClosureStatus.APPROVED;
      closure.directorApproverId = userId;
      closure.directorApprovedAt = approvalTimestamp;
      closure.directorNotes = dto?.notes?.trim() || null;
      const savedClosure = await manager.save(ProjectClosure, closure);

      // 6. Update Project to CLOSED
      project.status = "CLOSED";
      project.actualFinishAt = new Date(
        readiness.physicalActualFinishCandidate,
      );
      project.closedAt = approvalTimestamp;
      project.closedBy = userId;
      const savedProject = await manager.save(Project, project);

      // 7. AuditLog (Section 8 & 11)
      const audit = manager.create(AuditLog, {
        table_name: "project_closures",
        record_id: savedClosure.id,
        action: "PROJECT_CLOSURE_DIRECTOR_APPROVED",
        old_value: {
          status: ProjectClosureStatus.PENDING_DIRECTOR_APPROVAL,
          projectStatus: "IN_PROGRESS",
        },
        new_value: {
          status: ProjectClosureStatus.APPROVED,
          directorApproverId: userId,
          directorApprovedAt: approvalTimestamp,
          directorNotes: savedClosure.directorNotes,
          projectStatus: "CLOSED",
          actualFinishAt: savedProject.actualFinishAt,
          closedAt: savedProject.closedAt,
          closedBy: savedProject.closedBy,
          workflowInstanceId: activeTask.workflowInstanceId,
        },
        created_by: userId,
      });
      await manager.save(AuditLog, audit);

      // 8. OutboxEvent (Section 8 & 10)
      const outbox = manager.create(OutboxEvent, {
        event_id: randomUUID(),
        event_name: "project.closure.director.approved",
        event_version: "1.0",
        aggregate_type: "ProjectClosure",
        aggregate_id: Number(savedClosure.id),
        correlation_id: `closure-${savedClosure.id}-c${savedClosure.cycleNumber}`,
        payload: {
          projectId: pId,
          projectCode: project.code,
          closureId: savedClosure.id,
          cycleNumber: savedClosure.cycleNumber,
          workflowInstanceId: activeTask.workflowInstanceId,
          actor: { userId, roles: userRoles },
          occurredAt: approvalTimestamp.toISOString(),
          businessPayload: {
            projectId: pId,
            projectCode: project.code,
            closureId: savedClosure.id,
            cycleNumber: savedClosure.cycleNumber,
            workflowInstanceId: activeTask.workflowInstanceId,
            actorId: userId,
            actorRole: "DIRECTOR",
            directorApprovedAt: approvalTimestamp,
            notes: savedClosure.directorNotes,
            actualFinishAt: savedProject.actualFinishAt,
            closedAt: savedProject.closedAt,
            closedBy: savedProject.closedBy,
          },
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await manager.save(OutboxEvent, outbox);

      return {
        closure: savedClosure,
        project: savedProject,
      };
    });
  }

  /**
   * Director Return Closure
   * Transitions workflow to RETURNED (TERMINATED), updates ProjectClosure to RETURNED with mandatory reason,
   * preserves HOO review evidence, does NOT set director approval fields.
   */
  async directorReturn(
    projectId: number,
    closureId: number,
    dto: ReturnClosureDto,
    userId: number,
    userRoles: string[] = [],
  ): Promise<ProjectClosure> {
    const pId = Number(projectId);
    const cId = Number(closureId);

    if (userRoles.includes("SUPER_ADMIN") || userRoles.includes("ADMIN")) {
      throw new ForbiddenException(
        "Peran administratif dilarang melakukan aksi pengembalian penutupan proyek.",
      );
    }
    if (!userRoles.includes("DIRECTOR")) {
      throw new ForbiddenException(
        "Hanya Direktur yang berwenang mengembalikan penutupan proyek pada tahap ini.",
      );
    }
    if (
      !dto?.reason ||
      typeof dto.reason !== "string" ||
      dto.reason.trim().length === 0
    ) {
      throw new BadRequestException(
        "Alasan pengembalian (reason) wajib diisi.",
      );
    }

    return await this.dataSource.transaction(async (manager: EntityManager) => {
      // 1. Lock Project row & Closure row
      const project = await manager.findOne(Project, {
        where: { id: pId },
        lock: { mode: "pessimistic_write" },
      });
      if (!project)
        throw new NotFoundException(`Proyek #${pId} tidak ditemukan.`);
      if (project.status !== "IN_PROGRESS") {
        throw new ConflictException(
          `Proyek harus berstatus IN_PROGRESS. Status saat ini: ${project.status}`,
        );
      }

      const closure = await manager.findOne(ProjectClosure, {
        where: { id: cId },
        lock: { mode: "pessimistic_write" },
      });
      if (!closure)
        throw new NotFoundException(`Closure #${cId} tidak ditemukan.`);
      if (Number(closure.projectId) !== pId) {
        throw new BadRequestException(
          `Closure #${cId} bukan milik Proyek #${pId}.`,
        );
      }
      if (closure.status !== ProjectClosureStatus.PENDING_DIRECTOR_APPROVAL) {
        throw new ConflictException(
          `Siklus penutupan #${closure.cycleNumber} tidak dalam status PENDING_DIRECTOR_APPROVAL (Status saat ini: ${closure.status}).`,
        );
      }

      // 2. Resolve active Workflow task for node_director_approval
      const activeTask = await manager
        .createQueryBuilder(WorkflowTask, "task")
        .innerJoin("task.workflowInstance", "instance")
        .where("instance.entity_type = :entityType", {
          entityType: "PROJECT_CLOSURE",
        })
        .andWhere("instance.entity_id = :entityId", { entityId: closure.id })
        .andWhere("instance.status = :instanceStatus", {
          instanceStatus: WorkflowInstanceStatus.IN_PROGRESS,
        })
        .andWhere("task.status = :taskStatus", {
          taskStatus: WorkflowTaskStatus.PENDING,
        })
        .andWhere("task.node_id = :nodeId", {
          nodeId: "node_director_approval",
        })
        .getOne();

      if (!activeTask) {
        throw new ConflictException(
          "Tugas alur kerja aktif untuk Direktur tidak ditemukan atau sudah selesai.",
        );
      }

      const returnTs = new Date();
      const reason = dto.reason.trim();

      // 3. Complete task via Workflow Engine with action RETURN
      await this.getWorkflowEngine().completeTask(
        activeTask.id,
        { action: "RETURN", reason },
        userId,
        userRoles,
        manager,
      );

      // 4. Update ProjectClosure
      closure.status = ProjectClosureStatus.RETURNED;
      closure.returnActorId = userId;
      closure.returnRole = "DIRECTOR";
      closure.returnTimestamp = returnTs;
      closure.returnReason = reason;
      const savedClosure = await manager.save(ProjectClosure, closure);

      // 5. AuditLog (Section 8 & 11)
      const audit = manager.create(AuditLog, {
        table_name: "project_closures",
        record_id: savedClosure.id,
        action: "PROJECT_CLOSURE_DIRECTOR_RETURNED",
        old_value: {
          status: ProjectClosureStatus.PENDING_DIRECTOR_APPROVAL,
        },
        new_value: {
          status: ProjectClosureStatus.RETURNED,
          returnActorId: userId,
          returnRole: "DIRECTOR",
          returnTimestamp: returnTs,
          returnReason: reason,
          workflowInstanceId: activeTask.workflowInstanceId,
        },
        created_by: userId,
      });
      await manager.save(AuditLog, audit);

      // 6. OutboxEvent (Section 8 & 10)
      const outbox = manager.create(OutboxEvent, {
        event_id: randomUUID(),
        event_name: "project.closure.director.returned",
        event_version: "1.0",
        aggregate_type: "ProjectClosure",
        aggregate_id: Number(savedClosure.id),
        correlation_id: `closure-${savedClosure.id}-c${savedClosure.cycleNumber}`,
        payload: {
          projectId: pId,
          projectCode: project.code,
          closureId: savedClosure.id,
          cycleNumber: savedClosure.cycleNumber,
          workflowInstanceId: activeTask.workflowInstanceId,
          actor: { userId, roles: userRoles },
          occurredAt: returnTs.toISOString(),
          businessPayload: {
            projectId: pId,
            projectCode: project.code,
            closureId: savedClosure.id,
            cycleNumber: savedClosure.cycleNumber,
            workflowInstanceId: activeTask.workflowInstanceId,
            actorId: userId,
            actorRole: "DIRECTOR",
            returnTimestamp: returnTs,
            returnReason: reason,
          },
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await manager.save(OutboxEvent, outbox);

      return savedClosure;
    });
  }

  /**
   * Get Current Closure for Project
   */
  async getCurrentClosure(
    projectId: number,
    userId?: number,
    userRoles: string[] = [],
  ): Promise<any | null> {
    const pId = Number(projectId);
    const project = await this.getProjectRepo().findOne({ where: { id: pId } });
    if (!project)
      throw new NotFoundException(`Proyek #${pId} tidak ditemukan.`);

    // RBAC: If requester is Project Manager only, must be assigned PM
    if (
      userId &&
      userRoles.includes("PROJECT_MANAGER") &&
      !userRoles.some((r) =>
        [
          "SUPER_ADMIN",
          "DIRECTOR",
          "HEAD_OF_OPERATIONS",
          "PMO",
          "GENERAL_MANAGER",
          "PROCUREMENT",
          "FINANCE",
        ].includes(r),
      )
    ) {
      if (!project.managerId || Number(project.managerId) !== Number(userId)) {
        throw new ForbiddenException(
          "Akses ditolak: Anda bukan Project Manager yang ditugaskan untuk proyek ini.",
        );
      }
    }

    const closure = await this.getClosureRepo().findOne({
      where: { projectId: pId },
      order: { cycleNumber: "DESC" },
      relations: [
        "submittedBy",
        "hooReviewer",
        "directorApprover",
        "returnActor",
        "acceptanceDocument",
        "finalReportDocument",
      ],
    });

    if (!closure) return null;

    let workflowSummary: any = null;
    try {
      if (this.workflowEngineService) {
        const wfInstance = await this.workflowEngineService.getInstanceByEntity(
          "PROJECT_CLOSURE",
          closure.id,
        );
        if (wfInstance) {
          workflowSummary = {
            workflowInstanceId: wfInstance.id,
            workflowStatus: wfInstance.status,
            currentStep: wfInstance.currentNodeId,
          };
        }
      }
    } catch {
      // Workflow summary is an optional enhancement
    }

    return {
      ...closure,
      workflow: workflowSummary,
    };
  }

  /**
   * Get Closure History for Project
   */
  async getClosureHistory(
    projectId: number,
    userId?: number,
    userRoles: string[] = [],
  ): Promise<ProjectClosure[]> {
    const pId = Number(projectId);
    const project = await this.getProjectRepo().findOne({ where: { id: pId } });
    if (!project)
      throw new NotFoundException(`Proyek #${pId} tidak ditemukan.`);

    // RBAC check
    if (
      userId &&
      userRoles.includes("PROJECT_MANAGER") &&
      !userRoles.some((r) =>
        [
          "SUPER_ADMIN",
          "DIRECTOR",
          "HEAD_OF_OPERATIONS",
          "PMO",
          "GENERAL_MANAGER",
          "PROCUREMENT",
          "FINANCE",
        ].includes(r),
      )
    ) {
      if (!project.managerId || Number(project.managerId) !== Number(userId)) {
        throw new ForbiddenException(
          "Akses ditolak: Anda bukan Project Manager yang ditugaskan untuk proyek ini.",
        );
      }
    }

    return await this.getClosureRepo().find({
      where: { projectId: pId },
      order: { cycleNumber: "ASC" },
      relations: [
        "submittedBy",
        "hooReviewer",
        "directorApprover",
        "returnActor",
        "acceptanceDocument",
        "finalReportDocument",
      ],
    });
  }
}
