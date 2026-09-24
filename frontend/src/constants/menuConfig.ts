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
        key: '/',
        label: 'Dashboard',
        path: '/',
        iconName: 'DashboardOutlined',
        // PROJECT_MANAGER is strictly removed from Executive Dashboard
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'FINANCE', 'DIRECTOR', 'MANAGER', 'PROCUREMENT', 'PURCHASING'],
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
        key: 'dev-projects-data',
        label: 'Projects',
        path: 'dev-projects-data',
        iconName: 'FolderOpenOutlined',
        // PROJECT_MANAGER is removed from this inactive development stub
        allowedRoles: ['SUPER_ADMIN'],
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
        label: 'Tugas Persetujuan Proyek',
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
        allowedRoles: ['SUPER_ADMIN'],
      },
      {
        key: '/workflow',
        label: 'Workflow Designer',
        path: '/workflow',
        iconName: 'NodeIndexOutlined',
        // PROJECT_MANAGER is strictly removed from Workflow Designer
        allowedRoles: ['SUPER_ADMIN', 'HEAD_OF_OPERATIONS'],
      },
      {
        key: '/inbox',
        label: 'Unified Inbox',
        path: '/inbox',
        iconName: 'MailOutlined',
        allowedRoles: ['SUPER_ADMIN', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'PROJECT_MANAGER', 'FINANCE', 'DIRECTOR', 'MANAGER', 'PROCUREMENT', 'PURCHASING'],
      },
      {
        key: '/audit-trail',
        label: 'Audit Trail',
        path: '/audit-trail',
        iconName: 'LineChartOutlined',
        allowedRoles: ['SUPER_ADMIN'],
      },
      {
        key: 'dev-settings',
        label: 'Settings',
        path: 'dev-settings',
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

  for (const group of MENU_GROUPS) {
    for (const item of group.children) {
      const itemPath = (item.path || item.key).split('?')[0].replace(/\/$/, '') || '/';
      if (itemPath === cleanPath) {
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
