import { AnalyticsService } from '../analytics.service';
import { DashboardPeriod } from '../dto/get-analytics.dto';

describe('AnalyticsService Phase A KPI Credibility Tests', () => {
  let service: AnalyticsService;
  let mockTenderRepo: { query: jest.Mock };
  let mockDataSource: { query: jest.Mock };

  beforeEach(() => {
    mockTenderRepo = {
      query: jest.fn(),
    };
    mockDataSource = {
      query: jest.fn(),
    };

    service = new AnalyticsService(
      mockTenderRepo as any,
      mockDataSource as any,
    );
  });

  describe('1. Win Rate Decided-Outcome Calculation (Scope Item A.1)', () => {
    it('calculates winRate as WON / (WON + LOST) when decided outcomes exist', async () => {
      mockTenderRepo.query.mockResolvedValueOnce([
        {
          totalDeals: 10,
          wonCount: 3,
          lostCount: 1,
          openCount: 6,
          openPipelineValue: 600000000,
          wonValue: 300000000,
          lostValue: 100000000,
          totalPipeline: 1000000000,
          avgDealSize: 100000000,
        },
      ]);

      // Call internal getKpi through getDashboardAnalytics
      const res = await (service as any).getKpi(new Date('2026-01-01'), new Date('2026-11-16'), undefined, true);

      expect(res.winRate).toBe(0.75); // 3 / (3 + 1) = 0.75
      expect(res.winRateStatus).toBe('DECIDED_OUTCOME');
      expect(res.wonCount).toBe(3);
      expect(res.lostCount).toBe(1);
      expect(res.openCount).toBe(6);
      expect(res.openPipelineValue).toBe(600000000);
      expect(res.wonValue).toBe(300000000);
      expect(res.lostValue).toBe(100000000);
      expect(res.closedValueWinRate).toBe(0.75); // 300M / (300M + 100M)
      expect(res.overallConversionYield).toBe(0.3); // 3 / 10
    });

    it('returns winRate null and UNAVAILABLE status when zero decided outcomes (WON=0, LOST=0)', async () => {
      mockTenderRepo.query.mockResolvedValueOnce([
        {
          totalDeals: 5,
          wonCount: 0,
          lostCount: 0,
          openCount: 5,
          openPipelineValue: 500000000,
          wonValue: 0,
          lostValue: 0,
          totalPipeline: 500000000,
          avgDealSize: 0,
        },
      ]);

      const res = await (service as any).getKpi(new Date('2026-01-01'), new Date('2026-11-16'), undefined, true);

      expect(res.winRate).toBeNull();
      expect(res.winRateStatus).toBe('UNAVAILABLE');
      expect(res.closedValueWinRate).toBeNull();
      expect(res.overallConversionYield).toBe(0);
      expect(res.openCount).toBe(5);
    });

    it('calculates 100% winRate when WON > 0 and LOST = 0', async () => {
      mockTenderRepo.query.mockResolvedValueOnce([
        {
          totalDeals: 7,
          wonCount: 2,
          lostCount: 0,
          openCount: 5,
          openPipelineValue: 500000000,
          wonValue: 200000000,
          lostValue: 0,
          totalPipeline: 700000000,
          avgDealSize: 100000000,
        },
      ]);

      const res = await (service as any).getKpi(new Date('2026-01-01'), new Date('2026-11-16'), undefined, true);

      expect(res.winRate).toBe(1.0);
      expect(res.winRateStatus).toBe('DECIDED_OUTCOME');
    });
  });

  describe('2. Pipeline Growth & Baseline Handling (Scope Item A.2)', () => {
    it('sets momGrowth to null with NO_PRIOR_BASELINE when previous period has zero pipeline', async () => {
      // Mock current KPI
      mockTenderRepo.query
        .mockResolvedValueOnce([
          { totalDeals: 4, wonCount: 1, lostCount: 0, totalPipeline: 500000000, avgDealSize: 500000000 },
        ])
        // Mock previous KPI (zero baseline)
        .mockResolvedValueOnce([
          { totalDeals: 0, wonCount: 0, lostCount: 0, totalPipeline: 0, avgDealSize: 0 },
        ])
        // Sector distribution
        .mockResolvedValueOnce([])
        // Funnel
        .mockResolvedValueOnce([
          { stage: 'LEAD', count: 10 },
          { stage: 'QUALIFICATION', count: 8 },
          { stage: 'PROPOSAL', count: 5 },
          { stage: 'NEGOTIATION', count: 2 },
          { stage: 'WON', count: 1 },
          { stage: 'LOST', count: 0 },
        ])
        // TrendLine
        .mockResolvedValueOnce([]);

      const result = await service.getDashboardAnalytics({ period: DashboardPeriod.THIS_MONTH });

      expect(result.kpi.momGrowth).toBeNull();
      expect(result.kpi.growthStatus).toBe('NO_PRIOR_BASELINE');
      expect(result.kpi.growthPeriodLabel).toBe('MoM');
      expect(result.insights.topInsight).toContain('Tidak ada pembanding periode sebelumnya');
    });

    it('calculates correct growth percentage when previous baseline exists', async () => {
      mockTenderRepo.query
        .mockResolvedValueOnce([
          { totalDeals: 5, wonCount: 1, lostCount: 0, totalPipeline: 1500000000, avgDealSize: 500000000 },
        ])
        .mockResolvedValueOnce([
          { totalDeals: 3, wonCount: 0, lostCount: 0, totalPipeline: 1000000000, avgDealSize: 0 },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getDashboardAnalytics({ period: DashboardPeriod.THIS_MONTH });

      expect(result.kpi.momGrowth).toBe(0.5); // (1.5B - 1.0B) / 1.0B = 0.5 (50%)
      expect(result.kpi.growthStatus).toBe('GROWTH');
      expect(result.kpi.growthPeriodLabel).toBe('MoM');
      expect(result.insights.topInsight).toContain('50.0%');
    });

    it('returns null growth and label for ALL_TIME', async () => {
      mockTenderRepo.query
        .mockResolvedValueOnce([
          { totalDeals: 10, wonCount: 2, lostCount: 1, totalPipeline: 3000000000, avgDealSize: 1000000000 },
        ])
        .mockResolvedValueOnce([
          { totalDeals: 10, wonCount: 2, lostCount: 1, totalPipeline: 3000000000, avgDealSize: 1000000000 },
        ])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const result = await service.getDashboardAnalytics({ period: DashboardPeriod.ALL_TIME });

      expect(result.kpi.momGrowth).toBeNull();
      expect(result.kpi.growthStatus).toBe('NO_PRIOR_BASELINE');
      expect(result.kpi.growthPeriodLabel).toBeNull();
    });

    it('assigns QoQ label for THIS_QUARTER and YTD label for YEAR_TO_DATE', async () => {
      mockTenderRepo.query
        .mockResolvedValueOnce([{ totalPipeline: 100 }])
        .mockResolvedValueOnce([{ totalPipeline: 50 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const quarterRes = await service.getDashboardAnalytics({ period: DashboardPeriod.THIS_QUARTER });
      expect(quarterRes.kpi.growthPeriodLabel).toBe('QoQ');

      mockTenderRepo.query
        .mockResolvedValueOnce([{ totalPipeline: 100 }])
        .mockResolvedValueOnce([{ totalPipeline: 50 }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);

      const ytdRes = await service.getDashboardAnalytics({ period: DashboardPeriod.YEAR_TO_DATE });
      expect(ytdRes.kpi.growthPeriodLabel).toBe('YTD');
    });
  });

  describe('3. Funnel Stage Exclusion of Lost Tenders (Scope Item A.4)', () => {
    it('does not include lost tenders in negotiation stage count', async () => {
      // stages: LEAD: 10, QUALIFICATION: 8, PROPOSAL: 6, NEGOTIATION: 2, WON: 2, LOST: 5
      mockTenderRepo.query.mockResolvedValueOnce([
        { stage: 'LEAD', count: 10 },
        { stage: 'QUALIFICATION', count: 8 },
        { stage: 'PROPOSAL', count: 6 },
        { stage: 'NEGOTIATION', count: 2 },
        { stage: 'WON', count: 2 },
        { stage: 'LOST', count: 5 },
      ]);

      const funnel = await (service as any).getFunnel(new Date('2026-01-01'), new Date('2026-11-16'), undefined, true);

      const propStage = funnel.find((f: any) => f.stage === 'PROPOSAL');
      const negStage = funnel.find((f: any) => f.stage === 'NEGOTIATION');
      const wonStage = funnel.find((f: any) => f.stage === 'WON');

      // Won is 2
      expect(wonStage.count).toBe(2);
      // Neg is active neg (2) + won (2) = 4, NOT 4 + 5 = 9!
      expect(negStage.count).toBe(4);
      // Prop is active prop (6) + neg (2) + won (2) = 10, NOT including lost (5)
      expect(propStage.count).toBe(10);
    });
  });

  describe('4. Marketing Performance Separation & Generic Desk Isolation (Scope Item A.3)', () => {
    it('isolates generic account marketing@epms.com (id=4709) and separates open vs won vs lost value', async () => {
      mockTenderRepo.query.mockResolvedValueOnce([
        {
          marketingId: 4709,
          marketingName: 'Marketing EPMS',
          marketingEmail: 'marketing@epms.com',
          totalTender: 15,
          openCount: 15,
          openPipelineValue: 1200000000,
          wonCount: 0,
          wonValue: 0,
          lostCount: 0,
          lostValue: 0,
          totalPortfolioValue: 1200000000,
          averageDealSize: 80000000,
        },
        {
          marketingId: 9,
          marketingName: 'Ragil UBD',
          marketingEmail: 'ragil@ubd.co.id',
          totalTender: 10,
          openCount: 6,
          openPipelineValue: 800000000,
          wonCount: 3,
          wonValue: 300000000,
          lostCount: 1,
          lostValue: 100000000,
          totalPortfolioValue: 1200000000,
          averageDealSize: 100000000,
        },
      ]);

      const perf = await service.getMarketingPerformance({ period: DashboardPeriod.YEAR_TO_DATE });

      expect(perf).toHaveLength(2);
      
      const genericAccount = perf.find((p) => p.marketingId === 4709);
      expect(genericAccount).toBeDefined();
      expect(genericAccount?.isGenericAccount).toBe(true);
      expect(genericAccount?.openTender).toBe(15);
      expect(genericAccount?.pipelineValue).toBe(1200000000);
      expect(genericAccount?.winRate).toBeNull();
      expect(genericAccount?.winRateStatus).toBe('UNAVAILABLE');

      const realPic = perf.find((p) => p.marketingId === 9);
      expect(realPic).toBeDefined();
      expect(realPic?.isGenericAccount).toBe(false);
      expect(realPic?.openTender).toBe(6);
      expect(realPic?.pipelineValue).toBe(800000000);
      expect(realPic?.wonTender).toBe(3);
      expect(realPic?.wonValue).toBe(300000000);
      expect(realPic?.lostTender).toBe(1);
      expect(realPic?.lostValue).toBe(100000000);
      expect(realPic?.totalPortfolioValue).toBe(1200000000);
      expect(realPic?.winRate).toBe(75); // 3 / (3 + 1) * 100 = 75%
      expect(realPic?.winRateStatus).toBe('DECIDED_OUTCOME');
    });
  });
});
