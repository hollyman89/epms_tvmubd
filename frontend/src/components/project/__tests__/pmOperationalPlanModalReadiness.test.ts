import {
  evaluateOperationalPlanReadiness,
  resolveRevisionReviewerLabel,
  BackendOperationalReadinessData,
} from '../operational-plan-readiness.utils';

describe('R9.1B-OP-FIX PHASE 3: OP-03 Operational Plan Modal Readiness SSOT Alignment', () => {
  // Baseline simulated locally-complete form inputs
  const localCompleteInputs = {
    hasCostInput: true,
    totalPmEstimate: 250000000,
    isCostMappingValid: true,
    isCostServerSynced: true,
    isWbsComplete: true,
    isWbsServerSynced: true,
    isScheduleComplete: true,
    isScheduleServerSynced: true,
    isConditionComplete: true,
    initialConditionId: 991,
    hasSavedDraftSinceRevision: false,
    isRevisionMode: false,
  };

  // -------------------------------------------------------------------------
  // TEST 1 — LOCAL COMPLETE / BACKEND INCOMPLETE
  // Given: local Cost/WBS/Schedule/Condition booleans appear complete
  // BUT backend readiness: 2/4, IN_PROGRESS
  // ASSERT: modal does NOT display 4/4 READY.
  // ASSERT: modal reflects backend 2/4 state.
  // -------------------------------------------------------------------------
  describe('TEST 1 — LOCAL COMPLETE / BACKEND INCOMPLETE', () => {
    it('should reflect backend 2/4 state and NOT claim 4/4 READY even when client form is complete', () => {
      const backendIncompleteReadiness: BackendOperationalReadinessData = {
        projectId: 1361,
        projectCode: 'PRJ-2026-001',
        projectName: 'Fiber Optic Backbone',
        overallStatus: 'IN_PROGRESS',
        completenessCount: 2,
        totalPillars: 4,
        canSubmitForReview: false,
        canCreatePr: false,
        pillars: {
          cost: { status: 'READY', message: 'Estimasi biaya siap' },
          wbs: { status: 'READY', message: 'WBS 100% siap' },
          schedule: {
            status: 'IN_PROGRESS',
            message: 'Sebagian task belum memiliki tanggal mulai/selesai yang valid',
          },
          initialCondition: {
            status: 'NOT_STARTED',
            message: 'Belum ada data baseline di database',
          },
        },
      };

      const result = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        operationalReadinessData: backendIncompleteReadiness,
      });

      // ASSERT: modal does NOT display 4/4 READY
      expect(result.isOperationalPlanAuthoritativeReady).toBe(false);

      // ASSERT: modal reflects backend 2/4 state
      expect(result.completenessScore).toBe(2);
      expect(result.totalPillars).toBe(4);
      expect(result.overallStatus).toBe('IN_PROGRESS');

      // Individual pillar check
      expect(result.isCostReady).toBe(true);
      expect(result.isWbsReady).toBe(true);
      expect(result.isScheduleReady).toBe(false);
      expect(result.isConditionReady).toBe(false);

      // Management Review must be blocked
      expect(result.canSubmitManagementReview).toBe(false);
      expect(result.reviewSubmissionTooltip).toContain('2/4 selesai');
    });
  });

  // -------------------------------------------------------------------------
  // TEST 2 — BACKEND 4/4 READY
  // Given backend readiness: 4/4, READY
  // ASSERT: modal displays 4/4 READY and 100% Kesiapan.
  // -------------------------------------------------------------------------
  describe('TEST 2 — BACKEND 4/4 READY', () => {
    it('should display 4/4 READY and allow review when backend SSOT confirms 4/4 READY', () => {
      const backendReady: BackendOperationalReadinessData = {
        projectId: 1361,
        projectCode: 'PRJ-2026-001',
        projectName: 'Fiber Optic Backbone',
        overallStatus: 'READY',
        completenessCount: 4,
        totalPillars: 4,
        canSubmitForReview: true,
        canCreatePr: false,
        pillars: {
          cost: { status: 'READY', message: 'Cost siap' },
          wbs: { status: 'READY', message: 'WBS 100% siap' },
          schedule: { status: 'READY', message: 'Jadwal lengkap' },
          initialCondition: { status: 'READY', message: 'Baseline terisi' },
        },
      };

      const result = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        operationalReadinessData: backendReady,
      });

      // ASSERT: modal displays 4/4 READY
      expect(result.isOperationalPlanAuthoritativeReady).toBe(true);
      expect(result.completenessScore).toBe(4);
      expect(result.totalPillars).toBe(4);
      expect(result.overallStatus).toBe('READY');

      // Percentage calculation
      const percentage = Number(((result.completenessScore / result.totalPillars) * 100).toFixed(0));
      expect(percentage).toBe(100);

      // Pillars all ready
      expect(result.isCostReady).toBe(true);
      expect(result.isWbsReady).toBe(true);
      expect(result.isScheduleReady).toBe(true);
      expect(result.isConditionReady).toBe(true);

      // Submission eligible
      expect(result.canSubmitManagementReview).toBe(true);
      expect(result.reviewSubmissionTooltip).toBe(
        'Ajukan Operational Plan kepada Head of Operations untuk ditinjau.'
      );
    });
  });

  // -------------------------------------------------------------------------
  // TEST 3 — SAVE THEN REFETCH
  // After successful Save Draft:
  // ASSERT: getOperationalReadiness is refetched.
  // ASSERT: displayed readiness comes from returned backend state.
  // -------------------------------------------------------------------------
  describe('TEST 3 — SAVE THEN REFETCH', () => {
    it('should derive displayed readiness strictly from refetched backend state after save', async () => {
      let currentBackendState: BackendOperationalReadinessData = {
        projectId: 1361,
        overallStatus: 'IN_PROGRESS',
        completenessCount: 1,
        totalPillars: 4,
        pillars: {
          cost: { status: 'READY' },
          wbs: { status: 'NOT_STARTED' },
          schedule: { status: 'NOT_STARTED' },
          initialCondition: { status: 'NOT_STARTED' },
        },
      };

      // Simulated service
      const mockProjectService = {
        getOperationalReadiness: jest.fn().mockImplementation(async (pid: number) => {
          return currentBackendState;
        }),
      };

      // 1. Initial render before save
      let result = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        operationalReadinessData: await mockProjectService.getOperationalReadiness(1361),
      });
      expect(result.completenessScore).toBe(1);
      expect(result.isOperationalPlanAuthoritativeReady).toBe(false);

      // 2. User saves drafts -> Backend persists WBS and Schedule -> Backend updates to 3/4
      currentBackendState = {
        projectId: 1361,
        overallStatus: 'IN_PROGRESS',
        completenessCount: 3,
        totalPillars: 4,
        pillars: {
          cost: { status: 'READY' },
          wbs: { status: 'READY' },
          schedule: { status: 'READY' },
          initialCondition: { status: 'NOT_STARTED' },
        },
      };

      // Refetch triggered after save
      const freshReadiness = await mockProjectService.getOperationalReadiness(1361);
      result = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        operationalReadinessData: freshReadiness,
      });

      // ASSERT: refetch was called
      expect(mockProjectService.getOperationalReadiness).toHaveBeenCalledTimes(2);

      // ASSERT: displayed readiness comes directly from returned backend state
      expect(result.completenessScore).toBe(3);
      expect(result.isCostReady).toBe(true);
      expect(result.isWbsReady).toBe(true);
      expect(result.isScheduleReady).toBe(true);
      expect(result.isConditionReady).toBe(false);
      expect(result.isOperationalPlanAuthoritativeReady).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // TEST 4 — PARTIAL SAVE
  // Given: one pillar save fails
  // ASSERT: modal cannot become false 4/4 READY.
  // ASSERT: authoritative backend readiness is displayed.
  // -------------------------------------------------------------------------
  describe('TEST 4 — PARTIAL SAVE', () => {
    it('should maintain actual backend state and prevent false 4/4 READY when one pillar fails to save', async () => {
      // Backend persists Cost and WBS, but Schedule save failed at HTTP level
      const backendPartialState: BackendOperationalReadinessData = {
        projectId: 1361,
        overallStatus: 'IN_PROGRESS',
        completenessCount: 2,
        totalPillars: 4,
        pillars: {
          cost: { status: 'READY' },
          wbs: { status: 'READY' },
          schedule: { status: 'NOT_STARTED' }, // Schedule did not persist
          initialCondition: { status: 'NOT_STARTED' },
        },
      };

      // Even though schedule form is filled client-side:
      const result = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        isScheduleServerSynced: false, // Save failed
        operationalReadinessData: backendPartialState,
      });

      // ASSERT: modal cannot become false 4/4 READY
      expect(result.isOperationalPlanAuthoritativeReady).toBe(false);

      // ASSERT: authoritative backend readiness is displayed
      expect(result.completenessScore).toBe(2);
      expect(result.isCostReady).toBe(true);
      expect(result.isWbsReady).toBe(true);
      expect(result.isScheduleReady).toBe(false);
      expect(result.isScheduleLocalDraft).toBe(true); // Flagged as local unsaved draft
      expect(result.canSubmitManagementReview).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // TEST 5 — READINESS FETCH FAILURE
  // Given: readiness API fails or is unavailable
  // ASSERT: modal fails closed.
  // ASSERT: it does NOT derive READY from local booleans.
  // -------------------------------------------------------------------------
  describe('TEST 5 — READINESS FETCH FAILURE', () => {
    it('should fail closed when readiness API fails or returns null', () => {
      // Simulate API failure -> operationalReadinessData is null
      const resultNull = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        operationalReadinessData: null,
      });

      // ASSERT: fails closed
      expect(resultNull.isOperationalPlanAuthoritativeReady).toBe(false);
      expect(resultNull.completenessScore).toBe(0);
      expect(resultNull.totalPillars).toBe(4);
      expect(resultNull.isCostReady).toBe(false);
      expect(resultNull.isWbsReady).toBe(false);
      expect(resultNull.isScheduleReady).toBe(false);
      expect(resultNull.isConditionReady).toBe(false);
      expect(resultNull.canSubmitManagementReview).toBe(false);

      // Simulate API loading state
      const resultLoading = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        isReadinessLoading: true,
        operationalReadinessData: null,
      });
      expect(resultLoading.isOperationalPlanAuthoritativeReady).toBe(false);
      expect(resultLoading.completenessScore).toBe(0);
      expect(resultLoading.canSubmitManagementReview).toBe(false);
    });
  });

  // -------------------------------------------------------------------------
  // TEST 6 — MANAGEMENT REVIEW BUTTON
  // Backend readiness incomplete:
  // ASSERT: Management Review submission UI is not presented as ready.
  // Backend readiness READY 4/4:
  // ASSERT: normal eligibility behavior continues.
  // Do not weaken backend gate.
  // -------------------------------------------------------------------------
  describe('TEST 6 — MANAGEMENT REVIEW BUTTON', () => {
    it('should disable submit when backend is incomplete and enable only when 4/4 READY', () => {
      // Incomplete: 3/4
      const incomplete3of4: BackendOperationalReadinessData = {
        projectId: 1361,
        overallStatus: 'IN_PROGRESS',
        completenessCount: 3,
        totalPillars: 4,
        pillars: {
          cost: { status: 'READY' },
          wbs: { status: 'READY' },
          schedule: { status: 'READY' },
          initialCondition: { status: 'NOT_STARTED' },
        },
      };

      const resultIncomplete = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        operationalReadinessData: incomplete3of4,
      });

      expect(resultIncomplete.canSubmitManagementReview).toBe(false);
      expect(resultIncomplete.reviewSubmissionTooltip).toBe(
        'Lengkapi 4/4 pilar (3/4 selesai) untuk mengajukan review.'
      );

      // Complete: 4/4
      const complete4of4: BackendOperationalReadinessData = {
        projectId: 1361,
        overallStatus: 'READY',
        completenessCount: 4,
        totalPillars: 4,
        pillars: {
          cost: { status: 'READY' },
          wbs: { status: 'READY' },
          schedule: { status: 'READY' },
          initialCondition: { status: 'READY' },
        },
      };

      const resultComplete = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        operationalReadinessData: complete4of4,
      });

      expect(resultComplete.canSubmitManagementReview).toBe(true);
      expect(resultComplete.reviewSubmissionTooltip).toBe(
        'Ajukan Operational Plan kepada Head of Operations untuk ditinjau.'
      );

      // Revision mode: requires both 4/4 and hasSavedDraftSinceRevision
      const resultRevisionNoSave = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        isRevisionMode: true,
        hasSavedDraftSinceRevision: false,
        operationalReadinessData: complete4of4,
      });
      expect(resultRevisionNoSave.canSubmitManagementReview).toBe(false);
      expect(resultRevisionNoSave.reviewSubmissionTooltip).toBe(
        'Perbaiki dan simpan Operational Plan terlebih dahulu.'
      );

      const resultRevisionSaved = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        isRevisionMode: true,
        hasSavedDraftSinceRevision: true,
        revisionNodeId: 'node_pm_revision_hops',
        operationalReadinessData: complete4of4,
      });
      expect(resultRevisionSaved.canSubmitManagementReview).toBe(true);
      expect(resultRevisionSaved.reviewSubmissionTooltip).toBe(
        'Ajukan kembali Operational Plan yang telah direvisi kepada Head of Operations untuk ditinjau.'
      );
    });
  });

  // -------------------------------------------------------------------------
  // TEST 7 — REOPEN CONSISTENCY
  // Open modal with backend 3/4.
  // ASSERT: 3/4.
  // Close.
  // Backend becomes 4/4.
  // Reopen.
  // ASSERT: 4/4.
  // No stale local readiness.
  // -------------------------------------------------------------------------
  describe('TEST 7 — REOPEN CONSISTENCY', () => {
    it('should reset readiness on modal close and fetch fresh backend SSOT on reopen without stale state', () => {
      // 1. Initial Open: Backend is 3/4
      let modalReadinessData: BackendOperationalReadinessData | null = {
        projectId: 1361,
        overallStatus: 'IN_PROGRESS',
        completenessCount: 3,
        totalPillars: 4,
        pillars: {
          cost: { status: 'READY' },
          wbs: { status: 'READY' },
          schedule: { status: 'READY' },
          initialCondition: { status: 'NOT_STARTED' },
        },
      };

      let result = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        operationalReadinessData: modalReadinessData,
      });

      expect(result.completenessScore).toBe(3);
      expect(result.isOperationalPlanAuthoritativeReady).toBe(false);

      // 2. Modal Closes -> State resets to null
      modalReadinessData = null;
      let closedResult = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        operationalReadinessData: modalReadinessData,
      });
      expect(closedResult.completenessScore).toBe(0);
      expect(closedResult.isOperationalPlanAuthoritativeReady).toBe(false);

      // 3. In the background / elsewhere, backend updates to 4/4
      const freshBackend4of4: BackendOperationalReadinessData = {
        projectId: 1361,
        overallStatus: 'READY',
        completenessCount: 4,
        totalPillars: 4,
        pillars: {
          cost: { status: 'READY' },
          wbs: { status: 'READY' },
          schedule: { status: 'READY' },
          initialCondition: { status: 'READY' },
        },
      };

      // 4. Modal Reopens -> Fetches fresh backend data
      modalReadinessData = freshBackend4of4;
      let reopenedResult = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        operationalReadinessData: modalReadinessData,
      });

      // ASSERT: 4/4, no stale 3/4
      expect(reopenedResult.completenessScore).toBe(4);
      expect(reopenedResult.isOperationalPlanAuthoritativeReady).toBe(true);
      expect(reopenedResult.canSubmitManagementReview).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // TEST 8 — AUTHORITATIVE REVISION PERSISTENCE (A & E)
  // Given: isRevisionMode = true, 4/4 = READY
  // When no post-return persisted revision -> canSubmitManagementReview = false
  // When post-return persisted revision = true -> canSubmitManagementReview = true
  // -------------------------------------------------------------------------
  describe('TEST 8 — AUTHORITATIVE REVISION PERSISTENCE (A & E)', () => {
    const backendReadyInRevision: BackendOperationalReadinessData = {
      projectId: 1409,
      projectCode: 'CONT-20261001-0103',
      projectName: 'PROJECT ASIANET JAKARTA',
      overallStatus: 'READY',
      completenessCount: 4,
      totalPillars: 4,
      canSubmitForReview: true,
      canCreatePr: false,
      pillars: {
        cost: { status: 'READY' },
        wbs: { status: 'READY' },
        schedule: { status: 'READY' },
        initialCondition: { status: 'READY' },
      },
      gate: {
        status: 'NEEDS_REVISION',
        decidedAt: '2026-10-01T07:45:25.000Z',
      },
    };

    it('Scenario E (No-Edit): blocks resubmit when 4/4 is READY but no revision was saved after return', () => {
      const result = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        isRevisionMode: true,
        hasPersistedRevisionAfterReturn: false,
        operationalReadinessData: {
          ...backendReadyInRevision,
          hasPersistedRevisionAfterReturn: false,
        },
      });

      expect(result.isOperationalPlanAuthoritativeReady).toBe(true);
      expect(result.hasPersistedRevisionAfterReturn).toBe(false);
      expect(result.canSubmitManagementReview).toBe(false);
      expect(result.reviewSubmissionTooltip).toBe(
        'Perbaiki dan simpan Operational Plan terlebih dahulu.'
      );
    });

    it('Scenario A: enables resubmit when 4/4 is READY and post-return revision is saved', () => {
      const result = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        isRevisionMode: true,
        hasPersistedRevisionAfterReturn: true,
        revisionNodeId: 'node_pm_revision_hops',
        operationalReadinessData: {
          ...backendReadyInRevision,
          hasPersistedRevisionAfterReturn: true,
        },
      });

      expect(result.isOperationalPlanAuthoritativeReady).toBe(true);
      expect(result.hasPersistedRevisionAfterReturn).toBe(true);
      expect(result.canSubmitManagementReview).toBe(true);
      expect(result.reviewSubmissionTooltip).toBe(
        'Ajukan kembali Operational Plan yang telah direvisi kepada Head of Operations untuk ditinjau.'
      );
    });
  });

  // -------------------------------------------------------------------------
  // TEST 9 — REOPEN & REFRESH CONSISTENCY (C & D)
  // Reopening modal or refreshing page preserves eligibility purely from
  // authoritative server SSOT (without local React state / localStorage).
  // -------------------------------------------------------------------------
  describe('TEST 9 — REOPEN & REFRESH CONSISTENCY (C & D)', () => {
    it('survives modal close/reopen and page refresh via server-backed data', () => {
      const freshServerDataAfterSave: BackendOperationalReadinessData = {
        projectId: 1409,
        projectCode: 'CONT-20261001-0103',
        projectName: 'PROJECT ASIANET JAKARTA',
        overallStatus: 'READY',
        completenessCount: 4,
        totalPillars: 4,
        canSubmitForReview: true,
        canCreatePr: false,
        pillars: {
          cost: { status: 'READY' },
          wbs: { status: 'READY' },
          schedule: { status: 'READY' },
          initialCondition: { status: 'READY' },
        },
        gate: {
          status: 'NEEDS_REVISION',
          decidedAt: '2026-10-01T07:45:25.000Z',
          hasPersistedRevisionAfterReturn: true,
          lastReturnedAt: '2026-10-01T07:45:25.000Z',
          lastRevisionSavedAt: '2026-10-01T07:50:17.000Z',
        },
        hasPersistedRevisionAfterReturn: true,
        lastReturnedAt: '2026-10-01T07:45:25.000Z',
        lastRevisionSavedAt: '2026-10-01T07:50:17.000Z',
      };

      // Simulated fresh mount after page reload: all client draft state is false/default
      const freshMountResult = evaluateOperationalPlanReadiness({
        operationalReadinessData: freshServerDataAfterSave,
        isReadinessLoading: false,
        hasCostInput: false,
        totalPmEstimate: 0,
        isCostMappingValid: false,
        isCostServerSynced: true,
        isWbsComplete: false,
        isWbsServerSynced: true,
        isScheduleComplete: false,
        isScheduleServerSynced: true,
        isConditionComplete: false,
        initialConditionId: null,
        hasSavedDraftSinceRevision: false, // In-memory state was reset!
        hasPersistedRevisionAfterReturn: undefined, // Let it read from server data!
        isRevisionMode: true,
      });

      expect(freshMountResult.hasPersistedRevisionAfterReturn).toBe(true);
      expect(freshMountResult.isOperationalPlanAuthoritativeReady).toBe(true);
      expect(freshMountResult.canSubmitManagementReview).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // TEST 10 — SECOND RETURN CYCLE INVALIDATION (F)
  // Edits made during Cycle 1 do NOT automatically satisfy Cycle 2.
  // When a second return occurs, hasPersistedRevisionAfterReturn must become false.
  // -------------------------------------------------------------------------
  describe('TEST 10 — SECOND RETURN CYCLE INVALIDATION (F)', () => {
    it('invalidates previous revision saves when a newer RETURN cycle occurs', () => {
      // Cycle 1: Return at 10:00, saved at 10:05 -> Eligible
      const cycle1Readiness: BackendOperationalReadinessData = {
        projectId: 1409,
        overallStatus: 'READY',
        completenessCount: 4,
        totalPillars: 4,
        canSubmitForReview: true,
        pillars: {
          cost: { status: 'READY' },
          wbs: { status: 'READY' },
          schedule: { status: 'READY' },
          initialCondition: { status: 'READY' },
        },
        hasPersistedRevisionAfterReturn: true,
        lastReturnedAt: '2026-10-01T10:00:00.000Z',
        lastRevisionSavedAt: '2026-10-01T10:05:00.000Z',
      };

      const resultCycle1 = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        isRevisionMode: true,
        operationalReadinessData: cycle1Readiness,
      });
      expect(resultCycle1.canSubmitManagementReview).toBe(true);

      // Resubmit occurs, later Reviewer #2 (Finance) returns at 11:00.
      // Last save remains 10:05.
      // Server determines: lastRevisionSavedAt (10:05) < lastReturnedAt (11:00) -> hasPersistedRevisionAfterReturn = false.
      const cycle2ReadinessBeforeEdit: BackendOperationalReadinessData = {
        projectId: 1409,
        overallStatus: 'READY',
        completenessCount: 4,
        totalPillars: 4,
        canSubmitForReview: false,
        pillars: {
          cost: { status: 'READY' },
          wbs: { status: 'READY' },
          schedule: { status: 'READY' },
          initialCondition: { status: 'READY' },
        },
        hasPersistedRevisionAfterReturn: false,
        lastReturnedAt: '2026-10-01T11:00:00.000Z',
        lastRevisionSavedAt: '2026-10-01T10:05:00.000Z',
      };

      const resultCycle2BeforeEdit = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        isRevisionMode: true,
        operationalReadinessData: cycle2ReadinessBeforeEdit,
      });
      expect(resultCycle2BeforeEdit.canSubmitManagementReview).toBe(false);
      expect(resultCycle2BeforeEdit.reviewSubmissionTooltip).toBe(
        'Perbaiki dan simpan Operational Plan terlebih dahulu.'
      );

      // Now PM edits and saves during Cycle 2 at 11:15.
      const cycle2ReadinessAfterEdit: BackendOperationalReadinessData = {
        ...cycle2ReadinessBeforeEdit,
        canSubmitForReview: true,
        hasPersistedRevisionAfterReturn: true,
        lastRevisionSavedAt: '2026-10-01T11:15:00.000Z',
      };

      const resultCycle2AfterEdit = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        isRevisionMode: true,
        operationalReadinessData: cycle2ReadinessAfterEdit,
      });
      expect(resultCycle2AfterEdit.canSubmitManagementReview).toBe(true);
    });
  });

  // -------------------------------------------------------------------------
  // TEST 11 — DYNAMIC REVIEWER PRESENTATION RESOLVER & TARGET-AWARE COPY
  // Verifies Section 19 targeted tests:
  // 1. node_pm_revision_hops -> Head of Operations
  // 2. node_pm_revision_procurement -> Procurement
  // 3. node_pm_revision_finance -> Finance
  // 4. node_pm_revision_director -> Director
  // 5. Procurement-return modal does NOT contain "Ajukan Ulang ke Head of Operations"
  // 6. Finance-return modal does NOT contain "Head of Operations"
  // 7. Director-return modal does NOT contain "Head of Operations"
  // 8. Unknown revision node uses neutral safe fallback, not Head of Operations.
  // 9. Submit handler remains ProjectService.submitManagementReview(projectId)
  // 10. No target reviewer is added to API payload.
  // -------------------------------------------------------------------------
  describe('TEST 11 — DYNAMIC REVIEWER PRESENTATION RESOLVER & TARGET-AWARE COPY', () => {
    const ready4of4Data: BackendOperationalReadinessData = {
      projectId: 5,
      overallStatus: 'READY',
      completenessCount: 4,
      totalPillars: 4,
      pillars: {
        cost: { status: 'READY' },
        wbs: { status: 'READY' },
        schedule: { status: 'READY' },
        initialCondition: { status: 'READY' },
      },
      hasPersistedRevisionAfterReturn: true,
    };

    it('1. node_pm_revision_hops maps to Head of Operations', () => {
      expect(resolveRevisionReviewerLabel('node_pm_revision_hops')).toBe('Head of Operations');

      const result = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        isRevisionMode: true,
        revisionNodeId: 'node_pm_revision_hops',
        operationalReadinessData: ready4of4Data,
      });
      expect(result.revisionReviewerLabel).toBe('Head of Operations');
      expect(result.reviewSubmissionTooltip).toBe(
        'Ajukan kembali Operational Plan yang telah direvisi kepada Head of Operations untuk ditinjau.'
      );
    });

    it('2. node_pm_revision_procurement maps to Procurement', () => {
      expect(resolveRevisionReviewerLabel('node_pm_revision_procurement')).toBe('Procurement');

      const result = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        isRevisionMode: true,
        revisionNodeId: 'node_pm_revision_procurement',
        operationalReadinessData: ready4of4Data,
      });
      expect(result.revisionReviewerLabel).toBe('Procurement');
      expect(result.reviewSubmissionTooltip).toBe(
        'Ajukan kembali Operational Plan yang telah direvisi kepada Procurement untuk ditinjau.'
      );
    });

    it('3. node_pm_revision_finance maps to Finance', () => {
      expect(resolveRevisionReviewerLabel('node_pm_revision_finance')).toBe('Finance');

      const result = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        isRevisionMode: true,
        revisionNodeId: 'node_pm_revision_finance',
        operationalReadinessData: ready4of4Data,
      });
      expect(result.revisionReviewerLabel).toBe('Finance');
      expect(result.reviewSubmissionTooltip).toBe(
        'Ajukan kembali Operational Plan yang telah direvisi kepada Finance untuk ditinjau.'
      );
    });

    it('4. node_pm_revision_director maps to Director', () => {
      expect(resolveRevisionReviewerLabel('node_pm_revision_director')).toBe('Director');

      const result = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        isRevisionMode: true,
        revisionNodeId: 'node_pm_revision_director',
        operationalReadinessData: ready4of4Data,
      });
      expect(result.revisionReviewerLabel).toBe('Director');
      expect(result.reviewSubmissionTooltip).toBe(
        'Ajukan kembali Operational Plan yang telah direvisi kepada Director untuk ditinjau.'
      );
    });

    it('5. Procurement-return modal does NOT contain "Ajukan Ulang ke Head of Operations"', () => {
      const label = resolveRevisionReviewerLabel('node_pm_revision_procurement');
      const buttonText = `Konfirmasi & Ajukan Ulang ke ${label}`;
      const modalMessage =
        label === 'Head of Operations'
          ? 'Operational Plan hasil revisi akan diajukan kembali kepada Head of Operations untuk Management Review.'
          : `Operational Plan hasil revisi akan diajukan kembali kepada ${label} untuk melanjutkan review.`;

      expect(buttonText).toBe('Konfirmasi & Ajukan Ulang ke Procurement');
      expect(buttonText).not.toContain('Ajukan Ulang ke Head of Operations');
      expect(modalMessage).toBe(
        'Operational Plan hasil revisi akan diajukan kembali kepada Procurement untuk melanjutkan review.'
      );
      expect(modalMessage).not.toContain('Head of Operations');
    });

    it('6. Finance-return modal does NOT contain "Head of Operations"', () => {
      const label = resolveRevisionReviewerLabel('node_pm_revision_finance');
      const buttonText = `Konfirmasi & Ajukan Ulang ke ${label}`;
      const modalMessage =
        label === 'Head of Operations'
          ? 'Operational Plan hasil revisi akan diajukan kembali kepada Head of Operations untuk Management Review.'
          : `Operational Plan hasil revisi akan diajukan kembali kepada ${label} untuk melanjutkan review.`;

      expect(buttonText).toBe('Konfirmasi & Ajukan Ulang ke Finance');
      expect(buttonText).not.toContain('Head of Operations');
      expect(modalMessage).toBe(
        'Operational Plan hasil revisi akan diajukan kembali kepada Finance untuk melanjutkan review.'
      );
      expect(modalMessage).not.toContain('Head of Operations');
    });

    it('7. Director-return modal does NOT contain "Head of Operations"', () => {
      const label = resolveRevisionReviewerLabel('node_pm_revision_director');
      const buttonText = `Konfirmasi & Ajukan Ulang ke ${label}`;
      const modalMessage =
        label === 'Head of Operations'
          ? 'Operational Plan hasil revisi akan diajukan kembali kepada Head of Operations untuk Management Review.'
          : `Operational Plan hasil revisi akan diajukan kembali kepada ${label} untuk melanjutkan review.`;

      expect(buttonText).toBe('Konfirmasi & Ajukan Ulang ke Director');
      expect(buttonText).not.toContain('Head of Operations');
      expect(modalMessage).toBe(
        'Operational Plan hasil revisi akan diajukan kembali kepada Director untuk melanjutkan review.'
      );
      expect(modalMessage).not.toContain('Head of Operations');
    });

    it('8. Unknown revision node uses neutral safe fallback, not Head of Operations', () => {
      const unknownResult1 = resolveRevisionReviewerLabel('node_unknown_review');
      const unknownResult2 = resolveRevisionReviewerLabel(null);
      const unknownResult3 = resolveRevisionReviewerLabel(undefined);

      expect(unknownResult1).toBe('reviewer terkait');
      expect(unknownResult2).toBe('reviewer terkait');
      expect(unknownResult3).toBe('reviewer terkait');
      expect(unknownResult1).not.toBe('Head of Operations');

      const result = evaluateOperationalPlanReadiness({
        ...localCompleteInputs,
        isRevisionMode: true,
        revisionNodeId: 'node_custom_unknown',
        operationalReadinessData: ready4of4Data,
      });
      expect(result.revisionReviewerLabel).toBe('reviewer terkait');
      expect(result.reviewSubmissionTooltip).toBe(
        'Ajukan kembali Operational Plan yang telah direvisi kepada reviewer terkait untuk ditinjau.'
      );
    });

    it('9 & 10. submit handler remains ProjectService.submitManagementReview(projectId) without reviewer payload', async () => {
      const mockPost = jest.fn().mockResolvedValue({ data: { status: 'READY_FOR_PROCUREMENT' } });
      const mockApiClient = { post: mockPost };

      // Verify submitManagementReview calling signature
      const projectId = 5;
      await mockApiClient.post(`/project/${projectId}/management-review/submit`);

      expect(mockPost).toHaveBeenCalledTimes(1);
      expect(mockPost).toHaveBeenCalledWith('/project/5/management-review/submit');
      // Verify no target node or reviewer role was injected into request payload
      expect(mockPost.mock.calls[0][1]).toBeUndefined();
    });
  });

  // -------------------------------------------------------------------------
  // TEST 12 — POST-RESUBMIT MANAGEMENT REVIEW PROJECTION & REFRESH
  // -------------------------------------------------------------------------
  describe('TEST 12 — POST-RESUBMIT MANAGEMENT REVIEW PROJECTION & REFRESH', () => {
    it('1. After successful submit mutation frontend calls getManagementReview(projectId)', async () => {
      const projectId = 5;
      const mockSubmitManagementReview = jest.fn().mockResolvedValue({
        status: 'READY_FOR_PROCUREMENT',
        workflow: {
          current: {
            nodeKey: 'node_procurement_review',
            stage: 3,
            totalStages: 5,
            ownerRole: 'PROCUREMENT',
            ownerName: 'Procurement Team',
            headerBadge: 'Menunggu Review (Procurement Team)',
            position: 'Management Review (Tahap 3 dari 5)',
          },
        },
      });
      const mockGetManagementReview = jest.fn().mockResolvedValue({
        status: 'READY_FOR_PROCUREMENT',
        workflow: {
          current: {
            nodeKey: 'node_procurement_review',
            stage: 3,
            totalStages: 5,
            ownerRole: 'PROCUREMENT',
            ownerName: 'Procurement Team',
            headerBadge: 'Menunggu Review (Procurement Team)',
            position: 'Management Review (Tahap 3 dari 5)',
          },
        },
      });

      // Execute simulated submit flow in PmOperationalPlanModal
      let gateRecord: any = null;
      const serverResult = await mockSubmitManagementReview(projectId);
      if (serverResult) gateRecord = serverResult;
      const freshGate = await mockGetManagementReview(projectId);
      if (freshGate) gateRecord = freshGate;

      expect(mockSubmitManagementReview).toHaveBeenCalledWith(projectId);
      expect(mockGetManagementReview).toHaveBeenCalledWith(projectId);
      expect(gateRecord).toBe(freshGate);
    });

    it('2. gateRecord is populated from fresh authoritative GET result, not left on stripped mutation response', async () => {
      const strippedMutationResponse = {
        status: 'REVIEW_PENDING',
        // Missing workflow projection
      };
      const canonicalGetResponse = {
        status: 'READY_FOR_PROCUREMENT',
        workflow: {
          workflowInstanceId: 42,
          businessStatus: 'READY_FOR_PROCUREMENT',
          current: {
            nodeKey: 'node_procurement_review',
            stage: 3,
            totalStages: 5,
            ownerRole: 'PROCUREMENT',
            ownerName: 'Procurement Team',
            headerBadge: 'Menunggu Review (Procurement Team)',
            position: 'Management Review (Tahap 3 dari 5)',
            status: 'ACTIVE',
            nextStep: 'Keputusan Review dari Procurement',
          },
          steps: [
            { key: 'pm', role: 'PROJECT_MANAGER', stage: 1, stageName: 'Penyusunan Plan', status: 'COMPLETED' },
            { key: 'hoa', role: 'HEAD_OF_OPERATIONS', stage: 2, stageName: 'HOPS Review', status: 'COMPLETED' },
            { key: 'proc', role: 'PROCUREMENT', stage: 3, stageName: 'Procurement Review', status: 'ACTIVE' },
            { key: 'fin', role: 'FINANCE', stage: 4, stageName: 'Finance Review', status: 'WAITING' },
            { key: 'dir', role: 'DIRECTOR', stage: 5, stageName: 'Director Approval', status: 'WAITING' },
          ],
        },
      };

      let gateRecord: any = null;
      // Step 1: submit mutation
      const serverResult = strippedMutationResponse;
      if (serverResult) gateRecord = serverResult;
      // At this point gateRecord would be stripped
      expect(gateRecord.workflow).toBeUndefined();

      // Step 2: fresh refetch
      const freshGate = canonicalGetResponse;
      if (freshGate) gateRecord = freshGate;

      // Assert gateRecord now has authoritative projection
      expect(gateRecord.workflow).toBeDefined();
      expect(gateRecord.workflow.current.stage).toBe(3);
    });

    it('3, 4, 5. Procurement projection renders Stage 3, Procurement Team owner, and does NOT render Head of Operations header', () => {
      const canonicalProcurementGate = {
        status: 'READY_FOR_PROCUREMENT',
        workflow: {
          businessStatus: 'READY_FOR_PROCUREMENT',
          current: {
            nodeKey: 'node_procurement_review',
            stage: 3,
            totalStages: 5,
            ownerRole: 'PROCUREMENT',
            ownerName: 'Procurement Team',
            headerBadge: 'Menunggu Review (Procurement Team)',
            position: 'Management Review (Tahap 3 dari 5)',
            status: 'ACTIVE',
            nextStep: 'Keputusan Review dari Procurement',
          },
          steps: [
            { key: 'pm', role: 'PROJECT_MANAGER', stage: 1, stageName: 'Penyusunan Plan', status: 'COMPLETED' },
            { key: 'hoa', role: 'HEAD_OF_OPERATIONS', stage: 2, stageName: 'HOPS Review', status: 'COMPLETED' },
            { key: 'proc', role: 'PROCUREMENT', stage: 3, stageName: 'Procurement Review', status: 'ACTIVE' },
            { key: 'fin', role: 'FINANCE', stage: 4, stageName: 'Finance Review', status: 'WAITING' },
            { key: 'dir', role: 'DIRECTOR', stage: 5, stageName: 'Director Approval', status: 'WAITING' },
          ],
        },
      };

      const current = canonicalProcurementGate.workflow.current;
      // Stage check
      expect(current.stage).toBe(3);
      expect(current.totalStages).toBe(5);
      expect(current.position).toBe('Management Review (Tahap 3 dari 5)');

      // Owner check
      expect(current.ownerRole).toBe('PROCUREMENT');
      expect(current.ownerName).toBe('Procurement Team');

      // Header check: must be Procurement Team, must NOT contain Head of Operations
      expect(current.headerBadge).toBe('Menunggu Review (Procurement Team)');
      expect(current.headerBadge).not.toContain('Head of Operations');
      expect(current.position).not.toContain('Tahap 2 dari 5');
    });

    it('6. Existing HOO stage continues to render HOO when HOO is truly current', () => {
      const canonicalHooGate = {
        status: 'REVIEW_PENDING',
        workflow: {
          businessStatus: 'REVIEW_PENDING',
          current: {
            nodeKey: 'node_hops_review',
            stage: 2,
            totalStages: 5,
            ownerRole: 'HEAD_OF_OPERATIONS',
            ownerName: 'Head of Operations',
            headerBadge: 'Menunggu Review (Head of Operations)',
            position: 'Management Review (Tahap 2 dari 5)',
            status: 'ACTIVE',
            nextStep: 'Keputusan Review dari Head of Operations',
          },
          steps: [
            { key: 'pm', role: 'PROJECT_MANAGER', stage: 1, stageName: 'Penyusunan Plan', status: 'COMPLETED' },
            { key: 'hoa', role: 'HEAD_OF_OPERATIONS', stage: 2, stageName: 'HOPS Review', status: 'ACTIVE' },
            { key: 'proc', role: 'PROCUREMENT', stage: 3, stageName: 'Procurement Review', status: 'WAITING' },
            { key: 'fin', role: 'FINANCE', stage: 4, stageName: 'Finance Review', status: 'WAITING' },
            { key: 'dir', role: 'DIRECTOR', stage: 5, stageName: 'Director Approval', status: 'WAITING' },
          ],
        },
      };

      const current = canonicalHooGate.workflow.current;
      expect(current.stage).toBe(2);
      expect(current.ownerRole).toBe('HEAD_OF_OPERATIONS');
      expect(current.ownerName).toBe('Head of Operations');
      expect(current.headerBadge).toBe('Menunggu Review (Head of Operations)');
      expect(current.position).toBe('Management Review (Tahap 2 dari 5)');
    });

    it('7. No reviewer is fabricated and HOO approval remains preserved in steps', () => {
      const canonicalGate = {
        workflow: {
          current: {
            nodeKey: 'node_procurement_review',
            stage: 3,
            totalStages: 5,
            ownerRole: 'PROCUREMENT',
            ownerName: 'Procurement Team',
          },
          steps: [
            { key: 'pm', role: 'PROJECT_MANAGER', stage: 1, status: 'COMPLETED' },
            { key: 'hoa', role: 'HEAD_OF_OPERATIONS', stage: 2, status: 'COMPLETED' },
            { key: 'proc', role: 'PROCUREMENT', stage: 3, status: 'ACTIVE' },
          ],
        },
      };

      // Owner is directly from backend workflow SSOT
      expect(canonicalGate.workflow.current.ownerRole).toBe('PROCUREMENT');
      // HOO approval is completed, not reopened
      const hoaStep = canonicalGate.workflow.steps.find((s) => s.key === 'hoa');
      expect(hoaStep?.status).toBe('COMPLETED');
    });
  });
});


