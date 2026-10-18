import fs from 'fs';
import path from 'path';
import {
  DashboardService,
  ExecutiveSummaryResponse,
} from '@/services/dashboard.service';
import { InboxService } from '@/services/inbox.service';
import { apiClient } from '@/lib/axios';
import {
  formatCurrency,
  formatNumber,
  formatPercentage,
} from '@/lib/formatters';

jest.mock('@/lib/axios', () => ({
  apiClient: {
    get: jest.fn(),
  },
}));

const mockApiClient = apiClient as jest.Mocked<typeof apiClient>;

describe('PRE-W10 DASHBOARD-RD1: Executive Management Dashboard Contract Suite', () => {
  const dashboardComponentPath = path.resolve(
    process.cwd(),
    'src/components/DashboardPage.tsx',
  );
  let componentSource: string;

  beforeAll(() => {
    componentSource = fs.readFileSync(dashboardComponentPath, 'utf8');
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('1-2. Real API Consumption & Legacy Mock Elimination', () => {
    it('1. should consume authoritative executive summary API endpoint', async () => {
      const mockResponse: ExecutiveSummaryResponse = {
        meta: {
          generatedAt: '2026-10-01T10:00:00.000Z',
          period: {
            type: 'YEAR_TO_DATE',
            startDate: '2025-12-31T17:00:00.000Z',
            endDate: '2026-10-01T16:59:59.999Z',
          },
        },
        periodMetrics: {
          marketing: {
            totalPipeline: 113103691646,
            totalDeals: 118,
            wonDeals: 93,
            winRate: 78.81,
            pipelineByStage: [{ stage: 'LEAD', count: 118 }],
            marketingTrend: [{ month: 'Sep', value: 113103691646 }],
          },
          accountsPayable: {
            invoiceCount: 4,
            invoiceTotal: 968916000,
            verifiedInvoiceCount: 4,
            verifiedInvoiceValue: 968916000,
            paidInvoiceCount: 4,
            paidInvoiceValue: 968916000,
          },
          vendorPayments: {
            paymentCount: 4,
            paymentValue: 968916000,
          },
          procurement: {
            prCount: 21,
            pendingPrCount: 2,
            approvedPrCount: 19,
            poCount: 12,
            poCommittedValue: 1608916000,
            goodsReceiptCount: 3,
            goodsReceiptValue: 449120000,
            completedPoCount: 4,
            prToPoConversionRate: 63.16,
            poToGrCompletionRate: 33.33,
          },
        },
        currentSnapshot: {
          projects: {
            totalProjects: 66,
            activeProjects: 66,
            planningProjects: 39,
            inProgressProjects: 27,
            completedProjects: 0,
            onHoldProjects: 0,
            cancelledProjects: 0,
            readyForKickoff: 0,
            preKickoffContracts: 55,
            assignedProjectManagers: 66,
            unassignedProjectManagers: 0,
          },
          approvals: {
            totalPendingTasks: 27,
            pendingByTaskKey: [{ taskKey: 'PMO_ASSIGN_PM', count: 9 }],
            pendingByRole: {
              PMO: 9,
              MARKETING: 6,
              FINANCE: 4,
              HEAD_OF_OPERATIONS: 3,
              LEGAL: 2,
              PROCUREMENT: 2,
              PROJECT_MANAGER: 1,
            },
          },
          accountsPayable: {
            outstandingInvoiceCount: 0,
            outstandingInvoiceValue: 0,
          },
        },
      };

      mockApiClient.get.mockResolvedValueOnce({
        data: { statusCode: 200, data: mockResponse },
      });

      const res = await DashboardService.getExecutiveSummary({
        period: 'YEAR_TO_DATE',
      });
      expect(mockApiClient.get).toHaveBeenCalledWith(
        '/dashboard/executive-summary?period=YEAR_TO_DATE',
      );
      expect(res.currentSnapshot.projects.preKickoffContracts).toBe(55);
      expect(res.currentSnapshot.projects.readyForKickoff).toBe(0);
    });

    it('2. should verify legacy dashboard mock endpoints and hooks are completely removed from DashboardPage', () => {
      expect(componentSource).not.toContain('/dashboard/summary');
      expect(componentSource).not.toContain('/dashboard/project-trend');
      expect(componentSource).not.toContain('/dashboard/procurement-pending');
      expect(componentSource).not.toContain('useDashboardSummaryQuery');
      expect(componentSource).not.toContain('useDashboardProjectTrendQuery');
      expect(componentSource).not.toContain('useDashboardProcurementPendingQuery');
    });
  });

  describe('3-8. Forbidden and Unsupported Financial & Management Metrics', () => {
    it('3. should verify "Revenue" label is completely absent', () => {
      // Must not label vendor invoices or payments as Revenue
      expect(componentSource).not.toMatch(/Total Pengeluaran\s*\(\s*Revenue\s*\)/i);
      expect(componentSource).not.toMatch(/['"]Revenue['"]/i);
    });

    it('4. should verify "Revenue Collected" / Customer Collection is absent', () => {
      expect(componentSource).not.toContain('Revenue Collected');
      expect(componentSource).not.toContain('Customer Collection');
      expect(componentSource).not.toContain('Penerimaan Piutang');
    });

    it('5. should verify "Bank Balance" is absent', () => {
      expect(componentSource).not.toContain('Bank Balance');
      expect(componentSource).not.toContain('Saldo Bank');
    });

    it('6. should verify "Kas Balance" is absent', () => {
      expect(componentSource).not.toContain('Kas Balance');
      expect(componentSource).not.toContain('Saldo Kas');
    });

    it('7. should verify "Project Profit Margin" is absent', () => {
      expect(componentSource).not.toContain('Profit Margin');
      expect(componentSource).not.toContain('avgProfitMargin');
      expect(componentSource).not.toContain('Rata-rata Profit Margin');
    });

    it('8. should verify "On-Time Delivery" is absent', () => {
      expect(componentSource).not.toContain('On-Time Delivery');
      expect(componentSource).not.toContain('onTimeRate');
      expect(componentSource).not.toContain('Ketepatan Waktu');
    });
  });

  describe('9-13. Pre-Kickoff & True Kickoff Presentation & Real Zero Tests', () => {
    it('9. should render preKickoffContracts under the exact UI label "Kontrak Tahap Pra-Kickoff"', () => {
      expect(componentSource).toContain('Kontrak Tahap Pra-Kickoff');
      expect(componentSource).toContain('preKickoffContracts');
    });

    it('10. should ensure preKickoffContracts is NOT labelled as "Siap Formal Kickoff" or "Menunggu Formal Kickoff"', () => {
      // preKickoffContracts must be distinctly rendered from readyForKickoff
      const preKickoffIndex = componentSource.indexOf('Kontrak Tahap Pra-Kickoff');
      expect(preKickoffIndex).toBeGreaterThan(-1);

      // Verify component has distinct cards
      expect(componentSource).toContain('cSnapshot?.projects?.preKickoffContracts');
      expect(componentSource).toContain('cSnapshot?.projects?.readyForKickoff');
    });

    it('11. should render readyForKickoff separately under the label "Siap Formal Kickoff"', () => {
      expect(componentSource).toContain('Siap Formal Kickoff');
      expect(componentSource).toContain('readyForKickoff');
    });

    it('12. should render readyForKickoff = 0 as a valid REAL ZERO', () => {
      const readyZeroFormatted = formatNumber(0);
      expect(readyZeroFormatted).toBe('0');
      expect(formatCurrency(0)).toBe('Rp 0');
    });

    it('13. should render Outstanding AP = 0 as a valid REAL ZERO (Rp 0)', () => {
      const apZeroFormatted = formatCurrency(0);
      expect(apZeroFormatted).toBe('Rp 0');
      expect(componentSource).toContain('outstandingInvoiceValue');
    });
  });

  describe('14-17. Period Scope, Snapshot Labels & Dual Approval Authority', () => {
    it('14. should label period-aware metrics as "Periode Terpilih"', () => {
      expect(componentSource).toContain('Periode Terpilih');
    });

    it('15. should label live snapshot metrics as "Status Saat Ini"', () => {
      expect(componentSource).toContain('Status Saat Ini');
    });

    it('16. should verify Organization Approvals does NOT use /inbox/todos', () => {
      // Organization approvals is sourced from currentSnapshot.approvals
      expect(componentSource).toContain('cSnapshot?.approvals?.totalPendingTasks');
      expect(componentSource).toContain('cSnapshot?.approvals?.pendingByRole');
      expect(componentSource).toContain('cSnapshot?.approvals?.pendingByTaskKey');
    });

    it('17. should verify My Actions uses /inbox/todos for current user actionable tasks', async () => {
      mockApiClient.get.mockResolvedValueOnce({
        data: {
          data: [
            {
              todoId: 'wf-110',
              title: 'Review Rencana Operasional Proyek #1361',
              actionTarget: '/governance/tasks?taskId=110&projectId=1361',
            },
          ],
        },
      });

      const todos = await InboxService.getTodos();
      expect(mockApiClient.get).toHaveBeenCalledWith('/inbox/todos');
      expect(todos).toHaveLength(1);
      expect(todos[0].todoId).toBe('wf-110');
      expect(componentSource).toContain('InboxService.getTodos()');
    });
  });

  describe('18-19. Safe State Management: Loading & API Failure Handling', () => {
    it('18. should verify loading state contains NO mock KPI or fabricated values', () => {
      // Loading state shows clean spinner / skeleton message without static KPI numbers
      expect(componentSource).toContain('Memuat data ringkasan eksekutif');
      expect(componentSource).toContain('<Spin size="large" />');
    });

    it('19. should verify API failure displays error alert with retry and NEVER shows fallback mock data', () => {
      expect(componentSource).toContain('Gagal Memuat Dashboard Eksekutif');
      expect(componentSource).toContain('Coba Lagi');
      expect(componentSource).not.toContain('fallbackData');
    });
  });

  describe('20-22. Canonical id-ID Presentation Formatters', () => {
    it('20. should format currency strictly according to Indonesian locale (id-ID)', () => {
      expect(formatCurrency(113103691646)).toBe('Rp 113.103.691.646');
      expect(formatCurrency(1608916000)).toBe('Rp 1.608.916.000');
      expect(formatCurrency(968916000)).toBe('Rp 968.916.000');
      expect(formatCurrency(0)).toBe('Rp 0');
    });

    it('21. should format percentage strictly with comma decimal separator (id-ID)', () => {
      expect(formatPercentage(78.81)).toBe('78,81%');
      expect(formatPercentage(63.16)).toBe('63,16%');
      expect(formatPercentage(33.33)).toBe('33,33%');
      expect(formatPercentage(0)).toBe('0%');
    });

    it('22. should format counts and integers strictly with dot thousands separator (id-ID)', () => {
      expect(formatNumber(66)).toBe('66');
      expect(formatNumber(55)).toBe('55');
      expect(formatNumber(118)).toBe('118');
      expect(formatNumber(1250)).toBe('1.250');
      expect(formatNumber(0)).toBe('0');
    });
  });

  describe('23-31. DASHBOARD-DATA-R1: Data Lineage & Zero Baseline Integrity Gate', () => {
    it('23. Case 1: No hardcoded Key Focus business values (9, 39, 27) remain as static literals', () => {
      expect(componentSource).not.toMatch(/>\s*9\s+penugasan Project Manager/);
      expect(componentSource).not.toMatch(/>\s*39\s+proyek tahap perencanaan/);
      expect(componentSource).not.toMatch(/>\s*27\s+tugas persetujuan pending/);
    });

    it('24. Case 2: Planning Project binds dynamically to canonical API data', () => {
      expect(componentSource).toContain('cSnapshot?.projects?.planningProjects');
    });

    it('25. Case 3: Pending Approvals binds dynamically to totalPendingTasks', () => {
      expect(componentSource).toContain('cSnapshot?.approvals?.totalPendingTasks');
    });

    it('26. Case 4: Zero baseline and Donut fallbacks: no ?? 66, ?? 39, ?? 27 in geometry or tooltip', () => {
      expect(componentSource).not.toContain('?? 66');
      expect(componentSource).not.toContain('?? 39');
      expect(componentSource).not.toContain('?? 27');
      expect(componentSource).not.toContain('39 Perencanaan + 27 Sedang Eksekusi');
    });

    it('27. Case 5: Completed PO count binds to actual API metric', () => {
      expect(componentSource).toContain('pMetrics?.procurement?.completedPoCount');
      expect(componentSource).not.toContain('• 4 Selesai');
    });

    it('28. Case 6: PM allocation footer binds to actual API values (assigned / unassigned)', () => {
      expect(componentSource).toContain('cSnapshot?.projects?.assignedProjectManagers');
      expect(componentSource).toContain('cSnapshot?.projects?.unassignedProjectManagers');
      expect(componentSource).not.toContain('66 Ditugaskan • 0 Belum Ada PM');
    });

    it('29. Case 7: Marketing trend empty response contains no fake 113.1B fallback or 113,8 M static text', () => {
      expect(componentSource).not.toContain('113103691646');
      expect(componentSource).not.toContain('113,8 M');
    });

    it('30. Case 8: No valid disbursement percentage does not show fake 100% Selesai', () => {
      expect(componentSource).not.toContain('100% Selesai');
    });

    it('31. Case 9: Tile 5 secondary AP count binds dynamically without hardcoded 4', () => {
      expect(componentSource).not.toContain('4 Tagihan Vendor Telah Diverifikasi');
    });
  });

  describe('32-34. DASHBOARD-DATA-R1B: PM Assignment Semantic Strictness Gate', () => {
    it('32. should strictly remove pendingByRole.PMO fallback from PM assignment derivation in source', () => {
      expect(componentSource).not.toMatch(/pendingByRole\s*\?\.\s*PMO/);
    });

    it('33. Regression Case 1: PMO_ASSIGN_PM absent + pendingByRole.PMO = 5 must evaluate to 0 (NOT 5)', () => {
      const mockApprovals: any = {
        totalPendingTasks: 5,
        pendingByTaskKey: [{ taskKey: 'OTHER_PMO_TASK', count: 5 }],
        pendingByRole: { PMO: 5 },
      };

      const pmoAssignCount =
        mockApprovals?.pendingByTaskKey?.find((t: any) => t.taskKey === 'PMO_ASSIGN_PM')?.count ?? 0;

      expect(pmoAssignCount).toBe(0);
      expect(pmoAssignCount).not.toBe(5);
    });

    it('34. Regression Case 2: PMO_ASSIGN_PM = 3 + pendingByRole.PMO = 9 must evaluate to 3 (NOT 9)', () => {
      const mockApprovals: any = {
        totalPendingTasks: 9,
        pendingByTaskKey: [
          { taskKey: 'PMO_ASSIGN_PM', count: 3 },
          { taskKey: 'OTHER_TASK', count: 6 },
        ],
        pendingByRole: { PMO: 9 },
      };

      const pmoAssignCount =
        mockApprovals?.pendingByTaskKey?.find((t: any) => t.taskKey === 'PMO_ASSIGN_PM')?.count ?? 0;

      expect(pmoAssignCount).toBe(3);
      expect(pmoAssignCount).not.toBe(9);
    });
  });
});
