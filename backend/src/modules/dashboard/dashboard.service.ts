import { Injectable, Logger } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Project } from '../../entities/project.entity';
import { Payment } from '../../entities/payment.entity';
import { PurchaseOrder } from '../../entities/purchase-order.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { AnalyticsService } from '../analytics/analytics.service';
import { GetExecutiveSummaryDto } from './dto/get-executive-summary.dto';
import { DashboardPeriod } from '../analytics/dto/get-analytics.dto';

@Injectable()
export class DashboardService {
  private readonly logger = new Logger(DashboardService.name);

  constructor(
    @InjectRepository(Project) private projectRepo: Repository<Project>,
    @InjectRepository(Payment) private paymentRepo: Repository<Payment>,
    @InjectRepository(PurchaseOrder) private poRepo: Repository<PurchaseOrder>,
    @InjectRepository(PurchaseRequest) private prRepo: Repository<PurchaseRequest>,
    private readonly analyticsService: AnalyticsService,
    private readonly dataSource: DataSource,
  ) {}

  /**
   * Authoritative, real-data-only executive summary endpoint.
   * Exclusively accessible by SUPER_ADMIN, DIRECTOR, and HEAD_OF_OPERATIONS.
   * Aggregates Marketing, Projects, AP Finance, Vendor Disbursements, Procurement, and Approvals.
   */
  async getExecutiveSummary(query: GetExecutiveSummaryDto, userId?: number, roles?: string[]) {
    this.logger.log('Fetching authoritative executive summary from real EPMS data...');

    const { period, startDate, endDate } = query;
    const { start, end } = this.analyticsService.calculateDateRange(period, startDate, endDate);

    // 1. Marketing Metrics (delegated to canonical AnalyticsService)
    const analyticsPromise = this.analyticsService.getDashboardAnalytics(query, userId, roles);

    // 2. Won Deals count in period for explicit marketing wonDeals field
    const wonDealsPromise = this.dataSource.query(
      `SELECT COUNT(id) as count 
       FROM tenders 
       WHERE created_at BETWEEN ? AND ? AND status = 'WON' AND deleted_at IS NULL`,
      [start, end],
    );

    // 3. Project Snapshot (Current State - Planning, In Progress, Ready for Kickoff, Manager Assignment)
    const projectSnapshotPromise = this.dataSource.query(
      `SELECT
         COUNT(id) as totalProjects,
         COUNT(CASE WHEN status = 'PLANNING' THEN 1 END) as planningProjects,
         COUNT(CASE WHEN status = 'IN_PROGRESS' THEN 1 END) as inProgressProjects,
         COUNT(CASE WHEN status IN ('PLANNING', 'IN_PROGRESS') THEN 1 END) as activeProjects,
         COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completedProjects,
         COUNT(CASE WHEN status = 'ON_HOLD' THEN 1 END) as onHoldProjects,
         COUNT(CASE WHEN status = 'CANCELLED' THEN 1 END) as cancelledProjects,
         COUNT(CASE WHEN manager_id IS NOT NULL THEN 1 END) as assignedProjectManagers,
         COUNT(CASE WHEN manager_id IS NULL THEN 1 END) as unassignedProjectManagers
       FROM projects
       WHERE deleted_at IS NULL`,
    );

    // 3b. True Ready for Kickoff: Projects in PLANNING status that have completed the management review workflow (node_end / COMPLETED) or legacy review READY_FOR_KICKOFF
    const readyForKickoffPromise = this.dataSource.query(
      `SELECT COUNT(DISTINCT p.id) as readyForKickoff
       FROM projects p
       LEFT JOIN workflow_instances wi ON wi.entity_type = 'PROJECT' AND wi.entity_id = p.id
       LEFT JOIN project_management_reviews pmr ON pmr.project_id = p.id AND pmr.deleted_at IS NULL
       WHERE p.status = 'PLANNING' 
         AND p.deleted_at IS NULL
         AND (
           (wi.status = 'COMPLETED' OR wi.current_node_id = 'node_end')
           OR (wi.id IS NULL AND pmr.status = 'READY_FOR_KICKOFF')
         )`,
    );

    // 3c. Pre-Kickoff Portfolio: Active contracts where either no project workspace exists yet or project is still in PLANNING
    const preKickoffContractsPromise = this.dataSource.query(
      `SELECT COUNT(DISTINCT c.id) as preKickoffContracts
       FROM contracts c
       LEFT JOIN projects p ON p.contract_id = c.id AND p.deleted_at IS NULL
       WHERE c.status = 'ACTIVE' 
         AND c.deleted_at IS NULL
         AND (p.id IS NULL OR p.status = 'PLANNING')`,
    );

    // 4. Accounts Payable (Invoiced, Verified, Paid in period + Live Outstanding AP)
    const apPeriodPromise = this.dataSource.query(
      `SELECT
         COUNT(id) as invoiceCount,
         COALESCE(SUM(total_amount), 0) as invoiceTotal,
         COUNT(CASE WHEN match_status = 'VERIFIED' THEN 1 END) as verifiedInvoiceCount,
         COALESCE(SUM(CASE WHEN match_status = 'VERIFIED' THEN total_amount ELSE 0 END), 0) as verifiedInvoiceValue,
         COUNT(CASE WHEN payment_status = 'PAID' THEN 1 END) as paidInvoiceCount,
         COALESCE(SUM(CASE WHEN payment_status = 'PAID' THEN total_amount ELSE 0 END), 0) as paidInvoiceValue
       FROM invoices
       WHERE invoice_date BETWEEN ? AND ? AND deleted_at IS NULL`,
      [start, end],
    );

    const apOutstandingPromise = this.dataSource.query(
      `SELECT
         COUNT(CASE WHEN match_status = 'VERIFIED' AND payment_status != 'PAID' THEN 1 END) as outstandingInvoiceCount,
         COALESCE(SUM(CASE WHEN match_status = 'VERIFIED' AND payment_status != 'PAID' THEN total_amount ELSE 0 END), 0) as outstandingInvoiceValue
       FROM invoices
       WHERE deleted_at IS NULL`,
    );

    // 5. Vendor Disbursements (Actual Payments made in period)
    const paymentPromise = this.dataSource.query(
      `SELECT
         COUNT(id) as paymentCount,
         COALESCE(SUM(amount_paid), 0) as paymentValue
       FROM payments
       WHERE payment_date BETWEEN ? AND ? AND deleted_at IS NULL`,
      [start, end],
    );

    // 6. Procurement Metrics (PR, PO, GR within period)
    const prPromise = this.dataSource.query(
      `SELECT
         COUNT(id) as prCount,
         COUNT(CASE WHEN status = 'SUBMITTED' THEN 1 END) as pendingPrCount,
         COUNT(CASE WHEN status IN ('APPROVED', 'PO_ISSUED') THEN 1 END) as approvedPrCount,
         COUNT(CASE WHEN status = 'PO_ISSUED' THEN 1 END) as poIssuedPrCount
       FROM purchase_requests
       WHERE created_at BETWEEN ? AND ? AND deleted_at IS NULL`,
      [start, end],
    );

    const poPromise = this.dataSource.query(
      `SELECT
         COUNT(id) as poCount,
         COALESCE(SUM(total_amount), 0) as poCommittedValue,
         COUNT(CASE WHEN status = 'COMPLETED' THEN 1 END) as completedPoCount
       FROM purchase_orders
       WHERE created_at BETWEEN ? AND ? AND deleted_at IS NULL`,
      [start, end],
    );

    const grPromise = this.dataSource.query(
      `SELECT
         COUNT(id) as goodsReceiptCount,
         COALESCE(SUM(total_received_amount), 0) as goodsReceiptValue
       FROM goods_receipts
       WHERE receipt_date BETWEEN ? AND ? AND deleted_at IS NULL`,
      [start, end],
    );

    // 7. Organization-Wide Approval Summary (Current PENDING workflow tasks)
    const wfTotalPromise = this.dataSource.query(
      `SELECT COUNT(id) as totalPendingTasks
       FROM workflow_tasks
       WHERE status = 'PENDING'`,
    );

    const wfByTaskPromise = this.dataSource.query(
      `SELECT task_key as taskKey, COUNT(id) as count
       FROM workflow_tasks
       WHERE status = 'PENDING'
       GROUP BY task_key
       ORDER BY count DESC`,
    );

    const wfTasksPromise = this.dataSource.query(
      `SELECT 
         wt.id,
         wt.task_key,
         r.name as role_name
       FROM workflow_tasks wt
       LEFT JOIN roles r ON wt.assignee_role_id = r.id
       WHERE wt.status = 'PENDING'`,
    );

    // 8. Legal Contracts Snapshot (Current State - Pending Review, Expired Revision, Active)
    const legalSummaryPromise = this.dataSource.query(
      `SELECT
         COUNT(CASE WHEN status = 'PENDING_LEGAL_REVIEW' THEN 1 END) as pendingLegalReview,
         COUNT(CASE WHEN status = 'REVISION_EXPIRED' THEN 1 END) as revisionExpired,
         COUNT(CASE WHEN status = 'ACTIVE' THEN 1 END) as activeContracts,
         COUNT(CASE WHEN status = 'REVISION_NEEDED' THEN 1 END) as revisionNeeded,
         COUNT(id) as totalContracts
       FROM contracts
       WHERE deleted_at IS NULL`,
    );

    // Execute all queries concurrently
    const [
      analyticsData,
      wonDealsResult,
      projectSnapshotResult,
      readyForKickoffResult,
      preKickoffContractsResult,
      apPeriodResult,
      apOutstandingResult,
      paymentResult,
      prResult,
      poResult,
      grResult,
      wfTotalResult,
      wfByTaskResult,
      wfTasksResult,
      legalSummaryResult,
    ] = await Promise.all([
      analyticsPromise,
      wonDealsPromise,
      projectSnapshotPromise,
      readyForKickoffPromise,
      preKickoffContractsPromise,
      apPeriodPromise,
      apOutstandingPromise,
      paymentPromise,
      prPromise,
      poPromise,
      grPromise,
      wfTotalPromise,
      wfByTaskPromise,
      wfTasksPromise,
      legalSummaryPromise,
    ]);

    // Calculate procurement ratios with safe zero-denominator handling
    const approvedPrs = Number(prResult[0]?.approvedPrCount || 0);
    const poIssuedPrs = Number(prResult[0]?.poIssuedPrCount || 0);
    const totalPos = Number(poResult[0]?.poCount || 0);
    const completedPos = Number(poResult[0]?.completedPoCount || 0);

    const prToPoConversionRate =
      approvedPrs > 0 ? Number(((poIssuedPrs / approvedPrs) * 100).toFixed(2)) : 0;
    const poToGrCompletionRate =
      totalPos > 0 ? Number(((completedPos / totalPos) * 100).toFixed(2)) : 0;

    // Group pending tasks by canonical roles
    const roleBuckets: Record<string, number> = {
      PMO: 0,
      MARKETING: 0,
      FINANCE: 0,
      HEAD_OF_OPERATIONS: 0,
      LEGAL: 0,
      PROCUREMENT: 0,
      PROJECT_MANAGER: 0,
    };

    for (const t of wfTasksResult) {
      const role = String(t.role_name || '').toUpperCase();
      if (role === 'PMO') roleBuckets.PMO++;
      else if (role === 'MARKETING') roleBuckets.MARKETING++;
      else if (role === 'FINANCE') roleBuckets.FINANCE++;
      else if (role === 'HEAD_OF_OPERATIONS' || role === 'HOPS') roleBuckets.HEAD_OF_OPERATIONS++;
      else if (role === 'LEGAL') roleBuckets.LEGAL++;
      else if (role === 'PROCUREMENT' || role === 'PURCHASING') roleBuckets.PROCUREMENT++;
      else if (role === 'PROJECT_MANAGER' || role === 'PM') roleBuckets.PROJECT_MANAGER++;
      else {
        // Fallback for unclassified roles - default to PMO for administrative integrity
        roleBuckets.PMO++;
      }
    }

    const wonDeals = Number(wonDealsResult[0]?.count || 0);
    const totalDeals = Number(analyticsData.kpi?.totalDeals || 0);
    // Canonical backend win rate: WON / (WON + LOST) with null fallback when no closed decisions
    const winRate =
      analyticsData.kpi?.winRate !== null && analyticsData.kpi?.winRate !== undefined
        ? Number((Number(analyticsData.kpi.winRate) * 100).toFixed(2))
        : null;

    return {
      meta: {
        generatedAt: new Date().toISOString(),
        period: {
          type: period || DashboardPeriod.YEAR_TO_DATE,
          startDate: start.toISOString(),
          endDate: end.toISOString(),
        },
      },
      periodMetrics: {
        marketing: {
          totalPipeline: Number(analyticsData.kpi?.totalPipeline || 0),
          totalDeals,
          wonDeals,
          winRate,
          pipelineByStage: analyticsData.funnel || [],
          marketingTrend: analyticsData.trendLine || [],
        },
        accountsPayable: {
          invoiceCount: Number(apPeriodResult[0]?.invoiceCount || 0),
          invoiceTotal: Number(apPeriodResult[0]?.invoiceTotal || 0),
          verifiedInvoiceCount: Number(apPeriodResult[0]?.verifiedInvoiceCount || 0),
          verifiedInvoiceValue: Number(apPeriodResult[0]?.verifiedInvoiceValue || 0),
          paidInvoiceCount: Number(apPeriodResult[0]?.paidInvoiceCount || 0),
          paidInvoiceValue: Number(apPeriodResult[0]?.paidInvoiceValue || 0),
        },
        vendorPayments: {
          paymentCount: Number(paymentResult[0]?.paymentCount || 0),
          paymentValue: Number(paymentResult[0]?.paymentValue || 0),
        },
        procurement: {
          prCount: Number(prResult[0]?.prCount || 0),
          pendingPrCount: Number(prResult[0]?.pendingPrCount || 0),
          approvedPrCount: approvedPrs,
          poCount: totalPos,
          poCommittedValue: Number(poResult[0]?.poCommittedValue || 0),
          goodsReceiptCount: Number(grResult[0]?.goodsReceiptCount || 0),
          goodsReceiptValue: Number(grResult[0]?.goodsReceiptValue || 0),
          completedPoCount: completedPos,
          prToPoConversionRate,
          poToGrCompletionRate,
        },
      },
      currentSnapshot: {
        projects: {
          totalProjects: Number(projectSnapshotResult[0]?.totalProjects || 0),
          activeProjects: Number(projectSnapshotResult[0]?.activeProjects || 0),
          planningProjects: Number(projectSnapshotResult[0]?.planningProjects || 0),
          inProgressProjects: Number(projectSnapshotResult[0]?.inProgressProjects || 0),
          completedProjects: Number(projectSnapshotResult[0]?.completedProjects || 0),
          onHoldProjects: Number(projectSnapshotResult[0]?.onHoldProjects || 0),
          cancelledProjects: Number(projectSnapshotResult[0]?.cancelledProjects || 0),
          readyForKickoff: Number(readyForKickoffResult[0]?.readyForKickoff || 0),
          preKickoffContracts: Number(preKickoffContractsResult[0]?.preKickoffContracts || 0),
          assignedProjectManagers: Number(projectSnapshotResult[0]?.assignedProjectManagers || 0),
          unassignedProjectManagers: Number(projectSnapshotResult[0]?.unassignedProjectManagers || 0),
        },
        approvals: {
          totalPendingTasks: Number(wfTotalResult[0]?.totalPendingTasks || 0),
          pendingByTaskKey: (wfByTaskResult || []).map((r: any) => ({
            taskKey: String(r.taskKey),
            count: Number(r.count),
          })),
          pendingByRole: roleBuckets,
        },
        accountsPayable: {
          outstandingInvoiceCount: Number(apOutstandingResult[0]?.outstandingInvoiceCount || 0),
          outstandingInvoiceValue: Number(apOutstandingResult[0]?.outstandingInvoiceValue || 0),
        },
        legal: {
          pendingLegalReview: Number(legalSummaryResult[0]?.pendingLegalReview || 0),
          revisionExpired: Number(legalSummaryResult[0]?.revisionExpired || 0),
          activeContracts: Number(legalSummaryResult[0]?.activeContracts || 0),
          revisionNeeded: Number(legalSummaryResult[0]?.revisionNeeded || 0),
          totalContracts: Number(legalSummaryResult[0]?.totalContracts || 0),
        },
      },
    };
  }

  async getSummary() {
    this.logger.log('Fetching dashboard summary from DB...');
    
    // Execute independent database queries concurrently via Promise.all for maximum latency reduction
    const [
      totalProjects,
      revenueResult,
      poResult,
      pendingPRs,
      pendingPOs
    ] = await Promise.all([
      // 1. Total Projects (Active/Running)
      this.projectRepo.count({ where: { status: 'ACTIVE' } }),

      // 2. Total Revenue (Sum of all payments)
      this.paymentRepo
        .createQueryBuilder('payment')
        .select('SUM(payment.amount_paid)', 'total')
        .getRawOne(),

      // 3. Total PO Expense
      this.poRepo
        .createQueryBuilder('po')
        .select('SUM(po.total_amount)', 'totalExpense')
        .getRawOne(),

      // 4a. Pending PRs
      this.prRepo.count({ where: { status: 'DRAFT' } }),

      // 4b. Pending POs
      this.poRepo.count({ where: { status: 'DRAFT' } })
    ]);

    const totalRevenue = revenueResult?.total ? parseFloat(revenueResult.total) : 0;
    const totalExpense = poResult?.totalExpense ? parseFloat(poResult.totalExpense) : 0;

    const totalBudget = 5000000000;
    let avgProfitMargin = 0;
    if (totalBudget > 0) {
      avgProfitMargin = ((totalBudget - totalExpense) / totalBudget) * 100;
      avgProfitMargin = Math.min(100, Math.max(0, avgProfitMargin)); 
    } else {
      avgProfitMargin = 25.5; 
    }

    const pendingApprovals = pendingPRs + pendingPOs;
    const onTimeRate = 92.4; 

    return {
      totalProjects,
      totalRevenue,
      avgProfitMargin: parseFloat(avgProfitMargin.toFixed(2)),
      pendingApprovals,
      onTimeRate
    };
  }

  async getProjectTrend() {
    // Generate trend data for the last 30 days based on projects table
    // For demo purposes and since we might not have 30 days of data, we'll mock a realistic trend
    const trend = [];
    const today = new Date();
    
    for (let i = 30; i >= 0; i -= 3) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      
      // Mocking progressive data
      const completed = Math.floor(Math.random() * 5) + Math.floor((30 - i) / 2);
      const onHold = Math.floor(Math.random() * 3);
      
      trend.push({
        date: d.toISOString().split('T')[0],
        type: 'Selesai',
        value: completed
      });
      trend.push({
        date: d.toISOString().split('T')[0],
        type: 'Tertahan',
        value: onHold
      });
    }

    return trend;
  }

  async getProcurementPending() {
    // Fetch PRs that are DRAFT
    const prs = await this.prRepo.find({
      where: { status: 'DRAFT' },
      order: { createdAt: 'ASC' },
      take: 10
    });

    const pos = await this.poRepo.find({
      where: { status: 'DRAFT' },
      order: { createdAt: 'ASC' },
      take: 10
    });

    const pendingList = [
      ...prs.map(pr => ({
        id: `PR-${pr.id}`,
        type: 'Purchase Request',
        number: pr.prNumber,
        date: pr.createdAt,
        status: 'Menunggu Persetujuan'
      })),
      ...pos.map(po => ({
        id: `PO-${po.id}`,
        type: 'Purchase Order',
        number: po.poNumber,
        date: po.createdAt,
        status: 'Menunggu Persetujuan Manajer'
      }))
    ];

    // Sort by oldest first
    return pendingList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);
  }
}
