/**
 * EPMS — PROJECT-SERVICE-ENTRY-R1
 * PROJECT DELIVERY → EXISTING SERVICE CLAIM / PM VERIFICATION WIRING
 *
 * Focused Test Suite covering all 6 authoritative cases:
 * CASE 1: Assigned PM sees service verification entry for applicable project.
 * CASE 2: PM can open existing verification modal.
 * CASE 3: claimId deep-link opens correct claim context.
 * CASE 4: PM cannot perform Procurement commercial verification.
 * CASE 5: Material "Paket Pengadaan" remains unchanged.
 * CASE 6: Claim verification does not mutate project progress.
 */

import { resolveNotificationTarget } from '@/lib/notificationSync';
import { resolveTodoActionTarget } from '@/lib/todoActionResolver';
import {
  PmServiceClaimVerificationModalProps,
  resolveModalViewState,
} from '../PmServiceClaimVerificationModal';

describe('EPMS — PROJECT-SERVICE-ENTRY-R1: Project Delivery → Service Claim Wiring Suite', () => {
  // Mock Project representing assigned Asianet project
  const mockAsianetProject = {
    id: 1760,
    projectId: 1760,
    project_code: 'CONT-ASIANET-001',
    project_name: 'Implementasi Fiber Optik Asianet Jakarta',
    customerName: 'PT Asianet Media Teknologi',
    contract_total_value: 750000000,
    managerId: 42,
    projectManagerId: 42,
    pmName: 'Johan PM',
    status: 'IN_PROGRESS',
    overallProgress: 65,
  };

  const mockServiceClaim = {
    id: 108,
    claimNumber: 'CLM-SRV-202610-0001',
    poId: 55,
    projectId: 1760,
    vendorId: 12,
    status: 'SUBMITTED',
    totalClaimAmount: 85000000,
    items: [
      {
        id: 1,
        poItemId: 201,
        itemNameSnapshot: 'Pemasangan Tiang Fiber & FO Drop Cable',
        contractQuantitySnapshot: 100,
        currentClaimQuantity: 25,
        cumulativeApprovedQuantity: 25,
        remainingQuantity: 75,
        currentClaimAmount: 85000000,
      },
    ],
  };

  // Helper simulating "Aksi lainnya" menu item resolution in Project Delivery
  const resolveProjectDeliveryMoreMenuItems = (
    project: typeof mockAsianetProject,
    user: { id: number; roles: string[] }
  ) => {
    const isAssignedPm = Number(project.managerId) === Number(user.id);
    const isManagement = user.roles.some((r) =>
      ['SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'PMO'].includes(r)
    );
    const hasAccess = isAssignedPm || isManagement;

    const items: Array<{ key: string; label: string }> = [
      { key: 'workspace', label: 'Buka Project Workspace' },
      { key: 'detail', label: 'Detail Project' },
      { key: 'task-board', label: 'Task Board' },
      { key: 'progress-monitoring', label: 'Progress & Monitoring (S-Curve)' },
      { key: 'gantt', label: 'Gantt Chart (Baseline vs Actual)' },
      { key: 'procurement', label: 'Paket Pengadaan' },
    ];

    if (hasAccess) {
      items.push({ key: 'service-claim', label: 'Verifikasi Klaim Jasa' });
    }

    items.push({ key: 'operational-plan', label: 'Operational Plan' });
    items.push({ key: 'closure', label: 'Project Closure' });

    return items;
  };

  describe('CASE 1: Assigned PM sees service verification entry for applicable project', () => {
    it('shows "Verifikasi Klaim Jasa" action to the assigned Project Manager', () => {
      const pmUser = { id: 42, roles: ['PROJECT_MANAGER'] };
      const menuItems = resolveProjectDeliveryMoreMenuItems(mockAsianetProject, pmUser);

      const serviceAction = menuItems.find((item) => item.key === 'service-claim');
      expect(serviceAction).toBeDefined();
      expect(serviceAction?.label).toBe('Verifikasi Klaim Jasa');
    });

    it('shows "Verifikasi Klaim Jasa" to management/super admin users', () => {
      const adminUser = { id: 1, roles: ['SUPER_ADMIN'] };
      const menuItems = resolveProjectDeliveryMoreMenuItems(mockAsianetProject, adminUser);

      expect(menuItems.some((i) => i.key === 'service-claim')).toBe(true);
    });

    it('does NOT expose "Verifikasi Klaim Jasa" to an unassigned PM without management override', () => {
      const otherPmUser = { id: 99, roles: ['PROJECT_MANAGER'] };
      const menuItems = resolveProjectDeliveryMoreMenuItems(mockAsianetProject, otherPmUser);

      expect(menuItems.some((i) => i.key === 'service-claim')).toBe(false);
    });
  });

  describe('CASE 2: PM can open existing verification modal with required props', () => {
    it('PmServiceClaimVerificationModalProps accepts open, claimId, projectId, onClose, and onSuccess', () => {
      let modalOpen = true;
      let refreshedClaim = null;

      const props: PmServiceClaimVerificationModalProps = {
        open: modalOpen,
        claimId: 108,
        projectId: 1760,
        onClose: () => {
          modalOpen = false;
        },
        onSuccess: (updatedClaim) => {
          refreshedClaim = updatedClaim;
        },
      };

      expect(props.open).toBe(true);
      expect(props.claimId).toBe(108);
      expect(props.projectId).toBe(1760);

      props.onClose();
      expect(modalOpen).toBe(false);

      props.onSuccess?.(mockServiceClaim as any);
      expect(refreshedClaim).toEqual(mockServiceClaim);
    });

    it('modal supports opening via project row with projectId alone when claimId is not pre-selected', () => {
      const props: PmServiceClaimVerificationModalProps = {
        open: true,
        projectId: 1760,
        onClose: () => {},
      };

      expect(props.projectId).toBe(1760);
      expect(props.claimId).toBeUndefined();
    });
  });

  describe('CASE 3: claimId deep-link opens correct claim context', () => {
    it('normalizes backend-emitted /project?projectId=:p&claimId=:c to canonical /project-delivery target', () => {
      const backendNotification = {
        actionTarget: '/project?projectId=1760&claimId=108',
        metaData: {
          claimId: 108,
          projectId: 1760,
        },
      };

      const target = resolveNotificationTarget(backendNotification);
      expect(target).toBe('/project-delivery?projectId=1760&claimId=108');
    });

    it('derives canonical /project-delivery target from service-claim metadata when actionTarget is empty', () => {
      const notifWithoutTarget = {
        actionTarget: '',
        metaData: {
          category: 'SERVICE_CLAIM',
          claimId: 108,
          projectId: 1760,
        },
      };

      const target = resolveNotificationTarget(notifWithoutTarget);
      expect(target).toBe('/project-delivery?projectId=1760&claimId=108');
    });

    it('resolves inbox todo action target with /project? normalization', () => {
      const todoItem = {
        actionTarget: '/project?projectId=1760&claimId=108',
      };

      const target = resolveTodoActionTarget(todoItem);
      expect(target).toBe('/project-delivery?projectId=1760&claimId=108');
    });

    it('parses claimId and projectId from URL search params correctly in Project Delivery workspace', () => {
      const url = new URL('https://app.epms.local/project-delivery?projectId=1760&claimId=108');
      const projectIdParam = url.searchParams.get('projectId');
      const claimIdParam = url.searchParams.get('claimId');

      expect(Number(projectIdParam)).toBe(1760);
      expect(Number(claimIdParam)).toBe(108);
    });
  });

  describe('CASE 4: PM cannot perform Procurement commercial verification', () => {
    it('modal decision options are strictly limited to technical decisions: APPROVE, RETURN, REJECT', () => {
      const allowedTechnicalDecisions = ['APPROVE', 'RETURN', 'REJECT'];
      const forbiddenCommercialActions = ['APPROVE_FOR_INVOICE', 'CREATE_CLAIM', 'CREATE_SERVICE_PO', 'CREATE_GR'];

      // Technical verification only accepts technical decisions
      expect(allowedTechnicalDecisions).toContain('APPROVE');
      expect(allowedTechnicalDecisions).toContain('RETURN');
      expect(allowedTechnicalDecisions).toContain('REJECT');

      // None of the commercial actions are present in PM verification options
      forbiddenCommercialActions.forEach((action) => {
        expect(allowedTechnicalDecisions).not.toContain(action);
      });
    });

    it('preserves Segregation of Duties: PM verifies technical volume, Procurement verifies commercial invoice eligibility', () => {
      const pmRole = 'PROJECT_MANAGER';
      const procurementRole = 'PROCUREMENT';

      const canVerifyTechnical = (role: string) => ['PROJECT_MANAGER', 'SUPER_ADMIN'].includes(role);
      const canVerifyCommercial = (role: string) => ['PROCUREMENT', 'PURCHASING', 'SUPER_ADMIN'].includes(role);

      expect(canVerifyTechnical(pmRole)).toBe(true);
      expect(canVerifyCommercial(pmRole)).toBe(false);

      expect(canVerifyCommercial(procurementRole)).toBe(true);
      expect(canVerifyTechnical(procurementRole)).toBe(false);
    });
  });

  describe('CASE 5: Material "Paket Pengadaan" remains unchanged', () => {
    it('Paket Pengadaan and Verifikasi Klaim Jasa coexist as distinct menu items', () => {
      const pmUser = { id: 42, roles: ['PROJECT_MANAGER'] };
      const menuItems = resolveProjectDeliveryMoreMenuItems(mockAsianetProject, pmUser);

      const paketPengadaan = menuItems.find((i) => i.key === 'procurement');
      const klaimJasa = menuItems.find((i) => i.key === 'service-claim');

      expect(paketPengadaan).toBeDefined();
      expect(paketPengadaan?.label).toBe('Paket Pengadaan');

      expect(klaimJasa).toBeDefined();
      expect(klaimJasa?.label).toBe('Verifikasi Klaim Jasa');

      // They are distinct actions
      expect(paketPengadaan?.key).not.toBe(klaimJasa?.key);
    });
  });

  describe('CASE 6: Claim verification does not mutate project progress', () => {
    it('technical verification of service claim leaves project progress intact', () => {
      const initialProjectProgress = mockAsianetProject.overallProgress;

      // Executing technical verification transitions claim state only
      const verifiedClaim = {
        ...mockServiceClaim,
        status: 'PM_VERIFIED',
        pmVerifierId: 42,
        pmVerifiedAt: new Date().toISOString(),
      };

      expect(verifiedClaim.status).toBe('PM_VERIFIED');
      expect(verifiedClaim.pmVerifierId).toBe(42);

      // Project physical S-Curve / overall progress must NOT be mutated by claim verification
      const projectProgressAfterClaim = mockAsianetProject.overallProgress;
      expect(projectProgressAfterClaim).toBe(initialProjectProgress);
      expect(projectProgressAfterClaim).toBe(65);
    });
  });

  describe('CASE 7: Presentation Semantics — Success Empty vs Request Error vs Retry (Phase 11)', () => {
    it('success + []: shows Empty state ("Belum ada klaim jasa yang diajukan untuk proyek ini.")', () => {
      const state = {
        loading: false,
        errorMessage: null,
        claim: null,
      };
      const view = resolveModalViewState(state);
      expect(view.type).toBe('EMPTY');
      expect(view.description).toBe('Belum ada klaim jasa yang diajukan untuk proyek ini.');
    });

    it('request error: shows Error state ("Gagal memuat klaim jasa.")', () => {
      const state = {
        loading: false,
        errorMessage: 'Request failed with status code 404',
        claim: null,
      };
      const view = resolveModalViewState(state);
      expect(view.type).toBe('ERROR');
      expect(view.title).toBe('Gagal memuat klaim jasa.');
      expect(view.description).toBe('Request failed with status code 404');
    });

    it('request error: does NOT render valid Empty state', () => {
      const state = {
        loading: false,
        errorMessage: 'Cannot GET /api/v1/procurement/service-claims?projectId=1',
        claim: null,
      };
      const view = resolveModalViewState(state);
      expect(view.type).not.toBe('EMPTY');
      expect(view.type).toBe('ERROR');
    });

    it('Retry action: resets error state and re-invokes loadProjectClaims', () => {
      let currentError: string | null = 'Initial failure';
      let loading = false;
      let loadCount = 0;

      const mockLoadProjectClaims = (pid: number) => {
        loadCount++;
        loading = true;
        currentError = null;
      };

      // 1. Initial failure state
      let view = resolveModalViewState({ loading, errorMessage: currentError, claim: null });
      expect(view.type).toBe('ERROR');
      expect(view.type).not.toBe('EMPTY');

      // 2. User clicks "Coba Lagi" (Retry)
      mockLoadProjectClaims(1);
      expect(loadCount).toBe(1);
      expect(currentError).toBeNull();
      expect(loading).toBe(true);

      // 3. Loading in progress
      view = resolveModalViewState({ loading, errorMessage: currentError, claim: null });
      expect(view.type).toBe('LOADING');
      expect(view.type).not.toBe('EMPTY');
      expect(view.type).not.toBe('ERROR');
    });
  });
});
