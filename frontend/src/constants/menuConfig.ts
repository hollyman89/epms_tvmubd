import React from 'react';

export interface MenuItemConfig {
  key: string;
  label: string;
  path?: string;
  iconName?: string;
  allowedRoles: string[];
  requiredPermissions?: string[];
  visibilityRule?: (roles: string[]) => boolean;
}

export interface MenuGroupConfig {
  type: 'group';
  label: string;
  children: MenuItemConfig[];
}

/**
 * Single Source of Truth (SSOT) for EPMS Application Navigation and Route Access.
 * Used by MainLayout (Sidebar rendering) and ProtectedRoute (Access guarding).
 */
export const MENU_GROUPS: MenuGroupConfig[] = [
  {
    type: 'group',
    label: 'MAIN MENU',
    children: [
      {
        key: '/dashboard',
        label: 'Dashboard',
        path: '/dashboard',
        iconName: 'DashboardOutlined',
        // PRE-W10 DASHBOARD-ACCESS-F1: Accessible ONLY by ADMIN, SUPER_ADMIN, and DIRECTOR
        allowedRoles: ['ADMIN', 'SUPER_ADMIN', 'DIRECTOR'],
      },
      {
        key: '/reports',
        label: 'KPI & Reports',
        path: '/reports',
        iconName: 'BarChartOutlined',
        allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'DIRECTOR', 'MANAGER', 'GM_MARKETING'],
      },
    ],
  },
  {
    type: 'group',
    label: 'MODULES',
    children: [
      {
        key: '/sales',
        label: 'Marketing',
        path: '/sales',
        iconName: 'NotificationOutlined',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'DIRECTOR', 'MARKETING'],
      },
      {
        key: '/project-delivery',
        label: 'Project Delivery',
        path: '/project-delivery',
        iconName: 'ProjectOutlined',
        allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'DIRECTOR', 'PMO', 'PROJECT_MANAGER'],
      },
      {
        key: '/finance/invoices',
        label: 'Finance & Invoices',
        path: '/finance/invoices',
        iconName: 'DollarOutlined',
        allowedRoles: ['SUPER_ADMIN', 'FINANCE', 'DIRECTOR', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'PROJECT_MANAGER'],
      },
      {
        key: '/finance/payments',
        label: 'Payments & Kas/Bank',
        path: '/finance/payments',
        iconName: 'AccountBookOutlined',
        allowedRoles: ['SUPER_ADMIN', 'FINANCE', 'DIRECTOR', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS'],
      },
      {
        key: '/procurement',
        label: 'Procurement',
        path: '/procurement',
        iconName: 'ShoppingCartOutlined',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'PROJECT_MANAGER', 'FINANCE', 'MANAGER', 'DIRECTOR', 'PROCUREMENT', 'PURCHASING'],
      },
    ],
  },
  {
    type: 'group',
    label: 'DATA MASTER',
    children: [
      {
        key: '/customers',
        label: 'Customers',
        path: '/customers',
        iconName: 'UsergroupAddOutlined',
        allowedRoles: ['SUPER_ADMIN', 'MARKETING', 'GENERAL_MANAGER', 'DIRECTOR'],
      },
      {
        key: '/vendors',
        label: 'Vendors',
        path: '/vendors',
        iconName: 'ShopOutlined',
        allowedRoles: [
          'PROCUREMENT',
          'PURCHASING',
          'PROJECT_MANAGER',
          'PMO',
          'SUPER_ADMIN',
          'ADMIN',
          'DIRECTOR',
          'GENERAL_MANAGER',
          'MANAGER',
          'HEAD_OF_OPERATIONS',
          'FINANCE',
        ],
      },
      {
        key: '/projects',
        label: 'Project Master',
        path: '/projects',
        iconName: 'FolderOpenOutlined',
        allowedRoles: [
          'SUPER_ADMIN',
          'ADMIN',
          'DIRECTOR',
          'GENERAL_MANAGER',
          'HEAD_OF_OPERATIONS',
          'PMO',
          'PROJECT_MANAGER',
          'PROCUREMENT',
          'PURCHASING',
          'FINANCE',
          'LEGAL',
          'MARKETING',
          'MARKETING_MANAGER',
        ],
      },
      {
        key: '/documents',
        label: 'Documents',
        path: '/documents',
        iconName: 'FileOutlined',
        allowedRoles: ['SUPER_ADMIN', 'DIRECTOR', 'LEGAL', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS'],
      },
    ],
  },
  {
    type: 'group',
    label: 'PROJECT GOVERNANCE',
    children: [
      {
        key: '/legal/review',
        label: 'Legal Review',
        path: '/legal/review',
        iconName: 'SafetyCertificateOutlined',
        allowedRoles: ['SUPER_ADMIN', 'LEGAL', 'DIRECTOR'],
      },
      {
        key: '/governance/contracts',
        label: 'Contracts',
        path: '/governance/contracts',
        iconName: 'FileTextOutlined',
        // PROJECT_MANAGER is strictly removed from Global Contracts
        allowedRoles: ['SUPER_ADMIN', 'LEGAL', 'DIRECTOR', 'HEAD_OF_OPERATIONS', 'GENERAL_MANAGER'],
      },
      {
        key: '/governance/tasks',
        label: 'Approval Center',
        path: '/governance/tasks',
        iconName: 'AuditOutlined',
        allowedRoles: [
          'SUPER_ADMIN',
          'GENERAL_MANAGER',
          'HEAD_OF_OPERATIONS',
          'PROCUREMENT',
          'PURCHASING',
          'FINANCE',
          'DIRECTOR',
        ],
      },
    ],
  },
  {
    type: 'group',
    label: 'SYSTEM',
    children: [
      {
        key: '/admin/users',
        label: 'Users & Roles',
        path: '/admin/users',
        iconName: 'TeamOutlined',
        allowedRoles: ['SUPER_ADMIN', 'ADMIN'],
        // Deduplicated for SUPER_ADMIN (accessible via Settings -> Administration)
        visibilityRule: (roles: string[]) => !roles.some((r) => r.toUpperCase() === 'SUPER_ADMIN'),
      },
      {
        key: '/workflow',
        label: 'Workflow Designer',
        path: '/workflow',
        iconName: 'NodeIndexOutlined',
        // PROJECT_MANAGER is strictly removed from Workflow Designer
        // Deduplicated for SUPER_ADMIN (accessible via Settings -> Administration)
        allowedRoles: ['SUPER_ADMIN', 'HEAD_OF_OPERATIONS'],
        visibilityRule: (roles: string[]) => !roles.some((r) => r.toUpperCase() === 'SUPER_ADMIN'),
      },
      {
        key: '/inbox',
        label: 'Pusat Aktivitas',
        path: '/inbox',
        iconName: 'MailOutlined',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'PROJECT_MANAGER', 'PMO', 'FINANCE', 'DIRECTOR', 'MANAGER', 'PROCUREMENT', 'PURCHASING', 'LEGAL', 'MARKETING'],
      },
      {
        key: '/audit-trail',
        label: 'Audit Trail',
        path: '/audit-trail',
        iconName: 'LineChartOutlined',
        allowedRoles: ['SUPER_ADMIN'],
        // Deduplicated for SUPER_ADMIN (accessible via Settings -> Administration)
        visibilityRule: (roles: string[]) => !roles.some((r) => r.toUpperCase() === 'SUPER_ADMIN'),
      },
      {
        key: '/settings',
        label: 'Settings',
        path: '/settings',
        iconName: 'SettingOutlined',
        allowedRoles: ['SUPER_ADMIN'],
      },
    ],
  },
];

/**
 * Resolves the allowed roles for a given pathname from the centralized MENU_GROUPS.
 * Normalizes trailing slashes and handles query parameters.
 */
export function getRouteAllowedRoles(pathname: string): string[] | undefined {
  if (!pathname) return undefined;
  const cleanPath = pathname.split('?')[0].replace(/\/$/, '') || '/';
  const lookupPath = cleanPath === '/' ? '/dashboard' : cleanPath;

  for (const group of MENU_GROUPS) {
    for (const item of group.children) {
      const itemPath = (item.path || item.key).split('?')[0].replace(/\/$/, '') || '/';
      if (itemPath === lookupPath || itemPath === cleanPath) {
        return item.allowedRoles;
      }
    }
  }
  return undefined;
}

/**
 * Evaluates whether any of the user's roles are authorized for a given route.
 * Normalizes all roles to UPPERCASE to guarantee case-insensitive parity.
 */
export function isRoleAllowedForRoute(pathname: string, userRoles: string[] = []): boolean {
  const allowed = getRouteAllowedRoles(pathname);
  if (!allowed || allowed.length === 0) return true; // If route not restricted by menuConfig, allow
  const userUpper = userRoles.map((r) => String(r).toUpperCase());
  return allowed.some((role) => userUpper.includes(String(role).toUpperCase()));
}

/**
 * Evaluates whether a menu item should be visible in the navigation sidebar for given user roles.
 * Evaluates both allowedRoles and any custom visibilityRule.
 */
export function isItemVisibleForRoles(item: MenuItemConfig, userRoles: string[] = []): boolean {
  if (!item) return false;
  const userUpper = userRoles.map((r) => String(r).toUpperCase());
  const hasRole = !item.allowedRoles || item.allowedRoles.some((role) => userUpper.includes(String(role).toUpperCase()));
  if (!hasRole) return false;
  if (item.visibilityRule) {
    return item.visibilityRule(userUpper);
  }
  return true;
}

/**
 * Resolves the canonical landing route for a user based on their roles.
 * PRE-W10 DASHBOARD-ACCESS-F1 SSOT:
 * - ADMIN, SUPER_ADMIN, DIRECTOR -> /dashboard
 * - PM, PMO, HEAD_OF_OPERATIONS -> /project-delivery
 * - PROCUREMENT, PURCHASING, MANAGER -> /procurement
 * - FINANCE -> /finance/invoices
 * - MARKETING, GM_MARKETING -> /sales
 * - LEGAL -> /legal/review
 * - GENERAL_MANAGER -> /reports
 * - Fallback -> /project-delivery
 */
export function getCanonicalRoleLandingRoute(userRoles: string[] = []): string {
  const upper = userRoles.map((r) => String(r).toUpperCase());
  if (upper.includes('SUPER_ADMIN') || upper.includes('ADMIN') || upper.includes('DIRECTOR')) {
    return '/dashboard';
  }
  if (upper.includes('PROJECT_MANAGER') || upper.includes('PMO') || upper.includes('HEAD_OF_OPERATIONS')) {
    return '/project-delivery';
  }
  if (upper.includes('PROCUREMENT') || upper.includes('PURCHASING') || upper.includes('MANAGER')) {
    return '/procurement';
  }
  if (upper.includes('FINANCE')) {
    return '/finance/invoices';
  }
  if (upper.includes('MARKETING') || upper.includes('GM_MARKETING')) {
    return '/sales';
  }
  if (upper.includes('LEGAL')) {
    return '/legal/review';
  }
  if (upper.includes('GENERAL_MANAGER')) {
    return '/reports';
  }
  return '/project-delivery';
}

