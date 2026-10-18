import {
  resolvePlanVsActual,
  resolveSchedule,
  resolveOperationalHealth,
  resolveActiveNextAction,
  formatOperationalDate,
} from '../operational-control.utils';
import { resolvePmIdentity, resolveMarketingIdentity } from '../kickoff-queue.utils';

describe('EPMS — PROJECT-EXEC-F2-F3A Operational Control Presentation Unit Tests', () => {
  // =========================================================================
  // 1. Plan vs Actual & Variance Tests (Req 11, 12, 13, 14)
  // =========================================================================
  describe('resolvePlanVsActual', () => {
    it('11, 12, 13. should render Rencana, Aktual, and Deviasi when comparison is available', () => {
      const control = {
        planComparisonAvailable: true,
        plannedProgress: 62,
        actualProgress: 54,
        progressVariancePp: -8,
      };

      const result = resolvePlanVsActual(control);

      expect(result.plannedText).toBe('62%');
      expect(result.plannedPercent).toBe(62);
      expect(result.actualText).toBe('54%');
      expect(result.actualPercent).toBe(54);
      expect(result.varianceText).toBe('-8 pp');
      expect(result.varianceTone).toBe('red');
      expect(result.isComparisonAvailable).toBe(true);
    });

    it('should format positive variance with + prefix and green tone', () => {
      const control = {
        planComparisonAvailable: true,
        plannedProgress: 40,
        actualProgress: 42,
        progressVariancePp: 2,
      };

      const result = resolvePlanVsActual(control);

      expect(result.plannedText).toBe('40%');
      expect(result.actualText).toBe('42%');
      expect(result.varianceText).toBe('+2 pp');
      expect(result.varianceTone).toBe('green');
    });

    it('should format zero variance with slate tone', () => {
      const control = {
        planComparisonAvailable: true,
        plannedProgress: 50,
        actualProgress: 50,
        progressVariancePp: 0,
      };

      const result = resolvePlanVsActual(control);

      expect(result.varianceText).toBe('0 pp');
      expect(result.varianceTone).toBe('slate');
    });

    it('14. should render N/A truth when comparison is unavailable without fabricating fake 0', () => {
      const control = {
        planComparisonAvailable: false,
        planComparisonUnavailableReason: 'NO_ACTIVE_BASELINE',
        plannedProgress: null,
        actualProgress: null,
        progressVariancePp: null,
      };

      const result = resolvePlanVsActual(control);

      expect(result.plannedText).toBe('N/A');
      expect(result.plannedPercent).toBeNull();
      expect(result.actualText).toBe('N/A');
      expect(result.actualPercent).toBeNull();
      expect(result.varianceText).toBe('N/A');
      expect(result.varianceTone).toBe('slate');
      expect(result.isComparisonAvailable).toBe(false);
    });

    it('should render authoritative actual progress even when plan comparison is unavailable', () => {
      const control = {
        planComparisonAvailable: false,
        planComparisonUnavailableReason: 'INVALID_BASELINE',
        plannedProgress: null,
        actualProgress: 25, // Authoritative actual available
        progressVariancePp: null,
      };

      const result = resolvePlanVsActual(control);

      expect(result.plannedText).toBe('N/A');
      expect(result.actualText).toBe('25%');
      expect(result.actualPercent).toBe(25);
      expect(result.varianceText).toBe('N/A');
    });
  });

  // =========================================================================
  // 2. Schedule & Overdue Tests (Req 16, 17, 18)
  // =========================================================================
  describe('resolveSchedule', () => {
    it('16, 17, 18. should render actual start, planned finish, and overdue count', () => {
      const control = {
        planComparisonAvailable: true,
        actualStart: '2026-10-06T13:58:59.000Z',
        plannedFinish: '2026-10-29',
        overdueTaskCount: 2,
      };

      const result = resolveSchedule(control);

      expect(result.actualStartText).toBe('06 Okt 2026');
      expect(result.plannedFinishText).toBe('29 Okt 2026');
      expect(result.overdueCount).toBe(2);
      expect(result.overdueText).toBe('2 Task Terlambat');
      expect(result.overdueTone).toBe('red');
    });

    it('should render 0 Task Terlambat with green tone when overdue count is 0', () => {
      const control = {
        planComparisonAvailable: true,
        actualStart: '2026-10-01T00:00:00.000Z',
        plannedFinish: '2026-11-15',
        overdueTaskCount: 0,
      };

      const result = resolveSchedule(control);

      expect(result.overdueCount).toBe(0);
      expect(result.overdueText).toBe('0 Task Terlambat');
      expect(result.overdueTone).toBe('green');
    });

    it('should render N/A for missing dates and unavailable overdue count', () => {
      const control = {
        planComparisonAvailable: false,
        actualStart: null,
        plannedFinish: null,
        overdueTaskCount: null,
      };

      const result = resolveSchedule(control);

      expect(result.actualStartText).toBe('N/A');
      expect(result.plannedFinishText).toBe('N/A');
      expect(result.overdueCount).toBeNull();
      expect(result.overdueText).toBe('N/A');
      expect(result.overdueTone).toBe('slate');
    });
  });

  // =========================================================================
  // 3. Health Semantics Tests (Req 15)
  // =========================================================================
  describe('resolveOperationalHealth', () => {
    it('15a. should return LEBIH CEPAT for AHEAD progressHealth', () => {
      const control = {
        planComparisonAvailable: true,
        progressHealth: 'AHEAD' as const,
        overdueTaskCount: 0,
      };

      const health = resolveOperationalHealth(control);

      expect(health.label).toBe('LEBIH CEPAT');
      expect(health.tone).toBe('blue');
      expect(health.iconType).toBe('ahead');
    });

    it('15b. should return SESUAI RENCANA for ON_PLAN progressHealth', () => {
      const control = {
        planComparisonAvailable: true,
        progressHealth: 'ON_PLAN' as const,
        overdueTaskCount: 0,
      };

      const health = resolveOperationalHealth(control);

      expect(health.label).toBe('SESUAI RENCANA');
      expect(health.tone).toBe('green');
      expect(health.iconType).toBe('on_plan');
    });

    it('15c. should return TERLAMBAT for BEHIND progressHealth with overdue subtext', () => {
      const control = {
        planComparisonAvailable: true,
        progressHealth: 'BEHIND' as const,
        overdueTaskCount: 4,
      };

      const health = resolveOperationalHealth(control);

      expect(health.label).toBe('TERLAMBAT');
      expect(health.tone).toBe('red');
      expect(health.subtext).toBe('4 task overdue');
      expect(health.iconType).toBe('behind');
    });

    it('15d. should return BELUM TERSEDIA when comparison is unavailable', () => {
      const control = {
        planComparisonAvailable: false,
        planComparisonUnavailableReason: 'NO_ACTIVE_BASELINE',
      };

      const health = resolveOperationalHealth(control);

      expect(health.label).toBe('BELUM TERSEDIA');
      expect(health.tone).toBe('slate');
      expect(health.subtext).toBe('Baseline belum aktif');
      expect(health.iconType).toBe('unavailable');
    });
  });

  // =========================================================================
  // 4. PM & Marketing Identity Tests (Req 19)
  // =========================================================================
  describe('resolvePmIdentity & resolveMarketingIdentity', () => {
    it('19. should resolve authoritative PM name for User ID 2 (Project Manager) and User ID 879 (Faza Afina) without alias collision', () => {
      // User ID 2 (pm@epms.com) -> 'Project Manager', initials 'PM'
      const projectUser2 = {
        managerId: 2,
        manager: { id: 2, fullName: 'Project Manager', email: 'pm@epms.com' },
      };
      const pmUser2 = resolvePmIdentity(projectUser2);
      expect(pmUser2.name).toBe('Project Manager');
      expect(pmUser2.initials).toBe('PM');
      expect(pmUser2.isAssigned).toBe(true);

      // User ID 879 (faza@epms.com) -> 'Faza Afina', initials 'FA'
      const projectUser879 = {
        managerId: 879,
        manager: { id: 879, fullName: 'Faza Afina', email: 'faza@epms.com' },
      };
      const pmUser879 = resolvePmIdentity(projectUser879);
      expect(pmUser879.name).toBe('Faza Afina');
      expect(pmUser879.initials).toBe('FA');
      expect(pmUser879.isAssigned).toBe(true);
    });

    it('should return Belum Ditugaskan for unassigned project', () => {
      const project = {
        managerId: null,
        manager: null,
        pmName: null,
      };

      const pm = resolvePmIdentity(project);

      expect(pm.name).toBe('Belum Ditugaskan');
      expect(pm.isAssigned).toBe(false);
    });

    it('should resolve Marketing PIC person name', () => {
      const project = {
        marketingName: 'Dwi Ragil Pribadi',
      };

      const mkt = resolveMarketingIdentity(project);

      expect(mkt.name).toBe('Dwi Ragil Pribadi');
      expect(mkt.initials).toBe('DR');
    });
  });

  // =========================================================================
  // 5. Contextual Next Action & RBAC Gating Tests (Req 20, 21, 22)
  // =========================================================================
  describe('resolveActiveNextAction', () => {
    const assignedPmProject = {
      id: 1760,
      managerId: 2,
      manager: { id: 2, fullName: 'Faza Afina', email: 'pm@epms.com' },
      status: 'IN_PROGRESS',
    };

    it('20, 21. should show [ Update Progress ] button for exact assigned PM', () => {
      const result = resolveActiveNextAction({
        project: assignedPmProject,
        user: { sub: 2, id: 2 },
        userRoles: ['PROJECT_MANAGER'],
        hasPendingClaim: false,
      });

      expect(result.mode).toBe('UPDATE_PROGRESS_BUTTON');
      expect(result.buttonLabel).toBe('Update Progress');
      expect(result.isAssignedPm).toBe(true);
    });

    it('should show "Menunggu verifikasi" for assigned PM if there is a pending claim', () => {
      const result = resolveActiveNextAction({
        project: assignedPmProject,
        user: { sub: 2, id: 2 },
        userRoles: ['PROJECT_MANAGER'],
        hasPendingClaim: true,
      });

      expect(result.mode).toBe('WAITING_VERIFICATION');
      expect(result.text).toBe('Menunggu verifikasi');
      expect(result.isAssignedPm).toBe(true);
    });

    it('should show [ Review Progress ] for PMO or HOO when there is a pending claim', () => {
      const resultPmo = resolveActiveNextAction({
        project: assignedPmProject,
        user: { sub: 769, id: 769 },
        userRoles: ['PMO'],
        hasPendingClaim: true,
      });

      expect(resultPmo.mode).toBe('REVIEW_PROGRESS_BUTTON');
      expect(resultPmo.buttonLabel).toBe('Review Progress');

      const resultHoo = resolveActiveNextAction({
        project: assignedPmProject,
        user: { sub: 50, id: 50 },
        userRoles: ['HEAD_OF_OPERATIONS'],
        hasPendingClaim: true,
      });

      expect(resultHoo.mode).toBe('REVIEW_PROGRESS_BUTTON');
      expect(resultHoo.buttonLabel).toBe('Review Progress');
    });

    it('should show informational "Monitoring" for non-assigned PM (no mutation leak)', () => {
      const otherPmResult = resolveActiveNextAction({
        project: assignedPmProject,
        user: { sub: 99, id: 99 }, // Different PM
        userRoles: ['PROJECT_MANAGER'],
        hasPendingClaim: false,
      });

      expect(otherPmResult.mode).toBe('MONITORING_TEXT');
      expect(otherPmResult.text).toBe('Monitoring');
      expect(otherPmResult.isAssignedPm).toBe(false);
    });

    it('should show informational "Monitoring" for Admin / SuperAdmin (no unauthorized mutation leak)', () => {
      const adminResult = resolveActiveNextAction({
        project: assignedPmProject,
        user: { sub: 1, id: 1 },
        userRoles: ['SUPER_ADMIN', 'ADMIN'],
        hasPendingClaim: false,
      });

      expect(adminResult.mode).toBe('MONITORING_TEXT');
      expect(adminResult.text).toBe('Monitoring');
    });

    it('should show informational "Monitoring" for Director / Finance / Procurement', () => {
      const directorResult = resolveActiveNextAction({
        project: assignedPmProject,
        user: { sub: 4, id: 4 },
        userRoles: ['DIRECTOR'],
        hasPendingClaim: false,
      });

      expect(directorResult.mode).toBe('MONITORING_TEXT');
      expect(directorResult.text).toBe('Monitoring');
    });
  });
});
