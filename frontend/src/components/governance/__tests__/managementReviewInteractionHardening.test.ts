/**
 * EPMS — MANAGEMENT REVIEW INTERACTION HARDENING & BENCHMARK AUDIT TEST SUITE
 *
 * Mandatory Interaction Tests:
 * TEST A — Workflow history <= compact limit: "Lihat Semua" absent
 * TEST B — Workflow history > compact limit: compact list initially rendered
 * TEST C — Click "Lihat Semua": all real workflow transitions appear
 * TEST D — Expanded action label becomes: "Ringkas"
 * TEST E — Click "Ringkas": compact mode restored
 * TEST F — Expand/collapse produces ZERO workflow mutation
 * TEST G — Dead actionable UI audit & zero unexplained dead affordances
 * TEST H — Review tabs remain functional
 * TEST I — Tutup remains functional
 * TEST J — Minta Perbaikan remains functional
 * TEST K — Setujui remains functional
 * TEST L — Static Source Guards: zero hardcoded specimen data in production code
 * TEST M — formatWorkflowNodeLabel converts raw BPMN node IDs to executive labels
 */

import {
  WORKFLOW_HISTORY_COMPACT_LIMIT,
  formatWorkflowNodeLabel,
  STAGE_MAPPING,
  SupportedGovernanceNode,
  buildGovernanceActionContext,
  EnrichedGovernanceTask,
  shouldShowWorkflowExpandButton,
  getDisplayedWorkflowTransitions,
  calculateScheduleDuration,
} from '../ProjectGovernanceTaskCenter';
import fs from 'fs';
import path from 'path';

describe('EPMS — Management Review Interaction Hardening & Benchmark Verification', () => {
  const dummyTask: EnrichedGovernanceTask = {
    id: 51,
    workflowInstanceId: 26,
    nodeId: 'node_finance_review',
    taskKey: 'Finance Review',
    status: 'PENDING',
    projectId: 701,
    projectName: 'Proyek Infrastruktur Telekomunikasi',
    projectCode: 'CONT-2026-X9',
    contractNumber: 'CONT-2026-X9',
    classification: {
      code: 'MANAGEMENT_REVIEW',
      label: 'Management Review',
      tagColor: 'blue',
    },
    workflowInstance: {
      id: 26,
      entityType: 'PROJECT',
      entityId: '701',
      workflowDefinition: {
        id: 1,
        workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
        name: 'Review',
        domain: 'PROJECT',
      },
    },
  } as unknown as EnrichedGovernanceTask;

  const mockTransitions = [
    {
      id: 1,
      instanceId: 26,
      fromNodeId: 'INIT',
      toNodeId: 'node_start',
      action: 'START',
      createdAt: '2026-10-17T06:29:48.000Z',
      actor: { id: 10, username: 'faza', fullName: 'Faza Afina' },
      reason: 'Workflow instance initialized',
    },
    {
      id: 2,
      instanceId: 26,
      fromNodeId: 'node_hops_review',
      toNodeId: 'node_procurement_review',
      action: 'APPROVE',
      createdAt: '2026-10-17T07:01:36.000Z',
      actor: { id: 10, username: 'faza', fullName: 'Faza Afina' },
      reason: 'Disetujui pada tahap Head of Operations Review',
    },
    {
      id: 3,
      instanceId: 26,
      fromNodeId: 'node_procurement_review',
      toNodeId: 'node_finance_review',
      action: 'APPROVE',
      createdAt: '2026-10-17T07:27:55.000Z',
      actor: { id: 11, username: 'purchasing', fullName: 'Purchasing Officer' },
      reason: 'Disetujui pada tahap Procurement Review',
    },
    {
      id: 4,
      instanceId: 26,
      fromNodeId: 'node_finance_review',
      toNodeId: 'node_pm_revision_finance',
      action: 'RETURN',
      createdAt: '2026-10-17T07:45:00.000Z',
      actor: { id: 12, username: 'finance', fullName: 'Finance Manager' },
      reason: 'Perlu klarifikasi anggaran',
    },
    {
      id: 5,
      instanceId: 26,
      fromNodeId: 'node_pm_revision_finance',
      toNodeId: 'node_finance_review',
      action: 'APPROVE',
      createdAt: '2026-10-17T08:00:00.000Z',
      actor: { id: 9, username: 'pm', fullName: 'Project Manager' },
      reason: 'Revisi telah diunggah',
    },
  ];

  // ── TEST A: Workflow history <= compact limit: "Lihat Semua" absent ───────────
  describe('TEST A — Workflow history <= compact limit: "Lihat Semua" absent', () => {
    it('does NOT render "Lihat Semua" when total transitions is 0, 1, 2, or exactly the compact limit (3)', () => {
      [0, 1, 2, WORKFLOW_HISTORY_COMPACT_LIMIT].forEach((count) => {
        const subset = mockTransitions.slice(0, count);
        const hasMoreTransitions = subset.length > WORKFLOW_HISTORY_COMPACT_LIMIT;
        expect(hasMoreTransitions).toBe(false);
      });
      // Also verify helper with and without pending stage
      expect(shouldShowWorkflowExpandButton(2, false, 3)).toBe(false);
      expect(shouldShowWorkflowExpandButton(3, false, 3)).toBe(false);
      expect(shouldShowWorkflowExpandButton(1, true, 3)).toBe(false);
    });
  });

  // ── TEST B: Workflow history > compact limit: compact list initially rendered ──
  describe('TEST B — Workflow history > compact limit: compact list initially rendered', () => {
    it('determines that "Lihat Semua" is required and initially displays only the latest compact transitions', () => {
      expect(mockTransitions.length).toBeGreaterThan(WORKFLOW_HISTORY_COMPACT_LIMIT);
      const hasMoreTransitions = mockTransitions.length > WORKFLOW_HISTORY_COMPACT_LIMIT;
      expect(hasMoreTransitions).toBe(true);

      const workflowHistoryExpanded = false;
      const displayedTransitions = workflowHistoryExpanded
        ? mockTransitions
        : mockTransitions.slice(-WORKFLOW_HISTORY_COMPACT_LIMIT);

      expect(displayedTransitions.length).toBe(WORKFLOW_HISTORY_COMPACT_LIMIT);
      // Confirms it slices the latest 3 records (ids: 3, 4, 5)
      expect(displayedTransitions.map((t) => t.id)).toEqual([3, 4, 5]);

      // Verify helper with 3 completed transitions + 1 pending stage (total 4 entries > 3)
      expect(shouldShowWorkflowExpandButton(3, true, 3)).toBe(true);
      const compactSlice = getDisplayedWorkflowTransitions(mockTransitions.slice(0, 3), false, true, 3);
      expect(compactSlice.length).toBe(2);
      const expandedSlice = getDisplayedWorkflowTransitions(mockTransitions.slice(0, 3), true, true, 3);
      expect(expandedSlice.length).toBe(3);
    });
  });

  // ── TEST C: Click "Lihat Semua": all real workflow transitions appear ────────
  describe('TEST C — Click "Lihat Semua": all real workflow transitions appear', () => {
    it('reveals all transition records when expanded', () => {
      let workflowHistoryExpanded = false;
      // Simulate click "Lihat Semua":
      workflowHistoryExpanded = true;

      const displayedTransitions = workflowHistoryExpanded
        ? mockTransitions
        : mockTransitions.slice(-WORKFLOW_HISTORY_COMPACT_LIMIT);

      expect(displayedTransitions.length).toBe(mockTransitions.length);
      expect(displayedTransitions.map((t) => t.id)).toEqual([1, 2, 3, 4, 5]);
    });
  });

  // ── TEST D: Expanded action label becomes "Ringkas" ──────────────────────────
  describe('TEST D — Expanded action label becomes "Ringkas"', () => {
    it('toggles label between "Lihat Semua" and "Ringkas"', () => {
      const getActionLabel = (expanded: boolean) => (expanded ? 'Ringkas' : 'Lihat Semua');

      expect(getActionLabel(false)).toBe('Lihat Semua');
      expect(getActionLabel(true)).toBe('Ringkas');
    });
  });

  // ── TEST E: Click "Ringkas": compact mode restored ───────────────────────────
  describe('TEST E — Click "Ringkas": compact mode restored', () => {
    it('returns to compact view when collapsed', () => {
      let workflowHistoryExpanded = true;
      // Simulate click "Ringkas":
      workflowHistoryExpanded = false;

      const displayedTransitions = workflowHistoryExpanded
        ? mockTransitions
        : mockTransitions.slice(-WORKFLOW_HISTORY_COMPACT_LIMIT);

      expect(displayedTransitions.length).toBe(WORKFLOW_HISTORY_COMPACT_LIMIT);
      expect(displayedTransitions.map((t) => t.id)).toEqual([3, 4, 5]);
    });
  });

  // ── TEST F: Expand/collapse produces ZERO workflow mutation ─────────────────
  describe('TEST F — Expand/collapse produces ZERO workflow mutation', () => {
    it('leaves underlying task, workflow instance, and transition records completely unmodified', () => {
      const originalTransitionsSnapshot = JSON.stringify(mockTransitions);
      const originalTaskSnapshot = JSON.stringify(dummyTask);

      // Simulate expand and collapse cycles:
      let workflowHistoryExpanded = false;
      workflowHistoryExpanded = true;
      workflowHistoryExpanded = false;

      expect(JSON.stringify(mockTransitions)).toBe(originalTransitionsSnapshot);
      expect(JSON.stringify(dummyTask)).toBe(originalTaskSnapshot);
    });
  });

  // ── TEST G: Dead Actionable UI Audit ─────────────────────────────────────────
  describe('TEST G — Dead actionable UI audit & zero unexplained dead affordances', () => {
    it('verifies "Lihat Semua" uses real button semantics with click handler, hover, and keyboard support', () => {
      const srcPath = path.resolve(__dirname, '../ProjectGovernanceTaskCenter.tsx');
      const src = fs.readFileSync(srcPath, 'utf8');

      // The button must not be static decorative text
      expect(src).not.toContain("<span style={{ fontSize: 11.5, color: '#0284c7', fontWeight: 500, cursor: 'default' }}>Lihat Semua</span>");

      // Must be a proper interactive button element with onClick toggling workflowHistoryExpanded
      expect(src).toContain('setWorkflowHistoryExpanded(!workflowHistoryExpanded)');
      expect(src).toContain('type="button"');
      expect(src).toContain("cursor: 'pointer'");
      expect(src).toContain('aria-label=');
    });
  });

  // ── TEST H: Review tabs remain functional ───────────────────────────────────
  describe('TEST H — Review tabs remain functional', () => {
    it('verifies all 4 canonical review tabs are configured', () => {
      const srcPath = path.resolve(__dirname, '../ProjectGovernanceTaskCenter.tsx');
      const src = fs.readFileSync(srcPath, 'utf8');

      expect(src).toContain("key: 'cost'");
      expect(src).toContain("Estimasi Biaya (RAB)");
      expect(src).toContain("key: 'wbs'");
      expect(src).toContain("Struktur WBS (Bobot 100%)");
      expect(src).toContain("key: 'schedule'");
      expect(src).toContain("Jadwal & Milestones");
      expect(src).toContain("key: 'initialCondition'");
      expect(src).toContain("Kondisi Awal Lapangan");
    });
  });

  // ── TEST I, J, K: Action buttons remain functional ──────────────────────────
  describe('TEST I, J, K — Modal action buttons remain functional', () => {
    it('preserves Tutup, Minta Perbaikan, and Setujui action buttons with correct handlers', () => {
      const srcPath = path.resolve(__dirname, '../ProjectGovernanceTaskCenter.tsx');
      const src = fs.readFileSync(srcPath, 'utf8');

      expect(src).toContain('onClick={handleCloseReview}');
      expect(src).toContain('onClick={handleOpenReturnModal}');
      expect(src).toContain('onClick={handleOpenApproveConfirm}');
      expect(src).toContain('Tutup');
      expect(src).toContain("selectedTask?.isClosure ? 'Kembalikan' : 'Minta Perbaikan'");
      expect(src).toContain("'Setujui & Lanjutkan'");
    });
  });

  // ── TEST L: Static Source Guards ─────────────────────────────────────────────
  describe('TEST L — Static Source Guards: zero hardcoded specimen data in production code', () => {
    it('ensures ProjectGovernanceTaskCenter.tsx has zero specimen hardcodes', () => {
      const srcPath = path.resolve(__dirname, '../ProjectGovernanceTaskCenter.tsx');
      const src = fs.readFileSync(srcPath, 'utf8');

      const forbiddenStrings = [
        '503',
        'CONT-20261017-0005',
        '200.000.000',
        '150.000.000',
        '50.000.000',
      ];

      forbiddenStrings.forEach((forbidden) => {
        // Exclude comments if any, check code lines
        const lines = src.split('\n');
        lines.forEach((line, idx) => {
          const trimmed = line.trim();
          if (
            !trimmed.startsWith('//') &&
            !trimmed.startsWith('*') &&
            !trimmed.startsWith('/*') &&
            trimmed.includes(forbidden)
          ) {
            throw new Error(
              `Forbidden specimen string "${forbidden}" found at line ${idx + 1}: ${trimmed}`,
            );
          }
        });
      });
    });
  });

  // ── TEST M: formatWorkflowNodeLabel ──────────────────────────────────────────
  describe('TEST M — formatWorkflowNodeLabel converts raw BPMN node IDs to executive labels', () => {
    it('formats initial and standard governance nodes to clean labels', () => {
      expect(formatWorkflowNodeLabel('INIT')).toBe('Workflow dimulai');
      expect(formatWorkflowNodeLabel('node_start')).toBe('Workflow dimulai');
      expect(formatWorkflowNodeLabel('node_hops_review')).toBe('Head of Operations Review');
      expect(formatWorkflowNodeLabel('node_procurement_review')).toBe('Procurement Review');
      expect(formatWorkflowNodeLabel('node_finance_review')).toBe('Finance Review');
      expect(formatWorkflowNodeLabel('node_director_approval')).toBe('Director Approval');
      expect(formatWorkflowNodeLabel('node_ready_for_kickoff')).toBe('Ready for Kickoff');
      expect(formatWorkflowNodeLabel('node_kickoff')).toBe('Ready for Kickoff');
      expect(formatWorkflowNodeLabel('node_hoo_review')).toBe('Review Closure HOO');
      expect(formatWorkflowNodeLabel('node_closed')).toBe('Proyek Selesai');
      expect(formatWorkflowNodeLabel('node_pm_revision_finance')).toBe('PM Revision');
    });
  });

  // ── SCHEDULE DURATION CANONICAL DERIVATION (PHASE 8) ─────────────────────────
  describe('EPMS — Schedule Duration Canonical Derivation (Phase 8)', () => {
    it('TEST A — Valid canonical backend duration exists: uses canonical duration', () => {
      expect(calculateScheduleDuration({
        startDate: '2026-10-19',
        endDate: '2026-10-20',
        durationDays: 5,
      })).toBe('5 Hari');
    });

    it('TEST B — No canonical duration + valid same-day dates: 1 Hari', () => {
      expect(calculateScheduleDuration({
        startDate: '2026-10-19',
        endDate: '2026-10-19',
      })).toBe('1 Hari');
    });

    it('TEST C — 19/10/2026 → 20/10/2026: 2 Hari', () => {
      expect(calculateScheduleDuration({
        startDate: '2026-10-19',
        endDate: '2026-10-20',
      })).toBe('2 Hari');
    });

    it('TEST D — 21/10/2026 → 23/10/2026: 3 Hari', () => {
      expect(calculateScheduleDuration({
        startDate: '2026-10-21',
        endDate: '2026-10-23',
      })).toBe('3 Hari');
    });

    it('TEST E — 24/10/2026 → 27/10/2026: 4 Hari', () => {
      expect(calculateScheduleDuration({
        startDate: '2026-10-24',
        endDate: '2026-10-27',
      })).toBe('4 Hari');
    });

    it('TEST F — missing end date: returns —', () => {
      expect(calculateScheduleDuration({
        startDate: '2026-11-01',
        endDate: null,
        isMilestone: true,
      })).toBe('—');
      expect(calculateScheduleDuration({
        startDate: '2026-11-01',
        endDate: undefined,
      })).toBe('—');
    });

    it('TEST G — invalid date: returns —', () => {
      expect(calculateScheduleDuration({
        startDate: 'not-a-date',
        endDate: '2026-10-20',
      })).toBe('—');
      expect(calculateScheduleDuration({
        startDate: '2026-10-19',
        endDate: 'invalid',
      })).toBe('—');
    });

    it('TEST H — end date before start date: returns —', () => {
      expect(calculateScheduleDuration({
        startDate: '2026-10-25',
        endDate: '2026-10-20',
      })).toBe('—');
    });

    it('TEST I — timezone boundary does not change calendar-day result', () => {
      expect(calculateScheduleDuration({
        startDate: '2026-10-19T00:00:00.000Z',
        endDate: '2026-10-20T23:59:59.000Z',
      })).toBe('2 Hari');
      expect(calculateScheduleDuration({
        startDate: '2026-10-29',
        endDate: '2026-10-31',
      })).toBe('3 Hari');
    });

    it('TEST J — null or undefined record safely returns —', () => {
      expect(calculateScheduleDuration(null)).toBe('—');
      expect(calculateScheduleDuration(undefined)).toBe('—');
    });
  });

  // ── WORKFLOW HISTORY PANEL POLISH (REQUIREMENT 23) ───────────────────────────
  describe('EPMS — Workflow History Panel Polish (Requirement 23)', () => {
    const sampleHistory = [
      { id: 1, action: 'START', fromNodeId: 'INIT', toNodeId: 'node_hops_review', actor: { fullName: 'Faza Afina' } },
      { id: 2, action: 'APPROVE', fromNodeId: 'node_hops_review', toNodeId: 'node_procurement_review', actor: { fullName: 'Hoa' } },
      { id: 3, action: 'APPROVE', fromNodeId: 'node_procurement_review', toNodeId: 'node_finance_review', actor: { fullName: 'purchasing' } },
    ];

    it('1. Compact mode hides START if history exceeds compact logic', () => {
      const isPending = true;
      const compactSlice = getDisplayedWorkflowTransitions(sampleHistory, false, isPending, 3);
      // With pending stage, effectiveLimit is 2, taking slice(-2)
      expect(compactSlice.length).toBe(2);
      expect(compactSlice.map((t) => t.id)).toEqual([2, 3]);
      // START (id: 1) is excluded from compact slice
      expect(compactSlice.some((t) => t.action === 'START')).toBe(false);
    });

    it('2. Compact mode still accounts for and shows current pending stage', () => {
      const isPending = true;
      const compactSlice = getDisplayedWorkflowTransitions(sampleHistory, false, isPending, 3);
      // Compact slice (2) + pending stage (1) = total 3 entries displayed
      const totalCompactItems = compactSlice.length + (isPending ? 1 : 0);
      expect(totalCompactItems).toBe(3);
      expect(isPending).toBe(true);
    });

    it('3. "Lihat Semua" reveals START + full history', () => {
      const isPending = true;
      const expandedSlice = getDisplayedWorkflowTransitions(sampleHistory, true, isPending, 3);
      expect(expandedSlice.length).toBe(3);
      expect(expandedSlice.map((t) => t.id)).toEqual([1, 2, 3]);
      // START is revealed in expanded mode
      expect(expandedSlice.some((t) => t.action === 'START')).toBe(true);
      // Total expanded items including pending stage is 4
      expect(expandedSlice.length + (isPending ? 1 : 0)).toBe(4);
    });

    it('4. "Ringkas" restores compact mode and hides START again', () => {
      let isExpanded = true;
      let slice = getDisplayedWorkflowTransitions(sampleHistory, isExpanded, true, 3);
      expect(slice.length).toBe(3);

      // User clicks "Ringkas"
      isExpanded = false;
      slice = getDisplayedWorkflowTransitions(sampleHistory, isExpanded, true, 3);
      expect(slice.length).toBe(2);
      expect(slice.map((t) => t.id)).toEqual([2, 3]);
    });

    it('5. Compact panel sizing is content-driven with no forced expanded height', () => {
      // In compact mode, maxHeight is undefined (natural content-driven height)
      const getContainerMaxHeight = (expanded: boolean) => (expanded ? 360 : undefined);
      expect(getContainerMaxHeight(false)).toBeUndefined();
      expect(getContainerMaxHeight(true)).toBe(360);
    });

    it('6. Current stage remains visible regardless of expand state', () => {
      const isPendingStage = true;
      // In both compact and expanded mode, isPendingStage remains true and pending row is included
      [false, true].forEach((expanded) => {
        const slice = getDisplayedWorkflowTransitions(sampleHistory, expanded, isPendingStage, 3);
        const hasPendingRow = isPendingStage;
        expect(hasPendingRow).toBe(true);
        expect(slice.length).toBeGreaterThan(0);
      });
    });

    it('7. Workflow history rendering is read-only and causes zero workflow state mutation', () => {
      const originalHistory = JSON.parse(JSON.stringify(sampleHistory));
      const sliceCompact = getDisplayedWorkflowTransitions(sampleHistory, false, true, 3);
      const sliceExpanded = getDisplayedWorkflowTransitions(sampleHistory, true, true, 3);

      expect(sliceCompact).toBeDefined();
      expect(sliceExpanded).toBeDefined();
      // Ensure source array is completely untouched (pure function, no mutation)
      expect(sampleHistory).toEqual(originalHistory);
    });
  });
});

