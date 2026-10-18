import { MENU_GROUPS, getRouteAllowedRoles, isRoleAllowedForRoute } from '@/constants/menuConfig';

describe('W9-CP2: Frontend Inbox Access Control Alignment', () => {
  it('includes LEGAL in allowedRoles for /inbox route', () => {
    const allowed = getRouteAllowedRoles('/inbox');
    expect(allowed).toBeDefined();
    expect(allowed).toContain('LEGAL');
  });

  it('includes MARKETING in allowedRoles for /inbox route', () => {
    const allowed = getRouteAllowedRoles('/inbox');
    expect(allowed).toBeDefined();
    expect(allowed).toContain('MARKETING');
  });

  it('permits LEGAL role to access /inbox via isRoleAllowedForRoute', () => {
    expect(isRoleAllowedForRoute('/inbox', ['LEGAL'])).toBe(true);
    expect(isRoleAllowedForRoute('/inbox?tab=history', ['legal'])).toBe(true); // Case-insensitive
  });

  it('permits MARKETING role to access /inbox via isRoleAllowedForRoute', () => {
    expect(isRoleAllowedForRoute('/inbox', ['MARKETING'])).toBe(true);
    expect(isRoleAllowedForRoute('/inbox', ['marketing'])).toBe(true);
  });

  it('preserves existing canonical workflow roles for /inbox', () => {
    const canonicalRoles = [
      'SUPER_ADMIN',
      'GENERAL_MANAGER',
      'HEAD_OF_OPERATIONS',
      'PROJECT_MANAGER',
      'PMO',
      'FINANCE',
      'DIRECTOR',
      'MANAGER',
      'PROCUREMENT',
      'PURCHASING',
      'LEGAL',
      'MARKETING',
    ];

    for (const role of canonicalRoles) {
      expect(isRoleAllowedForRoute('/inbox', [role])).toBe(true);
    }
  });

  it('rejects unauthorized or unknown roles from /inbox', () => {
    expect(isRoleAllowedForRoute('/inbox', ['GUEST'])).toBe(false);
    expect(isRoleAllowedForRoute('/inbox', ['UNKNOWN_ROLE'])).toBe(false);
    expect(isRoleAllowedForRoute('/inbox', [])).toBe(false);
  });

  it('ensures /inbox menu item exists exactly once across MENU_GROUPS', () => {
    let inboxCount = 0;
    for (const group of MENU_GROUPS) {
      for (const item of group.children) {
        if (item.key === '/inbox' || item.path === '/inbox') {
          inboxCount++;
        }
      }
    }
    expect(inboxCount).toBe(1);
  });
});
