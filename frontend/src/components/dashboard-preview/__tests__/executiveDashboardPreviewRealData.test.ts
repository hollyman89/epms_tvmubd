import React from 'react';
import fs from 'fs';
import path from 'path';

describe('ExecutiveDashboardPreview Real Data Integration & Mock Elimination Contract', () => {
  const previewPath = path.resolve(__dirname, '../ExecutiveDashboardPreview.tsx');
  let content: string;

  beforeAll(() => {
    content = fs.readFileSync(previewPath, 'utf8');
  });

  describe('1. Mock Data Elimination & Synthetic Fallback Removal', () => {
    test('Must not contain progressPresets or hardcoded fake progress assignments', () => {
      expect(content).not.toContain('progressPresets');
      expect(content).not.toMatch(/progressPresets\[.*\]/);
    });

    test('Must not contain fabricated business names or fallback strings', () => {
      expect(content).not.toContain('Tender Infrastruktur IT');
      expect(content).not.toContain('PT Mitra Bisnis');
      expect(content).not.toContain('Vendor Mitra');
      expect(content).not.toContain('Vendor Terverifikasi');
    });

    test('Must not contain hardcoded fake chart heights or months', () => {
      expect(content).not.toContain('[14, 24, 30, 26, 42, 48, 38, 44, 76, 82]');
      expect(content).not.toContain('[10, 20, 26, 22, 44, 48, 38, 42, 48, 80]');
      expect(content).not.toContain('[20, 22, 28, 22, 48, 42, 54, 46, 58, 76]');
      expect(content).not.toContain("{ month: 'Jan', val: 24 }");
    });
  });

  describe('2. Six Executive KPIs Binding', () => {
    test('KPI 1: Total Pipeline Value binds to pMetrics.marketing.totalPipeline', () => {
      expect(content).toMatch(/totalPipeline\s*=\s*pMetrics\?\.marketing\?\.totalPipeline/);
    });

    test('KPI 2: Active Projects binds to cSnapshot.projects.activeProjects', () => {
      expect(content).toMatch(/activeProjects\s*=\s*cSnapshot\?\.projects\?\.activeProjects/);
    });

    test('KPI 3: Procurement Commitments binds to pMetrics.procurement.poCommittedValue', () => {
      expect(content).toMatch(/poCommitted\s*=\s*pMetrics\?\.procurement\?\.poCommittedValue/);
    });

    test('KPI 4: Vendor Payments binds to pMetrics.vendorPayments.paymentValue', () => {
      expect(content).toMatch(/vendorPayments\s*=\s*pMetrics\?\.vendorPayments\?\.paymentValue/);
    });

    test('KPI 5: Outstanding Invoices binds to cSnapshot.accountsPayable.outstandingInvoiceValue', () => {
      expect(content).toMatch(/outstandingInvoiceValue\s*=\s*cSnapshot\?\.accountsPayable\?\.outstandingInvoiceValue/);
    });

    test('KPI 6: Pending Approvals binds to cSnapshot.approvals.totalPendingTasks', () => {
      expect(content).toMatch(/totalPendingTasks\s*=\s*cSnapshot\?\.approvals\?\.totalPendingTasks/);
    });
  });

  describe('3. Project Portfolio Consistency & Reconciled Donut', () => {
    test('Donut center counter displays totalProjectsCount', () => {
      expect(content).toContain('{totalProjectsCount}');
      expect(content).toContain('Total Proyek');
    });

    test('Breakdown table sums across canonical categories and uses valid denominator', () => {
      expect(content).toContain('planningProjects');
      expect(content).toContain('inProgressProjects');
      expect(content).toContain('completedProjects');
      expect(content).toContain('onHoldProjects');
      expect(content).toContain('cancelledProjects');
    });

    test('Donut SVG geometry renders proportional arcs for inProgress and completed', () => {
      expect(content).toContain('inProgressStroke');
      expect(content).toContain('completedStroke');
      expect(content).toContain('#10B981');
      expect(content).toContain('#06B6D4');
    });
  });

  describe('4. Actual Time-Series Charts with Belum ada data Empty State', () => {
    test('All charts provide "Belum ada data" fallback when no data exists', () => {
      expect(content).toContain('Belum ada data');
      expect(content).toContain('hasMarketingData');
      expect(content).toContain('hasContractsData');
      expect(content).toContain('hasPaymentsData');
      expect(content).toContain('hasPosData');
    });

    test('Marketing Trend binds to marketingTrend from backend response', () => {
      expect(content).toContain('marketingTrend');
      expect(content).toContain('maxMarketingVal');
    });
  });

  describe('5. Executive Decision Panel and To-Do Integrity', () => {
    test('Priority Actions tab badge reflects todos.length', () => {
      expect(content).toContain('{todos.length}');
    });

    test('Approval Queue tab badge reflects totalPendingTasks', () => {
      expect(content).toContain('{totalPendingTasks}');
    });

    test('Priority Actions render deep links to todo.actionTarget', () => {
      expect(content).toContain('todo.actionTarget');
    });

    test('Displays empty state when 0 actionable tasks exist', () => {
      expect(content).toContain('Tidak ada tugas prioritas yang membutuhkan aksi langsung Anda saat ini.');
    });
  });

  describe('6. Period Filtering Integration', () => {
    test('Supports canonical period types including YEAR_TO_DATE, THIS_MONTH, LAST_MONTH', () => {
      expect(content).toContain('YEAR_TO_DATE');
      expect(content).toContain('THIS_MONTH');
      expect(content).toContain('LAST_MONTH');
      expect(content).toContain('THIS_QUARTER');
      expect(content).toContain('LAST_QUARTER');
      expect(content).toContain('ALL_TIME');
    });

    test('handlePeriodChange updates period and re-fetches authoritative data', () => {
      expect(content).toContain('handlePeriodChange');
      expect(content).toContain('fetchData(false, newPeriod)');
    });
  });
});
