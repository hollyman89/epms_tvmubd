import { BadRequestException } from '@nestjs/common';
import { DashboardService } from '../dashboard.service';
import { DashboardController } from '../dashboard.controller';
import { GetExecutiveSummaryDto } from '../dto/get-executive-summary.dto';
import { DashboardPeriod } from '../../analytics/dto/get-analytics.dto';

describe('CP2 — Executive Analytics Data Integration (Marketing Scope: ALL / UBD / TVM)', () => {
  let service: DashboardService;
  let controller: DashboardController;
  let mockDataSource: { query: jest.Mock };
  let mockAnalyticsService: { calculateDateRange: jest.Mock; getDashboardAnalytics: jest.Mock };

  beforeEach(() => {
    mockDataSource = {
      query: jest.fn().mockImplementation(async (sql: string, params: any[] = []) => {
        // Marketing identity resolution queries
        if (sql.includes('users WHERE email = ?')) {
          const email = params[0];
          if (email === 'ragil@epms.com') {
            return [{ id: 9, full_name: 'Dwi Ragil Pribadi', email: 'ragil@epms.com', is_active: 1 }];
          }
          if (email === 'lukas@epms.com') {
            return [{ id: 7, full_name: 'Lukas Kurniawan', email: 'lukas@epms.com', is_active: 1 }];
          }
          return [];
        }

        // Unclassified metadata query
        if (sql.includes('NOT IN (?, ?)') || sql.includes('NOT IN (9, 7)')) {
          if (sql.includes('FROM tenders')) {
            return [{ count: '113', value: '103979900005.00' }];
          }
          if (sql.includes('FROM contracts')) {
            return [{ count: '7', value: '101181069859.00' }];
          }
          if (sql.includes('FROM projects')) {
            return [{ count: '7' }];
          }
          if (sql.includes('FROM purchase_orders')) {
            return [{ count: '9', value: '598470207.00' }];
          }
          if (sql.includes('FROM payments')) {
            return [{ count: '7', value: '351298957.00' }];
          }
        }

        // Tenders won deals
        if (sql.includes('status = \'WON\'')) {
          // If UBD (Ragiel id 9)
          if (params.includes(9)) {
            return [{ count: '2', wonValue: '397805463.00', lostCount: '0' }];
          }
          // If TVM (Lukas id 7)
          if (params.includes(7)) {
            return [{ count: '0', wonValue: '0.00', lostCount: '0' }];
          }
          // Default ALL
          return [{ count: '9', wonValue: '101578875322.00', lostCount: '0' }];
        }

        // Tenders open pipeline
        if (sql.includes('status NOT IN (\'WON\', \'LOST\', \'CANCELLED\')')) {
          if (params.includes(9)) {
            return [{ openDealsCount: '48', openPipelineValue: '1192060452.00' }];
          }
          if (params.includes(7)) {
            return [{ openDealsCount: '0', openPipelineValue: '0.00' }];
          }
          return [{ openDealsCount: '154', openPipelineValue: '3990890598.00' }];
        }

        // Projects snapshot
        if (sql.includes('totalProjects')) {
          if (params.includes(9)) {
            return [{
              totalProjects: '2',
              planningProjects: '0',
              inProgressProjects: '0',
              activeProjects: '0',
              completedProjects: '2',
              onHoldProjects: '0',
              cancelledProjects: '0',
              assignedProjectManagers: '2',
              unassignedProjectManagers: '0',
            }];
          }
          if (params.includes(7)) {
            return [{
              totalProjects: '0',
              planningProjects: '0',
              inProgressProjects: '0',
              activeProjects: '0',
              completedProjects: '0',
              onHoldProjects: '0',
              cancelledProjects: '0',
              assignedProjectManagers: '0',
              unassignedProjectManagers: '0',
            }];
          }
          return [{
            totalProjects: '9',
            planningProjects: '0',
            inProgressProjects: '4',
            activeProjects: '4',
            completedProjects: '5',
            onHoldProjects: '0',
            cancelledProjects: '0',
            assignedProjectManagers: '9',
            unassignedProjectManagers: '0',
          }];
        }

        if (sql.includes('readyForKickoff')) return [{ readyForKickoff: '0' }];
        if (sql.includes('preKickoffContracts')) return [{ preKickoffContracts: '0' }];

        // Contracts awarded
        if (sql.includes('contractAwardedCount')) {
          if (params.includes(9)) {
            return [{ contractAwardedCount: '2', contractAwardedValue: '397805463.00' }];
          }
          if (params.includes(7)) {
            return [{ contractAwardedCount: '0', contractAwardedValue: '0.00' }];
          }
          return [{ contractAwardedCount: '9', contractAwardedValue: '101578875322.00' }];
        }

        // Value under execution
        if (sql.includes('underExecutionProjectsCount')) {
          if (params.includes(9)) {
            return [{ underExecutionProjectsCount: '0', underExecutionValue: '0.00' }];
          }
          if (params.includes(7)) {
            return [{ underExecutionProjectsCount: '0', underExecutionValue: '0.00' }];
          }
          return [{ underExecutionProjectsCount: '4', underExecutionValue: '100668052501.00' }];
        }

        if (sql.includes('overdueProjects')) return [{ overdueProjects: '0' }];
        if (sql.includes('openHighCriticalRisks')) return [{ openHighCriticalRisks: '0' }];
        if (sql.includes('overdueProjectIssues')) return [{ overdueProjectIssues: '0' }];
        if (sql.includes('pendingDirectorDecisions')) return [{ pendingDirectorDecisions: '0' }];

        // Invoices
        if (sql.includes('FROM invoices')) {
          if (params.includes(9)) {
            return [{
              invoiceCount: '3',
              invoiceTotal: '209483500.00',
              verifiedInvoiceCount: '3',
              verifiedInvoiceValue: '209483500.00',
              paidInvoiceCount: '3',
              paidInvoiceValue: '209483500.00',
            }];
          }
          if (params.includes(7)) {
            return [{
              invoiceCount: '0',
              invoiceTotal: '0.00',
              verifiedInvoiceCount: '0',
              verifiedInvoiceValue: '0.00',
              paidInvoiceCount: '0',
              paidInvoiceValue: '0.00',
            }];
          }
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
          return [{ outstandingInvoiceCount: '0', outstandingLiabilityBalance: '0.00' }];
        }

        // Payments
        if (sql.includes('FROM payments')) {
          if (params.includes(9)) {
            return [{ paymentCount: '3', paymentValue: '209483500.00' }];
          }
          if (params.includes(7)) {
            return [{ paymentCount: '0', paymentValue: '0.00' }];
          }
          return [{ paymentCount: '10', paymentValue: '560782457.00' }];
        }

        // Purchase Requests
        if (sql.includes('FROM purchase_requests')) {
          if (params.includes(9)) {
            return [{ prCount: '3', pendingPrCount: '0', approvedPrCount: '3', poIssuedPrCount: '3' }];
          }
          if (params.includes(7)) {
            return [{ prCount: '0', pendingPrCount: '0', approvedPrCount: '0', poIssuedPrCount: '0' }];
          }
          return [{ prCount: '12', pendingPrCount: '0', approvedPrCount: '12', poIssuedPrCount: '12' }];
        }

        // Purchase Orders
        if (sql.includes('FROM purchase_orders')) {
          if (params.includes(9)) {
            return [{
              poCount: '3',
              poCommittedValue: '209483500.00',
              completedPoCount: '2',
              materialPoCount: '2',
              completedMaterialPoCount: '2',
              servicePoCount: '1',
            }];
          }
          if (params.includes(7)) {
            return [{
              poCount: '0',
              poCommittedValue: '0.00',
              completedPoCount: '0',
              materialPoCount: '0',
              completedMaterialPoCount: '0',
              servicePoCount: '0',
            }];
          }
          return [{
            poCount: '12',
            poCommittedValue: '807953707.00',
            completedPoCount: '7',
            materialPoCount: '7',
            completedMaterialPoCount: '7',
            servicePoCount: '5',
          }];
        }

        // Service PO fulfillment
        if (sql.includes('service_pos')) {
          if (params.includes(9)) {
            return [{ servicePoCount: '1', fulfilledServicePoCount: '1', serviceFulfilledValue: '4152000.00' }];
          }
          if (params.includes(7)) {
            return [{ servicePoCount: '0', fulfilledServicePoCount: '0', serviceFulfilledValue: '0.00' }];
          }
          return [{ servicePoCount: '5', fulfilledServicePoCount: '5', serviceFulfilledValue: '50803212.00' }];
        }

        // Goods receipts
        if (sql.includes('FROM goods_receipts')) {
          if (params.includes(9)) {
            return [{ goodsReceiptCount: '2', goodsReceiptValue: '205331500.00' }];
          }
          if (params.includes(7)) {
            return [{ goodsReceiptCount: '0', goodsReceiptValue: '0.00' }];
          }
          return [{ goodsReceiptCount: '7', goodsReceiptValue: '757150495.00' }];
        }

        if (sql.includes('totalPendingTasks')) return [{ totalPendingTasks: '0' }];
        if (sql.includes('task_key as taskKey')) return [];
        if (sql.includes('assignee_role_id')) return [];

        // Legal contracts
        if (sql.includes('FROM contracts')) {
          if (params.includes(9)) {
            return [{ pendingLegalReview: '0', revisionExpired: '0', activeContracts: '2', revisionNeeded: '0', totalContracts: '2' }];
          }
          if (params.includes(7)) {
            return [{ pendingLegalReview: '0', revisionExpired: '0', activeContracts: '0', revisionNeeded: '0', totalContracts: '0' }];
          }
          return [{ pendingLegalReview: '0', revisionExpired: '0', activeContracts: '9', revisionNeeded: '0', totalContracts: '9' }];
        }

        return [];
      }),
    };

    mockAnalyticsService = {
      calculateDateRange: jest.fn().mockReturnValue({
        start: new Date('2026-01-01T00:00:00.000Z'),
        end: new Date('2026-10-26T23:59:59.999Z'),
      }),
      getDashboardAnalytics: jest.fn().mockImplementation((query: any, targetUserId?: number) => {
        if (targetUserId === 9) {
          // UBD
          return Promise.resolve({
            funnel: [{ stage: 'WON', count: 2 }],
            trendLine: [{ month: 'Oct', value: 1589865915 }],
            kpi: {
              totalDeals: 50,
              totalPipeline: 1589865915,
              winRate: 0.04,
            },
          });
        }
        if (targetUserId === 7) {
          // TVM
          return Promise.resolve({
            funnel: [{ stage: 'WON', count: 0 }],
            trendLine: [{ month: 'Oct', value: 0 }],
            kpi: {
              totalDeals: 0,
              totalPipeline: 0,
              winRate: 0,
            },
          });
        }
        // ALL
        return Promise.resolve({
          funnel: [{ stage: 'WON', count: 9 }],
          trendLine: [{ month: 'Oct', value: 105569765920 }],
          kpi: {
            totalDeals: 163,
            totalPipeline: 105569765920,
            winRate: 1.0,
          },
        });
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

  // CP2-01: ALL reporting — Existing baseline maintained
  it('CP2-01: should return consolidated ALL reporting maintaining installation-wide baseline', async () => {
    const query: GetExecutiveSummaryDto = {
      period: DashboardPeriod.YEAR_TO_DATE,
      divisionId: 'ALL',
    };
    const result = await service.getExecutiveSummary(query, 4, ['DIRECTOR']);

    expect(result.meta.reportingBasis).toBe('MARKETING_ATTRIBUTION');
    expect(result.meta.selectedScope).toBe('ALL');
    expect((result.meta as any).division.id).toBe('ALL');
    expect(result.periodMetrics.marketing.totalPipeline).toBe(105569765920);
    expect(result.periodMetrics.marketing.wonDeals).toBe(9);
    expect(result.periodMetrics.marketing.wonValue).toBe(101578875322);
    expect(result.currentSnapshot.projects.totalProjects).toBe(9);
    expect(result.currentSnapshot.projects.activeProjects).toBe(4);
    expect(result.periodMetrics.procurement.poCommittedValue).toBe(807953707);
    expect(result.periodMetrics.vendorPayments.paymentValue).toBe(560782457);
  });

  // CP2-02: UBD reporting — Only Ragiel-attributed data
  it('CP2-02: should filter executive analytics strictly to UBD Marketing Ragiel lineage', async () => {
    const query: GetExecutiveSummaryDto = {
      period: DashboardPeriod.YEAR_TO_DATE,
      divisionId: 'UBD',
    };
    const result = await service.getExecutiveSummary(query, 4, ['DIRECTOR']);

    expect(result.meta.reportingBasis).toBe('MARKETING_ATTRIBUTION');
    expect(result.meta.selectedScope).toBe('UBD');
    expect((result.meta as any).division.id).toBe('UBD');
    expect((result.meta as any).division.marketingUser).toBe('Dwi Ragil Pribadi');
    expect((result.meta as any).division.marketingEmail).toBe('ragil@epms.com');
    expect(result.periodMetrics.marketing.totalPipeline).toBe(1589865915);
    expect(result.periodMetrics.marketing.wonDeals).toBe(2);
    expect(result.periodMetrics.marketing.wonValue).toBe(397805463);
    expect(result.currentSnapshot.projects.totalProjects).toBe(2);
    expect(result.currentSnapshot.projects.activeProjects).toBe(0);
    expect(result.periodMetrics.procurement.poCommittedValue).toBe(209483500);
    expect(result.periodMetrics.vendorPayments.paymentValue).toBe(209483500);
  });

  // CP2-03: TVM reporting — Only Lukas-attributed data
  it('CP2-03: should return real zeros for TVM (Lukas) with zero transactions without crashing', async () => {
    const query: GetExecutiveSummaryDto = {
      period: DashboardPeriod.YEAR_TO_DATE,
      divisionId: 'TVM',
    };
    const result = await service.getExecutiveSummary(query, 4, ['DIRECTOR']);

    expect(result.meta.reportingBasis).toBe('MARKETING_ATTRIBUTION');
    expect(result.meta.selectedScope).toBe('TVM');
    expect((result.meta as any).division.id).toBe('TVM');
    expect((result.meta as any).division.marketingUser).toBe('Lukas Kurniawan');
    expect((result.meta as any).division.marketingEmail).toBe('lukas@epms.com');
    expect(result.periodMetrics.marketing.totalPipeline).toBe(0);
    expect(result.periodMetrics.marketing.wonDeals).toBe(0);
    expect(result.periodMetrics.marketing.wonValue).toBe(0);
    expect(result.currentSnapshot.projects.totalProjects).toBe(0);
    expect(result.currentSnapshot.projects.activeProjects).toBe(0);
    expect(result.periodMetrics.procurement.poCommittedValue).toBe(0);
    expect(result.periodMetrics.vendorPayments.paymentValue).toBe(0);
  });

  // CP2-04: Invalid scope — Rejected
  it('CP2-04: should reject invalid scope with HTTP 400 BadRequestException', async () => {
    await expect(service.validateDivision('INVALID_COMPANY')).rejects.toThrow(BadRequestException);
    await expect(service.validateDivision('UBD_DIV_UNKNOWN')).rejects.toThrow(BadRequestException);
    await expect(service.validateDivision('99999')).rejects.toThrow(BadRequestException);
  });

  // CP2-05: Missing Marketing identity — Explicit failure, not false zero
  it('CP2-05: should fail explicitly if marketing user identity cannot be resolved from database', async () => {
    // Override user query to simulate missing user record
    mockDataSource.query.mockImplementation(async (sql: string) => {
      if (sql.includes('users WHERE email = ?')) return [];
      return [];
    });

    await expect(service.resolveMarketingUser('UBD')).rejects.toThrow(BadRequestException);
    await expect(service.resolveMarketingUser('TVM')).rejects.toThrow(BadRequestException);
  });

  // CP2-06: Unclassified transactions — Excluded from UBD/TVM, retained in ALL
  it('CP2-06: should include unclassified metadata in ALL and exclude unclassified from UBD/TVM', async () => {
    const allResult = await service.getExecutiveSummary({ divisionId: 'ALL' }, 4, ['DIRECTOR']);
    expect(allResult.meta.unclassified).toBeDefined();
    expect(allResult.meta.unclassified?.tendersCount).toBe(113);
    expect(allResult.meta.unclassified?.tendersValue).toBe(103979900005);
    expect(allResult.meta.unclassified?.contractsCount).toBe(7);
    expect(allResult.meta.unclassified?.projectsCount).toBe(7);

    const ubdResult = await service.getExecutiveSummary({ divisionId: 'UBD' }, 4, ['DIRECTOR']);
    expect(ubdResult.meta.unclassified).toBeNull();

    const tvmResult = await service.getExecutiveSummary({ divisionId: 'TVM' }, 4, ['DIRECTOR']);
    expect(tvmResult.meta.unclassified).toBeNull();
  });

  // CP2-07: Contract lineage — Correct Tender association
  it('CP2-07: should associate contracts with marketing user via tender_id', async () => {
    await service.getExecutiveSummary({ divisionId: 'UBD' }, 4, ['DIRECTOR']);
    const queries: string[] = mockDataSource.query.mock.calls.map(c => c[0]);
    const contractAwardedQuery = queries.find(q => q.includes('contractAwardedCount'));
    expect(contractAwardedQuery).toContain('JOIN tenders t ON c.tender_id = t.id');
    expect(contractAwardedQuery).toContain('marketing_pic_id = ?');
  });

  // CP2-08: Project lineage — Correct Contract/Tender association
  it('CP2-08: should trace project lineage through contract_id -> tender_id -> marketing user', async () => {
    await service.getExecutiveSummary({ divisionId: 'UBD' }, 4, ['DIRECTOR']);
    const queries: string[] = mockDataSource.query.mock.calls.map(c => c[0]);
    const projectQuery = queries.find(q => q.includes('totalProjects'));
    expect(projectQuery).toContain('JOIN contracts c ON p.contract_id = c.id');
    expect(projectQuery).toContain('JOIN tenders t ON c.tender_id = t.id');
    expect(projectQuery).toContain('marketing_pic_id = ?');
  });

  // CP2-09: PO lineage — Correct PR/Project association
  it('CP2-09: should trace PO lineage through PR -> project -> contract -> tender', async () => {
    await service.getExecutiveSummary({ divisionId: 'UBD' }, 4, ['DIRECTOR']);
    const queries: string[] = mockDataSource.query.mock.calls.map(c => c[0]);
    const poQuery = queries.find(q => q.includes('poCommittedValue'));
    expect(poQuery).toContain('JOIN purchase_requests pr ON po.pr_id = pr.id');
    expect(poQuery).toContain('JOIN projects p ON pr.project_id = p.id');
    expect(poQuery).toContain('JOIN contracts c ON p.contract_id = c.id');
    expect(poQuery).toContain('JOIN tenders t ON c.tender_id = t.id');
  });

  // CP2-10: Invoice and Payment lineage — Correct upstream association
  it('CP2-10: should trace payments and invoices through complete upstream lineage', async () => {
    await service.getExecutiveSummary({ divisionId: 'UBD' }, 4, ['DIRECTOR']);
    const queries: string[] = mockDataSource.query.mock.calls.map(c => c[0]);
    const paymentQuery = queries.find(q => q.includes('paymentValue') && q.includes('FROM payments'));
    expect(paymentQuery).toContain('JOIN invoices i ON pay.invoice_id = i.id');
    expect(paymentQuery).toContain('JOIN purchase_orders po ON i.po_id = po.id');
    expect(paymentQuery).toContain('JOIN purchase_requests pr ON po.pr_id = pr.id');
  });

  // CP2-11: Duplicate prevention — No join-based amount duplication
  it('CP2-11: should prevent join-based double counting in live outstanding AP', async () => {
    await service.getExecutiveSummary({ divisionId: 'UBD' }, 4, ['DIRECTOR']);
    const queries: string[] = mockDataSource.query.mock.calls.map(c => c[0]);
    const apOutstandingQuery = queries.find(q => q.includes('outstandingLiabilityBalance'));
    expect(apOutstandingQuery).toContain('GROUP BY invoice_id');
  });

  // CP2-12: KPI reconciliation — Sum matches source for additive metrics (ALL = UBD + TVM + UNCLASSIFIED)
  it('CP2-12: should reconcile mathematically: ALL = UBD + TVM + UNCLASSIFIED', async () => {
    const all = await service.getExecutiveSummary({ divisionId: 'ALL' }, 4, ['DIRECTOR']);
    const ubd = await service.getExecutiveSummary({ divisionId: 'UBD' }, 4, ['DIRECTOR']);
    const tvm = await service.getExecutiveSummary({ divisionId: 'TVM' }, 4, ['DIRECTOR']);

    const unclass = all.meta.unclassified!;
    // Won values reconciliation
    const wonSum = ubd.periodMetrics.marketing.wonValue + tvm.periodMetrics.marketing.wonValue + unclass.contractsValue;
    expect(wonSum).toBe(all.periodMetrics.marketing.wonValue);

    // PO commitments reconciliation
    const poSum = ubd.periodMetrics.procurement.poCommittedValue + tvm.periodMetrics.procurement.poCommittedValue + unclass.posValue;
    expect(poSum).toBe(all.periodMetrics.procurement.poCommittedValue);

    // Payments reconciliation
    const paySum = ubd.periodMetrics.vendorPayments.paymentValue + tvm.periodMetrics.vendorPayments.paymentValue + unclass.paymentsValue;
    expect(paySum).toBe(all.periodMetrics.vendorPayments.paymentValue);
  });

  // CP2-13: Time filter — Preserved across all selected scopes
  it('CP2-13: should preserve date range calculation across all reporting scopes', async () => {
    await service.getExecutiveSummary({ divisionId: 'UBD', period: DashboardPeriod.LAST_MONTH }, 4, ['DIRECTOR']);
    expect(mockAnalyticsService.calculateDateRange).toHaveBeenCalledWith(
      DashboardPeriod.LAST_MONTH,
      undefined,
      undefined,
    );
  });

  // CP2-14: Shared approvals — Not falsely attributed to one company
  it('CP2-14: should declare workflow approvals as GLOBAL shared scope for company reporting', async () => {
    const ubd = await service.getExecutiveSummary({ divisionId: 'UBD' }, 4, ['DIRECTOR']);
    expect(ubd.currentSnapshot.approvals.scope).toBe('GLOBAL');
    expect(ubd.currentSnapshot.approvals.isSharedWorkflow).toBe(true);

    const all = await service.getExecutiveSummary({ divisionId: 'ALL' }, 4, ['DIRECTOR']);
    expect(all.currentSnapshot.approvals.scope).toBe('INSTALLATION');
    expect(all.currentSnapshot.approvals.isSharedWorkflow).toBe(false);
  });

  // CP2-15: Existing API contract — Backward-compatible
  it('CP2-15: should maintain exact backward-compatible structure for omitted divisionId', async () => {
    const result = await service.getExecutiveSummary({}, 4, ['DIRECTOR']);
    expect(result.meta.division).toBeDefined();
    expect((result.meta as any).division.id).toBe('ALL');
    expect((result.meta as any).division.scope).toBe('INSTALLATION');
    expect(result.periodMetrics).toBeDefined();
    expect(result.currentSnapshot).toBeDefined();
  });

  // CP2-16: Controller compatibility & fail-fast validation
  it('CP2-16: should validate scope and expose /executive-summary via controller for authorized roles', async () => {
    const req = { user: { userId: 4, roles: ['DIRECTOR'] } };
    const res = await controller.getExecutiveSummary({ divisionId: 'UBD' }, req);
    expect(res.statusCode).toBe(200);
    expect(res.data.meta.selectedScope).toBe('UBD');

    // Invalid scope rejects at controller level
    await expect(controller.getExecutiveSummary({ divisionId: 'UNKNOWN_SCOPE' }, req)).rejects.toThrow(
      BadRequestException,
    );
  });
});
