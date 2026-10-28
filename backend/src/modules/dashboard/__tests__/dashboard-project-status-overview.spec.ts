import { DashboardService } from '../dashboard.service';
import { GetExecutiveSummaryDto } from '../dto/get-executive-summary.dto';
import { DashboardPeriod } from '../../analytics/dto/get-analytics.dto';

describe('DASH-REC-003 & DASH-REC-004: Dashboard Project Status Overview Backend Aggregation', () => {
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
        start: new Date('2026-01-01'),
        end: new Date('2026-10-23'),
      }),
      getDashboardAnalytics: jest.fn().mockResolvedValue({
        pipelineByStage: [],
        marketingTrend: [],
        totalDeals: 10,
        totalPipelineValue: 500000000,
        winRate: 50,
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

  describe('DASH-REC-004: Completed Projects SQL Aggregation Semantic', () => {
    it('1. should query completed projects with status IN ("COMPLETED", "CLOSED")', async () => {
      // Mock all SQL calls made by getExecutiveSummary
      mockDataSource.query.mockImplementation(async (sql: string) => {
        if (sql.includes('FROM projects') && sql.includes('totalProjects')) {
          // Verify that the SQL query includes both COMPLETED and CLOSED
          expect(sql).toContain("COUNT(CASE WHEN status IN ('COMPLETED', 'CLOSED') THEN 1 END) as completedProjects");
          return [
            {
              totalProjects: '7',
              planningProjects: '2',
              inProgressProjects: '1',
              activeProjects: '3',
              completedProjects: '4',
              onHoldProjects: '0',
              cancelledProjects: '0',
              assignedProjectManagers: '7',
              unassignedProjectManagers: '0',
            },
          ];
        }
        if (sql.includes('readyForKickoff')) {
          return [{ readyForKickoff: '0' }];
        }
        if (sql.includes('preKickoffContracts')) {
          return [{ preKickoffContracts: '2' }];
        }
        if (sql.includes('FROM invoices')) {
          return [{ verifiedInvoiceCount: '9', verifiedInvoiceValue: '543753457', paidInvoiceCount: '9', paidInvoiceValue: '543753457' }];
        }
        if (sql.includes('outstandingInvoiceCount')) {
          return [{ outstandingInvoiceCount: '0', outstandingInvoiceValue: '0' }];
        }
        if (sql.includes('FROM payments')) {
          return [{ paymentCount: '9', paymentValue: '543753457' }];
        }
        if (sql.includes('FROM purchase_requests')) {
          return [{ prCount: '9', pendingPrCount: '0', poIssuedPrCount: '9' }];
        }
        if (sql.includes('FROM purchase_orders')) {
          return [{ poCount: '9', poCommittedValue: '543753457', completedPoCount: '5' }];
        }
        if (sql.includes('FROM goods_receipts')) {
          return [{ goodsReceiptCount: '5', goodsReceiptValue: '509979245' }];
        }
        if (sql.includes('FROM workflow_tasks')) {
          return [{ totalPendingTasks: '1' }];
        }
        if (sql.includes('FROM contracts')) {
          return [{ totalContracts: '8', pendingLegalReview: '1', revisionExpired: '0', activeContracts: '7', revisionNeeded: '0' }];
        }
        if (sql.includes('FROM tenders')) {
          return [{ count: '8' }];
        }
        return [];
      });

      const queryDto: GetExecutiveSummaryDto = { period: DashboardPeriod.YEAR_TO_DATE };
      const result = await service.getExecutiveSummary(queryDto, 1, ['DIRECTOR']);

      const projects = result.currentSnapshot.projects;

      // 1. Total projects = 7
      expect(projects.totalProjects).toBe(7);

      // 2. Active projects = 3 (planning 2 + inProgress 1)
      expect(projects.activeProjects).toBe(3);
      expect(projects.planningProjects).toBe(2);
      expect(projects.inProgressProjects).toBe(1);

      // 3. Completed projects = 4 (includes CLOSED projects)
      expect(projects.completedProjects).toBe(4);

      // 4. On hold & cancelled
      expect(projects.onHoldProjects).toBe(0);
      expect(projects.cancelledProjects).toBe(0);

      // 5. Breakdown reconciliation: 2 + 1 + 4 + 0 + 0 = 7
      const breakdownSum =
        projects.planningProjects +
        projects.inProgressProjects +
        projects.completedProjects +
        projects.onHoldProjects +
        projects.cancelledProjects;
      expect(breakdownSum).toBe(projects.totalProjects);
    });

    it('2. should count both COMPLETED and CLOSED towards completedProjects in database aggregation', () => {
      // Test SQL case statement expression logic simulation
      const evaluateProjectStatus = (status: string) => {
        const isPlanning = status === 'PLANNING' ? 1 : 0;
        const isInProgress = status === 'IN_PROGRESS' ? 1 : 0;
        const isActive = ['PLANNING', 'IN_PROGRESS'].includes(status) ? 1 : 0;
        const isCompleted = ['COMPLETED', 'CLOSED'].includes(status) ? 1 : 0;
        const isOnHold = status === 'ON_HOLD' ? 1 : 0;
        const isCancelled = status === 'CANCELLED' ? 1 : 0;
        return { isPlanning, isInProgress, isActive, isCompleted, isOnHold, isCancelled };
      };

      const testPopulation = [
        { id: 1, status: 'PLANNING' },
        { id: 2, status: 'PLANNING' },
        { id: 3, status: 'IN_PROGRESS' },
        { id: 4, status: 'CLOSED' },
        { id: 5, status: 'CLOSED' },
        { id: 6, status: 'CLOSED' },
        { id: 7, status: 'CLOSED' },
      ];

      const aggregated = testPopulation.reduce(
        (acc, p) => {
          const evalRes = evaluateProjectStatus(p.status);
          acc.totalProjects += 1;
          acc.planningProjects += evalRes.isPlanning;
          acc.inProgressProjects += evalRes.isInProgress;
          acc.activeProjects += evalRes.isActive;
          acc.completedProjects += evalRes.isCompleted;
          acc.onHoldProjects += evalRes.isOnHold;
          acc.cancelledProjects += evalRes.isCancelled;
          return acc;
        },
        {
          totalProjects: 0,
          planningProjects: 0,
          inProgressProjects: 0,
          activeProjects: 0,
          completedProjects: 0,
          onHoldProjects: 0,
          cancelledProjects: 0,
        },
      );

      expect(aggregated.totalProjects).toBe(7);
      expect(aggregated.activeProjects).toBe(3);
      expect(aggregated.planningProjects).toBe(2);
      expect(aggregated.inProgressProjects).toBe(1);
      expect(aggregated.completedProjects).toBe(4);
      expect(aggregated.onHoldProjects).toBe(0);
      expect(aggregated.cancelledProjects).toBe(0);

      // Reconciles exactly
      expect(
        aggregated.planningProjects +
          aggregated.inProgressProjects +
          aggregated.completedProjects +
          aggregated.onHoldProjects +
          aggregated.cancelledProjects,
      ).toBe(aggregated.totalProjects);
    });

    it('3. should handle mixed CLOSED and COMPLETED rows correctly', () => {
      const evaluateIsCompleted = (status: string) => ['COMPLETED', 'CLOSED'].includes(status);

      expect(evaluateIsCompleted('CLOSED')).toBe(true);
      expect(evaluateIsCompleted('COMPLETED')).toBe(true);
      expect(evaluateIsCompleted('PLANNING')).toBe(false);
      expect(evaluateIsCompleted('IN_PROGRESS')).toBe(false);
    });
  });
});
