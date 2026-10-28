import { BadRequestException } from '@nestjs/common';
import { DashboardService } from '../dashboard.service';
import { DashboardController } from '../dashboard.controller';
import { GetExecutiveSummaryDto } from '../dto/get-executive-summary.dto';
import { DashboardPeriod } from '../../analytics/dto/get-analytics.dto';

describe('CP1: Division Filter & Data Scope Integrity Contract', () => {
  let service: DashboardService;
  let controller: DashboardController;
  let mockDataSource: { query: jest.Mock };
  let mockAnalyticsService: { calculateDateRange: jest.Mock; getDashboardAnalytics: jest.Mock };

  beforeEach(() => {
    mockDataSource = {
      query: jest.fn().mockImplementation(async (sql: string) => {
        if (sql.includes('status = \'WON\'')) {
          return [{ count: '9', wonValue: '101578875322.00', lostCount: '0' }];
        }
        if (sql.includes('status NOT IN (\'WON\', \'LOST\', \'CANCELLED\')')) {
          return [{ openDealsCount: '154', openPipelineValue: '3990890598.00' }];
        }
        if (sql.includes('totalProjects')) {
          return [{
            totalProjects: '9',
            planningProjects: '0',
            inProgressProjects: '4',
            activeProjects: '4',
            completedProjects: '5',
            onHoldProjects: '0',
            cancelledProjects: '0',
            assignedProjectManagers: '4',
            unassignedProjectManagers: '0',
          }];
        }
        if (sql.includes('readyForKickoff')) return [{ readyForKickoff: '0' }];
        if (sql.includes('preKickoffContracts')) return [{ preKickoffContracts: '0' }];
        if (sql.includes('contractAwardedCount')) return [{ contractAwardedCount: '9', contractAwardedValue: '101578875322.00' }];
        if (sql.includes('underExecutionProjectsCount')) return [{ underExecutionProjectsCount: '4', underExecutionValue: '430762082.00' }];
        if (sql.includes('overdueProjects')) return [{ overdueProjects: '0' }];
        if (sql.includes('openHighCriticalRisks')) return [{ openHighCriticalRisks: '0' }];
        if (sql.includes('overdueProjectIssues')) return [{ overdueProjectIssues: '0' }];
        if (sql.includes('pendingDirectorDecisions')) return [{ pendingDirectorDecisions: '0' }];
        if (sql.includes('FROM invoices')) {
          return [{
            invoiceCount: '10',
            invoiceTotal: '560782457.00',
            verifiedInvoiceCount: '10',
            verifiedInvoiceValue: '560782457.00',
            paidInvoiceCount: '10',
            paidInvoiceValue: '560782457.00',
          }];
        }
        if (sql.includes('outstandingInvoiceCount')) {
          return [{ outstandingInvoiceCount: '0', outstandingLiabilityBalance: '0' }];
        }
        if (sql.includes('FROM payments')) return [{ paymentCount: '10', paymentValue: '560782457.00' }];
        if (sql.includes('FROM purchase_requests')) return [{ prCount: '12', pendingPrCount: '0', approvedPrCount: '12', poIssuedPrCount: '12' }];
        if (sql.includes('FROM purchase_orders')) return [{ poCount: '12', poCommittedValue: '807953707.00', completedPoCount: '12', materialPoCount: '6', completedMaterialPoCount: '6', servicePoCount: '6' }];
        if (sql.includes('service_pos')) return [{ servicePoCount: '6', fulfilledServicePoCount: '6', serviceFulfilledValue: '4152000.00' }];
        if (sql.includes('FROM goods_receipts')) return [{ goodsReceiptCount: '6', goodsReceiptValue: '803801707.00' }];
        if (sql.includes('totalPendingTasks')) return [{ totalPendingTasks: '0' }];
        if (sql.includes('task_key as taskKey')) return [];
        if (sql.includes('assignee_role_id')) return [];
        if (sql.includes('FROM contracts')) return [{ pendingLegalReview: '0', revisionExpired: '0', activeContracts: '9', revisionNeeded: '0', totalContracts: '9' }];
        if (sql.includes('users WHERE email')) return [{ id: 9, full_name: 'Dwi Ragil Pribadi', email: 'ragil@epms.com', is_active: 1 }];
        return [];
      }),
    };

    mockAnalyticsService = {
      calculateDateRange: jest.fn().mockReturnValue({
        start: new Date('2026-01-01T00:00:00.000Z'),
        end: new Date('2026-10-26T23:59:59.999Z'),
      }),
      getDashboardAnalytics: jest.fn().mockResolvedValue({
        funnel: [],
        trendLine: [],
        kpi: {
          totalDeals: 163,
          totalPipeline: 105569765920,
          winRate: 1.0,
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

    controller = new DashboardController(service);
  });

  describe('CP1-A: Authoritative Division Mapping & Discovery', () => {
    it('should return available divisions with ALL DIVISIONS and explicit governance status', async () => {
      const result = await service.getAuthorizedDivisions(['DIRECTOR']);

      expect(result).toBeDefined();
      expect(result.availableDivisions).toHaveLength(3);
      expect(result.availableDivisions[0]).toEqual({
        id: 'ALL',
        name: 'Semua Divisi',
        code: 'ALL',
        isDefault: true,
        scope: 'INSTALLATION',
      });
      expect(result.subDivisionEnabled).toBe(false);
      expect(result.governanceStatus).toBe('DIVISION ALLOCATION RULE NOT VERIFIED');
      expect(result.message).toContain('INSTALLATION');
    });

    it('should expose /dashboard/divisions endpoint via controller', async () => {
      const req = { user: { roles: ['DIRECTOR'] } };
      const res = await controller.getDivisions(req);

      expect(res.statusCode).toBe(200);
      expect(res.data.availableDivisions[0].id).toBe('ALL');
      expect(res.data.governanceStatus).toBe('DIVISION ALLOCATION RULE NOT VERIFIED');
    });
  });

  describe('CP1-B: Division Filter Contract Validation', () => {
    it('should accept and validate undefined divisionId as installation-wide ALL', async () => {
      const valid = await service.validateDivision(undefined, ['DIRECTOR']);
      expect(valid.id).toBe('ALL');
      expect(valid.scope).toBe('INSTALLATION');
    });

    it('should accept and validate explicit "ALL" as installation-wide ALL', async () => {
      const valid = await service.validateDivision('ALL', ['DIRECTOR']);
      expect(valid.id).toBe('ALL');
      expect(valid.scope).toBe('INSTALLATION');
    });

    it('should throw BadRequestException and never silently fallback on unknown division ID', async () => {
      await expect(service.validateDivision('UBD_DIV_1', ['DIRECTOR'])).rejects.toThrow(BadRequestException);
      await expect(service.validateDivision('TVM_DIV_2', ['DIRECTOR'])).rejects.toThrow(BadRequestException);
      await expect(service.validateDivision('99999', ['DIRECTOR'])).rejects.toThrow(BadRequestException);
    });

    it('should enforce division validation at controller level before executing queries', async () => {
      const req = { user: { userId: 4, roles: ['DIRECTOR'] } };
      const invalidQuery: GetExecutiveSummaryDto = {
        period: DashboardPeriod.YEAR_TO_DATE,
        divisionId: 'NON_EXISTENT_DIVISION',
      };

      await expect(controller.getExecutiveSummary(invalidQuery, req)).rejects.toThrow(BadRequestException);
      // Ensure dataSource query was NOT invoked due to fail-fast validation
      expect(mockDataSource.query).not.toHaveBeenCalled();
    });
  });

  describe('CP1-C: Executive Summary Metadata Lineage', () => {
    it('should include division scope and allocationStatus in response meta', async () => {
      const query: GetExecutiveSummaryDto = {
        period: DashboardPeriod.YEAR_TO_DATE,
        divisionId: 'ALL',
      };

      const result = await service.getExecutiveSummary(query, 4, ['DIRECTOR']);

      expect(result.meta).toBeDefined();
      expect((result.meta as any).division).toEqual({
        id: 'ALL',
        name: 'Semua Divisi',
        code: 'ALL',
        scope: 'INSTALLATION',
        allocationStatus: 'DIVISION ALLOCATION RULE NOT VERIFIED',
      });
      expect(result.periodMetrics.marketing.totalPipeline).toBe(105569765920);
      expect(result.currentSnapshot.projects.totalProjects).toBe(9);
    });

    it('CP4-R1: should support ALL_TIME period without throwing validation error', async () => {
      const query: GetExecutiveSummaryDto = {
        period: DashboardPeriod.ALL_TIME,
        divisionId: 'ALL',
      };

      const result = await service.getExecutiveSummary(query, 4, ['DIRECTOR']);
      expect(result.meta.period.type).toBe(DashboardPeriod.ALL_TIME);
      expect(mockAnalyticsService.calculateDateRange).toHaveBeenCalledWith(
        DashboardPeriod.ALL_TIME,
        undefined,
        undefined,
      );
    });
  });
});
