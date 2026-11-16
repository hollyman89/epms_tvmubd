import { DashboardService } from '../dashboard.service';
import { DashboardPeriod } from '../../analytics/dto/get-analytics.dto';

describe('DashboardService Phase A Credibility & Unclassified Reconciliation Tests', () => {
  let service: DashboardService;
  let mockProjectRepo: { count: jest.Mock };
  let mockPaymentRepo: { createQueryBuilder: jest.Mock };
  let mockPoRepo: { count: jest.Mock; createQueryBuilder: jest.Mock };
  let mockPrRepo: { count: jest.Mock };
  let mockAnalyticsService: { calculateDateRange: jest.Mock; getDashboardAnalytics: jest.Mock };
  let mockDataSource: { query: jest.Mock };

  beforeEach(() => {
    mockProjectRepo = {
      count: jest.fn(),
    };
    mockPaymentRepo = {
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ total: '150000000' }),
      }),
    };
    mockPoRepo = {
      count: jest.fn().mockResolvedValue(2),
      createQueryBuilder: jest.fn().mockReturnValue({
        select: jest.fn().mockReturnThis(),
        getRawOne: jest.fn().mockResolvedValue({ totalExpense: '200000000' }),
      }),
    };
    mockPrRepo = {
      count: jest.fn().mockResolvedValue(3),
    };
    mockAnalyticsService = {
      calculateDateRange: jest.fn().mockReturnValue({
        start: new Date('2026-01-01T00:00:00.000Z'),
        end: new Date('2026-11-16T23:59:59.999Z'),
      }),
      getDashboardAnalytics: jest.fn().mockResolvedValue({
        funnel: [],
        trendLine: [],
        kpi: {
          totalDeals: 10,
          totalPipeline: 1000000000,
          winRate: 0.5,
        },
      }),
    };
    mockDataSource = {
      query: jest.fn().mockResolvedValue([{ count: 0, value: 0 }]),
    };

    service = new DashboardService(
      mockProjectRepo as any,
      mockPaymentRepo as any,
      mockPoRepo as any,
      mockPrRepo as any,
      mockAnalyticsService as any,
      mockDataSource as any,
    );
  });

  describe('1. DashboardService.getSummary() Legacy Defect Elimination (Scope Item A.6)', () => {
    it('eliminates AP-as-Revenue and hardcoded metrics, returning explicit UNAVAILABLE states', async () => {
      mockProjectRepo.count.mockResolvedValueOnce(12);

      const summary = await service.getSummary();

      // Project count queries IN_PROGRESS, not fake ACTIVE
      expect(mockProjectRepo.count).toHaveBeenCalledWith({ where: { status: 'IN_PROGRESS' } });
      expect(summary.totalProjects).toBe(12);

      // Total revenue is eliminated from AP expenses and marked UNAVAILABLE
      expect(summary.totalRevenue).toBeNull();
      expect(summary.revenueStatus).toBe('UNAVAILABLE');
      expect(summary.vendorDisbursements).toBe(150000000);

      // Hardcoded profit margin and on-time rate are eliminated
      expect(summary.avgProfitMargin).toBeNull();
      expect(summary.profitMarginStatus).toBe('UNAVAILABLE');
      expect(summary.onTimeRate).toBeNull();
      expect(summary.onTimeRateStatus).toBe('UNAVAILABLE');

      // Legacy deprecation flags
      expect(summary.isDeprecated).toBe(true);
      expect(summary.notice).toContain('didepresiasi');
    });
  });

  describe('2. DashboardService.getUnclassifiedMetadata() Date Range Alignment (Scope Item A.5)', () => {
    it('applies date range predicates when start and end are provided', async () => {
      // Mock resolveMarketingUser
      mockDataSource.query
        .mockResolvedValueOnce([{ id: 9 }]) // resolve UBD
        .mockResolvedValueOnce([{ id: 7 }]) // resolve TVM
        .mockResolvedValueOnce([{ count: 5, value: 500000000 }]) // tenders
        .mockResolvedValueOnce([{ count: 2, value: 200000000 }]) // contracts
        .mockResolvedValueOnce([{ count: 2 }]) // projects
        .mockResolvedValueOnce([{ count: 3, value: 150000000 }]) // pos
        .mockResolvedValueOnce([{ count: 1, value: 50000000 }]); // payments

      const start = new Date('2026-01-01T00:00:00.000Z');
      const end = new Date('2026-11-16T23:59:59.999Z');

      const meta = await service.getUnclassifiedMetadata(start, end);

      expect(meta.tendersCount).toBe(5);
      expect(meta.tendersValue).toBe(500000000);
      expect(meta.posCount).toBe(3);
      expect(meta.paymentsValue).toBe(50000000);

      // Verify that queries with date filters were executed
      const queries = mockDataSource.query.mock.calls.map((call) => call[0]);
      const params = mockDataSource.query.mock.calls.map((call) => call[1]);

      // Tenders query had created_at BETWEEN
      const tenderCall = mockDataSource.query.mock.calls.find((c) => c[0].includes('FROM tenders'));
      expect(tenderCall[0]).toContain('AND t.created_at BETWEEN ? AND ?');
      expect(tenderCall[1]).toContain(start);
      expect(tenderCall[1]).toContain(end);

      // POs query had created_at BETWEEN and status filter
      const poCall = mockDataSource.query.mock.calls.find((c) => c[0].includes('FROM purchase_orders'));
      expect(poCall[0]).toContain("po.status IN ('ISSUED', 'PARTIALLY_FULFILLED', 'COMPLETED')");
      expect(poCall[1]).toContain(start);
      expect(poCall[1]).toContain(end);

      // Payments query had payment_date BETWEEN
      const payCall = mockDataSource.query.mock.calls.find((c) => c[0].includes('FROM payments'));
      expect(payCall[0]).toContain('AND pay.payment_date BETWEEN ? AND ?');
      expect(payCall[1]).toContain(start);
      expect(payCall[1]).toContain(end);
    });

    it('retains baseline queries without date constraints when start/end are omitted', async () => {
      mockDataSource.query
        .mockResolvedValueOnce([{ id: 9 }])
        .mockResolvedValueOnce([{ id: 7 }])
        .mockResolvedValueOnce([{ count: 10, value: 1000000000 }])
        .mockResolvedValueOnce([{ count: 4, value: 400000000 }])
        .mockResolvedValueOnce([{ count: 4 }])
        .mockResolvedValueOnce([{ count: 6, value: 300000000 }])
        .mockResolvedValueOnce([{ count: 2, value: 100000000 }]);

      const meta = await service.getUnclassifiedMetadata();

      expect(meta.tendersCount).toBe(10);
      const tenderCall = mockDataSource.query.mock.calls.find((c) => c[0].includes('FROM tenders'));
      expect(tenderCall[0]).not.toContain('created_at BETWEEN');
      expect(tenderCall[1]).toEqual([9, 7]);
    });
  });
});
