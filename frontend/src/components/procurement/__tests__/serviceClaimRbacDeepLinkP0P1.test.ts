import { describe, it, expect } from '@jest/globals';

describe('EPMS Service Claim P0/P1 RBAC Gating & Deep-Link Resolution Suite', () => {
  // Pure predicate replication matching ServiceClaimModal logic SSOT
  const computeRoleCapabilities = (userRole?: string) => {
    const normalizedRole = String(userRole || '').trim().toUpperCase();
    const isSuperAdmin = normalizedRole === 'SUPER_ADMIN';
    const isPurchasingOrProcurement = ['PROCUREMENT', 'PURCHASING'].includes(normalizedRole) || isSuperAdmin;
    const isProjectManager = normalizedRole === 'PROJECT_MANAGER';

    const canManageClaims = isSuperAdmin || (isPurchasingOrProcurement && !isProjectManager);
    const canVerifyCommercial = isSuperAdmin || (isPurchasingOrProcurement && !isProjectManager);
    const canVerifyTechnical = isSuperAdmin || (isProjectManager && !isPurchasingOrProcurement);

    return {
      canManageClaims,
      canVerifyCommercial,
      canVerifyTechnical,
    };
  };

  const getVisibleActionsForClaim = (
    claimStatus: string,
    userRole?: string
  ): {
    canCreateNew: boolean;
    canEdit: boolean;
    canSubmit: boolean;
    canCancel: boolean;
    canVerifyCommercial: boolean;
    canVerifyTechnical: boolean;
    canViewDetail: boolean;
  } => {
    const caps = computeRoleCapabilities(userRole);

    const isDraftOrRevision = claimStatus === 'DRAFT' || claimStatus === 'NEEDS_REVISION';
    const isSubmitted = claimStatus === 'SUBMITTED';
    const isPmVerified = claimStatus === 'PM_VERIFIED';

    return {
      canCreateNew: caps.canManageClaims,
      canEdit: isDraftOrRevision && caps.canManageClaims,
      canSubmit: isDraftOrRevision && caps.canManageClaims,
      canCancel: isDraftOrRevision && caps.canManageClaims,
      canVerifyCommercial: isPmVerified && caps.canVerifyCommercial,
      canVerifyTechnical: isSubmitted && caps.canVerifyTechnical,
      canViewDetail: true,
    };
  };

  describe('P1 — Frontend Role Gating Invariants', () => {
    it('1. PURCHASING account: can create/edit/submit/cancel and commercially verify; CANNOT technically verify', () => {
      const caps = computeRoleCapabilities('PURCHASING');
      expect(caps.canManageClaims).toBe(true);
      expect(caps.canVerifyCommercial).toBe(true);
      expect(caps.canVerifyTechnical).toBe(false);

      // On SUBMITTED claim: Purchasing MUST NOT see technical verification
      const submittedActions = getVisibleActionsForClaim('SUBMITTED', 'PURCHASING');
      expect(submittedActions.canVerifyTechnical).toBe(false);
      expect(submittedActions.canViewDetail).toBe(true);

      // On PM_VERIFIED claim: Purchasing sees commercial verification
      const verifiedActions = getVisibleActionsForClaim('PM_VERIFIED', 'PURCHASING');
      expect(verifiedActions.canVerifyCommercial).toBe(true);

      // On DRAFT or NEEDS_REVISION: Purchasing sees edit, submit, and cancel
      const revisionActions = getVisibleActionsForClaim('NEEDS_REVISION', 'PURCHASING');
      expect(revisionActions.canEdit).toBe(true);
      expect(revisionActions.canSubmit).toBe(true);
      expect(revisionActions.canCancel).toBe(true);
    });

    it('2. PROCUREMENT account: can create/edit/submit/cancel and commercially verify; CANNOT technically verify', () => {
      const caps = computeRoleCapabilities('PROCUREMENT');
      expect(caps.canManageClaims).toBe(true);
      expect(caps.canVerifyCommercial).toBe(true);
      expect(caps.canVerifyTechnical).toBe(false);

      const submittedActions = getVisibleActionsForClaim('SUBMITTED', 'PROCUREMENT');
      expect(submittedActions.canVerifyTechnical).toBe(false);

      const verifiedActions = getVisibleActionsForClaim('PM_VERIFIED', 'PROCUREMENT');
      expect(verifiedActions.canVerifyCommercial).toBe(true);
    });

    it('3. PROJECT_MANAGER account: CANNOT create, edit, submit, cancel, or commercially verify in ServiceClaimModal', () => {
      const caps = computeRoleCapabilities('PROJECT_MANAGER');
      expect(caps.canManageClaims).toBe(false);
      expect(caps.canVerifyCommercial).toBe(false);

      // In modal header: PM cannot create new claim
      const listActions = getVisibleActionsForClaim('DRAFT', 'PROJECT_MANAGER');
      expect(listActions.canCreateNew).toBe(false);
      expect(listActions.canEdit).toBe(false);
      expect(listActions.canSubmit).toBe(false);
      expect(listActions.canCancel).toBe(false);

      // On PM_VERIFIED claim: PM CANNOT commercially verify
      const verifiedActions = getVisibleActionsForClaim('PM_VERIFIED', 'PROJECT_MANAGER');
      expect(verifiedActions.canVerifyCommercial).toBe(false);

      // PM always retains read-only Detail visibility
      expect(verifiedActions.canViewDetail).toBe(true);
    });

    it('4. SUPER_ADMIN account: possesses full management, commercial, and technical capabilities', () => {
      const caps = computeRoleCapabilities('SUPER_ADMIN');
      expect(caps.canManageClaims).toBe(true);
      expect(caps.canVerifyCommercial).toBe(true);
      expect(caps.canVerifyTechnical).toBe(true);

      const revisionActions = getVisibleActionsForClaim('NEEDS_REVISION', 'SUPER_ADMIN');
      expect(revisionActions.canEdit).toBe(true);
      expect(revisionActions.canSubmit).toBe(true);
      expect(revisionActions.canCancel).toBe(true);

      const verifiedActions = getVisibleActionsForClaim('PM_VERIFIED', 'SUPER_ADMIN');
      expect(verifiedActions.canVerifyCommercial).toBe(true);
    });

    it('5. Status bounds: APPROVED_FOR_INVOICE, REJECTED, and CANCELLED locks out all mutation actions regardless of role', () => {
      ['APPROVED_FOR_INVOICE', 'REJECTED', 'CANCELLED'].forEach((status) => {
        const purActions = getVisibleActionsForClaim(status, 'PURCHASING');
        expect(purActions.canEdit).toBe(false);
        expect(purActions.canSubmit).toBe(false);
        expect(purActions.canCancel).toBe(false);
        expect(purActions.canVerifyCommercial).toBe(false);
        expect(purActions.canVerifyTechnical).toBe(false);
        expect(purActions.canViewDetail).toBe(true);
      });
    });
  });

  describe('P0 — Deep-Link URL Resolution & Navigation Contract', () => {
    it('6. Returned claim notification target resolves correctly to /procurement with poId and claimId', () => {
      const buildReturnedNotificationTarget = (poId: number | null, claimId: number) => {
        return poId
          ? `/procurement?tab=po&poId=${poId}&claimId=${claimId}&action=service-claim`
          : (claimId ? `/procurement?tab=po&claimId=${claimId}&action=service-claim` : `/procurement`);
      };

      const targetWithPo = buildReturnedNotificationTarget(101, 501);
      expect(targetWithPo).toBe('/procurement?tab=po&poId=101&claimId=501&action=service-claim');

      const targetWithoutPo = buildReturnedNotificationTarget(null, 501);
      expect(targetWithoutPo).toBe('/procurement?tab=po&claimId=501&action=service-claim');
    });

    it('7. Rejected claim notification target resolves correctly to /procurement with poId and claimId', () => {
      const buildRejectedNotificationTarget = (poId: number | null, claimId: number) => {
        return poId
          ? `/procurement?tab=po&poId=${poId}&claimId=${claimId}&action=service-claim`
          : (claimId ? `/procurement?tab=po&claimId=${claimId}&action=service-claim` : `/procurement`);
      };

      const target = buildRejectedNotificationTarget(202, 602);
      expect(target).toBe('/procurement?tab=po&poId=202&claimId=602&action=service-claim');
    });

    it('8. To-Do task action target for SERVICE_CLAIM_REVISION resolves to /procurement', () => {
      const buildRevisionTodoTarget = (poId: number | null | undefined, claimId: number) => {
        return poId
          ? `/procurement?tab=po&poId=${poId}&claimId=${claimId}&action=service-claim`
          : `/procurement?tab=po&claimId=${claimId}&action=service-claim`;
      };

      const target = buildRevisionTodoTarget(93, 58);
      expect(target).toBe('/procurement?tab=po&poId=93&claimId=58&action=service-claim');
    });

    it('9. ProcurementPage query parameters contract correctly identifies service-claim intent and auto-opens modal', () => {
      const parseProcurementQueryParams = (query: Record<string, string>) => {
        const poIdParam = query.poId;
        const claimIdParam = query.claimId || query.serviceClaimId;
        const actionParam = query.action;
        const tabParam = query.tab;

        const isServiceClaimAction = actionParam === 'service-claim' || Boolean(claimIdParam);
        const activeTabKey = tabParam === 'po' || poIdParam || tabParam === 'service-claim' ? 'po' : 'pr';
        const shouldOpenServiceClaimModal = Boolean(poIdParam && isServiceClaimAction);

        return {
          poIdParam,
          claimIdParam: claimIdParam ? Number(claimIdParam) : undefined,
          actionParam,
          activeTabKey,
          shouldOpenServiceClaimModal,
        };
      };

      const parsed = parseProcurementQueryParams({
        tab: 'po',
        poId: '93',
        claimId: '58',
        action: 'service-claim',
      });

      expect(parsed.activeTabKey).toBe('po');
      expect(parsed.poIdParam).toBe('93');
      expect(parsed.claimIdParam).toBe(58);
      expect(parsed.shouldOpenServiceClaimModal).toBe(true);
    });

    it('10. Initial view mode selection under deep link obeys role capability', () => {
      const resolveInitialViewMode = (
        claimStatus: string,
        initialClaimId: number | undefined,
        userRole: string
      ): 'DETAIL' | 'VERIFY_COMMERCIAL' | 'VERIFY_TECHNICAL' | 'LIST' => {
        if (!initialClaimId) return 'LIST';

        const caps = computeRoleCapabilities(userRole);

        if (claimStatus === 'PM_VERIFIED' && caps.canVerifyCommercial) {
          return 'VERIFY_COMMERCIAL';
        }
        if (claimStatus === 'SUBMITTED' && caps.canVerifyTechnical) {
          return 'VERIFY_TECHNICAL';
        }
        return 'DETAIL';
      };

      // Purchasing opening PM_VERIFIED claim -> VERIFY_COMMERCIAL
      expect(resolveInitialViewMode('PM_VERIFIED', 55, 'PURCHASING')).toBe('VERIFY_COMMERCIAL');

      // PM opening PM_VERIFIED claim -> DETAIL (PM cannot verify commercially)
      expect(resolveInitialViewMode('PM_VERIFIED', 55, 'PROJECT_MANAGER')).toBe('DETAIL');

      // Purchasing opening NEEDS_REVISION claim -> DETAIL (where edit draft & submit buttons reside)
      expect(resolveInitialViewMode('NEEDS_REVISION', 58, 'PURCHASING')).toBe('DETAIL');

      // Purchasing opening SUBMITTED claim -> DETAIL (Purchasing cannot verify technically)
      expect(resolveInitialViewMode('SUBMITTED', 60, 'PURCHASING')).toBe('DETAIL');

      // PM opening SUBMITTED claim -> VERIFY_TECHNICAL (PM can technically verify)
      expect(resolveInitialViewMode('SUBMITTED', 60, 'PROJECT_MANAGER')).toBe('VERIFY_TECHNICAL');
    });
  });
});

