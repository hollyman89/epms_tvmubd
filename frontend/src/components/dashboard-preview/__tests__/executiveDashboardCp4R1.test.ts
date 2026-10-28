import fs from 'fs';
import path from 'path';

describe('CP4-R1: Executive Dashboard Data Accuracy & Auto-Refresh Tests', () => {
  const previewPath = path.resolve(__dirname, '../ExecutiveDashboardPreview.tsx');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(previewPath, 'utf8');
  });

  describe('F1: Period Support & Zero Cross-Company Leakage', () => {
    test('PERIOD_OPTIONS includes ALL_TIME option', () => {
      expect(content).toContain("value: 'ALL_TIME'");
      expect(content).toContain("label: 'Semua Waktu'");
    });

    test('Does NOT contain legacy un-scoped fallback endpoints (/project/operational-board, /procurement/purchase-orders, etc.)', () => {
      expect(content).not.toContain('/project/operational-board');
      expect(content).not.toContain('/marketing/tenders?limit=4');
      expect(content).not.toContain('/procurement/purchase-orders');
      expect(content).not.toContain('/finance/invoices?limit=4');
      expect(content).not.toContain('/contracts');
      expect(content).not.toContain('/finance/payments');
    });

    test('Clears operational datasets to empty on summary failure instead of leaking global data', () => {
      expect(content).toContain('setContractsMonthly([]);');
      expect(content).toContain('setPaymentsMonthly([]);');
      expect(content).toContain('setPosMonthly([]);');
      expect(content).toContain('setProjectsList([]);');
      expect(content).toContain('setTendersList([]);');
      expect(content).toContain('setPosList([]);');
      expect(content).toContain('setInvoicesList([]);');
    });
  });

  describe('F2: Dynamic Reporting Year', () => {
    test('Does NOT have hardcoded Tahun 2026 in chart mini-dropdowns', () => {
      expect(content).not.toContain('<span>Tahun 2026</span>');
      expect(content).toContain('<span>Tahun {displayYear}</span>');
    });

    test('Dynamically computes period labels and displayYear', () => {
      expect(content).toContain('displayYear');
      expect(content).toContain('getDynamicPeriodOptions');
    });
  });

  describe('F3: Automatic Dashboard Refresh', () => {
    test('Configured with 60-second polling interval', () => {
      expect(content).toContain('60000');
      expect(content).toContain('setInterval(');
      expect(content).toContain('clearInterval(intervalId)');
    });

    test('Includes document visibility revalidation and online listeners', () => {
      expect(content).toContain("document.visibilityState === 'visible'");
      expect(content).toContain("addEventListener('visibilitychange'");
      expect(content).toContain("addEventListener('online'");
      expect(content).toContain("removeEventListener('visibilitychange'");
      expect(content).toContain("removeEventListener('online'");
    });

    test('Guards against in-flight requests and hidden tab polling', () => {
      expect(content).toContain('document.hidden');
      expect(content).toContain('inFlightRef');
    });
  });

  describe('F4: Finance Navigation Link', () => {
    test('Pembayaran & Tagihan Lihat Semua points to /finance/invoices (not /finance)', () => {
      expect(content).not.toContain('href="/finance"');
      expect(content).toContain('href="/finance/invoices"');
    });
  });

  describe('F6: Closed Project Value Period Clarity', () => {
    test('Displays Status Saat Ini indicator', () => {
      expect(content).toContain('Status Saat Ini');
    });

    test('Explains that closed project value does not follow period filter', () => {
      expect(content).toContain('Akumulasi proyek berstatus CLOSED — tidak mengikuti filter periode.');
    });
  });

  describe('F7: Active Project Status Badge', () => {
    test('Renders status dynamically based on p.status', () => {
      expect(content).toContain('p.status');
      expect(content).toContain('Sedang Eksekusi');
      expect(content).toContain('Perencanaan');
    });
  });
});
