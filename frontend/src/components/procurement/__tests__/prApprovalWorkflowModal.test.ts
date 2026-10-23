/**
 * EPMS — PR APPROVAL WORKFLOW MODAL TESTS
 *
 * Covers:
 * 1. Real PR data mapped correctly
 * 2. Missing optional data shows N/A or 'Belum ada data'
 * 3. No mock fallback is rendered
 * 4. Approved PR state
 * 5. Active RFQ CTA
 * 6. Cancelled RFQ CTA
 * 7. No RFQ CTA
 * 8. Workflow history sorting
 * 9. PR items count correct
 * 10. Responsive action area & role gating
 * 11. Loading state
 * 12. Error state
 */

import {
  resolvePrStatusConfig,
  deriveWorkflowSteps,
  formatPrInfoPresentation,
  resolveRfqCta,
  deriveWorkflowHistoryEvents,
  derivePrItemsMetrics,
  PrApprovalStatus,
  PrItemPresentation,
} from '../prApprovalWorkflow.utils';
import { WorkflowInstance, WorkflowTransition } from '@/services/workflowEngine.service';

describe('EPMS — PR Approval Workflow Modal Redesign Tests', () => {
  // ── 1. REAL PR DATA MAPPED CORRECTLY ──
  describe('1. Real PR Data Mapped Correctly', () => {
    it('should accurately format PR Number, Project Name, and IDR currency for Total Amount and WBS Allocation', () => {
      const presentation = formatPrInfoPresentation({
        prNumber: 'PR-20261023-001',
        projectName: 'PROJECT FIBER OPTIC JAKARTA',
        totalAmount: 15404970000,
        budgetAllocation: 15404970000,
        wbsTaskName: 'WBS Pengadaan Material & Peralatan',
        opPlanRef: 'OP-1',
        submittedBy: 'purchasing',
        submittedAt: '2026-10-23T15:43:00Z',
        financeReviewedBy: 'Finance User',
        financeReviewedAt: '2026-10-23T15:44:00Z',
        directorDecisionBy: 'Director',
        directorDecisionAt: '2026-10-23T15:44:30Z',
      });

      expect(presentation.prNumber).toBe('PR-20261023-001');
      expect(presentation.projectName).toBe('PROJECT FIBER OPTIC JAKARTA');
      expect(presentation.totalAmountText).toBe('Rp 15.404.970.000');
      expect(presentation.budgetAllocationText).toBe('Rp 15.404.970.000');
      expect(presentation.wbsReferenceText).toBe('WBS Pengadaan Material & Peralatan');
      expect(presentation.hasWbsReference).toBe(true);
      expect(presentation.gateText).toBe('OP-1');
      expect(presentation.hasGate).toBe(true);
      expect(presentation.submittedByText).toContain('purchasing');
      expect(presentation.financeReviewText).toContain('Finance User');
      expect(presentation.directorApprovalText).toContain('Director');
    });
  });

  // ── 2. MISSING OPTIONAL DATA SHOWS N/A / Belum ada data ──
  describe('2. Missing Optional Data Shows N/A / Belum ada data', () => {
    it('should output canonical fallbacks for missing fields without inventing values', () => {
      const presentation = formatPrInfoPresentation({
        prNumber: '',
        prId: undefined,
        projectName: undefined,
        totalAmount: null,
        budgetAllocation: null,
        wbsTaskName: null,
        opPlanRef: null,
        submittedBy: null,
        submittedAt: null,
        financeReviewedBy: null,
        financeReviewedAt: null,
        directorDecisionBy: null,
        directorDecisionAt: null,
      });

      expect(presentation.prNumber).toBe('Belum ada data');
      expect(presentation.projectName).toBe('Belum ada data');
      expect(presentation.totalAmountText).toBe('N/A');
      expect(presentation.budgetAllocationText).toBe('N/A');
      expect(presentation.wbsReferenceText).toBe('Belum ada data');
      expect(presentation.hasWbsReference).toBe(false);
      expect(presentation.gateText).toBe('Belum ada data');
      expect(presentation.hasGate).toBe(false);
      expect(presentation.submittedByText).toBe('N/A');
      expect(presentation.financeReviewText).toBe('Belum ada data');
      expect(presentation.directorApprovalText).toBe('Belum ada data');
    });
  });

  // ── 3. NO MOCK FALLBACK IS RENDERED ──
  describe('3. No Mock Fallback is Rendered', () => {
    it('should NEVER produce hardcoded mock actor or project strings and not fall back budget to total amount', () => {
      const presentation = formatPrInfoPresentation({
        prNumber: 'PR-TEST-99',
        projectName: '',
        totalAmount: 5000000,
        budgetAllocation: undefined,
        wbsTaskName: '',
        opPlanRef: '',
        submittedBy: '',
        financeReviewedBy: '',
        directorDecisionBy: '',
      });

      // Assert against forbidden mock strings
      expect(presentation.projectName).not.toBe('PROJECT PERCOBAAN UNTUK DEBUG');
      expect(presentation.projectName).not.toBe('[Proyek Tidak Terdefinisi]');
      expect(presentation.submittedByText).not.toBe('Procurement Team');
      expect(presentation.financeReviewText).not.toBe('Finance Team');
      expect(presentation.financeReviewText).not.toBe('Finance User');
      expect(presentation.directorApprovalText).not.toBe('Director');
      expect(presentation.wbsReferenceText).not.toBe('WBS Pengadaan Material & Peralatan');
      expect(presentation.gateText).not.toContain('(Approved by HOA)');
      expect(presentation.totalAmountText).toBe('Rp 5.000.000');
      expect(presentation.budgetAllocationText).toBe('N/A');
      expect(presentation.budgetAllocationText).not.toBe(presentation.totalAmountText);
    });

    it('should NEVER produce synthetic notes in history events when reason is absent', () => {
      const transitions: WorkflowTransition[] = [
        {
          id: 1,
          instanceId: 10,
          fromNodeId: 'node_start',
          toNodeId: 'node_finance_review',
          action: 'START',
          createdAt: '2026-10-23T15:43:00Z',
          versionId: 1,
          actor: { id: 1, fullName: 'purchasing', email: 'purchasing@epms.com' },
          reason: null, // No reason provided
        },
        {
          id: 2,
          instanceId: 10,
          fromNodeId: 'node_finance_review',
          toNodeId: 'node_director_approval',
          action: 'APPROVE',
          createdAt: '2026-10-23T15:44:00Z',
          versionId: 1,
          actor: { id: 2, fullName: 'Finance User', email: 'finance@epms.com' },
          reason: undefined, // No reason provided
        },
        {
          id: 3,
          instanceId: 10,
          fromNodeId: 'node_director_approval',
          toNodeId: 'node_end',
          action: 'APPROVE',
          createdAt: '2026-10-23T15:44:30Z',
          versionId: 1,
          actor: { id: 3, fullName: 'Director', email: 'director@epms.com' },
          reason: '', // Empty reason
        },
      ];

      const events = deriveWorkflowHistoryEvents({ transitions });

      events.forEach((ev) => {
        expect(ev.note).toBeNull();
        expect(ev.note).not.toBe('Anggaran dan kelayakan harga telah disetujui.');
        expect(ev.note).not.toBe('Pengadaan telah disetujui penuh.');
      });
    });
  });

  // ── 4. APPROVED PR STATE ──
  describe('4. Approved PR State', () => {
    it('should configure approved badge with emerald green semantics and mark all review steps completed', () => {
      const badgeCfg = resolvePrStatusConfig('APPROVED');
      expect(badgeCfg.label).toBe('PR Disetujui');
      expect(badgeCfg.color).toBe('#059669');

      const steps = deriveWorkflowSteps({
        status: 'APPROVED',
        activeRfq: null,
      });

      expect(steps).toHaveLength(4);
      expect(steps[0].state).toBe('COMPLETED'); // Procurement
      expect(steps[1].state).toBe('COMPLETED'); // Finance
      expect(steps[2].state).toBe('COMPLETED'); // Director
      expect(steps[3].state).toBe('ACTIVE');    // Procurement Next
      expect(steps[3].statusLabel).toBe('Siap Diproses');
    });

    it('should mark Procurement Next as completed when PO is issued', () => {
      const steps = deriveWorkflowSteps({
        status: 'PO_ISSUED',
      });
      expect(steps[3].state).toBe('COMPLETED');
      expect(steps[3].label).toBe('PO Diterbitkan');
      expect(steps[3].statusLabel).toBe('Selesai');
    });
  });

  // ── 5. ACTIVE RFQ CTA ──
  describe('5. Active RFQ CTA', () => {
    it('should resolve to "Kelola RFQ" when active RFQ is present', () => {
      const activeRfq = { id: 50, rfqNumber: 'RFQ-2026-001', status: 'OPEN' };
      const cta = resolveRfqCta(activeRfq, null);

      expect(cta.label).toBe('Kelola RFQ');
      expect(cta.buttonType).toBe('default');
      expect(cta.mode).toBe('MANAGE');
    });
  });

  // ── 6. CANCELLED RFQ CTA ──
  describe('6. Cancelled RFQ CTA', () => {
    it('should resolve to "Buat RFQ Baru" when latest RFQ is cancelled and no active RFQ exists', () => {
      const latestRfq = { id: 51, rfqNumber: 'RFQ-2026-002', status: 'CANCELLED' };
      const cta = resolveRfqCta(null, latestRfq);

      expect(cta.label).toBe('Buat RFQ Baru');
      expect(cta.buttonType).toBe('primary');
      expect(cta.mode).toBe('RECREATE');
    });
  });

  // ── 7. NO RFQ CTA ──
  describe('7. No RFQ CTA', () => {
    it('should resolve to canonical "Buat RFQ" when no RFQ exists', () => {
      const cta = resolveRfqCta(null, null);

      expect(cta.label).toBe('Buat RFQ');
      expect(cta.buttonType).toBe('primary');
      expect(cta.mode).toBe('CREATE');
    });
  });

  // ── 8. WORKFLOW HISTORY SORTING ──
  describe('8. Workflow History Sorting', () => {
    it('should sort history chronologically by actual timestamps and append pending tasks at the end', () => {
      const transitions: WorkflowTransition[] = [
        {
          id: 103,
          instanceId: 5,
          fromNodeId: 'node_director_approval',
          toNodeId: 'node_end',
          action: 'APPROVE',
          createdAt: '2026-10-23T15:44:30Z',
          versionId: 1,
          actor: { id: 3, fullName: 'Director' },
        },
        {
          id: 101,
          instanceId: 5,
          fromNodeId: 'node_start',
          toNodeId: 'node_finance_review',
          action: 'START',
          createdAt: '2026-10-23T15:43:00Z',
          versionId: 1,
          actor: { id: 1, fullName: 'purchasing' },
        },
        {
          id: 102,
          instanceId: 5,
          fromNodeId: 'node_finance_review',
          toNodeId: 'node_director_approval',
          action: 'APPROVE',
          createdAt: '2026-10-23T15:44:00Z',
          versionId: 1,
          actor: { id: 2, fullName: 'Finance User' },
        },
      ];

      const events = deriveWorkflowHistoryEvents({ transitions });

      expect(events).toHaveLength(3);
      // Event 1 must be earliest (submit at 15:43)
      expect(events[0].id).toBe('event_initial_pr_submit');
      expect(events[0].actor).toBe('purchasing');

      // Event 2 must be finance review (at 15:44)
      expect(events[1].id).toBe('trans_102');
      expect(events[1].actor).toBe('Finance User');

      // Event 3 must be director approval (at 15:44:30)
      expect(events[2].id).toBe('trans_103');
      expect(events[2].actor).toBe('Director');

      // Verify strict chronological timestamp sequence
      const time0 = new Date(events[0].timestamp!).getTime();
      const time1 = new Date(events[1].timestamp!).getTime();
      const time2 = new Date(events[2].timestamp!).getTime();
      expect(time0).toBeLessThanOrEqual(time1);
      expect(time1).toBeLessThanOrEqual(time2);
    });
  });

  // ── 9. PR ITEMS COUNT CORRECT ──
  describe('9. PR Items Count Correct and Metrics', () => {
    it('should calculate item count, total quantity, and subtotal accurately', () => {
      const items: PrItemPresentation[] = [
        {
          id: 1,
          itemName: 'Pole Accessories',
          quantity: 1200,
          uom: 'PCS',
          estimatedUnitPrice: 75000,
          totalPrice: 90000000,
        },
        {
          id: 2,
          itemName: 'Steel Pole 7m',
          quantity: 1200,
          uom: 'BATANG',
          estimatedUnitPrice: 1075000,
          totalPrice: 1290000000,
        },
        {
          id: 3,
          itemName: 'FO ADSS Cable 288 core',
          quantity: 178990,
          uom: 'MTR',
          estimatedUnitPrice: 78000,
          totalPrice: 13961220000,
        },
        {
          id: 4,
          itemName: 'HDPE Subduct 40/34',
          quantity: 3000,
          uom: 'MTR',
          estimatedUnitPrice: 21250,
          totalPrice: 63750000,
        },
      ];

      const metrics = derivePrItemsMetrics(items);

      expect(metrics.itemCount).toBe(4);
      expect(metrics.hasUom).toBe(true);
      expect(metrics.hasUnitPrice).toBe(true);
      expect(metrics.hasSubtotal).toBe(true);
      expect(metrics.totalQuantity).toBe(1200 + 1200 + 178990 + 3000);
      expect(metrics.totalCalculatedSubtotal).toBe(90000000 + 1290000000 + 13961220000 + 63750000);
      expect(metrics.totalCalculatedSubtotal).toBe(15404970000);
    });

    it('should handle items without unit price or subtotal gracefully', () => {
      const items: PrItemPresentation[] = [
        {
          itemName: 'Jasa Konsultasi',
          quantity: 1,
        },
      ];

      const metrics = derivePrItemsMetrics(items);
      expect(metrics.itemCount).toBe(1);
      expect(metrics.hasUom).toBe(false);
      expect(metrics.hasUnitPrice).toBe(false);
      expect(metrics.totalQuantity).toBe(1);
    });
  });

  // ── 10. RESPONSIVE ACTION AREA & REVISION HANDLING ──
  describe('10. Responsive Action Area & Revision Handling', () => {
    it('should mark Procurement step as REJECTED when PR is returned for revision', () => {
      const steps = deriveWorkflowSteps({
        status: 'REJECTED_TO_PROCUREMENT',
      });

      expect(steps[0].state).toBe('REJECTED');
      expect(steps[0].label).toBe('Perlu Perbaikan');
      expect(steps[0].statusLabel).toBe('Perlu Revisi');
    });

    it('should mark Finance step as ACTIVE when status is SUBMITTED', () => {
      const steps = deriveWorkflowSteps({
        status: 'SUBMITTED',
      });

      expect(steps[0].state).toBe('COMPLETED');
      expect(steps[1].state).toBe('ACTIVE');
      expect(steps[1].statusLabel).toBe('Sedang Berjalan');
      expect(steps[2].state).toBe('PENDING');
      expect(steps[3].state).toBe('PENDING');
    });

    it('should mark Director step as ACTIVE when status is DIRECTOR_APPROVAL', () => {
      const steps = deriveWorkflowSteps({
        status: 'DIRECTOR_APPROVAL',
      });

      expect(steps[0].state).toBe('COMPLETED');
      expect(steps[1].state).toBe('COMPLETED');
      expect(steps[2].state).toBe('ACTIVE');
      expect(steps[2].statusLabel).toBe('Sedang Berjalan');
      expect(steps[3].state).toBe('PENDING');
    });
  });

  // ── 11. LOADING STATE ──
  describe('11. Loading State', () => {
    it('should maintain initial empty state while loading workflow instance', () => {
      const presentation = formatPrInfoPresentation({
        prNumber: 'PR-LOADING',
        submittedBy: null,
        financeReviewedBy: null,
      });

      expect(presentation.submittedByText).toBe('N/A');
      expect(presentation.financeReviewText).toBe('Belum ada data');
    });
  });

  // ── 12. ERROR & FALLBACK STATE (NEVER SYNTHESIZE PR-${id}) ──
  describe('12. Error & Fallback State (Never Synthesize PR-${id})', () => {
    it('should cleanly represent fallback when PR ID cannot be resolved', () => {
      const presentation = formatPrInfoPresentation({
        prNumber: '',
        prId: undefined,
      });

      expect(presentation.prNumber).toBe('Belum ada data');
      expect(presentation.projectName).toBe('Belum ada data');
    });

    it('STRICT: should NEVER synthesize "PR-${id}" when real prNumber is empty or missing', () => {
      // Test cases where PR id is known but prNumber is missing or blank
      const cases = [
        { prId: 14, prNumber: '' },
        { prId: 14, prNumber: '   ' },
        { prId: 99, prNumber: undefined },
        { prId: '100', prNumber: '' },
      ];

      cases.forEach((c) => {
        const presentation = formatPrInfoPresentation({
          prId: c.prId,
          prNumber: c.prNumber,
        });

        // Must be canonical 'Belum ada data'
        expect(presentation.prNumber).toBe('Belum ada data');
        // Absolutely NEVER produce PR-14 or PR-99 or PR-100
        expect(presentation.prNumber).not.toBe(`PR-${c.prId}`);
        expect(presentation.prNumber).not.toMatch(/^PR-\d+$/);
      });
    });

    it('STRICT: should use real PR number when provided and not synthesize', () => {
      const presentation = formatPrInfoPresentation({
        prId: 14,
        prNumber: 'PR/2026/X/0014',
      });
      expect(presentation.prNumber).toBe('PR/2026/X/0014');
    });
  });

  // ── 13. WORKFLOW STEPPER NO-TRUNCATION & FULL LABELS AUDIT ──
  describe('13. Stepper Layout & Full Labels Audit', () => {
    it('should produce 4 distinct workflow steps with full non-truncated descriptions', () => {
      const steps = deriveWorkflowSteps({
        status: 'APPROVED',
        activeRfq: null,
      });

      expect(steps).toHaveLength(4);

      // Step 1: Procurement
      expect(steps[0].key).toBe('procurement');
      expect(steps[0].role).toBe('Procurement');
      expect(steps[0].label).toBe('Pengajuan PR');
      expect(steps[0].state).toBe('COMPLETED');
      expect(steps[0].statusLabel).toBe('Selesai');

      // Step 2: Finance
      expect(steps[1].key).toBe('finance');
      expect(steps[1].role).toBe('Finance');
      expect(steps[1].label).toBe('Financial Review');
      expect(steps[1].state).toBe('COMPLETED');
      expect(steps[1].statusLabel).toBe('Selesai');

      // Step 3: Director
      expect(steps[2].key).toBe('director');
      expect(steps[2].role).toBe('Director');
      expect(steps[2].label).toBe('Final Approval');
      expect(steps[2].state).toBe('COMPLETED');
      expect(steps[2].statusLabel).toBe('Selesai');

      // Step 4: Procurement Next (Downstream RFQ -> PO -> GR)
      expect(steps[3].key).toBe('procurement_next');
      expect(steps[3].role).toBe('Procurement Next');
      expect(steps[3].label).toBe('RFQ → PO → GR');
      expect(steps[3].state).toBe('ACTIVE');
      expect(steps[3].statusLabel).toBe('Siap Diproses');
    });

    it('should correctly adapt Step 4 label when active RFQ or PO is issued', () => {
      // With active RFQ
      const stepsWithRfq = deriveWorkflowSteps({
        status: 'APPROVED',
        activeRfq: { id: 1, rfqNumber: 'RFQ-001' },
      });
      expect(stepsWithRfq[3].label).toBe('RFQ → PO → GR');
      expect(stepsWithRfq[3].statusLabel).toBe('Sedang Berjalan');

      // With PO Issued
      const stepsWithPo = deriveWorkflowSteps({
        status: 'PO_ISSUED',
      });
      expect(stepsWithPo[3].label).toBe('PO Diterbitkan');
      expect(stepsWithPo[3].statusLabel).toBe('Selesai');
    });

    it('STRICT: CSS audit should verify that .stepTitle does NOT truncate text', () => {
      const fs = require('fs');
      const path = require('path');
      const cssPath = path.resolve(__dirname, '../PrApprovalWorkflow.module.css');
      const cssContent = fs.readFileSync(cssPath, 'utf8');

      // Extract .stepTitle rule block
      const stepTitleMatch = cssContent.match(/\.stepTitle\s*\{([^}]+)\}/);
      expect(stepTitleMatch).not.toBeNull();
      const stepTitleBlock = stepTitleMatch![1];

      // Must have white-space: normal
      expect(stepTitleBlock).toMatch(/white-space:\s*normal/);
      // Must NOT have white-space: nowrap
      expect(stepTitleBlock).not.toMatch(/white-space:\s*nowrap/);
      // Must NOT have text-overflow: ellipsis
      expect(stepTitleBlock).not.toMatch(/text-overflow:\s*ellipsis/);
      // Must NOT have overflow: hidden
      expect(stepTitleBlock).not.toMatch(/overflow:\s*hidden/);
      // Must have overflow: visible
      expect(stepTitleBlock).toMatch(/overflow:\s*visible/);
      // Must have text-overflow: clip
      expect(stepTitleBlock).toMatch(/text-overflow:\s*clip/);

      // Verify .stepItem has adequate min-width (>= 160px)
      const stepItemMatch = cssContent.match(/\.stepItem\s*\{([^}]+)\}/);
      expect(stepItemMatch).not.toBeNull();
      const stepItemBlock = stepItemMatch![1];
      expect(stepItemBlock).toMatch(/min-width:\s*16[0-9]px/);

      // Verify .stepConnector has controlled max-width (<= 70px)
      const connectorMatch = cssContent.match(/\.stepConnector\s*\{([^}]+)\}/);
      expect(connectorMatch).not.toBeNull();
      const connectorBlock = connectorMatch![1];
      expect(connectorBlock).toMatch(/max-width:\s*60px/);
    });
  });

  // ── 14. DATA INTEGRITY & WRAPPING AUDIT ──
  describe('14. Data Integrity, Wrapping & Items Table Audit', () => {
    it('should retain long project name and long item description without truncation', () => {
      const longProject = 'PROYEK FIBER OPTIK INTERNASIONAL MULTI-ZONE TRANS-SUMATERA DAN JAWA TENGAH TAHAP III REGIONAL 4';
      const presentation = formatPrInfoPresentation({
        prNumber: 'PR-2026-LONG',
        projectName: longProject,
        totalAmount: 1000000000,
        budgetAllocation: null,
      });

      expect(presentation.projectName).toBe(longProject);
      // Budget missing -> N/A
      expect(presentation.budgetAllocationText).toBe('N/A');

      // Long item description
      const longDescription = 'Kabel Fiber Optik Single Mode 288 Core ADSS Span 100m Standard ITU-T G.652D with dual jacket water blocking tape and aramid yarn reinforcement';
      const items: PrItemPresentation[] = [
        {
          id: 1,
          itemName: longDescription,
          quantity: 50,
          uom: 'HASPEL',
          estimatedUnitPrice: 45000000,
          totalPrice: 2250000000,
        },
      ];

      const metrics = derivePrItemsMetrics(items);
      expect(metrics.itemCount).toBe(1);
      expect(items[0].itemName).toBe(longDescription);
      expect(metrics.totalCalculatedSubtotal).toBe(2250000000);
    });
  });
});
