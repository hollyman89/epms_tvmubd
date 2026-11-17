import { DashboardService } from '../dashboard.service';
import { AnalyticsService } from '../../analytics/analytics.service';
import { GetExecutiveSummaryDto } from '../dto/get-executive-summary.dto';
import { DashboardPeriod } from '../../analytics/dto/get-analytics.dto';
import {
  SANDBOX_TENDER_IDS,
  SANDBOX_CONTRACT_IDS,
  SANDBOX_PROJECT_IDS,
  SANDBOX_PR_IDS,
  SANDBOX_PO_IDS,
  SANDBOX_INVOICE_IDS,
  SANDBOX_PAYMENT_IDS,
  SANDBOX_GR_IDS,
  isSandboxTender,
  isSandboxContract,
  isSandboxProject,
  isSandboxPr,
  isSandboxPo,
  isSandboxInvoice,
  isSandboxPayment,
  isSandboxGr,
  getSandboxTenderFilter,
  getSandboxContractFilter,
  getSandboxProjectFilter,
  getSandboxPrFilter,
  getSandboxPoFilter,
  getSandboxInvoiceFilter,
  getSandboxPaymentFilter,
  getSandboxGrFilter,
} from '../../../shared/helpers/sandbox-kpi-filter.helper';

describe('Phase B — Controlled Implementation: Sandbox KPI Isolation', () => {
  describe('1. Sandbox Eligibility Helper & Critical Safety Invariants', () => {
    it('accurately identifies all 7 confirmed Sandbox Tenders', () => {
      expect(SANDBOX_TENDER_IDS).toEqual([166, 133, 163, 164, 165, 171, 172]);
      for (const id of [166, 133, 163, 164, 165, 171, 172]) {
        expect(isSandboxTender(id)).toBe(true);
      }
    });

    it('CRITICAL SAFETY: strictly preserves Tender #170 as production-eligible', () => {
      // Tender 170: 'JASA PENGURUSAN PERIZINAN SLF CIREBON' (Rp2,127,000,000, WON, SPK verified)
      expect(isSandboxTender(170)).toBe(false);
      expect(SANDBOX_TENDER_IDS.includes(170)).toBe(false);
    });

    it('accurately identifies all 8 confirmed Sandbox Projects and 7 Sandbox Contracts', () => {
      expect(SANDBOX_PROJECT_IDS).toEqual([3, 4, 5, 6, 53, 88, 124, 96]);
      for (const id of [3, 4, 5, 6, 53, 88, 124, 96]) {
        expect(isSandboxProject(id)).toBe(true);
      }
      expect(isSandboxProject(1)).toBe(false); // Production Project Asianet Surabaya
      expect(isSandboxProject(2)).toBe(false);

      expect(SANDBOX_CONTRACT_IDS).toEqual([3, 4, 5, 8, 14, 32, 33]);
      for (const id of [3, 4, 5, 8, 14, 32, 33]) {
        expect(isSandboxContract(id)).toBe(true);
      }
      expect(isSandboxContract(1)).toBe(false); // Production Contract CONT-20261017-0001
      expect(isSandboxContract(2)).toBe(false);
    });

    it('accurately identifies all 14 Sandbox PRs and 14 Sandbox POs', () => {
      expect(SANDBOX_PR_IDS.length).toBe(14);
      expect(SANDBOX_PO_IDS.length).toBe(14);
      expect(isSandboxPo(4)).toBe(true);
      expect(isSandboxPo(19)).toBe(true); // Rp15.12B test PO
      expect(isSandboxPo(1)).toBe(false); // Production PO 1
      expect(isSandboxPo(24)).toBe(false); // Production PO 24
    });

    it('CRITICAL LINEAGE: distinguishes Sandbox Invoice #23 from Production Invoice #24', () => {
      // Invoice #23: 'INV-20261113-002' (tagged UBD, but belongs to PO 23 -> PR 23 -> Project 124 'PROJECT PERCOBAAN PAJAK' -> Tender 172)
      expect(isSandboxInvoice(23)).toBe(true);
      expect(SANDBOX_INVOICE_IDS.includes(23)).toBe(true);

      // Invoice #24: 'INV-20261113-003' (tagged UBD, belongs to PO 24 -> PR 24 -> Project 57 -> Tender 110 production)
      expect(isSandboxInvoice(24)).toBe(false);
      expect(SANDBOX_INVOICE_IDS.includes(24)).toBe(false);
    });

    it('accurately isolates all 10 Sandbox Payments while keeping 9 Non-Sandbox Payments eligible', () => {
      expect(SANDBOX_PAYMENT_IDS).toEqual([2, 5, 6, 7, 8, 9, 12, 13, 16, 19]);
      for (const id of [2, 5, 6, 7, 8, 9, 12, 13, 16, 19]) {
        expect(isSandboxPayment(id)).toBe(true);
      }

      // Non-sandbox payments: [1, 3, 4, 10, 11, 14, 15, 17, 18]
      for (const id of [1, 3, 4, 10, 11, 14, 15, 17, 18]) {
        expect(isSandboxPayment(id)).toBe(false);
      }
    });

    it('formats valid SQL filter clauses with correct aliases and column names', () => {
      expect(getSandboxTenderFilter('t')).toBe('AND t.id NOT IN (166, 133, 163, 164, 165, 171, 172)');
      expect(getSandboxTenderFilter()).toBe('AND id NOT IN (166, 133, 163, 164, 165, 171, 172)');
      expect(getSandboxProjectFilter('p')).toBe('AND p.id NOT IN (3, 4, 5, 6, 53, 88, 124, 96)');
      expect(getSandboxContractFilter('c')).toBe('AND c.id NOT IN (3, 4, 5, 8, 14, 32, 33)');
      expect(getSandboxPaymentFilter('pay')).toBe('AND pay.id NOT IN (2, 5, 6, 7, 8, 9, 12, 13, 16, 19)');
      expect(getSandboxPoFilter('po')).toBe('AND po.id NOT IN (4, 5, 6, 7, 8, 9, 13, 14, 18, 19, 20, 21, 22, 23)');
      expect(getSandboxInvoiceFilter('i')).toBe('AND i.id NOT IN (4, 5, 6, 7, 8, 9, 13, 14, 17, 18, 20, 23)');
    });
  });

  describe('2. AnalyticsService Query-Level Sandbox Exclusion', () => {
    let analyticsService: AnalyticsService;
    let mockTenderRepo: { query: jest.Mock };
    let mockDataSource: { query: jest.Mock };

    beforeEach(() => {
      mockTenderRepo = { query: jest.fn() };
      mockDataSource = { query: jest.fn() };
      analyticsService = new AnalyticsService(mockTenderRepo as any, mockDataSource as any);
    });

    it('applies sandbox tender exclusion in getKpi query', async () => {
      mockTenderRepo.query.mockResolvedValueOnce([
        {
          totalDeals: 10,
          wonCount: 2,
          lostCount: 1,
          openCount: 7,
          openPipelineValue: 500000000,
          wonValue: 2127000000, // E.g. Tender 170
          lostValue: 100000000,
          totalPipeline: 2727000000,
          avgDealSize: 1063500000,
        },
      ]);

      await (analyticsService as any).getKpi(new Date('2026-01-01'), new Date('2026-11-16'), undefined, true);

      expect(mockTenderRepo.query).toHaveBeenCalledTimes(1);
      const executedSql = mockTenderRepo.query.mock.calls[0][0];
      expect(executedSql).toContain('NOT IN (166, 133, 163, 164, 165, 171, 172)');
      expect(executedSql).toContain('FROM tenders');
    });

    it('applies sandbox tender exclusion in getSectorDistribution query', async () => {
      mockTenderRepo.query.mockResolvedValueOnce([
        { sector: 'Telekomunikasi', value: 2127000000 },
      ]);

      await (analyticsService as any).getSectorDistribution(new Date('2026-01-01'), new Date('2026-11-16'), undefined, true);

      expect(mockTenderRepo.query).toHaveBeenCalledTimes(1);
      const executedSql = mockTenderRepo.query.mock.calls[0][0];
      expect(executedSql).toContain('NOT IN (166, 133, 163, 164, 165, 171, 172)');
      expect(executedSql).toContain('business_sector');
    });

    it('applies sandbox tender exclusion in getFunnel query', async () => {
      mockTenderRepo.query.mockResolvedValueOnce([
        { stage: 'WON', count: 2 },
        { stage: 'LEAD', count: 5 },
      ]);

      await (analyticsService as any).getFunnel(new Date('2026-01-01'), new Date('2026-11-16'), undefined, true);

      expect(mockTenderRepo.query).toHaveBeenCalledTimes(1);
      const executedSql = mockTenderRepo.query.mock.calls[0][0];
      expect(executedSql).toContain('NOT IN (166, 133, 163, 164, 165, 171, 172)');
      expect(executedSql).toContain('GROUP BY stage');
    });

    it('applies sandbox tender exclusion in getTrendLine query', async () => {
      mockTenderRepo.query.mockResolvedValueOnce([
        { year: 2026, month: 10, value: 2127000000 },
      ]);

      await (analyticsService as any).getTrendLine(new Date('2026-11-16'), undefined, true);

      expect(mockTenderRepo.query).toHaveBeenCalledTimes(1);
      const executedSql = mockTenderRepo.query.mock.calls[0][0];
      expect(executedSql).toContain('NOT IN (166, 133, 163, 164, 165, 171, 172)');
      expect(executedSql).toContain('GROUP BY YEAR(created_at), MONTH(created_at)');
    });

    it('applies sandbox tender exclusion in getMarketingPerformance query', async () => {
      mockTenderRepo.query.mockResolvedValueOnce([]);

      await analyticsService.getMarketingPerformance({ period: DashboardPeriod.ALL_TIME });

      expect(mockTenderRepo.query).toHaveBeenCalledTimes(1);
      const executedSql = mockTenderRepo.query.mock.calls[0][0];
      expect(executedSql).toContain('t.id NOT IN (166, 133, 163, 164, 165, 171, 172)');
    });
  });

  describe('3. DashboardService Executive Summary Query-Level Sandbox Exclusion', () => {
    let dashboardService: DashboardService;
    let mockDataSource: { query: jest.Mock };
    let mockAnalyticsService: { calculateDateRange: jest.Mock; getDashboardAnalytics: jest.Mock };
    let executedQueries: string[];

    beforeEach(() => {
      executedQueries = [];
      mockDataSource = {
        query: jest.fn().mockImplementation(async (sql: string, params: any[] = []) => {
          executedQueries.push(sql);
          // Marketing identity resolution
          if (sql.includes('users WHERE email = ?')) {
            if (params[0] === 'ragil@epms.com') return [{ id: 9, full_name: 'Dwi Ragil Pribadi', email: 'ragil@epms.com', is_active: 1 }];
            if (params[0] === 'lukas@epms.com') return [{ id: 7, full_name: 'Lukas Kurniawan', email: 'lukas@epms.com', is_active: 1 }];
            return [];
          }
          if (sql.includes('COUNT(t.id) as count')) return [{ count: 0, value: 0 }];
          if (sql.includes('COUNT(c.id) as count')) return [{ count: 0, value: 0 }];
          if (sql.includes('COUNT(p.id) as count')) return [{ count: 0 }];
          if (sql.includes('COUNT(po.id) as count')) return [{ count: 0, value: 0 }];
          if (sql.includes('COUNT(pay.id) as count')) return [{ count: 0, value: 0 }];
          return [{ count: 0, value: 0 }];
        }),
      };

      mockAnalyticsService = {
        calculateDateRange: jest.fn().mockReturnValue({
          start: new Date('2026-01-01T00:00:00.000Z'),
          end: new Date('2026-11-16T23:59:59.999Z'),
        }),
        getDashboardAnalytics: jest.fn().mockResolvedValue({
          period: 'YEAR_TO_DATE',
          kpi: {
            totalPipeline: 1000000000,
            winRate: 0.5,
            winRateStatus: 'DECIDED_OUTCOME',
            wonCount: 2,
            lostCount: 2,
            openCount: 5,
            openPipelineValue: 500000000,
            wonValue: 500000000,
            lostValue: 200000000,
            closedValueWinRate: 0.7143,
            overallConversionYield: 0.2222,
            avgDealSize: 250000000,
            totalDeals: 9,
            momGrowth: 0.1,
            growthStatus: 'GROWTH',
            growthPeriodLabel: 'MoM',
          },
          trendLine: [],
          sectorDistribution: [],
          funnel: [],
          insights: { topInsight: 'test', warningInsight: 'test' },
        }),
      };

      dashboardService = new DashboardService(
        {} as any,
        {} as any,
        {} as any,
        {} as any,
        mockAnalyticsService as any,
        mockDataSource as any,
      );
    });

    it('guarantees that all consolidated KPI queries exclude confirmed Sandbox IDs', async () => {
      const query: GetExecutiveSummaryDto = {
        period: DashboardPeriod.ALL_TIME,
        divisionId: 'ALL',
      };

      await dashboardService.getExecutiveSummary(query);

      // Verify Won Deals query excludes sandbox tenders
      const wonQuery = executedQueries.find(q => q.includes("status = 'WON'") && q.includes('wonValue'));
      expect(wonQuery).toBeDefined();
      expect(wonQuery).toContain('t.id NOT IN (166, 133, 163, 164, 165, 171, 172)');

      // Verify Open Pipeline query excludes sandbox tenders
      const openQuery = executedQueries.find(q => q.includes('openDealsCount') && q.includes('openPipelineValue'));
      expect(openQuery).toBeDefined();
      expect(openQuery).toContain('t.id NOT IN (166, 133, 163, 164, 165, 171, 172)');

      // Verify Project Snapshot excludes sandbox projects
      const projectSnapshotQuery = executedQueries.find(q => q.includes('totalProjects') && q.includes('planningProjects'));
      expect(projectSnapshotQuery).toBeDefined();
      expect(projectSnapshotQuery).toContain('p.id NOT IN (3, 4, 5, 6, 53, 88, 124, 96)');

      // Verify Contract Awarded excludes sandbox contracts
      const contractAwardedQuery = executedQueries.find(q => q.includes('contractAwardedCount'));
      expect(contractAwardedQuery).toBeDefined();
      expect(contractAwardedQuery).toContain('c.id NOT IN (3, 4, 5, 8, 14, 32, 33)');

      // Verify Under Execution Value excludes sandbox projects and contracts
      const underExecutionQuery = executedQueries.find(q => q.includes('underExecutionProjectsCount'));
      expect(underExecutionQuery).toBeDefined();
      expect(underExecutionQuery).toContain('p.id NOT IN (3, 4, 5, 6, 53, 88, 124, 96)');
      expect(underExecutionQuery).toContain('c.id NOT IN (3, 4, 5, 8, 14, 32, 33)');

      // Verify Payments & Vendor Disbursements excludes sandbox payments
      const paymentQuery = executedQueries.find(q => q.includes('paymentCount') && q.includes('paymentValue'));
      expect(paymentQuery).toBeDefined();
      expect(paymentQuery).toContain('pay.id NOT IN (2, 5, 6, 7, 8, 9, 12, 13, 16, 19)');

      // Verify Purchase Orders excludes sandbox POs
      const poQuery = executedQueries.find(q => q.includes('poCommittedValue'));
      expect(poQuery).toBeDefined();
      expect(poQuery).toContain('po.id NOT IN (4, 5, 6, 7, 8, 9, 13, 14, 18, 19, 20, 21, 22, 23)');

      // Verify Invoices / AP Period excludes sandbox Invoices
      const apQuery = executedQueries.find(q => q.includes('invoiceTotal') && q.includes('verifiedInvoiceCount'));
      expect(apQuery).toBeDefined();
      expect(apQuery).toContain('i.id NOT IN (4, 5, 6, 7, 8, 9, 13, 14, 17, 18, 20, 23)');

      // Verify Outstanding AP excludes sandbox Invoices and sandbox Payments
      const apOutstandingQuery = executedQueries.find(q => q.includes('outstandingLiabilityBalance'));
      expect(apOutstandingQuery).toBeDefined();
      expect(apOutstandingQuery).toContain('i.id NOT IN (4, 5, 6, 7, 8, 9, 13, 14, 17, 18, 20, 23)');
      expect(apOutstandingQuery).toContain('id NOT IN (2, 5, 6, 7, 8, 9, 12, 13, 16, 19)');

      // Verify Payments Trend excludes sandbox payments
      const paymentsTrendQuery = executedQueries.find(q => q.includes('pay.amount_paid') && q.includes('GROUP BY m ORDER BY m'));
      expect(paymentsTrendQuery).toBeDefined();
      expect(paymentsTrendQuery).toContain('pay.id NOT IN (2, 5, 6, 7, 8, 9, 12, 13, 16, 19)');
    });

    it('guarantees that Entity-Specific scopes (UBD / TVM) retain sandbox exclusion without re-introducing test records', async () => {
      executedQueries = [];
      const query: GetExecutiveSummaryDto = {
        period: DashboardPeriod.ALL_TIME,
        divisionId: 'UBD',
      };

      await dashboardService.getExecutiveSummary(query);

      // Verify Won Deals in UBD scope still excludes sandbox tenders
      const wonQuery = executedQueries.find(q => q.includes("status = 'WON'") && q.includes('wonValue'));
      expect(wonQuery).toBeDefined();
      expect(wonQuery).toContain('t.id NOT IN (166, 133, 163, 164, 165, 171, 172)');

      // Verify Payments in UBD scope still excludes sandbox payments
      const paymentQuery = executedQueries.find(q => q.includes('paymentCount') && q.includes('paymentValue'));
      expect(paymentQuery).toBeDefined();
      expect(paymentQuery).toContain('pay.id NOT IN (2, 5, 6, 7, 8, 9, 12, 13, 16, 19)');
    });

    it('guarantees that getUnclassifiedMetadata excludes Sandbox records across all tables', async () => {
      executedQueries = [];
      await dashboardService.getUnclassifiedMetadata(new Date('2026-01-01'), new Date('2026-11-16'));

      const tenderUnclass = executedQueries.find(q => q.includes('FROM tenders t') && q.includes('NOT IN (?, ?)'));
      expect(tenderUnclass).toBeDefined();
      expect(tenderUnclass).toContain('t.id NOT IN (166, 133, 163, 164, 165, 171, 172)');

      const contractUnclass = executedQueries.find(q => q.includes('FROM contracts c') && q.includes('NOT IN (?, ?)'));
      expect(contractUnclass).toBeDefined();
      expect(contractUnclass).toContain('c.id NOT IN (3, 4, 5, 8, 14, 32, 33)');
      expect(contractUnclass).toContain('t.id NOT IN (166, 133, 163, 164, 165, 171, 172)');

      const projectUnclass = executedQueries.find(q => q.includes('FROM projects p') && q.includes('NOT IN (?, ?)'));
      expect(projectUnclass).toBeDefined();
      expect(projectUnclass).toContain('p.id NOT IN (3, 4, 5, 6, 53, 88, 124, 96)');

      const poUnclass = executedQueries.find(q => q.includes('FROM purchase_orders po') && q.includes('NOT IN (?, ?)'));
      expect(poUnclass).toBeDefined();
      expect(poUnclass).toContain('po.id NOT IN (4, 5, 6, 7, 8, 9, 13, 14, 18, 19, 20, 21, 22, 23)');

      const paymentUnclass = executedQueries.find(q => q.includes('FROM payments pay') && q.includes('NOT IN (?, ?)'));
      expect(paymentUnclass).toBeDefined();
      expect(paymentUnclass).toContain('pay.id NOT IN (2, 5, 6, 7, 8, 9, 12, 13, 16, 19)');
    });
  });
});
