import {
  checkWbsHierarchyIntegrity,
  calculateRootWeightSum,
  calculateLeafWeightSum,
  WbsNodeItem,
} from '../WbsTreeTableModal';
import {
  evaluateOperationalPlanReadiness,
  BackendOperationalReadinessData,
} from '../operational-plan-readiness.utils';

describe('PROJECT-CORE-R1-C1 (C1-14): Frontend WBS Draft & Gate Separation Unit Tests', () => {
  // =========================================================================
  // 1. OVER-ALLOCATION DETECTION VS INCOMPLETE HIERARCHY
  // =========================================================================
  describe('Hierarchy Integrity & Over-Allocation Differentiation', () => {
    it('should mark children < parent as invalid but NOT over-allocated (incomplete draft)', () => {
      const nodes: WbsNodeItem[] = [
        {
          id: '1',
          code: '1.0',
          name: 'Parent WP',
          level: 1,
          weightPercentage: 30.0,
          children: [
            {
              id: '2',
              code: '1.1',
              name: 'Incomplete Child',
              level: 2,
              weightPercentage: 10.0,
            },
          ],
        },
      ];

      const result = checkWbsHierarchyIntegrity(nodes);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].isOverAllocated).toBe(false);
      expect(result.violations[0].childrenWeightSum).toBe(10.0);
      expect(result.violations[0].parentWeight).toBe(30.0);
    });

    it('should mark children > parent as over-allocated (violates structural safety)', () => {
      const nodes: WbsNodeItem[] = [
        {
          id: '1',
          code: '1.0',
          name: 'Parent WP',
          level: 1,
          weightPercentage: 30.0,
          children: [
            {
              id: '2',
              code: '1.1',
              name: 'Child A',
              level: 2,
              weightPercentage: 20.0,
            },
            {
              id: '3',
              code: '1.2',
              name: 'Child B (Over)',
              level: 2,
              weightPercentage: 15.0,
            },
          ],
        },
      ];

      const result = checkWbsHierarchyIntegrity(nodes);
      expect(result.valid).toBe(false);
      expect(result.violations).toHaveLength(1);
      expect(result.violations[0].isOverAllocated).toBe(true);
      expect(result.violations[0].childrenWeightSum).toBe(35.0);
      expect(result.violations[0].parentWeight).toBe(30.0);
    });

    it('should calculate root and leaf weight sums accurately', () => {
      const incompleteNodes: WbsNodeItem[] = [
        {
          id: '1',
          code: '1.0',
          name: 'WP 1',
          level: 1,
          weightPercentage: 40.0,
          children: [
            { id: '2', code: '1.1', name: 'Deliverable 1.1', level: 2, weightPercentage: 40.0 },
          ],
        },
        {
          id: '3',
          code: '2.0',
          name: 'WP 2 (Draft)',
          level: 1,
          weightPercentage: 30.0,
        },
      ];

      const rootSum = calculateRootWeightSum(incompleteNodes);
      const leafSum = calculateLeafWeightSum(incompleteNodes);

      expect(rootSum).toBe(70.0);
      expect(leafSum).toBe(70.0);

      // Root is under 100%, not over-allocated
      const isRootOverAllocated = rootSum > 100.01;
      expect(isRootOverAllocated).toBe(false);

      // Over-allocated check
      const overNodes: WbsNodeItem[] = [
        { id: '1', code: '1.0', name: 'WP 1', level: 1, weightPercentage: 60.0 },
        { id: '2', code: '2.0', name: 'WP 2', level: 1, weightPercentage: 55.0 },
      ];
      expect(calculateRootWeightSum(overNodes)).toBe(115.0);
      expect(calculateRootWeightSum(overNodes) > 100.01).toBe(true);
    });
  });

  // =========================================================================
  // 2. READINESS EVALUATION: SUBMIT GATE BLOCKED WHEN INCOMPLETE
  // =========================================================================
  describe('Gate Enforcement & Readiness Warnings', () => {
    it('should keep review submission disabled when WBS is IN_PROGRESS (incomplete draft)', () => {
      const backendIncompleteReadiness: BackendOperationalReadinessData = {
        projectId: 100,
        projectCode: 'PRJ-2026-001',
        projectName: 'Power Substation Upgrade',
        overallStatus: 'IN_PROGRESS',
        completenessCount: 3,
        totalPillars: 4,
        canSubmitForReview: false,
        canCreatePr: false,
        pillars: {
          cost: { status: 'READY', message: 'Estimasi biaya siap' },
          wbs: {
            status: 'IN_PROGRESS',
            rootWeightStatus: 'INCOMPLETE',
            leafWeightStatus: 'INCOMPLETE',
            rootWeightSum: 70.0,
            leafWeightSum: 70.0,
            message: 'Bobot Root WBS belum seimbang (70.00% != 100.00%)',
          },
          schedule: { status: 'READY', message: 'Jadwal lengkap' },
          initialCondition: { status: 'READY', message: 'Kondisi awal siap' },
        },
      };

      const evalResult = evaluateOperationalPlanReadiness({
        operationalReadinessData: backendIncompleteReadiness,
        isReadinessLoading: false,
        hasCostInput: true,
        totalPmEstimate: 100000000,
        isCostMappingValid: true,
        isCostServerSynced: true,
        isWbsComplete: false,
        isWbsServerSynced: true,
        isScheduleComplete: true,
        isScheduleServerSynced: true,
        isConditionComplete: true,
        initialConditionId: 1,
        hasSavedDraftSinceRevision: true,
      });

      // Submit must be strictly disabled
      expect(evalResult.isOperationalPlanAuthoritativeReady).toBe(false);
      expect(evalResult.canSubmitManagementReview).toBe(false);
      expect(evalResult.completenessScore).toBe(3);
      expect(evalResult.isWbsReady).toBe(false);
      expect(evalResult.reviewSubmissionTooltip).toContain('3/4 selesai');
    });

    it('should enable review submission ONLY when 100% complete and backend confirms READY', () => {
      const backendReady: BackendOperationalReadinessData = {
        projectId: 100,
        projectCode: 'PRJ-2026-001',
        projectName: 'Power Substation Upgrade',
        overallStatus: 'READY',
        completenessCount: 4,
        totalPillars: 4,
        canSubmitForReview: true,
        canCreatePr: false,
        pillars: {
          cost: { status: 'READY', message: 'Cost siap' },
          wbs: { status: 'READY', message: 'WBS 100% siap' },
          schedule: { status: 'READY', message: 'Jadwal siap' },
          initialCondition: { status: 'READY', message: 'Kondisi awal siap' },
        },
      };

      const evalResult = evaluateOperationalPlanReadiness({
        operationalReadinessData: backendReady,
        isReadinessLoading: false,
        hasCostInput: true,
        totalPmEstimate: 100000000,
        isCostMappingValid: true,
        isCostServerSynced: true,
        isWbsComplete: true,
        isWbsServerSynced: true,
        isScheduleComplete: true,
        isScheduleServerSynced: true,
        isConditionComplete: true,
        initialConditionId: 1,
        hasSavedDraftSinceRevision: true,
      });

      expect(evalResult.isOperationalPlanAuthoritativeReady).toBe(true);
      expect(evalResult.canSubmitManagementReview).toBe(true);
      expect(evalResult.completenessScore).toBe(4);
      expect(evalResult.isWbsReady).toBe(true);
    });
  });
});
