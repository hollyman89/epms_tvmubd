import { getRouteAllowedRoles, isRoleAllowedForRoute, MENU_GROUPS } from '../../constants/menuConfig';

describe('W9-CP3: Frontend Admin Authority Alignment', () => {
  it('allows ADMIN and SUPER_ADMIN for /admin/users route in menuConfig', () => {
    const roles = getRouteAllowedRoles('/admin/users');
    expect(roles).toBeDefined();
    expect(roles).toContain('SUPER_ADMIN');
    expect(roles).toContain('ADMIN');
  });

  it('permits ADMIN role to access /admin/users route via isRoleAllowedForRoute', () => {
    expect(isRoleAllowedForRoute('/admin/users', ['ADMIN'])).toBe(true);
    expect(isRoleAllowedForRoute('/admin/users', ['admin'])).toBe(true); // case-insensitive
    expect(isRoleAllowedForRoute('/admin/users', ['SUPER_ADMIN'])).toBe(true);
  });

  it('does NOT allow ADMIN access to business routes such as /inbox, /workflow', () => {
    // /inbox allowed roles are canonical business roles
    const inboxRoles = getRouteAllowedRoles('/inbox');
    expect(inboxRoles).toBeDefined();
    expect(inboxRoles).not.toContain('ADMIN');

    // ADMIN is rejected from /inbox unless having independent business role
    expect(isRoleAllowedForRoute('/inbox', ['ADMIN'])).toBe(false);

    // /workflow allowed roles are SUPER_ADMIN and HEAD_OF_OPERATIONS
    const workflowRoles = getRouteAllowedRoles('/workflow');
    expect(workflowRoles).toBeDefined();
    expect(workflowRoles).not.toContain('ADMIN');
    expect(isRoleAllowedForRoute('/workflow', ['ADMIN'])).toBe(false);
  });

  it('ensures /admin/users menu item exists exactly once across MENU_GROUPS', () => {
    let count = 0;
    for (const group of MENU_GROUPS) {
      for (const item of group.children) {
        if (item.path === '/admin/users' || item.key === '/admin/users') {
          count++;
        }
      }
    }
    expect(count).toBe(1);
  });
});
