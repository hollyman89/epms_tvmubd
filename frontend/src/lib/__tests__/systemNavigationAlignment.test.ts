import {
  MENU_GROUPS,
  getRouteAllowedRoles,
  isRoleAllowedForRoute,
  isItemVisibleForRoles,
} from '@/constants/menuConfig';

describe('PRE-W10 SETTINGS-NAV-F1: Role-Aware System Navigation Alignment', () => {
  const systemGroup = MENU_GROUPS.find((g) => g.label === 'SYSTEM');

  const getSystemItem = (key: string) =>
    systemGroup?.children.find((item) => item.key === key || item.path === key);

  // 1. SUPER_ADMIN SYSTEM menu deduplication
  describe('1. SUPER_ADMIN SYSTEM Menu Deduplication', () => {
    it('shows Unified Inbox and Settings in sidebar for SUPER_ADMIN', () => {
      const inbox = getSystemItem('/inbox');
      const settings = getSystemItem('/settings');

      expect(inbox).toBeDefined();
      expect(settings).toBeDefined();

      expect(isItemVisibleForRoles(inbox!, ['SUPER_ADMIN'])).toBe(true);
      expect(isItemVisibleForRoles(settings!, ['SUPER_ADMIN'])).toBe(true);
    });

    it('hides Users & Roles, Workflow Designer, and Audit Trail from sidebar for SUPER_ADMIN', () => {
      const users = getSystemItem('/admin/users');
      const workflow = getSystemItem('/workflow');
      const audit = getSystemItem('/audit-trail');

      expect(users).toBeDefined();
      expect(workflow).toBeDefined();
      expect(audit).toBeDefined();

      expect(isItemVisibleForRoles(users!, ['SUPER_ADMIN'])).toBe(false);
      expect(isItemVisibleForRoles(workflow!, ['SUPER_ADMIN'])).toBe(false);
      expect(isItemVisibleForRoles(audit!, ['SUPER_ADMIN'])).toBe(false);
    });

    it('evaluates visible SYSTEM menu items for SUPER_ADMIN to exactly Pusat Aktivitas and Settings', () => {
      const visibleItems = (systemGroup?.children || []).filter((item) =>
        isItemVisibleForRoles(item, ['SUPER_ADMIN'])
      );

      const visibleLabels = visibleItems.map((item) => item.label);
      expect(visibleLabels).toEqual(['Pusat Aktivitas', 'Settings']);
    });
  });

  // 2. ADMIN role system navigation and authorization
  describe('2. ADMIN System Navigation and Route Authorization', () => {
    it('shows Users & Roles in sidebar for ADMIN', () => {
      const users = getSystemItem('/admin/users');
      expect(users).toBeDefined();
      expect(isItemVisibleForRoles(users!, ['ADMIN'])).toBe(true);
    });

    it('authorizes /admin/users route for ADMIN role', () => {
      expect(isRoleAllowedForRoute('/admin/users', ['ADMIN'])).toBe(true);
      expect(isRoleAllowedForRoute('/admin/users', ['admin'])).toBe(true);
      const roles = getRouteAllowedRoles('/admin/users');
      expect(roles).toContain('ADMIN');
      expect(roles).toContain('SUPER_ADMIN');
    });
  });

  // 3. HEAD_OF_OPERATIONS system navigation
  describe('3. HEAD_OF_OPERATIONS System Navigation', () => {
    it('shows Workflow Designer and Unified Inbox in sidebar for HEAD_OF_OPERATIONS', () => {
      const workflow = getSystemItem('/workflow');
      const inbox = getSystemItem('/inbox');

      expect(workflow).toBeDefined();
      expect(inbox).toBeDefined();

      expect(isItemVisibleForRoles(workflow!, ['HEAD_OF_OPERATIONS'])).toBe(true);
      expect(isItemVisibleForRoles(inbox!, ['HEAD_OF_OPERATIONS'])).toBe(true);
    });

    it('hides Users & Roles, Audit Trail, and Settings for HEAD_OF_OPERATIONS', () => {
      const users = getSystemItem('/admin/users');
      const audit = getSystemItem('/audit-trail');
      const settings = getSystemItem('/settings');

      expect(isItemVisibleForRoles(users!, ['HEAD_OF_OPERATIONS'])).toBe(false);
      expect(isItemVisibleForRoles(audit!, ['HEAD_OF_OPERATIONS'])).toBe(false);
      expect(isItemVisibleForRoles(settings!, ['HEAD_OF_OPERATIONS'])).toBe(false);
    });
  });

  // 4. PROJECT_MANAGER system navigation
  describe('4. PROJECT_MANAGER System Navigation', () => {
    it('shows Unified Inbox for PROJECT_MANAGER and hides administrative items', () => {
      const inbox = getSystemItem('/inbox');
      const users = getSystemItem('/admin/users');
      const workflow = getSystemItem('/workflow');
      const settings = getSystemItem('/settings');

      expect(isItemVisibleForRoles(inbox!, ['PROJECT_MANAGER'])).toBe(true);
      expect(isItemVisibleForRoles(users!, ['PROJECT_MANAGER'])).toBe(false);
      expect(isItemVisibleForRoles(workflow!, ['PROJECT_MANAGER'])).toBe(false);
      expect(isItemVisibleForRoles(settings!, ['PROJECT_MANAGER'])).toBe(false);
    });
  });

  // 5. MARKETING role navigation and inbox authorization
  describe('5. MARKETING Navigation and Route Authorization', () => {
    it('shows Unified Inbox in sidebar for MARKETING', () => {
      const inbox = getSystemItem('/inbox');
      expect(isItemVisibleForRoles(inbox!, ['MARKETING'])).toBe(true);
    });

    it('authorizes /inbox route for MARKETING role', () => {
      expect(isRoleAllowedForRoute('/inbox', ['MARKETING'])).toBe(true);
      const roles = getRouteAllowedRoles('/inbox');
      expect(roles).toContain('MARKETING');
    });
  });

  // 6. LEGAL role navigation and inbox authorization
  describe('6. LEGAL Navigation and Route Authorization', () => {
    it('shows Unified Inbox in sidebar for LEGAL', () => {
      const inbox = getSystemItem('/inbox');
      expect(isItemVisibleForRoles(inbox!, ['LEGAL'])).toBe(true);
    });

    it('authorizes /inbox route for LEGAL role', () => {
      expect(isRoleAllowedForRoute('/inbox', ['LEGAL'])).toBe(true);
      const roles = getRouteAllowedRoles('/inbox');
      expect(roles).toContain('LEGAL');
    });
  });

  // 7. Settings remains SUPER_ADMIN only
  describe('7. Settings Route Security', () => {
    it('ensures Settings is accessible only to SUPER_ADMIN', () => {
      expect(isRoleAllowedForRoute('/settings', ['SUPER_ADMIN'])).toBe(true);
      expect(isRoleAllowedForRoute('/settings', ['ADMIN'])).toBe(false);
      expect(isRoleAllowedForRoute('/settings', ['HEAD_OF_OPERATIONS'])).toBe(false);
      expect(isRoleAllowedForRoute('/settings', ['PROJECT_MANAGER'])).toBe(false);
      expect(isRoleAllowedForRoute('/settings', ['MARKETING'])).toBe(false);
      expect(isRoleAllowedForRoute('/settings', ['LEGAL'])).toBe(false);
      expect(isRoleAllowedForRoute('/settings', ['DIRECTOR'])).toBe(false);
    });
  });

  // 8. Workflow route permissions remain unchanged
  describe('8. Workflow Route Permissions Preservation', () => {
    it('preserves route authorization for SUPER_ADMIN and HEAD_OF_OPERATIONS', () => {
      expect(isRoleAllowedForRoute('/workflow', ['SUPER_ADMIN'])).toBe(true);
      expect(isRoleAllowedForRoute('/workflow', ['HEAD_OF_OPERATIONS'])).toBe(true);
      expect(isRoleAllowedForRoute('/workflow', ['PROJECT_MANAGER'])).toBe(false);
      expect(isRoleAllowedForRoute('/workflow', ['MARKETING'])).toBe(false);
    });
  });

  // 9. Canonical route existence across MENU_GROUPS
  describe('9. Canonical Route Preservation', () => {
    it('ensures all 5 canonical routes remain registered in MENU_GROUPS', () => {
      const paths = (systemGroup?.children || []).map((c) => c.path || c.key);
      expect(paths).toContain('/admin/users');
      expect(paths).toContain('/workflow');
      expect(paths).toContain('/inbox');
      expect(paths).toContain('/audit-trail');
      expect(paths).toContain('/settings');
    });
  });
});
