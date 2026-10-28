import { DashboardService } from '../dashboard.service';
import { GetExecutiveSummaryDto } from '../dto/get-executive-summary.dto';
import { DashboardPeriod } from '../../analytics/dto/get-analytics.dto';

describe('Phase 5B-BE01: Backend Data Contract Remediation (BLK-01 to BLK-04)', () => {
  let service: DashboardService;
  let mockDataSource: { query: jest.Mock };
  let mockAnalyticsService: { calculateDateRange: jest.Mock; getDashboardAnalytics: jest.Mock };
  let mockProjectRepo: any;
  let mockPaymentRepo: any;
  let mockPoRepo: any;
  let mockPrRepo: any;

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
          winRate: 0.0552, // 9 / 163 (legacy total deals formula)
        },
      }),
    };

    mockProjectRepo = {};
    mockPaymentRepo = {};
    mockPoRepo = {};
    mockPrRepo = {};

    service = new DashboardService(
      mockProjectRepo,
      mockPaymentRepo,
      mockPoRepo,
      mockPrRepo,
      mockAnalyticsService as any,
      mockDataSource as any,
    );
  });

  const setupDefaultMocks = (overrides?: {
    wonResult?: any[];
    openPipelineResult?: any[];
    poResult?: any[];
    serviceFulfillmentResult?: any[];
    apOutstandingResult?: any[];
  }) => {
    mockDataSource.query.mockImplementation(async (sql: string) => {
      // 1. Tenders - wonDeals and wonValue
      if (sql.includes('status = \'WON\'') && sql.includes('wonValue')) {
        return overrides?.wonResult || [
          { count: '9', wonValue: '101578875322.00', lostCount: '0' },
        ];
      }
      // 2. Tenders - openPipeline
      if (sql.includes('openDealsCount') && sql.includes('openPipelineValue')) {
        return overrides?.openPipelineResult || [
          { openDealsCount: '154', openPipelineValue: '3990890598.00' },
        ];
      }
      // 3. Projects snapshot
      if (sql.includes('FROM projects') && sql.includes('totalProjects')) {
        return [
          {
            totalProjects: '9',
            planningProjects: '5',
            inProgressProjects: '4',
            activeProjects: '4',
            completedProjects: '0',
            onHoldProjects: '0',
            cancelledProjects: '0',
            assignedProjectManagers: '9',
            unassignedProjectManagers: '0',
          },
        ];
      }
      if (sql.includes('readyForKickoff')) {
        return [{ readyForKickoff: '2' }];
      }
      if (sql.includes('preKickoffContracts')) {
        return [{ preKickoffContracts: '5' }];
      }
      // 4. Invoices
      if (sql.includes('FROM invoices') && sql.includes('invoiceTotal')) {
        return [
          {
            invoiceCount: '10',
            invoiceTotal: '556677401.00',
            verifiedInvoiceCount: '10',
            verifiedInvoiceValue: '556677401.00',
            paidInvoiceCount: '10',
            paidInvoiceValue: '556677401.00',
          },
        ];
      }
      // 5. AP Outstanding Liability (BLK-04)
      if (sql.includes('outstandingLiabilityBalance')) {
        return overrides?.apOutstandingResult || [
          { outstandingInvoiceCount: '0', outstandingLiabilityBalance: '0.00' },
        ];
      }
      // 6. Payments
      if (sql.includes('FROM payments')) {
        return [{ paymentCount: '10', paymentValue: '556677401.00' }];
      }
      // 7. Purchase Requests
      if (sql.includes('FROM purchase_requests')) {
        return [{ prCount: '12', pendingPrCount: '0', approvedPrCount: '12', poIssuedPrCount: '12' }];
      }
      // 8. Purchase Orders (BLK-03)
      if (sql.includes('FROM purchase_orders') && sql.includes('materialPoCount')) {
        return overrides?.poResult || [
          {
            poCount: '12',
            poCommittedValue: '587786401.00',
            completedPoCount: '7',
            materialPoCount: '7',
            completedMaterialPoCount: '7',
            servicePoCount: '5',
          },
        ];
      }
      // 9. Service Claim Fulfillment (BLK-03)
      if (sql.includes('fulfilledServicePoCount')) {
        return overrides?.serviceFulfillmentResult || [
          { servicePoCount: '5', fulfilledServicePoCount: '5' },
        ];
      }
      // 10. Goods Receipts
      if (sql.includes('FROM goods_receipts')) {
        return [{ goodsReceiptCount: '7', goodsReceiptValue: '534898745.00' }];
      }
      // 11. Workflow tasks
      if (sql.includes('FROM workflow_tasks') && sql.includes('totalPendingTasks')) {
        return [{ totalPendingTasks: '0' }];
      }
      if (sql.includes('FROM workflow_tasks') && sql.includes('task_key as taskKey')) {
        return [];
      }
      if (sql.includes('FROM workflow_tasks wt')) {
        return [];
      }
      // 12. Legal contracts
      if (sql.includes('FROM contracts')) {
        return [
          {
            totalContracts: '9',
            pendingLegalReview: '0',
            revisionExpired: '0',
            activeContracts: '9',
            revisionNeeded: '0',
          },
        ];
      }
      return [];
    });
  };

  describe('BE01-CP1 — BLK-01 Won Bookings Monetary Value', () => {
    it('should expose wonValue and wonDeals from canonical period tender aggregation', async () => {
      setupDefaultMocks({
        wonResult: [{ count: '9', wonValue: '101578875322.00', lostCount: '0' }],
      });

      const queryDto: GetExecutiveSummaryDto = { period: DashboardPeriod.YEAR_TO_DATE };
      const result = await service.getExecutiveSummary(queryDto, 1, ['DIRECTOR']);

      expect(result.periodMetrics.marketing.wonValue).toBe(101578875322);
      expect(result.periodMetrics.marketing.wonDeals).toBe(9);
      // Decided Win Rate: 9 / (9 + 0) = 100%
      expect(result.periodMetrics.marketing.winRate).toBe(100);
    });

    it('should calculate decided Win Rate correctly when LOST deals exist', async () => {
      setupDefaultMocks({
        wonResult: [{ count: '8', wonValue: '80000000000.00', lostCount: '2' }],
      });

      const queryDto: GetExecutiveSummaryDto = { period: DashboardPeriod.YEAR_TO_DATE };
      const result = await service.getExecutiveSummary(queryDto, 1, ['DIRECTOR']);

      expect(result.periodMetrics.marketing.wonDeals).toBe(8);
      expect(result.periodMetrics.marketing.wonValue).toBe(80000000000);
      // Decided Win Rate: 8 / (8 + 2) = 80.00%
      expect(result.periodMetrics.marketing.winRate).toBe(80);
    });

    it('should return null for winRate if denominator (WON + LOST) is zero', async () => {
      mockAnalyticsService.getDashboardAnalytics.mockResolvedValueOnce({
        funnel: [],
        trendLine: [],
        kpi: { totalDeals: 0, totalPipeline: 0, winRate: null },
      });

      setupDefaultMocks({
        wonResult: [{ count: '0', wonValue: '0', lostCount: '0' }],
      });

      const queryDto: GetExecutiveSummaryDto = { period: DashboardPeriod.YEAR_TO_DATE };
      const result = await service.getExecutiveSummary(queryDto, 1, ['DIRECTOR']);

      expect(result.periodMetrics.marketing.wonValue).toBe(0);
      expect(result.periodMetrics.marketing.wonDeals).toBe(0);
      expect(result.periodMetrics.marketing.winRate).toBeNull();
    });
  });

  describe('BE01-CP2 — BLK-02 Open Commercial Pipeline Count & Value', () => {
    it('should expose current active opportunities count and monetary value in currentSnapshot', async () => {
      setupDefaultMocks({
        openPipelineResult: [{ openDealsCount: '154', openPipelineValue: '3990890598.00' }],
      });

      const queryDto: GetExecutiveSummaryDto = { period: DashboardPeriod.YEAR_TO_DATE };
      const result = await service.getExecutiveSummary(queryDto, 1, ['DIRECTOR']);

      expect(result.currentSnapshot.marketing.openDealsCount).toBe(154);
      expect(result.currentSnapshot.marketing.openPipelineValue).toBe(3990890598);
    });

    it('should verify SQL excludes terminal statuses WON, LOST, CANCELLED and deleted records', async () => {
      let executedSql = '';
      setupDefaultMocks();
      const originalQuery = mockDataSource.query.getMockImplementation();
      mockDataSource.query.mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('openDealsCount')) {
          executedSql = sql;
        }
        return originalQuery ? originalQuery(sql, params) : [];
      });

      await service.getExecutiveSummary({ period: DashboardPeriod.YEAR_TO_DATE }, 1, ['DIRECTOR']);

      // Assert canonical SQL query constraints
      expect(executedSql).toContain("status NOT IN ('WON', 'LOST', 'CANCELLED')");
      expect(executedSql).toContain('deleted_at IS NULL');
      expect(executedSql).toContain('COALESCE(negotiated_price, estimated_budget)');
    });
  });

  describe('BE01-CP3 — BLK-03 Procurement Fulfillment Dual Contract', () => {
    it('should expose independent Material and Service fulfillment rates without invented weighting', async () => {
      setupDefaultMocks({
        poResult: [
          {
            poCount: '12',
            poCommittedValue: '587786401.00',
            completedPoCount: '7',
            materialPoCount: '7',
            completedMaterialPoCount: '7',
            servicePoCount: '5',
          },
        ],
        serviceFulfillmentResult: [
          { servicePoCount: '5', fulfilledServicePoCount: '5' },
        ],
      });

      const queryDto: GetExecutiveSummaryDto = { period: DashboardPeriod.YEAR_TO_DATE };
      const result = await service.getExecutiveSummary(queryDto, 1, ['DIRECTOR']);

      const procurement = result.periodMetrics.procurement;
      expect(procurement.materialFulfillmentRate).toBe(100);
      expect(procurement.materialPoCount).toBe(7);
      expect(procurement.completedMaterialPoCount).toBe(7);

      expect(procurement.serviceFulfillmentRate).toBe(100);
      expect(procurement.servicePoCount).toBe(5);
      expect(procurement.fulfilledServicePoCount).toBe(5);

      // Backwards compatibility alias matches material fulfillment
      expect(procurement.poToGrCompletionRate).toBe(100);
    });

    it('should return null (not fake 0%) when service denominator is zero', async () => {
      setupDefaultMocks({
        poResult: [
          {
            poCount: '7',
            poCommittedValue: '500000000.00',
            completedPoCount: '5',
            materialPoCount: '7',
            completedMaterialPoCount: '5',
            servicePoCount: '0',
          },
        ],
        serviceFulfillmentResult: [
          { servicePoCount: '0', fulfilledServicePoCount: '0' },
        ],
      });

      const queryDto: GetExecutiveSummaryDto = { period: DashboardPeriod.YEAR_TO_DATE };
      const result = await service.getExecutiveSummary(queryDto, 1, ['DIRECTOR']);

      const procurement = result.periodMetrics.procurement;
      expect(procurement.materialFulfillmentRate).toBe(71.43);
      // Crucial: serviceFulfillmentRate MUST be null, not 0
      expect(procurement.serviceFulfillmentRate).toBeNull();
      expect(procurement.servicePoCount).toBe(0);
    });

    it('should return null when material denominator is zero', async () => {
      setupDefaultMocks({
        poResult: [
          {
            poCount: '0',
            poCommittedValue: '0',
            completedPoCount: '0',
            materialPoCount: '0',
            completedMaterialPoCount: '0',
            servicePoCount: '0',
          },
        ],
        serviceFulfillmentResult: [
          { servicePoCount: '0', fulfilledServicePoCount: '0' },
        ],
      });

      const queryDto: GetExecutiveSummaryDto = { period: DashboardPeriod.YEAR_TO_DATE };
      const result = await service.getExecutiveSummary(queryDto, 1, ['DIRECTOR']);

      const procurement = result.periodMetrics.procurement;
      expect(procurement.materialFulfillmentRate).toBeNull();
      expect(procurement.serviceFulfillmentRate).toBeNull();
    });
  });

  describe('BE01-CP4 — BLK-04 Outstanding AP Net Liability Contract', () => {
    it('should render real zero balance and zero count when all verified invoices are settled', async () => {
      setupDefaultMocks({
        apOutstandingResult: [
          { outstandingInvoiceCount: '0', outstandingLiabilityBalance: '0.00' },
        ],
      });

      const queryDto: GetExecutiveSummaryDto = { period: DashboardPeriod.YEAR_TO_DATE };
      const result = await service.getExecutiveSummary(queryDto, 1, ['DIRECTOR']);

      const ap = result.currentSnapshot.accountsPayable;
      expect(ap.outstandingInvoiceCount).toBe(0);
      expect(ap.outstandingLiabilityBalance).toBe(0);
      expect(ap.outstandingInvoiceValue).toBe(0); // Compatibility alias
    });

    it('should safely expose remaining liability when partially settled invoices exist', async () => {
      setupDefaultMocks({
        apOutstandingResult: [
          { outstandingInvoiceCount: '2', outstandingLiabilityBalance: '45000000.50' },
        ],
      });

      const queryDto: GetExecutiveSummaryDto = { period: DashboardPeriod.YEAR_TO_DATE };
      const result = await service.getExecutiveSummary(queryDto, 1, ['DIRECTOR']);

      const ap = result.currentSnapshot.accountsPayable;
      expect(ap.outstandingInvoiceCount).toBe(2);
      expect(ap.outstandingLiabilityBalance).toBe(45000000.5);
      expect(ap.outstandingInvoiceValue).toBe(45000000.5);
    });

    it('should verify subquery SQL protects against multiple-payment duplication', async () => {
      let executedApSql = '';
      setupDefaultMocks();
      const originalQuery = mockDataSource.query.getMockImplementation();
      mockDataSource.query.mockImplementation(async (sql: string, params?: any[]) => {
        if (sql.includes('outstandingLiabilityBalance')) {
          executedApSql = sql;
        }
        return originalQuery ? originalQuery(sql, params) : [];
      });

      await service.getExecutiveSummary({ period: DashboardPeriod.YEAR_TO_DATE }, 1, ['DIRECTOR']);

      // Verify subquery GROUP BY invoice_id prevents cartesian product multiplication
      expect(executedApSql).toContain('GROUP BY invoice_id');
      expect(executedApSql).toContain('GREATEST(0, i.total_amount - COALESCE(p.total_paid, 0))');
      expect(executedApSql).toContain("i.match_status = 'VERIFIED'");
    });
  });
});
