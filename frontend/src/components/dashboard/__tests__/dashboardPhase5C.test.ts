import fs from 'fs';
import path from 'path';

describe('EPMS PHASE 5C: Desktop Executive Layout Transformation Tests', () => {
  const dashboardComponentPath = path.resolve(
    process.cwd(),
    'src/components/DashboardPage.tsx',
  );
  const dashboardCssPath = path.resolve(
    process.cwd(),
    'src/components/DashboardPage.module.css',
  );

  let dashboardSource: string;
  let cssSource: string;

  beforeAll(() => {
    dashboardSource = fs.readFileSync(dashboardComponentPath, 'utf8');
    cssSource = fs.readFileSync(dashboardCssPath, 'utf8');
  });

  describe('1. Executive Header & Brief Area', () => {
    it('renders clean Executive Header with controls and timestamp', () => {
      expect(dashboardSource).toContain('Executive Dashboard');
      expect(dashboardSource).toContain('Ringkasan kinerja komersial, proyek, pengadaan, dan keuangan');
      expect(dashboardSource).toContain('headerControls');
      expect(dashboardSource).toContain('handleRefresh');
    });

    it('renders ExecutiveSummary component in Executive Brief area', () => {
      expect(dashboardSource).toContain('<ExecutiveSummary');
      expect(dashboardSource).toContain('summaryData={summaryData}');
      expect(dashboardSource).toContain('todos={todos}');
    });
  });

  describe('2. Primary KPI Row', () => {
    it('renders all six canonical KPI cards', () => {
      expect(dashboardSource).toContain('label="Won Bookings"');
      expect(dashboardSource).toContain('label="Open Pipeline"');
      expect(dashboardSource).toContain('label="Proyek Aktif"');
      expect(dashboardSource).toContain('label="Realisasi Pengadaan"');
      expect(dashboardSource).toContain('label="Outstanding AP"');
      expect(dashboardSource).toMatch(/label=\{\s*currentUser\?\.roles/);
    });
  });

  describe('3. Decision Center (Director Actions & Approval Queue)', () => {
    it('renders Decision Center with Director Priority Actions and Organization Approval Queue', () => {
      expect(dashboardSource).toContain('decisionCenterGrid');
      expect(dashboardSource).toContain('Director Priority Actions');
      expect(dashboardSource).toContain('Organization Approval Queue');
      expect(cssSource).toContain('.decisionCenterGrid');
      expect(cssSource).toContain('.decisionTable');
    });

    it('Director Priority Actions uses personal todos with reference, age, and priority', () => {
      expect(dashboardSource).toContain('todos.slice(0, 5).map');
      expect(dashboardSource).toContain('refBadge');
      expect(dashboardSource).toContain('priorityHigh');
      expect(dashboardSource).toContain('priorityNormal');
      expect(dashboardSource).toContain('emptyDecisionState');
    });

    it('Organization Approval Queue maps canonical roles dynamically from currentSnapshot.approvals', () => {
      expect(dashboardSource).toContain('cSnapshot?.approvals?.pendingByRole');
      expect(dashboardSource).toContain('PROCUREMENT');
      expect(dashboardSource).toContain('FINANCE');
      expect(dashboardSource).toContain('cSnapshot?.approvals?.totalPendingTasks');
    });
  });

  describe('4. Business Performance (Commercial + Project Portfolio)', () => {
    it('renders Commercial Performance with Funnel Tender and Decided Win Rate gauge', () => {
      expect(dashboardSource).toContain('Commercial Performance');
      expect(dashboardSource).toContain('Funnel Tender (Jumlah)');
      expect(dashboardSource).toContain('Decided Win Rate');
      expect(dashboardSource).toContain('winRateGauge');
      expect(dashboardSource).toContain('pMetrics?.marketing?.wonDeals');
      expect(dashboardSource).toContain('Won');
      expect(dashboardSource).toContain('Lost');
    });

    it('renders Project Portfolio with Donut chart and Project Attention strip', () => {
      expect(dashboardSource).toContain('Project Portfolio');
      expect(dashboardSource).toContain('Total Proyek');
      expect(dashboardSource).toContain('Project Attention (Task & Milestone)');
      expect(dashboardSource).toContain('Unassigned PM');
      expect(dashboardSource).toContain('Pending Kickoff');
      expect(dashboardSource).toContain('Pre-Kickoff Contract');
      expect(dashboardSource).toContain('Overdue Tasks');
      expect(dashboardSource).toContain('Overdue Milestones');
    });
  });

  describe('5. Procurement → Cost / AP Flow', () => {
    it('renders horizontal 5-stage procurement to payment flow', () => {
      expect(dashboardSource).toContain('Procurement → Cost / AP Flow');
      expect(dashboardSource).toContain('flowStepsContainer');
      expect(dashboardSource).toContain('PO Diterbitkan');
      expect(dashboardSource).toContain('Terpenuhi');
      expect(dashboardSource).toContain('Invoice Vendor');
      expect(dashboardSource).toContain('Pembayaran');
      expect(dashboardSource).toContain('Outstanding AP');
    });

    it('binds flow stages to canonical procurement and finance metrics', () => {
      expect(dashboardSource).toContain('pMetrics?.procurement?.poCount');
      expect(dashboardSource).toContain('pMetrics?.procurement?.poCommittedValue');
      expect(dashboardSource).toContain('pMetrics?.procurement?.completedMaterialPoCount');
      expect(dashboardSource).toContain('pMetrics?.procurement?.goodsReceiptValue');
      expect(dashboardSource).toContain('pMetrics?.accountsPayable?.verifiedInvoiceCount');
      expect(dashboardSource).toContain('pMetrics?.accountsPayable?.verifiedInvoiceValue');
      expect(dashboardSource).toContain('pMetrics?.vendorPayments?.paymentCount');
      expect(dashboardSource).toContain('pMetrics?.vendorPayments?.paymentValue');
      expect(dashboardSource).toContain('cSnapshot?.accountsPayable?.outstandingLiabilityBalance');
    });
  });

  describe('6. Legacy Clutter Removal', () => {
    it('removes the redundant 5 module summary cards from Executive Dashboard composition', () => {
      // The old domainGrid with 5 monolithic cards should not be rendered
      expect(dashboardSource).not.toContain('<div className={styles.domainGrid}>');
      expect(dashboardSource).not.toContain('Module 1: Marketing');
    });

    it('removes the redundant standalone Key Focus strip from Executive Dashboard composition', () => {
      // Key focus data is now reallocated into Project Attention and Decision Center
      expect(dashboardSource).not.toContain('<div className={styles.keyFocusSection}>');
      expect(dashboardSource).not.toContain('styles.keyFocusGrid');
    });
  });

  describe('7. Phase 5C-HF01 Semantic Hardening', () => {
    it('renders independent Material and Service states for headline Procurement KPI without fake combined 100%', () => {
      expect(dashboardSource).toContain('Mat:');
      expect(dashboardSource).toContain('Jasa:');
      // When serviceFulfillmentRate is null, displays N/A
      expect(dashboardSource).toContain(": 'N/A'");
      expect(dashboardSource).toContain('Belum ada pengadaan jasa');
    });

    it('renders Step 2 Terpenuhi with separate Material GR and Service rates', () => {
      expect(dashboardSource).toContain('Terpenuhi (GR)');
      expect(dashboardSource).toContain('Mat:');
      expect(dashboardSource).toContain('• Jasa:');
    });

    it('does not contain manufactured percentage multipliers in commercial funnel', () => {
      expect(dashboardSource).not.toContain('openCount * 0.55');
      expect(dashboardSource).not.toContain('openCount * 0.3');
      expect(dashboardSource).not.toContain('openCount * 0.08');
    });
  });
});
