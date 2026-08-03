import React from 'react';

export interface MenuItemConfig {
  key: string;
  label: string;
  iconName: string;
  allowedRoles: string[];
  preload: () => Promise<any>;
}

export const MENU_ITEMS: MenuItemConfig[] = [
  {
    key: '/dashboard',
    label: 'Dashboard',
    iconName: 'DashboardOutlined',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER'],
    preload: () => import('../components/DashboardPage')
  },
  {
    key: '/sales',
    label: 'Marketing & Sales',
    iconName: 'NotificationOutlined',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MARKETING'],
    preload: () => import('../components/SalesPipelinePage')
  },
  {
    key: '/project-delivery',
    label: 'Project Delivery',
    iconName: 'ProjectOutlined',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'PMO', 'PROJECT_MANAGER'],
    preload: () => import('../app/project-delivery/page')
  },
  {
    key: '/procurement',
    label: 'Procurement',
    iconName: 'ShoppingCartOutlined',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'PROJECT_MANAGER', 'FINANCE', 'MANAGER', 'DIRECTOR', 'PURCHASING'],
    preload: () => import('../components/ProcurementPage')
  },
  {
    key: '/customers',
    label: 'Customers',
    iconName: 'UsergroupAddOutlined',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'MARKETING', 'GENERAL_MANAGER'],
    preload: () => import('../components/CustomersPage')
  },
  {
    key: '/legal/review',
    label: 'Legal Review',
    iconName: 'SafetyCertificateOutlined',
    allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'LEGAL', 'DIRECTOR'],
    preload: () => import('../components/LegalReviewForm')
  }
];
