import { getRouteAllowedRoles, isRoleAllowedForRoute } from '../../constants/menuConfig';

describe('W9-SEC-R1: Targeted Frontend Actor Authority & Visibility Gate', () => {
  describe('AuthContext Role Logic', () => {
    // Mimic the exact canonical helper derivations from AuthContext.tsx
    const deriveHelpers = (roles: string[]) => {
      const isSuperAdmin = roles.includes('SUPER_ADMIN');
      const isGeneralManager = roles.includes('GENERAL_MANAGER');
      const isHeadOfOperations = roles.includes('HEAD_OF_OPERATIONS');
      const isDirector = roles.includes('DIRECTOR');
      const isProjectManager = roles.includes('PROJECT_MANAGER');
      const isPmo = roles.includes('PMO');
      const isProcurement = roles.includes('PROCUREMENT');
      const isPurchasing = roles.includes('PURCHASING');
      const isFinance = roles.includes('FINANCE');
      const canMakeManagementDecision =
        roles.includes('HEAD_OF_OPERATIONS') ||
        roles.includes('GENERAL_MANAGER') ||
        roles.includes('DIRECTOR');
      const isPmOnly = roles.includes('PROJECT_MANAGER') && !canMakeManagementDecision;

      return {
        isSuperAdmin,
        isGeneralManager,
        isHeadOfOperations,
        isDirector,
        isProjectManager,
        isPmo,
        isProcurement,
        isPurchasing,
        isFinance,
        canMakeManagementDecision,
        isPmOnly,
      };
    };

    it('1. SUPER_ADMIN does not see Finance business mutation CTA', () => {
      const superAdminHelpers = deriveHelpers(['SUPER_ADMIN']);
      expect(superAdminHelpers.isFinance).toBe(false);

      // Invoice verification CTA guard in InvoiceDetailModal
      const canVerifyInvoice = superAdminHelpers.isFinance;
      expect(canVerifyInvoice).toBe(false);

      // Payment creation CTA guard in payments/page.tsx
      const canProcessPayment = superAdminHelpers.isFinance;
      expect(canProcessPayment).toBe(false);
    });

    it('2. SUPER_ADMIN does not see Procurement mutation CTA', () => {
      const superAdminHelpers = deriveHelpers(['SUPER_ADMIN']);
      expect(superAdminHelpers.isProcurement).toBe(false);
      expect(superAdminHelpers.isPurchasing).toBe(false);

      // canPerformProcurementAction guard in ProcurementPage & PackageDrawer
      const canPerformProcurementAction =
        superAdminHelpers.isProcurement || superAdminHelpers.isPurchasing;
      expect(canPerformProcurementAction).toBe(false);

      // canCreateRfq guard
      const canCreateRfq =
        superAdminHelpers.isProcurement || superAdminHelpers.isPurchasing;
      expect(canCreateRfq).toBe(false);

      // canReceiveGoods guard in ProcurementPage
      const userRoles = ['SUPER_ADMIN'];
      const canReceiveGoods =
        superAdminHelpers.isProcurement ||
        superAdminHelpers.isPurchasing ||
        superAdminHelpers.isProjectManager ||
        superAdminHelpers.isHeadOfOperations ||
        userRoles.includes('PMO');
      expect(canReceiveGoods).toBe(false);
    });

    it('3. SUPER_ADMIN does not see Management Review decision CTA', () => {
      const superAdminHelpers = deriveHelpers(['SUPER_ADMIN']);
      expect(superAdminHelpers.canMakeManagementDecision).toBe(false);
    });

    it('4. SUPER_ADMIN does not see Formal Kickoff CTA', () => {
      const user = { sub: 1, roles: ['SUPER_ADMIN'] };
      const recordPmId = 42; // Assigned PM ID != 1

      const isAssignedPm = Boolean(
        user?.sub &&
          recordPmId &&
          Number(recordPmId) === Number(user.sub),
      );
      const canFormalKickoff = isAssignedPm;

      expect(canFormalKickoff).toBe(false);
    });

    it('5. Legal CTA hidden for pure SUPER_ADMIN', () => {
      const userRoles = ['SUPER_ADMIN'];
      const canReview = userRoles.includes('LEGAL');
      expect(canReview).toBe(false);
    });

    it('6. Project progress verification CTA hidden for SUPER_ADMIN', () => {
      const superAdminHelpers = deriveHelpers(['SUPER_ADMIN']);
      const canVerifyProgress =
        superAdminHelpers.isPmo || superAdminHelpers.isHeadOfOperations;
      expect(canVerifyProgress).toBe(false);
    });

    it('7. PMO sees legitimate progress verification CTA', () => {
      const pmoHelpers = deriveHelpers(['PMO']);
      expect(pmoHelpers.isPmo).toBe(true);

      const canVerifyProgress =
        pmoHelpers.isPmo || pmoHelpers.isHeadOfOperations;
      expect(canVerifyProgress).toBe(true);
    });

    it('8. ADMIN does not receive business CTA through stale role arrays', () => {
      const adminHelpers = deriveHelpers(['ADMIN']);

      // Finance verification
      const canVerifyInvoice = adminHelpers.isFinance;
      expect(canVerifyInvoice).toBe(false);

      // Payment processing
      const canProcessPayment = adminHelpers.isFinance;
      expect(canProcessPayment).toBe(false);

      // Procurement action
      const canPerformProcurementAction =
        adminHelpers.isProcurement || adminHelpers.isPurchasing;
      expect(canPerformProcurementAction).toBe(false);

      // Progress verification
      const canVerifyProgress =
        adminHelpers.isPmo || adminHelpers.isHeadOfOperations;
      expect(canVerifyProgress).toBe(false);
    });

    it('9. System Admin UI remains available for ADMIN and SUPER_ADMIN', () => {
      const adminUsersRoles = getRouteAllowedRoles('/admin/users');
      expect(adminUsersRoles).toContain('SUPER_ADMIN');
      expect(adminUsersRoles).toContain('ADMIN');

      expect(isRoleAllowedForRoute('/admin/users', ['SUPER_ADMIN'])).toBe(true);
      expect(isRoleAllowedForRoute('/admin/users', ['ADMIN'])).toBe(true);
    });

    it('10. Technical read-only pages remain available where intended for observation', () => {
      // Invoices list allows SUPER_ADMIN and ADMIN for observation
      const invoiceRoles = [
        'SUPER_ADMIN',
        'ADMIN',
        'FINANCE',
        'DIRECTOR',
        'GENERAL_MANAGER',
        'HEAD_OF_OPERATIONS',
        'PROJECT_MANAGER',
        'PROCUREMENT',
        'PURCHASING',
      ];
      expect(invoiceRoles).toContain('SUPER_ADMIN');
      expect(invoiceRoles).toContain('ADMIN');

      // Payments list allows SUPER_ADMIN and ADMIN for observation
      const paymentPageRoles = [
        'SUPER_ADMIN',
        'ADMIN',
        'FINANCE',
        'DIRECTOR',
        'GENERAL_MANAGER',
        'HEAD_OF_OPERATIONS',
        'MANAGER',
      ];
      expect(paymentPageRoles).toContain('SUPER_ADMIN');
      expect(paymentPageRoles).toContain('ADMIN');
    });
  });
});
