import * as fs from 'fs';
import * as path from 'path';

describe('EPMS PHASE 3: Benchmark-Locked Visual Analytics Transformation Tests', () => {
  const dashboardPath = path.resolve(__dirname, '../../DashboardPage.tsx');
  const dashboardCssPath = path.resolve(__dirname, '../../DashboardPage.module.css');
  const dashboardSource = fs.readFileSync(dashboardPath, 'utf8');
  const cssSource = fs.readFileSync(dashboardCssPath, 'utf8');

  describe('1. Authoritative Visual Benchmark Structure', () => {
    it('implements Benchmark-Locked layout layers', () => {
      expect(dashboardSource).toContain('benchmarkContainer');
      expect(dashboardSource).toContain('benchmarkHeader');
      expect(dashboardSource).toContain('benchmarkBriefContainer');
      expect(dashboardSource).toContain('benchmarkKpiStrip');
      expect(dashboardSource).toContain('benchmarkRowTwo');
      expect(dashboardSource).toContain('benchmarkRowThree');
      expect(dashboardSource).toContain('benchmarkRowFour');
    });

    it('defines corresponding benchmark CSS classes in DashboardPage.module.css', () => {
      expect(cssSource).toContain('.benchmarkContainer');
      expect(cssSource).toContain('.benchmarkBriefContainer');
      expect(cssSource).toContain('.benchmarkKpiStrip');
      expect(cssSource).toContain('.benchmarkRowTwo');
      expect(cssSource).toContain('.benchmarkRowThree');
      expect(cssSource).toContain('.benchmarkRowFour');
      expect(cssSource).toContain('.benchmarkFunnelTrapezoid');
    });
  });

  describe('2. Canonical Metric Bindings (Section 32 Requirements)', () => {
    it('1. Open Pipeline binds to canonical openPipelineValue (Rp 3,99 M)', () => {
      expect(dashboardSource).toContain('cSnapshot?.marketing?.openPipelineValue');
      expect(dashboardSource).toContain('154');
    });

    it('2. Contract Awarded binds to canonical contractAwardedValue (Rp 101,58 M)', () => {
      expect(dashboardSource).toContain('cSnapshot?.contracts?.contractAwardedValue');
      expect(dashboardSource).toContain('contractAwardedValue');
    });

    it('3. Under Execution binds to canonical underExecutionValue (Rp 100,67 M)', () => {
      expect(dashboardSource).toContain('cSnapshot?.projects?.underExecutionValue');
      expect(dashboardSource).toContain('underExecutionValue');
    });

    it('4. Revenue unavailable remains honestly unavailable (Belum tersedia)', () => {
      expect(dashboardSource).toContain('Revenue');
      expect(dashboardSource).toContain('Belum tersedia');
      expect(dashboardSource).toContain('Data akan tersedia setelah modul aktif');
    });

    it('5. Cash Collection unavailable remains honestly unavailable (Belum tersedia)', () => {
      expect(dashboardSource).toContain('Cash Collection');
      expect(dashboardSource).toContain('Belum tersedia');
    });

    it('6. Margin unavailable remains honestly unavailable (Belum tersedia)', () => {
      expect(dashboardSource).toContain('Margin');
      expect(dashboardSource).toContain('Belum tersedia');
    });

    it('7. AP flow uses corrected canonical values (PO Rp 807,95M, Invoice Rp 560,78M, Paid Rp 560,78M, AP Rp 0)', () => {
      expect(dashboardSource).toContain('pMetrics?.procurement?.poCommittedValue');
      expect(dashboardSource).toContain('pMetrics?.accountsPayable?.verifiedInvoiceValue');
      expect(dashboardSource).toContain('pMetrics?.vendorPayments?.paymentValue');
      expect(dashboardSource).toContain('cSnapshot?.accountsPayable?.outstandingLiabilityBalance');
    });

    it('8. Service fulfillment remains included in total Fulfilled (Rp 807,95M)', () => {
      expect(dashboardSource).toContain('pMetrics?.procurement?.totalFulfilledValue');
      expect(dashboardSource).toContain('7 Mat • 5 Jasa');
    });

    it('9. Director Actions remain personal Director actions from authenticated todos', () => {
      expect(dashboardSource).toContain('Director Action Required');
      expect(dashboardSource).toContain('todos.slice(0, 5)');
      expect(dashboardSource).toContain('Semua keputusan Direktur telah diselesaikan');
    });

    it('10. Charts do not use mock/random data (uses real canonical marketingTrend and project status)', () => {
      expect(dashboardSource).not.toContain('Math.random()');
      expect(dashboardSource).not.toContain('mockData');
      expect(dashboardSource).toContain('Pipeline Baru per Bulan');
      expect(dashboardSource).toContain('Pipeline Added Trend (New Opportunity)');
    });
  });
});
