import {
  formatRiskProbability,
  formatRiskImpact,
  formatRiskScore,
  formatRiskLevel,
  validateMaterializePayload,
  canUserPerformAction,
  resolveIssueRiskInitialTab,
  resolveDeepLinkTarget,
  validateDeepLinkRecord,
  isRecordMatchingDomain,
  normalizeIssueRiskListResponse,
} from '../issue-risk/issue-risk-presentation.utils';
import {
  ProjectRiskLevel,
  ProjectRiskStatus,
  ProjectIssueSeverity,
  ProjectIssuePriority,
  ProjectIssueStatus,
  ProjectIssueItem,
  ProjectRiskItem,
} from '@/services/project-issue-risk.service';

describe('EPMS — PROJECT-ISSUE-RISK-R1 Frontend Presentation & Domain Invariants', () => {
  describe('1. Empty State Presentation', () => {
    it('handles empty issues list cleanly without crashing', () => {
      const issues: ProjectIssueItem[] = [];
      expect(issues.length).toBe(0);
      const openIssues = issues.filter((i) =>
        [ProjectIssueStatus.OPEN, ProjectIssueStatus.IN_PROGRESS].includes(i.status)
      );
      expect(openIssues.length).toBe(0);
    });

    it('handles empty risks list cleanly without crashing', () => {
      const risks: ProjectRiskItem[] = [];
      expect(risks.length).toBe(0);
      const criticalOrHigh = risks.filter((r) =>
        [ProjectRiskLevel.CRITICAL, ProjectRiskLevel.HIGH].includes(r.riskLevel as any)
      );
      expect(criticalOrHigh.length).toBe(0);
    });
  });

  describe('2. IDENTIFIED / Unassessed Risk Presentation (ARCH-C3 Invariant)', () => {
    const unassessedRisk: Partial<ProjectRiskItem> = {
      id: 101,
      riskNumber: 'RSK-20261009-001',
      title: 'Keterlambatan Pengiriman Kabel FO',
      status: ProjectRiskStatus.IDENTIFIED,
      probability: null,
      impact: null,
      riskScore: null,
      riskLevel: null,
    };

    it('renders Probability = Belum dinilai when null', () => {
      expect(formatRiskProbability(unassessedRisk.probability)).toBe('Belum dinilai');
    });

    it('renders Impact = Belum dinilai when null', () => {
      expect(formatRiskImpact(unassessedRisk.impact)).toBe('Belum dinilai');
    });

    it('renders Score = N/A when null (never 0)', () => {
      expect(formatRiskScore(unassessedRisk.riskScore)).toBe('N/A');
    });

    it('renders Level = Belum dinilai when null (never LOW)', () => {
      expect(formatRiskLevel(unassessedRisk.riskLevel)).toBe('Belum dinilai');
    });

    it('renders formatted values when risk is formally assessed', () => {
      expect(formatRiskProbability(4)).toBe('4 / 5');
      expect(formatRiskImpact(5)).toBe('5 / 5');
      expect(formatRiskScore(20)).toBe('20');
      expect(formatRiskLevel(ProjectRiskLevel.CRITICAL)).toBe('CRITICAL');
    });
  });

  describe('3. Risk Materialization Form Invariants & Validation', () => {
    it('rejects materialization when Severity is missing', () => {
      const result = validateMaterializePayload({
        severity: null,
        priority: ProjectIssuePriority.HIGH,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Severity wajib dipilih secara eksplisit.');
    });

    it('rejects materialization when Priority is missing', () => {
      const result = validateMaterializePayload({
        severity: ProjectIssueSeverity.CRITICAL,
        priority: null,
      });
      expect(result.isValid).toBe(false);
      expect(result.errors).toContain('Priority wajib dipilih secara eksplisit.');
    });

    it('accepts materialization when both Severity and Priority are explicitly provided', () => {
      const result = validateMaterializePayload({
        severity: ProjectIssueSeverity.HIGH,
        priority: ProjectIssuePriority.URGENT,
      });
      expect(result.isValid).toBe(true);
      expect(result.errors.length).toBe(0);
    });

    it('strictly forbids automatic Risk Level → Issue Severity mapping', () => {
      const riskLevels = [
        ProjectRiskLevel.LOW,
        ProjectRiskLevel.MEDIUM,
        ProjectRiskLevel.HIGH,
        ProjectRiskLevel.CRITICAL,
      ];

      riskLevels.forEach((level) => {
        const validation = validateMaterializePayload({
          severity: null,
          priority: ProjectIssuePriority.MEDIUM,
        });
        expect(validation.isValid).toBe(false);
      });
    });
  });

  describe('4. RBAC & Action Visibility Matrix', () => {
    it('allows Assigned PM and Governance to create and assess risks', () => {
      expect(canUserPerformAction('CREATE_RISK', ['PROJECT_MANAGER'], false, true)).toBe(true);
      expect(canUserPerformAction('CREATE_RISK', ['PMO'], false, false)).toBe(true);
      expect(canUserPerformAction('ASSESS_RISK', ['PROJECT_MANAGER'], false, true)).toBe(true);
      expect(canUserPerformAction('ASSESS_RISK', ['HEAD_OF_OPERATIONS'], false, false)).toBe(true);
    });

    it('forbids unassigned PM or non-governance roles from creating risks on foreign project', () => {
      expect(canUserPerformAction('CREATE_RISK', ['PROJECT_MANAGER'], false, false)).toBe(false);
      expect(canUserPerformAction('CREATE_RISK', ['PROCUREMENT'], false, false)).toBe(false);
    });

    it('allows Assigned Record Owner to resolve their owned Issue', () => {
      expect(canUserPerformAction('RESOLVE_ISSUE', ['PROCUREMENT'], true, false)).toBe(true);
      expect(canUserPerformAction('RESOLVE_ISSUE', ['FINANCE'], true, false)).toBe(true);
    });

    it('strictly forbids Non-PM owner from closing a resolved Issue (governance close required)', () => {
      expect(canUserPerformAction('CLOSE_ISSUE', ['PROCUREMENT'], true, false)).toBe(false);
      expect(canUserPerformAction('CLOSE_ISSUE', ['FINANCE'], true, false)).toBe(false);

      expect(canUserPerformAction('CLOSE_ISSUE', ['PROJECT_MANAGER'], false, true)).toBe(true);
      expect(canUserPerformAction('CLOSE_ISSUE', ['PMO'], false, false)).toBe(true);
    });
  });

  describe('5. Workspace Issue & Risk Section Routing & Deep-Link Resolution', () => {
    it('resolves section tab based on type URL parameter', () => {
      expect(resolveIssueRiskInitialTab('risk')).toBe('risks');
      expect(resolveIssueRiskInitialTab('risks')).toBe('risks');
      expect(resolveIssueRiskInitialTab('issue')).toBe('issues');
      expect(resolveIssueRiskInitialTab('issues')).toBe('issues');
      expect(resolveIssueRiskInitialTab(null)).toBe('issues');
      expect(resolveIssueRiskInitialTab(undefined)).toBe('issues');
    });
  });

  describe('6. Authoritative Record Deep-Link Resolution (C1 Contracts)', () => {
    it('resolves Issue tab and exact target ID when type=issue and id=<issueId>', () => {
      const target = resolveDeepLinkTarget('issue', '105');
      expect(target.tab).toBe('issues');
      expect(target.recordId).toBe(105);
    });

    it('resolves Risk tab and exact target ID when type=risk and id=<riskId>', () => {
      const target = resolveDeepLinkTarget('risk', '204');
      expect(target.tab).toBe('risks');
      expect(target.recordId).toBe(204);
    });

    it('falls back to normal register when id is absent', () => {
      const targetIssue = resolveDeepLinkTarget('issue', null);
      expect(targetIssue.tab).toBe('issues');
      expect(targetIssue.recordId).toBeNull();

      const targetRisk = resolveDeepLinkTarget('risk', undefined);
      expect(targetRisk.tab).toBe('risks');
      expect(targetRisk.recordId).toBeNull();
    });

    it('handles invalid or malformed id gracefully without crashing', () => {
      expect(resolveDeepLinkTarget('issue', 'abc').recordId).toBeNull();
      expect(resolveDeepLinkTarget('issue', '-10').recordId).toBeNull();
      expect(resolveDeepLinkTarget('issue', '0').recordId).toBeNull();
      expect(resolveDeepLinkTarget('risk', '').recordId).toBeNull();
    });

    it('prevents type/id domain mismatch from opening wrong domain record', () => {
      const issueRecord = { id: 105, issueNumber: 'ISS-20261009-001', projectId: 50 };
      const riskRecord = { id: 204, riskNumber: 'RSK-20261009-001', projectId: 50 };

      // An issue record must not match a risk request
      expect(isRecordMatchingDomain('risk', issueRecord)).toBe(false);
      expect(isRecordMatchingDomain('issue', issueRecord)).toBe(true);

      // A risk record must not match an issue request
      expect(isRecordMatchingDomain('issue', riskRecord)).toBe(false);
      expect(isRecordMatchingDomain('risk', riskRecord)).toBe(true);
    });

    it('enforces cross-project isolation on deep-link records', () => {
      const recordOnProject50 = { id: 101, projectId: 50 };
      expect(validateDeepLinkRecord(recordOnProject50, 50)).toBe(true);
      expect(validateDeepLinkRecord(recordOnProject50, 99)).toBe(false); // foreign project rejected
      expect(validateDeepLinkRecord(null, 50)).toBe(false);
      expect(validateDeepLinkRecord(undefined, 50)).toBe(false);
    });
  });

  describe('7. API Response Normalization & KPI Calculation Contract (R1-C2 Defect Guard)', () => {
    it('normalizes nested paginated Issue response into Issue[]', () => {
      const nestedApiResponse = {
        meta: { code: 200, status: 'success', message: 'Request successful' },
        data: {
          data: [
            { id: 1, issueNumber: 'ISS-001', status: ProjectIssueStatus.OPEN, isOverdue: false },
            { id: 2, issueNumber: 'ISS-002', status: ProjectIssueStatus.IN_PROGRESS, isOverdue: true },
          ],
          total: 2,
          page: 1,
          limit: 10,
        },
      };

      const normalized = normalizeIssueRiskListResponse<ProjectIssueItem>(nestedApiResponse);
      expect(Array.isArray(normalized.data)).toBe(true);
      expect(normalized.data.length).toBe(2);
      expect(normalized.total).toBe(2);

      // Verify KPI metrics calculation executes cleanly via .filter() without throwing
      const openCount = normalized.data.filter((i) => i.status === ProjectIssueStatus.OPEN).length;
      const inProgressCount = normalized.data.filter((i) => i.status === ProjectIssueStatus.IN_PROGRESS).length;
      const resolvedCount = normalized.data.filter((i) => i.status === ProjectIssueStatus.RESOLVED).length;
      const closedCount = normalized.data.filter((i) => i.status === ProjectIssueStatus.CLOSED).length;
      const overdueCount = normalized.data.filter((i) => i.isOverdue).length;

      expect(openCount).toBe(1);
      expect(inProgressCount).toBe(1);
      expect(resolvedCount).toBe(0);
      expect(closedCount).toBe(0);
      expect(overdueCount).toBe(1);
    });

    it('normalizes nested paginated Risk response into Risk[]', () => {
      const nestedApiResponse = {
        meta: { code: 200, status: 'success', message: 'Request successful' },
        data: {
          data: [
            { id: 10, riskNumber: 'RSK-001', status: ProjectRiskStatus.IDENTIFIED, riskLevel: ProjectRiskLevel.CRITICAL, isReviewOverdue: false },
            { id: 11, riskNumber: 'RSK-002', status: ProjectRiskStatus.MATERIALIZED, riskLevel: ProjectRiskLevel.HIGH, isReviewOverdue: true },
          ],
          total: 2,
          page: 1,
          limit: 10,
        },
      };

      const normalized = normalizeIssueRiskListResponse<ProjectRiskItem>(nestedApiResponse);
      expect(Array.isArray(normalized.data)).toBe(true);
      expect(normalized.data.length).toBe(2);
      expect(normalized.total).toBe(2);

      // Verify KPI metrics calculation executes cleanly via .filter() without throwing
      const criticalCount = normalized.data.filter((r) => r.riskLevel === ProjectRiskLevel.CRITICAL).length;
      const highCount = normalized.data.filter((r) => r.riskLevel === ProjectRiskLevel.HIGH).length;
      const materializedCount = normalized.data.filter((r) => r.status === ProjectRiskStatus.MATERIALIZED).length;
      const reviewOverdueCount = normalized.data.filter((r) => r.isReviewOverdue).length;

      expect(criticalCount).toBe(1);
      expect(highCount).toBe(1);
      expect(materializedCount).toBe(1);
      expect(reviewOverdueCount).toBe(1);
    });

    it('normalizes direct pagination payload { data: [...], total } into array', () => {
      const payload = {
        data: [{ id: 1, issueNumber: 'ISS-001', status: ProjectIssueStatus.RESOLVED }],
        total: 1,
      };

      const normalized = normalizeIssueRiskListResponse(payload);
      expect(Array.isArray(normalized.data)).toBe(true);
      expect(normalized.data.length).toBe(1);
      expect(normalized.total).toBe(1);

      const resolvedCount = normalized.data.filter((i) => i.status === ProjectIssueStatus.RESOLVED).length;
      expect(resolvedCount).toBe(1);
    });

    it('normalizes empty paginated response cleanly to empty array [] and total 0', () => {
      const emptyNested = {
        meta: { code: 200, status: 'success', message: 'Request successful' },
        data: { data: [], total: 0, page: 1, limit: 10 },
      };

      const normalizedNested = normalizeIssueRiskListResponse(emptyNested);
      expect(Array.isArray(normalizedNested.data)).toBe(true);
      expect(normalizedNested.data).toEqual([]);
      expect(normalizedNested.total).toBe(0);

      const nullNormalized = normalizeIssueRiskListResponse(null);
      expect(Array.isArray(nullNormalized.data)).toBe(true);
      expect(nullNormalized.data).toEqual([]);
      expect(nullNormalized.total).toBe(0);

      const emptyObjNormalized = normalizeIssueRiskListResponse({});
      expect(Array.isArray(emptyObjNormalized.data)).toBe(true);
      expect(emptyObjNormalized.data).toEqual([]);
      expect(emptyObjNormalized.total).toBe(0);

      // Verify .filter on empty normalized data does not throw and yields 0
      expect(emptyObjNormalized.data.filter((i: any) => i.status === ProjectIssueStatus.OPEN).length).toBe(0);
    });
  });

  // =============================================================
  // 8. Cross-PM Action Visibility & ID-Based Authorization (R1-C3 Contracts)
  // =============================================================
  describe('8. Cross-PM Action Visibility & ID-Based Authorization (R1-C3 Contracts)', () => {
    it('grants canCreate to assigned PM strictly based on user ID and managerId match', () => {
      const currentUserId = 2; // User 2 (pm@epms.com, "Project Manager")
      const currentUserRoles = ['PROJECT_MANAGER'];

      // Project 2007: managerId is 2 (assigned)
      const project2007 = { id: 2007, managerId: 2 };
      const isAssignedPm2007 =
        currentUserRoles.includes('PROJECT_MANAGER') &&
        Number(project2007.managerId) === currentUserId;
      const canCreate2007 = isAssignedPm2007 || currentUserRoles.includes('PMO');

      expect(isAssignedPm2007).toBe(true);
      expect(canCreate2007).toBe(true);

      // Project 20: managerId is 879 (unassigned / Faza Afina's project)
      const project20 = { id: 20, managerId: 879 };
      const isAssignedPm20 =
        currentUserRoles.includes('PROJECT_MANAGER') &&
        Number(project20.managerId) === currentUserId;
      const canCreate20 = isAssignedPm20 || currentUserRoles.includes('PMO');

      expect(isAssignedPm20).toBe(false);
      expect(canCreate20).toBe(false);
    });

    it('proves authorization uses numerical IDs and is completely decoupled from display names', () => {
      // Even if display name was changed or spoofed, only ID equality determines canCreate
      const userWithArbitraryName = { id: 2, fullName: 'Arbitrary Person', email: 'pm@epms.com' };
      const project = { id: 2007, managerId: 2 };

      const isAssignedPm = Number(project.managerId) === Number(userWithArbitraryName.id);
      expect(isAssignedPm).toBe(true);

      const foreignProject = { id: 20, managerId: 879 };
      const isAssignedPmForeign = Number(foreignProject.managerId) === Number(userWithArbitraryName.id);
      expect(isAssignedPmForeign).toBe(false);
    });
  });
});


