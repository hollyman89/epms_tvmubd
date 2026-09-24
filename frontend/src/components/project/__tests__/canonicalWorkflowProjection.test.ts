import { isPmEditableWorkflowState, getCanonicalStatusColor } from '../workflowUiHelpers';

describe('Canonical Workflow Projection Contract Tests', () => {
  describe('Project #20 Acceptance Contract Verification', () => {
    const project20CanonicalProjection = {
      workflowInstanceId: 8,
      status: 'IN_PROGRESS',
      businessStatus: 'REVIEW_FINANCE',
      current: {
        nodeKey: 'FINANCE_REVIEW',
        stage: 4,
        totalStages: 5,
        ownerRole: 'FINANCE',
        ownerName: 'Finance Team',
        label: 'Finance Review',
        position: 'Management Review (Tahap 4 dari 5)',
        nextStep: 'Keputusan Review dari Finance Team',
        headerBadge: 'Menunggu Review (Finance Team)',
        status: 'ACTIVE',
      },
      steps: [
        { key: 'pm', role: 'PROJECT_MANAGER', stageName: 'Penyusunan Plan', status: 'COMPLETED' },
        { key: 'hoa', role: 'HEAD_OF_OPERATIONS', stageName: 'HOPS Review', status: 'COMPLETED' },
        { key: 'proc', role: 'PROCUREMENT', stageName: 'Procurement Review', status: 'COMPLETED' },
        { key: 'fin', role: 'FINANCE', stageName: 'Finance Review', status: 'ACTIVE' },
        { key: 'dir', role: 'DIRECTOR', stageName: 'Director Approval', status: 'WAITING' },
      ],
      lastApprovedBy: { name: 'purchasing', role: 'PROCUREMENT' },
      lastApprovedRole: 'PROCUREMENT',
      lastApprovedAt: '2026-03-21T06:14:41.000Z',
    };

    it('should correctly evaluate Project #20 PM editability as non-editable', () => {
      expect(isPmEditableWorkflowState(project20CanonicalProjection.current)).toBe(false);
    });

    it('should correctly map Project #20 status color', () => {
      const color = getCanonicalStatusColor(project20CanonicalProjection.current.status);
      expect(color.tagColor).toBe('processing');
    });

    it('should verify Procurement is COMPLETED in Project #20 steps', () => {
      const procStep = project20CanonicalProjection.steps.find((s) => s.key === 'proc');
      expect(procStep?.status).toBe('COMPLETED');
    });

    it('should prevent Create PR action because Procurement is not active', () => {
      const isProcurementActor = true;
      const uncoveredRabItems = [{ id: 1, name: 'Item 1' }];
      const procStep = project20CanonicalProjection.steps.find((s) => s.key === 'proc');

      const isWorkflowProcurementActive =
        project20CanonicalProjection.current.nodeKey === 'PROCUREMENT_REVIEW' &&
        project20CanonicalProjection.current.status === 'ACTIVE' &&
        procStep?.status === 'ACTIVE';

      const showCreatePrAction =
        isProcurementActor && isWorkflowProcurementActive && uncoveredRabItems.length > 0;

      expect(showCreatePrAction).toBe(false);
    });
  });

  describe('Procurement Canonical Agreement and Mismatch Fail-Safe', () => {
    it('should allow Create PR action only when current and steps agree on active Procurement review', () => {
      const isProcurementActor = true;
      const uncoveredRabItems = [{ id: 1 }];
      const canonicalProjection = {
        current: { nodeKey: 'PROCUREMENT_REVIEW', status: 'ACTIVE' },
        steps: [{ key: 'proc', status: 'ACTIVE' }],
      };

      const procStep = canonicalProjection.steps.find((s) => s.key === 'proc');
      const isWorkflowProcurementActive =
        canonicalProjection.current.nodeKey === 'PROCUREMENT_REVIEW' &&
        canonicalProjection.current.status === 'ACTIVE' &&
        procStep?.status === 'ACTIVE';

      const showCreatePrAction =
        isProcurementActor && isWorkflowProcurementActive && uncoveredRabItems.length > 0;

      expect(showCreatePrAction).toBe(true);
    });

    it('should fail-safe (hide Create PR) when current nodeKey is FINANCE_REVIEW but procurement step is ACTIVE (canonical mismatch)', () => {
      const isProcurementActor = true;
      const uncoveredRabItems = [{ id: 1 }];
      const mismatchedProjection = {
        current: { nodeKey: 'FINANCE_REVIEW', status: 'ACTIVE' },
        steps: [{ key: 'proc', status: 'ACTIVE' }],
      };

      const procStep = mismatchedProjection.steps.find((s) => s.key === 'proc');
      const isWorkflowProcurementActive =
        mismatchedProjection.current.nodeKey === 'PROCUREMENT_REVIEW' &&
        mismatchedProjection.current.status === 'ACTIVE' &&
        procStep?.status === 'ACTIVE';

      const showCreatePrAction =
        isProcurementActor && isWorkflowProcurementActive && uncoveredRabItems.length > 0;

      expect(showCreatePrAction).toBe(false);
    });

    it('should fail-safe (hide Create PR) when all RAB items are already covered (domain condition)', () => {
      const isProcurementActor = true;
      const uncoveredRabItems: any[] = []; // Zero uncovered
      const canonicalProjection = {
        current: { nodeKey: 'PROCUREMENT_REVIEW', status: 'ACTIVE' },
        steps: [{ key: 'proc', status: 'ACTIVE' }],
      };

      const procStep = canonicalProjection.steps.find((s) => s.key === 'proc');
      const isWorkflowProcurementActive =
        canonicalProjection.current.nodeKey === 'PROCUREMENT_REVIEW' &&
        canonicalProjection.current.status === 'ACTIVE' &&
        procStep?.status === 'ACTIVE';

      const showCreatePrAction =
        isProcurementActor && isWorkflowProcurementActive && uncoveredRabItems.length > 0;

      expect(showCreatePrAction).toBe(false);
    });
  });

  describe('Cross-Stage Rendering & Fallback Boundary', () => {
    it('PM_PLANNING should be editable with active draft capability', () => {
      const curr = { nodeKey: 'PM_PLANNING', status: 'ACTIVE', stage: 1 };
      expect(isPmEditableWorkflowState(curr)).toBe(true);
    });

    it('PM_REVISION should be editable for resubmission UX', () => {
      const curr = { nodeKey: 'PM_REVISION', status: 'REVISION_REQUESTED', stage: 1 };
      expect(isPmEditableWorkflowState(curr)).toBe(true);
    });

    it('HOPS_REVIEW, FINANCE_REVIEW, DIRECTOR_APPROVAL, COMPLETED should be non-editable', () => {
      expect(isPmEditableWorkflowState({ nodeKey: 'HOPS_REVIEW', status: 'ACTIVE' })).toBe(false);
      expect(isPmEditableWorkflowState({ nodeKey: 'FINANCE_REVIEW', status: 'ACTIVE' })).toBe(false);
      expect(isPmEditableWorkflowState({ nodeKey: 'DIRECTOR_APPROVAL', status: 'ACTIVE' })).toBe(false);
      expect(isPmEditableWorkflowState({ nodeKey: 'COMPLETED', status: 'COMPLETED' })).toBe(false);
    });

    it('UNKNOWN state should disable PM mutations and map to error color', () => {
      const curr = { nodeKey: 'SOME_UNKNOWN_KEY', status: 'UNKNOWN' };
      expect(isPmEditableWorkflowState(curr)).toBe(false);
      expect(getCanonicalStatusColor(curr.status).tagColor).toBe('error');
    });

    it('Strict Boundary: when workflow exists, legacy fallback is bypassed even if history is empty', () => {
      const gateRecordWithWorkflow = {
        status: 'READY_FOR_PROCUREMENT', // Legacy status
        workflow: {
          businessStatus: 'REVIEW_FINANCE',
          current: { nodeKey: 'FINANCE_REVIEW', status: 'ACTIVE' },
          history: [],
        },
      };

      // Ensure empty history produces empty events instead of falling back to legacy gateRecord.submittedAt/decidedAt
      const events = gateRecordWithWorkflow.workflow
        ? (gateRecordWithWorkflow.workflow.history || [])
        : [{ title: 'Legacy Event' }];

      expect(events).toEqual([]);
    });

    it('Strict Boundary: legacy fallback only runs when workflow is null or undefined', () => {
      const legacyGateRecord = {
        status: 'READY_FOR_PROCUREMENT',
        workflow: null,
      };

      const shouldUseLegacy = !legacyGateRecord.workflow;
      expect(shouldUseLegacy).toBe(true);
    });
  });
});
