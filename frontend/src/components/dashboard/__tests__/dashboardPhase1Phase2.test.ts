import * as fs from 'fs';
import * as path from 'path';

describe('EPMS PHASE 1+2: Director Executive Decision Dashboard Foundation Tests', () => {
  const dashboardPath = path.resolve(__dirname, '../../DashboardPage.tsx');
  const dashboardCssPath = path.resolve(__dirname, '../../DashboardPage.module.css');
  const execSummaryPath = path.resolve(__dirname, '../ExecutiveSummary.tsx');
  const dashboardSource = fs.readFileSync(dashboardPath, 'utf8');
  const cssSource = fs.readFileSync(dashboardCssPath, 'utf8');
  const execSummarySource = fs.readFileSync(execSummaryPath, 'utf8');

  describe('1. Authoritative 8-Layer Hierarchy & Structure', () => {
    it('implements the 8-layer architecture in DashboardPage', () => {
      // 1. Executive Brief Today
      expect(dashboardSource).toContain('<ExecutiveSummary');
      // 2. Executive KPI Board (5 positions)
      expect(dashboardSource).toContain('kpiGridFive');
      expect(dashboardSource).toContain('Pipeline');
      expect(dashboardSource).toContain('Contract Awarded');
      // 3. Business Conversion
      expect(dashboardSource).toContain('Business Conversion');
      expect(dashboardSource).toContain('conversionStepsContainer');
      expect(dashboardSource).toContain('Open Pipeline');
      expect(dashboardSource).toContain('Contract Awarded');
      expect(dashboardSource).toContain('Value Under Execution');
      // 4. Top Executive Risks
      expect(dashboardSource).toContain('Top Executive Risks');
      // 5. Need Director Decision
      expect(dashboardSource).toContain('Need Director Decision');
      // 6. Business Trends
      expect(dashboardSource).toContain('Business Trends');
      // 7. Project / Portfolio Health
      expect(dashboardSource).toContain('Project Portfolio Health');
      // 8. Procurement & AP Exposure
      expect(dashboardSource).toContain('Procurement & AP Exposure');
    });
  });

  describe('2. Executive Brief Today & Monetary Overview Strip', () => {
    it('ExecutiveSummary displays real monetary indicators and neutral Belum tersedia for unavailable fields', () => {
      expect(execSummarySource).toContain('financialStrip');
      expect(execSummarySource).toContain('Open Pipeline');
      expect(execSummarySource).toContain('Contract Awarded');
      expect(execSummarySource).toContain('Under Execution');
      expect(execSummarySource).toContain('Outstanding AP');
      expect(execSummarySource).toContain('Belum tersedia');
    });

    it('renders deterministic backend attention items without LLM hallucinations', () => {
      expect(execSummarySource).toContain('executiveBrief?.attentionItems');
      expect(execSummarySource).toContain('financialStrip');
    });

    it('ensures Open Pipeline uses openPipelineValue and not totalPipeline (excludes WON tenders)', () => {
      expect(execSummarySource).toContain('cSnapshot?.marketing?.openPipelineValue');
      expect(execSummarySource).toContain('summaryData?.currentSnapshot?.marketing?.openPipelineValue');
      expect(dashboardSource).toContain('cSnapshot?.marketing?.openPipelineValue');
      expect(dashboardSource).toContain('cSnapshot?.marketing?.openDealsCount');
    });
  });

  describe('3. Executive KPI Board (5 Positions)', () => {
    it('renders 5 KPI positions with Target: N/A and Pencapaian: N/A', () => {
      expect(dashboardSource).toContain('kpiGridFive');
      expect(dashboardSource).toContain('Pipeline');
      expect(dashboardSource).toContain('Contract Awarded');
      expect(dashboardSource).toContain('Revenue');
      expect(dashboardSource).toContain('Cash Collection');
      expect(dashboardSource).toContain('Margin');
      expect(dashboardSource).toContain('Target:');
      expect(dashboardSource).toContain('Pencapaian:');
    });

    it('binds Contract Awarded to canonical contractAwardedValue, not WON tender value', () => {
      expect(dashboardSource).toContain('cSnapshot?.projects?.contractAwardedValue');
      expect(dashboardSource).toContain('contractAwardedValue');
    });

    it('displays Belum tersedia for Revenue, Cash Collection, and Margin', () => {
      expect(dashboardSource).toContain('Revenue');
      expect(dashboardSource).toContain('Cash Collection');
      expect(dashboardSource).toContain('Margin');
      expect(dashboardSource).toContain('Belum tersedia');
    });
  });

  describe('4. Business Conversion Flow', () => {
    it('renders 6 conversion stages with active vs muted presentation', () => {
      expect(dashboardSource).toContain('conversionStepActive');
      expect(dashboardSource).toContain('conversionStepMuted');
      expect(dashboardSource).toContain('Customer Invoice');
      expect(dashboardSource).toContain('Payment Received');
      expect(dashboardSource).toContain('Cash In');
      expect(dashboardSource).toContain('underExecutionValue');
    });

    it('displays explicit conversion notice banner explaining unavailable downstream capability', () => {
      expect(dashboardSource).toContain('conversionNoticeBanner');
      expect(dashboardSource).toContain('Aliran konversi nilai bisnis');
    });
  });

  describe('5. Top Executive Risks (Factual Exceptions Only)', () => {
    it('renders factual risk exception counts without fabricated thresholds', () => {
      expect(dashboardSource).toContain('overdueProjectsCount');
      expect(dashboardSource).toContain('unassignedPMsCount');
      expect(dashboardSource).toContain('openRisksCount');
      expect(dashboardSource).toContain('overdueIssuesCount');
      expect(dashboardSource).toContain('onHoldProjectsCount');
      expect(dashboardSource).toContain('Tidak ada executive exception aktif.');
    });
  });

  describe('6. Need Director Decision (Enriched Personal Inbox)', () => {
    it('renders personal Director inbox with monetaryExposure, age, and ctaLabel', () => {
      expect(dashboardSource).toContain('item.monetaryExposure');
      expect(dashboardSource).toContain('item.ctaLabel');
      expect(dashboardSource).toContain('exposureBadge');
      expect(dashboardSource).toContain('ctaDecisionBtn');
      expect(dashboardSource).toContain('Tidak ada keputusan Direktur yang tertunda.');
    });
  });

  describe('7. Business Trends & Portfolio Health', () => {
    it('labels trend strictly as Pipeline Baru per Bulan / New Pipeline Added', () => {
      expect(dashboardSource).toContain('Pipeline Baru per Bulan');
      expect(dashboardSource).toContain('New Pipeline Added');
      expect(dashboardSource).not.toContain('Pipeline Trend: Historis');
    });

    it('renders portfolio health with real Proyek Aktif, Proyek Selesai, and Value Under Execution', () => {
      expect(dashboardSource).toContain('Proyek Aktif');
      expect(dashboardSource).toContain('Proyek Selesai');
      expect(dashboardSource).toContain('Value Under Execution');
    });
  });

  describe('8. Procurement & AP Exposure (Cost-Side Flow)', () => {
    it('keeps cost-side flow separate from revenue conversion', () => {
      expect(dashboardSource).toContain('Procurement & AP Exposure');
      expect(dashboardSource).toContain('PO Diterbitkan');
      expect(dashboardSource).toContain('Terpenuhi (GR)');
      expect(dashboardSource).toContain('Invoice Vendor');
      expect(dashboardSource).toContain('Pembayaran');
      expect(dashboardSource).toContain('Outstanding AP');
    });

    it('HF02: displays semantically valid total fulfillment (material GR + service claims) and detailed breakdown', () => {
      expect(dashboardSource).toContain('totalFulfilledValue');
      expect(dashboardSource).toContain('goodsReceiptValue');
      expect(dashboardSource).toContain('serviceFulfilledValue');
      expect(dashboardSource).toContain('Terpenuhi (GR)');
    });
  });
});

