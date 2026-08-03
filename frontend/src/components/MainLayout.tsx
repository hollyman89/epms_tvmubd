"use client";

import React, { useState } from 'react';
import { Layout, Menu, Typography, Dropdown, Avatar, Space } from 'antd';
import { 
  DashboardOutlined, 
  MailOutlined, 
  NodeIndexOutlined, 
  TeamOutlined,
  LogoutOutlined,
  UserOutlined,
  BarChartOutlined,
  NotificationOutlined,
  AuditOutlined,
  ProjectOutlined,
  DollarOutlined,
  ShoppingCartOutlined,
  UsergroupAddOutlined,
  ShopOutlined,
  FileTextOutlined,
  FolderOpenOutlined,
  FileOutlined,
  SettingOutlined,
  LineChartOutlined,
  SafetyCertificateOutlined
} from '@ant-design/icons';
import { message } from 'antd';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from './NotificationBell';

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
}

export const MainLayout: React.FC<MainLayoutProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);

  const tabParam = searchParams.get('tab');
  const currentKey = tabParam ? `${pathname}?tab=${tabParam}` : pathname;

  // Configuration for all possible menu items
  const menuConfig = [
    {
      type: 'group',
      label: 'MAIN MENU',
      children: [
        { 
          key: '/', 
          icon: <DashboardOutlined />, 
          label: 'Dashboard',
          allowedRoles: ['SUPER_ADMIN', 'GENERAL_MANAGER', 'PROJECT_MANAGER', 'FINANCE', 'DIRECTOR', 'MANAGER']
        },
        { 
          key: 'dev-kpi', 
          icon: <BarChartOutlined />, 
          label: 'KPI & Reports',
          allowedRoles: ['SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER']
        }
      ]
    },
    {
      type: 'group',
      label: 'MODULES',
      children: [
        { 
          key: '/sales', 
          icon: <NotificationOutlined />, 
          label: 'Marketing',
          allowedRoles: ['SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MARKETING']
        },
        { 
          key: '/sales?tab=3', 
          icon: <ProjectOutlined />, 
          label: 'Project Delivery',
          allowedRoles: ['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'PMO', 'PROJECT_MANAGER']
        },


        { 
          key: 'dev-finance', 
          icon: <DollarOutlined />, 
          label: 'Finance & Cost',
          allowedRoles: ['SUPER_ADMIN', 'FINANCE', 'DIRECTOR']
        },
        { 
          key: '/procurement', 
          icon: <ShoppingCartOutlined />, 
          label: 'Procurement',
          allowedRoles: ['SUPER_ADMIN', 'GENERAL_MANAGER', 'PROJECT_MANAGER', 'FINANCE', 'MANAGER', 'DIRECTOR', 'PURCHASING']
        },
      ]
    },
    {
      type: 'group',
      label: 'DATA MASTER',
      children: [
        { 
          key: '/customers', 
          icon: <UsergroupAddOutlined />, 
          label: 'Customers',
          allowedRoles: ['SUPER_ADMIN', 'MARKETING', 'GENERAL_MANAGER']
        },
        { 
          key: 'dev-vendors', 
          icon: <ShopOutlined />, 
          label: 'Vendors',
          allowedRoles: ['SUPER_ADMIN', 'PURCHASING']
        },

        { 
          key: 'dev-projects-data', 
          icon: <FolderOpenOutlined />, 
          label: 'Projects',
          allowedRoles: ['SUPER_ADMIN', 'PROJECT_MANAGER']
        },
        { 
          key: '/documents', 
          icon: <FileOutlined />, 
          label: 'Documents',
          allowedRoles: ['SUPER_ADMIN', 'DIRECTOR', 'LEGAL', 'GENERAL_MANAGER']
        },
      ]
    },
    {
      type: 'group',
      label: 'PROJECT GOVERNANCE',
      children: [
        { 
          key: '/legal/review', 
          icon: <SafetyCertificateOutlined />, 
          label: 'Legal Review',
          allowedRoles: ['SUPER_ADMIN', 'LEGAL', 'DIRECTOR']
        },
        { 
          key: '/governance/contracts', 
          icon: <FileTextOutlined />, 
          label: 'Contracts',
          allowedRoles: ['SUPER_ADMIN', 'LEGAL', 'DIRECTOR', 'PROJECT_MANAGER', 'HEAD_OF_OPERATIONS']
        }
      ]
    },
    {
      type: 'group',
      label: 'SYSTEM',
      children: [
        { 
          key: '/admin/users', 
          icon: <TeamOutlined />, 
          label: 'Users & Roles',
          allowedRoles: ['SUPER_ADMIN']
        },
        { 
          key: '/workflow', 
          icon: <NodeIndexOutlined />, 
          label: 'Workflow Designer',
          allowedRoles: ['SUPER_ADMIN', 'PROJECT_MANAGER']
        },
        { 
          key: '/inbox', 
          icon: <MailOutlined />, 
          label: 'Unified Inbox',
          allowedRoles: ['SUPER_ADMIN', 'GENERAL_MANAGER', 'PROJECT_MANAGER', 'FINANCE', 'DIRECTOR', 'MANAGER']
        },
        { 
          key: 'dev-audit', 
          icon: <LineChartOutlined />, 
          label: 'Audit Trail',
          allowedRoles: ['SUPER_ADMIN']
        },
        { 
          key: 'dev-settings', 
          icon: <SettingOutlined />, 
          label: 'Settings',
          allowedRoles: ['SUPER_ADMIN']
        },
      ]
    }
  ];

  // Filter menu items based on user role
  const userRolesUpper = (user?.roles || []).map(r => String(r).toUpperCase());
  const filteredMenuItems = menuConfig.map(group => {
    return {
      ...group,
      children: group.children.filter(item => 
        !item.allowedRoles || item.allowedRoles.some(role => userRolesUpper.includes(String(role).toUpperCase()))
      ).map(({ key, icon, label }) => ({ key, icon, label }))
    };
  }).filter(group => group.children.length > 0);

  const handleMenuClick = (key: string) => {
    if (key.startsWith('dev-')) {
      message.info('Fitur ini masih dalam tahap pengembangan 🚀');
      return;
    }
    router.push(key);
  };

  const userMenu = {
    items: [
      {
        key: 'profile',
        icon: <UserOutlined />,
        label: 'Profil Saya',
        onClick: () => router.push('/profile'),
      },
      {
        key: 'logout',
        icon: <LogoutOutlined />,
        label: 'Logout',
        danger: true,
        onClick: logout,
      },
    ]
  };

  return (
    <Layout style={{ minHeight: '100vh' }}>
      <Sider 
        collapsible 
        collapsed={collapsed} 
        onCollapse={(value) => setCollapsed(value)}
        width={260} 
        theme="dark" 
        style={{ background: '#0a192f', borderRight: '1px solid #0f2445', boxShadow: '2px 0 8px 0 rgba(0,0,0,.15)' }}
      >
        <div style={{ 
          margin: '16px', 
          padding: collapsed ? '16px 0' : '16px 0',
          background: 'rgba(255, 255, 255, 0.05)',
          borderRadius: '12px',
          display: 'flex', 
          justifyContent: 'center',
          alignItems: 'center',
          gap: collapsed ? '0' : '12px',
          overflow: 'hidden',
          transition: 'all 0.2s'
        }}>
          <div style={{
            width: '36px',
            height: '36px',
            background: 'linear-gradient(135deg, #1677ff, #3b82f6)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'white',
            fontWeight: 900,
            fontSize: '20px',
            flexShrink: 0
          }}>
            E
          </div>
          {!collapsed && (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <span style={{ fontSize: '22px', fontWeight: 900, color: '#ffffff', letterSpacing: '1px', lineHeight: '1.1' }}>EPMS</span>
              <span style={{ fontSize: '10px', fontWeight: 600, color: '#94a3b8', letterSpacing: '2.5px', textTransform: 'uppercase' }}>Enterprise</span>
            </div>
          )}
        </div>
        <Menu 
          theme="dark"
          mode="inline" 
          selectedKeys={[currentKey]} 
          items={filteredMenuItems as any} 
          onClick={({ key }) => handleMenuClick(key)}
          style={{ background: '#0a192f' }}
        />
      </Sider>
      <Layout>
        <Header style={{ 
          padding: '0 24px', 
          background: '#fff', 
          borderBottom: '1px solid #f0f0f0', 
          display: 'flex', 
          justifyContent: 'flex-end', 
          alignItems: 'center',
          gap: '24px'
        }}>
          <NotificationBell />
          <Dropdown menu={userMenu} placement="bottomRight">
            <Space style={{ cursor: 'pointer' }}>
              <Avatar style={{ backgroundColor: '#1677ff' }} icon={<UserOutlined />} />
              <span style={{ fontWeight: 500 }}>{user?.email || 'User'}</span>
            </Space>
          </Dropdown>
        </Header>
        <Content style={{ margin: '24px 16px', minHeight: 280 }}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};
