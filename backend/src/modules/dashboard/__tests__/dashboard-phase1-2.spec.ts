import { DashboardService } from '../dashboard.service';
import { GetExecutiveSummaryDto } from '../dto/get-executive-summary.dto';
import { DashboardPeriod } from '../../analytics/dto/get-analytics.dto';

describe('Director Executive Dashboard Phase 1+2 Backend Extensions', () => {
  let service: DashboardService;
  let mockDataSource: { query: jest.Mock };
  let mockAnalyticsService: { calculateDateRange: jest.Mock; getDashboardAnalytics: jest.Mock };

  beforeEach(() => {
    mockDataSource = {
      query: jest.fn(),
    };

    mockAnalyticsService = {
      calculateDateRange: jest.fn().mockReturnValue({
        start: new Date('2026-01-01T00:00:00.000Z'),
        end: new Date('2026-10-24T23:59:59.999Z'),
      }),
      getDashboardAnalytics: jest.fn().mockResolvedValue({
        funnel: [],
        trendLine: [],
        kpi: {
          totalDeals: 163,
          totalPipeline: 105569765920,
          winRate: 0.0552,
        },
      }),
    };

    service = new DashboardService(
      {} as any,
      {} as any,
      {} as any,
      {} as any,
      mockAnalyticsService as any,
      mockDataSource as any,
    );
  });

  const setupMocks = (overrides?: {
    contractAwardedResult?: any[];
    underExecutionResult?: any[];
    overdueProjectsResult?: any[];
    openRisksResult?: any[];
    overdueIssuesResult?: any[];
    pendingDirectorDecisionsResult?: any[];
    projectSnapshotResult?: any[];
  }) => {
    mockDataSource.query.mockImplementation(async (sql: string) => {
      if (sql.includes('contractAwardedValue')) {
        return (
          overrides?.contractAwardedResult || [
            { contractAwardedCount: 9, contractAwardedValue: 101578875322 },
          ]
        );
      }
      if (sql.includes('underExecutionValue')) {
        return (
          overrides?.underExecutionResult || [
            { underExecutionProjectsCount: 4, underExecutionValue: 100668052501 },
          ]
        );
      }
      if (sql.includes('overdueProjects')) {
        return overrides?.overdueProjectsResult || [{ overdueProjects: 0 }];
      }
      if (sql.includes('openHighCriticalRisks')) {
        return overrides?.openRisksResult || [{ openHighCriticalRisks: 0 }];
      }
      if (sql.includes('overdueProjectIssues')) {
        return overrides?.overdueIssuesResult || [{ overdueProjectIssues: 0 }];
      }
      if (sql.includes('pendingDirectorDecisions')) {
        return overrides?.pendingDirectorDecisionsResult || [{ pendingDirectorDecisions: 0 }];
      }
      if (sql.includes('totalProjects') && sql.includes('activeProjects')) {
        return (
          overrides?.projectSnapshotResult || [
            {
              totalProjects: 9,
              activeProjects: 4,
              planningProjects: 0,
              inProgressProjects: 4,
              completedProjects: 5,
              onHoldProjects: 0,
              cancelledProjects: 0,
              assignedProjectManagers: 4,
              unassignedProjectManagers: 0,
            },
          ]
        );
      }
      if (sql.includes('openPipelineValue')) {
        return [{ openDealsCount: 154, openPipelineValue: 3990890598 }];
      }
      if (sql.includes('status = \'WON\'')) {
        return [{ count: 9, wonValue: 101578875322, lostCount: 0 }];
      }
      if (sql.includes('readyForKickoff')) {
        return [{ readyForKickoff: 0 }];
      }
      if (sql.includes('preKickoffContracts')) {
        return [{ preKickoffContracts: 55 }];
      }
      if (sql.includes('outstandingLiabilityBalance')) {
        return [{ outstandingInvoiceCount: 0, outstandingLiabilityBalance: 0 }];
      }
      if (sql.includes('poCommittedValue')) {
        return [
          {
            poCount: 12,
            poCommittedValue: 807953707,
            completedPoCount: 7,
            materialPoCount: 7,
            completedMaterialPoCount: 7,
            servicePoCount: 5,
          },
        ];
      }
      if (sql.includes('goodsReceiptValue')) {
        return [{ goodsReceiptCount: 7, goodsReceiptValue: 757150495 }];
      }
      if (sql.includes('fulfilledServicePoCount')) {
        return [
          {
            servicePoCount: 5,
            fulfilledServicePoCount: 5,
            serviceFulfilledValue: 50803212,
          },
        ];
      }
      if (sql.includes('verifiedInvoiceValue')) {
        return [
          {
            invoiceCount: 10,
            invoiceTotal: 560782457,
            verifiedInvoiceCount: 10,
            verifiedInvoiceValue: 560782457,
            paidInvoiceCount: 10,
            paidInvoiceValue: 560782457,
          },
        ];
      }
      if (sql.includes('paymentValue')) {
        return [{ paymentCount: 10, paymentValue: 560782457 }];
      }
      if (sql.includes('totalPendingTasks')) {
        return [{ totalPendingTasks: 2 }];
      }
      if (sql.includes('GROUP BY task_key')) {
        return [];
      }
      if (sql.includes('SELECT \n         wt.id,')) {
        return [];
      }
      if (sql.includes('pendingLegalReview')) {
        return [
          {
            pendingLegalReview: 0,
            revisionExpired: 0,
            activeContracts: 9,
            revisionNeeded: 0,
            totalContracts: 9,
          },
        ];
      }
      return [{}];
    });
  };

  it('1. should return contractAwardedValue from contracts and underExecutionValue from active projects', async () => {
    setupMocks();

    const result = await service.getExecutiveSummary({
      period: DashboardPeriod.YEAR_TO_DATE,
    });

    expect(result.currentSnapshot.contracts?.contractAwardedValue).toBe(101578875322);
    expect(result.currentSnapshot.contracts?.contractAwardedCount).toBe(9);
    expect(result.currentSnapshot.projects?.underExecutionValue).toBe(100668052501);
    expect(result.currentSnapshot.projects?.underExecutionProjectsCount).toBe(4);
  });

  it('2. should generate deterministic attention items when exceptions exist', async () => {
    setupMocks({
      overdueProjectsResult: [{ overdueProjects: 2 }],
      openRisksResult: [{ openHighCriticalRisks: 1 }],
      overdueIssuesResult: [{ overdueProjectIssues: 3 }],
      pendingDirectorDecisionsResult: [{ pendingDirectorDecisions: 1 }],
    });

    const result = await service.getExecutiveSummary({
      period: DashboardPeriod.YEAR_TO_DATE,
    });

    const items = result.currentSnapshot.executiveBrief?.attentionItems || [];
    expect(items.length).toBeLessThanOrEqual(3);
    expect(items[0]).toBe('2 proyek melewati tanggal selesai.');
    expect(items[1]).toBe('1 risiko proyek berkategori High/Critical terbuka.');
    expect(items[2]).toBe('3 isu proyek melewati batas waktu penyelesaian.');
  });

  it('3. should generate factual reassuring statements when no exceptions exist', async () => {
    setupMocks({
      overdueProjectsResult: [{ overdueProjects: 0 }],
      openRisksResult: [{ openHighCriticalRisks: 0 }],
      overdueIssuesResult: [{ overdueProjectIssues: 0 }],
      pendingDirectorDecisionsResult: [{ pendingDirectorDecisions: 0 }],
      projectSnapshotResult: [
        {
          totalProjects: 9,
          activeProjects: 4,
          planningProjects: 0,
          inProgressProjects: 4,
          completedProjects: 5,
          onHoldProjects: 0,
          cancelledProjects: 0,
          assignedProjectManagers: 4,
          unassignedProjectManagers: 0,
        },
      ],
    });

    const result = await service.getExecutiveSummary({
      period: DashboardPeriod.YEAR_TO_DATE,
    });

    const items = result.currentSnapshot.executiveBrief?.attentionItems || [];
    expect(items.length).toBeGreaterThan(0);
    expect(items).toContain('Tidak ada keputusan Direktur yang tertunda.');
    expect(items).toContain('Semua proyek aktif berjalan sesuai jadwal.');
  });

  it('4. should disable mock behavior in getProjectTrend and return empty array', async () => {
    const trend = await service.getProjectTrend();
    expect(trend).toEqual([]);
  });

  it('5. proves WON tender value MUST NOT contribute to Open Pipeline Value and Open Pipeline != Total Tender Portfolio Value', async () => {
    // Total tender portfolio: 163 deals, value 105,569,765,920
    // WON deals: 9 deals, value 101,578,875,322
    // Open pipeline: 154 deals, value 3,990,890,598
    setupMocks();

    const result = await service.getExecutiveSummary({
      period: DashboardPeriod.YEAR_TO_DATE,
    });

    const openPipelineVal = result.currentSnapshot.marketing.openPipelineValue;
    const openDealsCount = result.currentSnapshot.marketing.openDealsCount;
    const totalPipelineVal = result.periodMetrics.marketing.totalPipeline;
    const wonVal = result.periodMetrics.marketing.wonValue;

    // 1. Open Pipeline Value must equal total portfolio minus WON value (3,990,890,598)
    expect(openPipelineVal).toBe(3990890598);
    expect(openDealsCount).toBe(154);
    expect(wonVal).toBe(101578875322);

    // 2. Proves WON tender value does not contribute to Open Pipeline
    expect(openPipelineVal).not.toBe(totalPipelineVal);
    expect(openPipelineVal + wonVal).toBe(totalPipelineVal);
    expect(openPipelineVal).toBeLessThan(totalPipelineVal);
  });

  it('6. validates AP fulfillment monetary semantics (Material + Service = Total Fulfilled = PO Committed)', async () => {
    setupMocks();

    const result = await service.getExecutiveSummary({
      period: DashboardPeriod.YEAR_TO_DATE,
    });

    const proc = result.periodMetrics.procurement;
    expect(proc.poCommittedValue).toBe(807953707);
    expect(proc.goodsReceiptValue).toBe(757150495);
    expect(proc.serviceFulfilledValue).toBe(50803212);
    expect(proc.totalFulfilledValue).toBe(807953707);
    expect(proc.totalFulfilledValue).toBe(proc.poCommittedValue);

    // Vendor invoices & payments remain strictly unchanged
    expect(result.periodMetrics.accountsPayable.verifiedInvoiceValue).toBe(560782457);
    expect(result.periodMetrics.vendorPayments.paymentValue).toBe(560782457);
    expect(result.currentSnapshot.accountsPayable.outstandingLiabilityBalance).toBe(0);
  });
});


