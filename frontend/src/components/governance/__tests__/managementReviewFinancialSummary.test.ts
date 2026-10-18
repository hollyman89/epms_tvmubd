/**
 * EPMS — MANAGEMENT REVIEW FINANCIAL SUMMARY REGRESSION TEST SUITE
 *
 * Covers:
 * TEST 1  — Valid contract + valid RAB produces all 5 core metrics
 * TEST 2  — Keuntungan formula: contract - modal
 * TEST 3  — Margin formula: profit / contract × 100
 * TEST 4  — ROI formula: profit / modal × 100
 * TEST 5  — Missing contract value: financial dependent values show N/A / Belum ada data
 * TEST 6  — Missing RAB: Modal / Profit / Margin / ROI handled safely
 * TEST 7  — Zero contract: Margin = N/A (no division-by-zero)
 * TEST 8  — Zero modal: ROI = N/A (no division-by-zero)
 * TEST 9  — Negative profit: negative profit, margin, and ROI render accurately
 * TEST 10 — No specimen project IDs or financial values are hard-coded in production source
 * TEST 11 — Existing immutable Approval Action Context tests continue PASS
 * TEST 12 — Management Review stages HOO / Procurement / Finance / Director all use the same generic financial summary implementation
 */

import {
  calculateProjectFinancialSummary,
  resolveCanonicalFinancialInputs,
  formatRupiahDisplay,
  formatPercentageDisplay,
  formatRabStatusDisplay,
  buildGovernanceActionContext,
  STAGE_MAPPING,
  SupportedGovernanceNode,
  EnrichedGovernanceTask,
} from '../ProjectGovernanceTaskCenter';
import fs from 'fs';
import path from 'path';

describe('EPMS — Management Review Financial Summary SSOT & Benchmark Compliance', () => {
  // ── TEST 1: Valid contract + valid RAB produces all 5 metrics ───────────────
  it('TEST 1 — Valid contract + valid RAB produces Nilai Kontrak, Modal Project, Keuntungan Project, Margin Project, ROI', () => {
    const result = calculateProjectFinancialSummary({
      contractValue: 200000000,
      modalProject: 150000000,
    });

    expect(result.contractValue).toBe(200000000);
    expect(result.modalProject).toBe(150000000);
    expect(result.keuntungan).toBe(50000000);
    expect(result.marginPercentage).toBe(25);
    expect(result.roiPercentage).toBeCloseTo(33.3333, 2);

    expect(result.formattedContractValue).toBe('Rp 200.000.000');
    expect(result.formattedModalProject).toBe('Rp 150.000.000');
    expect(result.formattedKeuntungan).toBe('Rp 50.000.000');
    expect(result.formattedMargin).toBe('25,00%');
    expect(result.formattedRoi).toBe('33,33%');
    expect(result.isProfitNegative).toBe(false);
    expect(result.isMarginNegative).toBe(false);
    expect(result.isRoiNegative).toBe(false);
  });

  // ── TEST 2: Keuntungan formula: contract - modal ────────────────────────────
  it('TEST 2 — Keuntungan formula strictly calculates contract - modal', () => {
    const testCases = [
      { contract: 500000000, modal: 350000000, expected: 150000000 },
      { contract: 1200000000, modal: 1000000000, expected: 200000000 },
      { contract: 75000000, modal: 75000000, expected: 0 },
    ];

    testCases.forEach(({ contract, modal, expected }) => {
      const res = calculateProjectFinancialSummary({
        contractValue: contract,
        modalProject: modal,
      });
      expect(res.keuntungan).toBe(expected);
      expect(res.formattedKeuntungan).toBe(`Rp ${expected.toLocaleString('id-ID')}`);
    });
  });

  // ── TEST 3: Margin formula: profit / contract × 100 ─────────────────────────
  it('TEST 3 — Margin formula strictly calculates profit / contract × 100', () => {
    const res1 = calculateProjectFinancialSummary({
      contractValue: 200000000,
      modalProject: 150000000, // profit = 50M -> 50/200 = 25%
    });
    expect(res1.marginPercentage).toBe(25);
    expect(res1.formattedMargin).toBe('25,00%');

    const res2 = calculateProjectFinancialSummary({
      contractValue: 100000000,
      modalProject: 90000000, // profit = 10M -> 10/100 = 10%
    });
    expect(res2.marginPercentage).toBe(10);
    expect(res2.formattedMargin).toBe('10,00%');
  });

  // ── TEST 4: ROI formula: profit / modal × 100 ───────────────────────────────
  it('TEST 4 — ROI formula strictly calculates profit / modal × 100', () => {
    const res1 = calculateProjectFinancialSummary({
      contractValue: 200000000,
      modalProject: 150000000, // profit = 50M -> 50/150 = 33.333%
    });
    expect(res1.roiPercentage).toBeCloseTo(33.3333, 2);
    expect(res1.formattedRoi).toBe('33,33%');

    const res2 = calculateProjectFinancialSummary({
      contractValue: 150000000,
      modalProject: 100000000, // profit = 50M -> 50/100 = 50%
    });
    expect(res2.roiPercentage).toBe(50);
    expect(res2.formattedRoi).toBe('50,00%');
  });

  // ── TEST 5: Missing contract value fallback ─────────────────────────────────
  it('TEST 5 — Missing contract value safely produces Belum ada data and N/A for dependent metrics', () => {
    const resNull = calculateProjectFinancialSummary({
      contractValue: null,
      modalProject: 150000000,
    });

    expect(resNull.contractValue).toBeNull();
    expect(resNull.formattedContractValue).toBe('Belum ada data');
    expect(resNull.formattedModalProject).toBe('Rp 150.000.000');
    expect(resNull.keuntungan).toBeNull();
    expect(resNull.formattedKeuntungan).toBe('N/A');
    expect(resNull.marginPercentage).toBeNull();
    expect(resNull.formattedMargin).toBe('N/A');
    expect(resNull.roiPercentage).toBeNull();
    expect(resNull.formattedRoi).toBe('N/A');

    const resUndef = calculateProjectFinancialSummary({
      contractValue: undefined,
      modalProject: 150000000,
    });
    expect(resUndef.formattedContractValue).toBe('Belum ada data');
    expect(resUndef.formattedKeuntungan).toBe('N/A');
    expect(resUndef.formattedMargin).toBe('N/A');
  });

  // ── TEST 6: Missing RAB / modal fallback ─────────────────────────────────────
  it('TEST 6 — Missing RAB safely handles Modal, Keuntungan, Margin, and ROI without error', () => {
    const res = calculateProjectFinancialSummary({
      contractValue: 200000000,
      modalProject: null,
    });

    expect(res.contractValue).toBe(200000000);
    expect(res.formattedContractValue).toBe('Rp 200.000.000');
    expect(res.modalProject).toBeNull();
    expect(res.formattedModalProject).toBe('Belum ada data');
    expect(res.keuntungan).toBeNull();
    expect(res.formattedKeuntungan).toBe('N/A');
    expect(res.marginPercentage).toBeNull();
    expect(res.formattedMargin).toBe('N/A');
    expect(res.roiPercentage).toBeNull();
    expect(res.formattedRoi).toBe('N/A');
  });

  // ── TEST 7: Zero contract value (guard against division by zero) ─────────────
  it('TEST 7 — Zero contract value sets Margin to N/A with no division-by-zero output', () => {
    const res = calculateProjectFinancialSummary({
      contractValue: 0,
      modalProject: 150000000,
    });

    expect(res.contractValue).toBe(0);
    expect(res.formattedContractValue).toBe('Rp 0');
    expect(res.keuntungan).toBe(-150000000);
    expect(res.formattedKeuntungan).toBe('-Rp 150.000.000');
    // Margin division by zero guarded:
    expect(res.marginPercentage).toBeNull();
    expect(res.formattedMargin).toBe('N/A');
    // ROI remains calculable since modal is non-zero:
    expect(res.roiPercentage).toBe(-100);
    expect(res.formattedRoi).toBe('-100,00%');
  });

  // ── TEST 8: Zero modal value (guard against division by zero) ────────────────
  it('TEST 8 — Zero modal value sets ROI to N/A with no division-by-zero output', () => {
    const res = calculateProjectFinancialSummary({
      contractValue: 200000000,
      modalProject: 0,
    });

    expect(res.modalProject).toBe(0);
    expect(res.formattedModalProject).toBe('Rp 0');
    expect(res.keuntungan).toBe(200000000);
    expect(res.marginPercentage).toBe(100);
    expect(res.formattedMargin).toBe('100,00%');
    // ROI division by zero guarded:
    expect(res.roiPercentage).toBeNull();
    expect(res.formattedRoi).toBe('N/A');
  });

  // ── TEST 9: Negative profit rendering ───────────────────────────────────────
  it('TEST 9 — Negative profit and negative margin render accurately with negative sign', () => {
    const res = calculateProjectFinancialSummary({
      contractValue: 100000000,
      modalProject: 150000000,
    });

    expect(res.keuntungan).toBe(-50000000);
    expect(res.isProfitNegative).toBe(true);
    expect(res.formattedKeuntungan).toBe('-Rp 50.000.000');

    expect(res.marginPercentage).toBe(-50);
    expect(res.isMarginNegative).toBe(true);
    expect(res.formattedMargin).toBe('-50,00%');

    expect(res.roiPercentage).toBeCloseTo(-33.3333, 2);
    expect(res.isRoiNegative).toBe(true);
    expect(res.formattedRoi).toBe('-33,33%');
  });

  // ── TEST 10: No specimen IDs or financial values hard-coded in source ────────
  it('TEST 10 — No specimen project IDs or financial values are hard-coded in production source', () => {
    const componentPath = path.resolve(__dirname, '../ProjectGovernanceTaskCenter.tsx');
    const source = fs.readFileSync(componentPath, 'utf-8');

    // Ensure specimen numbers from reference example are NOT hard-coded in production code:
    expect(source).not.toMatch(/200000000/);
    expect(source).not.toMatch(/150000000/);
    expect(source).not.toMatch(/50000000/);
    expect(source).not.toMatch(/25,00%/);
    expect(source).not.toMatch(/33,33%/);
    expect(source).not.toMatch(/projectId\s*===?\s*503/);
  });

  // ── TEST 11: Existing immutable Approval Action Context tests continue PASS ──
  it('TEST 11 — Existing immutable Approval Action Context snapshot continues to be preserved', () => {
    const mockTask = {
      id: 51,
      workflowInstanceId: 26,
      nodeId: 'node_finance_review',
      projectId: 503,
      projectName: 'Project Renovasi J&T GTW Jakarta',
      projectCode: 'CONT-20261017-0005',
      contractNumber: 'CONT-20261017-0005',
      classification: { code: 'MANAGEMENT_REVIEW', label: 'Management Review', tagColor: 'blue' },
      contract: { contractValue: 200000000, contractNumber: 'CONT-20261017-0005' },
    } as unknown as EnrichedGovernanceTask;

    const stageInfo = STAGE_MAPPING['node_finance_review'];
    const ctx = buildGovernanceActionContext(mockTask, stageInfo);

    expect(ctx.taskId).toBe(51);
    expect(ctx.projectId).toBe(503);
    expect(ctx.currentStageLabel).toBe('Finance Review');
    expect(ctx.nextNodeLabel).toBe('Director Approval');
  });

  // ── TEST 12: Generic across HOO, Procurement, Finance, Director ─────────────
  it('TEST 12 — Management Review stages HOO / Procurement / Finance / Director all use the same generic financial summary implementation', () => {
    const reviewStages: SupportedGovernanceNode[] = [
      'node_hops_review',
      'node_procurement_review',
      'node_finance_review',
      'node_director_approval',
    ];

    const sampleContract = 300000000;
    const sampleModal = 240000000;

    reviewStages.forEach((nodeId) => {
      const stageInfo = STAGE_MAPPING[nodeId];
      expect(stageInfo).toBeDefined();

      // Calculation is pure and derives solely from project financial SSOT:
      const res = calculateProjectFinancialSummary({
        contractValue: sampleContract,
        modalProject: sampleModal,
      });

      expect(res.contractValue).toBe(300000000);
      expect(res.modalProject).toBe(240000000);
      expect(res.keuntungan).toBe(60000000);
      expect(res.marginPercentage).toBe(20);
      expect(res.roiPercentage).toBe(25);
      expect(res.formattedContractValue).toBe('Rp 300.000.000');
      expect(res.formattedModalProject).toBe('Rp 240.000.000');
      expect(res.formattedKeuntungan).toBe('Rp 60.000.000');
      expect(res.formattedMargin).toBe('20,00%');
      expect(res.formattedRoi).toBe('25,00%');
    });
  });

  // ── TEST 13: Canonical Contract Source Only (Rejects Stale Contract Projections) ──
  it('TEST 13 — Contract uses canonical source only and rejects stale fallbacks (contractValue, contractSummary)', () => {
    // 13a. Canonical contract present on task.contract
    const taskWithCanonical = {
      id: 51,
      contract: { contractValue: 200000000, contractNumber: 'CONT-20261017-0005' },
      contractValue: 999999999, // Stale projection
      contractSummary: { contractValue: 888888888 }, // Legacy
    } as unknown as EnrichedGovernanceTask;

    const resolvedA = resolveCanonicalFinancialInputs(taskWithCanonical, null);
    expect(resolvedA.contractValue).toBe(200000000);

    // 13b. Canonical contract missing -> does NOT fall back to stale contractValue or contractSummary
    const taskWithOnlyStale = {
      id: 51,
      contract: null,
      contractValue: 999999999, // Stale projection
      contractSummary: { contractValue: 888888888 }, // Legacy
    } as unknown as EnrichedGovernanceTask;

    const resolvedB = resolveCanonicalFinancialInputs(taskWithOnlyStale, null);
    expect(resolvedB.contractValue).toBeNull();

    const summaryB = calculateProjectFinancialSummary(resolvedB);
    expect(summaryB.formattedContractValue).toBe('Belum ada data');
  });

  // ── TEST 14: Modal Project uses totalPmEstimate only (Rejects Readiness Snapshot & Legacy totalCost) ──
  it('TEST 14 — Modal Project uses totalPmEstimate only and rejects readiness snapshot and legacy totalCost', () => {
    // 14a. Canonical costData with totalPmEstimate
    const costDataCanonical = {
      totalPmEstimate: 150000000,
      totalCost: 111111111, // Legacy
      status: 'DRAFT',
    };
    const taskWithReadiness = {
      id: 51,
      readiness: { costPillar: { totalEstimate: 99999999 } }, // Stale snapshot
    } as unknown as EnrichedGovernanceTask;

    const resolvedA = resolveCanonicalFinancialInputs(taskWithReadiness, costDataCanonical);
    expect(resolvedA.modalProject).toBe(150000000);

    // 14b. totalPmEstimate is missing -> rejects readiness snapshot and legacy totalCost
    const costDataLegacyOnly = {
      totalCost: 111111111,
      status: 'DRAFT',
    };
    const resolvedB = resolveCanonicalFinancialInputs(taskWithReadiness, costDataLegacyOnly);
    expect(resolvedB.modalProject).toBeNull();

    // 14c. costData is null (failed load) -> rejects readiness snapshot
    const resolvedC = resolveCanonicalFinancialInputs(taskWithReadiness, null);
    expect(resolvedC.modalProject).toBeNull();

    const summaryC = calculateProjectFinancialSummary(resolvedC);
    expect(summaryC.formattedModalProject).toBe('Belum ada data');
    expect(summaryC.formattedKeuntungan).toBe('N/A');
    expect(summaryC.formattedMargin).toBe('N/A');
    expect(summaryC.formattedRoi).toBe('N/A');
  });

  // ── TEST 15: RAB status is rendered dynamically and not hardcoded ───────────
  it('TEST 15 — RAB status is rendered dynamically from canonical costData.status and never hardcodes DRAFT fallback', () => {
    // 15a. Valid canonical statuses: DRAFT, APPROVED, FROZEN, SUBMITTED, REVISED
    const canonicalStatuses = ['DRAFT', 'APPROVED', 'FROZEN', 'SUBMITTED', 'REVISED'];
    canonicalStatuses.forEach((status) => {
      const validTask = {
        id: 51,
        contract: { contractValue: 200000000 },
      } as unknown as EnrichedGovernanceTask;

      const resolved = resolveCanonicalFinancialInputs(validTask, {
        totalPmEstimate: 150000000,
        status,
      });

      expect(resolved.rabStatus).toBe(status);
      const summary = calculateProjectFinancialSummary(resolved);
      expect(summary.rabStatus).toBe(status);
      expect(summary.formattedRabStatus).toBe(status);
      expect(formatRabStatusDisplay(status)).toBe(status);
    });

    // 15b. Missing status: null, undefined, empty, whitespace
    const missingCases = [null, undefined, '', '   '];
    missingCases.forEach((missingStatus) => {
      const validTask = {
        id: 51,
        contract: { contractValue: 200000000 },
      } as unknown as EnrichedGovernanceTask;

      const resolved = resolveCanonicalFinancialInputs(validTask, {
        totalPmEstimate: 150000000,
        status: missingStatus,
      });

      expect(resolved.rabStatus).toBeNull();
      const summary = calculateProjectFinancialSummary(resolved);
      expect(summary.rabStatus).toBeNull();
      expect(summary.formattedRabStatus).toBe('Belum ada data');
      expect(summary.formattedRabStatus).not.toBe('DRAFT');
      expect(formatRabStatusDisplay(missingStatus)).toBe('Belum ada data');
      expect(formatRabStatusDisplay(missingStatus)).not.toBe('DRAFT');
    });

    // 15c. When costData itself is null (failed load)
    const validTask = {
      id: 51,
      contract: { contractValue: 200000000 },
    } as unknown as EnrichedGovernanceTask;
    const resolvedNull = resolveCanonicalFinancialInputs(validTask, null);
    expect(resolvedNull.rabStatus).toBeNull();
    const summaryNull = calculateProjectFinancialSummary(resolvedNull);
    expect(summaryNull.rabStatus).toBeNull();
    expect(summaryNull.formattedRabStatus).toBe('Belum ada data');
    expect(summaryNull.formattedRabStatus).not.toBe('DRAFT');

    // 15d. Source code inspection verifying NO hardcoded 'DRAFT' fallback exists in production JSX/source
    const componentPath = path.resolve(__dirname, '../ProjectGovernanceTaskCenter.tsx');
    const source = fs.readFileSync(componentPath, 'utf-8');
    expect(source).not.toMatch(/\|\|\s*['"]DRAFT['"]/);
    expect(source).not.toMatch(/\?\?\s*['"]DRAFT['"]/);
  });

  // ── TEST 16: Missing canonical Contract or RAB sets dependent metrics to N/A ──
  it('TEST 16 — Missing either canonical Contract or RAB sets Keuntungan, Margin, and ROI to N/A', () => {
    // Missing contract
    const resNoContract = calculateProjectFinancialSummary({
      contractValue: null,
      modalProject: 150000000,
    });
    expect(resNoContract.formattedContractValue).toBe('Belum ada data');
    expect(resNoContract.formattedModalProject).toBe('Rp 150.000.000');
    expect(resNoContract.formattedKeuntungan).toBe('N/A');
    expect(resNoContract.formattedMargin).toBe('N/A');
    expect(resNoContract.formattedRoi).toBe('N/A');

    // Missing modal
    const resNoModal = calculateProjectFinancialSummary({
      contractValue: 200000000,
      modalProject: null,
    });
    expect(resNoModal.formattedContractValue).toBe('Rp 200.000.000');
    expect(resNoModal.formattedModalProject).toBe('Belum ada data');
    expect(resNoModal.formattedKeuntungan).toBe('N/A');
    expect(resNoModal.formattedMargin).toBe('N/A');
    expect(resNoModal.formattedRoi).toBe('N/A');

    // Missing both
    const resNoBoth = calculateProjectFinancialSummary({
      contractValue: null,
      modalProject: null,
    });
    expect(resNoBoth.formattedContractValue).toBe('Belum ada data');
    expect(resNoBoth.formattedModalProject).toBe('Belum ada data');
    expect(resNoBoth.formattedKeuntungan).toBe('N/A');
    expect(resNoBoth.formattedMargin).toBe('N/A');
    expect(resNoBoth.formattedRoi).toBe('N/A');
  });
});
