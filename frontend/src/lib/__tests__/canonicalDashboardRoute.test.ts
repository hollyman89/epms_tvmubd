import fs from 'fs';
import path from 'path';
import {
  MENU_GROUPS,
  getRouteAllowedRoles,
  isRoleAllowedForRoute,
  isItemVisibleForRoles,
  getCanonicalRoleLandingRoute,
} from '@/constants/menuConfig';

describe('PRE-W10 DASHBOARD-ACCESS-F1: Role Access Correction & Canonical Routing Suite', () => {
  describe('1. Dashboard Allowed-Role SSOT & Matrix Authorization', () => {
    const mainGroup = MENU_GROUPS.find((g) => g.label === 'MAIN MENU');
    const dashboardItem = mainGroup?.children.find((item) => item.label === 'Dashboard');

    it('defines Dashboard menu item with canonical /dashboard key and path', () => {
      expect(mainGroup).toBeDefined();
      expect(dashboardItem).toBeDefined();
      expect(dashboardItem?.key).toBe('/dashboard');
      expect(dashboardItem?.path).toBe('/dashboard');
    });

    it('strictly confines allowedRoles to ADMIN, SUPER_ADMIN, and DIRECTOR only', () => {
      expect(dashboardItem?.allowedRoles).toBeDefined();
      const roles = dashboardItem?.allowedRoles.map((r) => r.toUpperCase());
      expect(roles).toEqual(expect.arrayContaining(['ADMIN', 'SUPER_ADMIN', 'DIRECTOR']));
      expect(roles).toHaveLength(3);

      // Verify no unauthorized roles exist in allowedRoles
      expect(roles).not.toContain('HEAD_OF_OPERATIONS');
      expect(roles).not.toContain('GENERAL_MANAGER');
      expect(roles).not.toContain('FINANCE');
      expect(roles).not.toContain('MARKETING');
      expect(roles).not.toContain('LEGAL');
      expect(roles).not.toContain('PMO');
      expect(roles).not.toContain('PROJECT_MANAGER');
      expect(roles).not.toContain('PROCUREMENT');
    });

    it('maps root / route to exact same allowed roles as /dashboard', () => {
      const rootRoles = getRouteAllowedRoles('/');
      const dashboardRoles = getRouteAllowedRoles('/dashboard');
      expect(rootRoles).toEqual(dashboardRoles);
      expect(dashboardRoles).toEqual(expect.arrayContaining(['ADMIN', 'SUPER_ADMIN', 'DIRECTOR']));
      expect(dashboardRoles).toHaveLength(3);
    });

    it('verifies explicit ALLOW matrix for /dashboard and /', () => {
      // Authorized roles: SUPER_ADMIN, ADMIN, DIRECTOR
      expect(isRoleAllowedForRoute('/dashboard', ['SUPER_ADMIN'])).toBe(true);
      expect(isRoleAllowedForRoute('/dashboard', ['ADMIN'])).toBe(true);
      expect(isRoleAllowedForRoute('/dashboard', ['DIRECTOR'])).toBe(true);

      expect(isRoleAllowedForRoute('/', ['SUPER_ADMIN'])).toBe(true);
      expect(isRoleAllowedForRoute('/', ['ADMIN'])).toBe(true);
      expect(isRoleAllowedForRoute('/', ['DIRECTOR'])).toBe(true);
    });

    it('verifies explicit DENY matrix for /dashboard and /', () => {
      // Unauthorized roles MUST be denied
      const deniedRoles = [
        'HEAD_OF_OPERATIONS',
        'MARKETING',
        'LEGAL',
        'PMO',
        'PROJECT_MANAGER',
        'PROCUREMENT',
        'FINANCE',
        'GENERAL_MANAGER',
        'MANAGER',
        'PURCHASING',
      ];

      for (const role of deniedRoles) {
        expect(isRoleAllowedForRoute('/dashboard', [role])).toBe(false);
        expect(isRoleAllowedForRoute('/', [role])).toBe(false);
      }
    });

    it('evaluates sidebar item visibility strictly according to access rules', () => {
      expect(dashboardItem).toBeDefined();

      // Visible ONLY for ADMIN, SUPER_ADMIN, DIRECTOR
      expect(isItemVisibleForRoles(dashboardItem!, ['SUPER_ADMIN'])).toBe(true);
      expect(isItemVisibleForRoles(dashboardItem!, ['ADMIN'])).toBe(true);
      expect(isItemVisibleForRoles(dashboardItem!, ['DIRECTOR'])).toBe(true);

      // Hidden for all unauthorized roles
      expect(isItemVisibleForRoles(dashboardItem!, ['HEAD_OF_OPERATIONS'])).toBe(false);
      expect(isItemVisibleForRoles(dashboardItem!, ['MARKETING'])).toBe(false);
      expect(isItemVisibleForRoles(dashboardItem!, ['LEGAL'])).toBe(false);
      expect(isItemVisibleForRoles(dashboardItem!, ['PMO'])).toBe(false);
      expect(isItemVisibleForRoles(dashboardItem!, ['PROJECT_MANAGER'])).toBe(false);
      expect(isItemVisibleForRoles(dashboardItem!, ['PROCUREMENT'])).toBe(false);
      expect(isItemVisibleForRoles(dashboardItem!, ['FINANCE'])).toBe(false);
      expect(isItemVisibleForRoles(dashboardItem!, ['GENERAL_MANAGER'])).toBe(false);
    });
  });

  describe('2. Canonical Role Landing Route Resolution', () => {
    it('resolves authorized executive roles to /dashboard', () => {
      expect(getCanonicalRoleLandingRoute(['SUPER_ADMIN'])).toBe('/dashboard');
      expect(getCanonicalRoleLandingRoute(['ADMIN'])).toBe('/dashboard');
      expect(getCanonicalRoleLandingRoute(['DIRECTOR'])).toBe('/dashboard');
    });

    it('resolves unauthorized roles to their existing canonical landing routes', () => {
      expect(getCanonicalRoleLandingRoute(['HEAD_OF_OPERATIONS'])).toBe('/project-delivery');
      expect(getCanonicalRoleLandingRoute(['PROJECT_MANAGER'])).toBe('/project-delivery');
      expect(getCanonicalRoleLandingRoute(['PMO'])).toBe('/project-delivery');
      expect(getCanonicalRoleLandingRoute(['PROCUREMENT'])).toBe('/procurement');
      expect(getCanonicalRoleLandingRoute(['PURCHASING'])).toBe('/procurement');
      expect(getCanonicalRoleLandingRoute(['FINANCE'])).toBe('/finance/invoices');
      expect(getCanonicalRoleLandingRoute(['MARKETING'])).toBe('/sales');
      expect(getCanonicalRoleLandingRoute(['GM_MARKETING'])).toBe('/sales');
      expect(getCanonicalRoleLandingRoute(['LEGAL'])).toBe('/legal/review');
      expect(getCanonicalRoleLandingRoute(['GENERAL_MANAGER'])).toBe('/reports');
    });

    it('never resolves unauthorized roles to /dashboard', () => {
      const unauthorizedRoleSets = [
        ['HEAD_OF_OPERATIONS'],
        ['MARKETING'],
        ['LEGAL'],
        ['PMO'],
        ['PROJECT_MANAGER'],
        ['PROCUREMENT'],
        ['FINANCE'],
        ['GENERAL_MANAGER'],
        ['MANAGER'],
      ];

      for (const roles of unauthorizedRoleSets) {
        expect(getCanonicalRoleLandingRoute(roles)).not.toBe('/dashboard');
        expect(getCanonicalRoleLandingRoute(roles)).not.toBe('/');
      }
    });
  });

  describe('3. Source Verification: Root Page Redirect Implementation', () => {
    const rootPagePath = path.resolve(
      process.cwd(),
      'src/app/(dashboard)/page.tsx',
    );
    let rootPageContent: string;

    beforeAll(() => {
      rootPageContent = fs.readFileSync(rootPagePath, 'utf8');
    });

    it('uses getCanonicalRoleLandingRoute for role-aware root redirection', () => {
      expect(rootPageContent).toContain('getCanonicalRoleLandingRoute(user.roles || [])');
      expect(rootPageContent).toContain('router.replace(destination)');
    });

    it('redirects unauthenticated users to /login', () => {
      expect(rootPageContent).toContain("if (!isAuthenticated || !user)");
      expect(rootPageContent).toContain("router.replace(dest)");
      expect(rootPageContent).toContain("'/login'");
    });

    it('preserves query parameters on redirect', () => {
      expect(rootPageContent).toContain('useSearchParams()');
      expect(rootPageContent).toContain('searchParams.toString()');
      expect(rootPageContent).toContain('const destination = qs ? `${landing}?${qs}` : landing');
    });

    it('wraps client search param consumption in React Suspense boundary', () => {
      expect(rootPageContent).toContain('<Suspense');
      expect(rootPageContent).toContain('</Suspense>');
    });
  });

  describe('4. Source Verification: Canonical Dashboard Page Authorization', () => {
    const dashboardPagePath = path.resolve(
      process.cwd(),
      'src/app/(dashboard)/dashboard/page.tsx',
    );
    let dashboardPageContent: string;

    beforeAll(() => {
      dashboardPageContent = fs.readFileSync(dashboardPagePath, 'utf8');
    });

    it('exists at app/(dashboard)/dashboard/page.tsx and renders DashboardComponent', () => {
      expect(dashboardPageContent).toContain("import { DashboardPage as DashboardComponent } from '@/components/DashboardPage'");
      expect(dashboardPageContent).toContain('<DashboardComponent />');
    });

    it('guards /dashboard using isRoleAllowedForRoute and redirects unauthorized roles', () => {
      expect(dashboardPageContent).toContain("isRoleAllowedForRoute('/dashboard', userRoles)");
      expect(dashboardPageContent).toContain("getCanonicalRoleLandingRoute(userRoles)");
      expect(dashboardPageContent).toContain('router.replace(safeDestination)');
    });

    it('prevents redirect loop by ensuring safeDestination is never /dashboard or /', () => {
      expect(dashboardPageContent).toContain("safeDestination = (fallbackRoute === '/dashboard' || fallbackRoute === '/')");
    });
  });

  describe('5. Source Verification: MainLayout and Login Redirection', () => {
    const mainLayoutPath = path.resolve(
      process.cwd(),
      'src/components/MainLayout.tsx',
    );
    const loginPagePath = path.resolve(
      process.cwd(),
      'src/app/login/page.tsx',
    );
    let mainLayoutContent: string;
    let loginPageContent: string;

    beforeAll(() => {
      mainLayoutContent = fs.readFileSync(mainLayoutPath, 'utf8');
      loginPageContent = fs.readFileSync(loginPagePath, 'utf8');
    });

    it('highlights /dashboard menu key on root / or /dashboard pathname', () => {
      expect(mainLayoutContent).toContain("currentKey === '/' ? '/dashboard' : currentKey");
    });

    it('applies seamless background and zero margin to /dashboard', () => {
      expect(mainLayoutContent).toContain("pathname === '/' || pathname === '/dashboard'");
    });

    it('delegates login routing to getCanonicalRoleLandingRoute SSOT', () => {
      expect(loginPageContent).toContain('getCanonicalRoleLandingRoute(userObj?.roles || [])');
    });
  });
});
