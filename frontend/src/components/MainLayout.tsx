"use client";

import React, { useState, useEffect, useMemo, useCallback, Suspense } from 'react';
import { Layout, Menu, Typography, Dropdown, Avatar, Space, Drawer, Button, message} from 'antd';
import { 
  DashboardOutlined, 
  MailOutlined, 
  NodeIndexOutlined, 
  TeamOutlined,
  LogoutOutlined,
  UserOutlined,
  BarChartOutlined,
  NotificationOutlined,
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
  SafetyCertificateOutlined,
  MenuOutlined,
  LeftOutlined,
  RightOutlined,
  AccountBookOutlined,
  AuditOutlined,
} from '@ant-design/icons';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../context/AuthContext';
import { NotificationBell } from './NotificationBell';

import { MENU_GROUPS } from '@/constants/menuConfig';

const ICON_MAP: Record<string, React.ReactNode> = {
  DashboardOutlined: <DashboardOutlined />,
  BarChartOutlined: <BarChartOutlined />,
  NotificationOutlined: <NotificationOutlined />,
  ProjectOutlined: <ProjectOutlined />,
  DollarOutlined: <DollarOutlined />,
  AccountBookOutlined: <AccountBookOutlined />,
  ShoppingCartOutlined: <ShoppingCartOutlined />,
  UsergroupAddOutlined: <UsergroupAddOutlined />,
  ShopOutlined: <ShopOutlined />,
  FolderOpenOutlined: <FolderOpenOutlined />,
  FileOutlined: <FileOutlined />,
  SafetyCertificateOutlined: <SafetyCertificateOutlined />,
  FileTextOutlined: <FileTextOutlined />,
  AuditOutlined: <AuditOutlined />,
  TeamOutlined: <TeamOutlined />,
  NodeIndexOutlined: <NodeIndexOutlined />,
  MailOutlined: <MailOutlined />,
  LineChartOutlined: <LineChartOutlined />,
  SettingOutlined: <SettingOutlined />,
};

const { Header, Content, Sider } = Layout;
const { Title } = Typography;

interface MainLayoutProps {
  children: React.ReactNode;
}

// Isolated tiny component — only this uses useSearchParams, wrapped in its own narrow Suspense
const TabKeyUpdater: React.FC<{ onKeyChange: (key: string) => void }> = ({ onKeyChange }) => {
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    const key = tabParam ? `${pathname}?tab=${tabParam}` : pathname;
    onKeyChange(key);
  }, [pathname, searchParams, onKeyChange]);

  return null;
};

const MainLayoutContent: React.FC<MainLayoutProps> = ({ children }) => {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [collapsed, setCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [isHoveredTrigger, setIsHoveredTrigger] = useState(false);
  // currentKey: initialized from pathname, updated by TabKeyUpdater when ?tab param is present
  const [currentKey, setCurrentKey] = useState<string>(pathname);

  const customTrigger = useMemo(() => (
    <div 
      role="button"
      tabIndex={0}
      aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
      onClick={() => setCollapsed(prev => !prev)}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          setCollapsed(prev => !prev);
        }
      }}
      onMouseEnter={() => setIsHoveredTrigger(true)}
      onMouseLeave={() => setIsHoveredTrigger(false)}
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '48px',
        width: '100%',
        background: 'transparent',
        cursor: 'pointer',
      }}
    >
      <div 
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '10px',
          background: isHoveredTrigger ? 'rgba(56, 189, 248, 0.16)' : 'rgba(255, 255, 255, 0.06)',
          border: isHoveredTrigger ? '1px solid rgba(56, 189, 248, 0.45)' : '1px solid rgba(255, 255, 255, 0.12)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          color: isHoveredTrigger ? '#38bdf8' : '#cbd5e1',
          fontSize: '13px',
          transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
          boxShadow: isHoveredTrigger ? '0 0 12px rgba(56, 189, 248, 0.25)' : '0 2px 6px rgba(0,0,0,0.2)',
          transform: isHoveredTrigger ? 'scale(1.06)' : 'scale(1)',
        }}
      >
        {collapsed ? <RightOutlined /> : <LeftOutlined />}
      </div>
    </div>
  ), [collapsed, isHoveredTrigger]);

  // Keep currentKey in sync with pathname changes during normal navigation
  useEffect(() => {
    setCurrentKey(pathname);
  }, [pathname]);

  // Responsive screen detection
  useEffect(() => {
    const handleResize = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      if (mobile) {
        setCollapsed(true);
      }
    };
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Configuration for all possible menu items — derived from Single Source of Truth MENU_GROUPS
  const menuConfig = useMemo(() => {
    return MENU_GROUPS.map((group) => ({
      type: 'group' as const,
      label: group.label,
      children: group.children.map((item) => ({
        key: item.key,
        icon: item.iconName ? ICON_MAP[item.iconName] : undefined,
        label: item.label,
        allowedRoles: item.allowedRoles,
      })),
    }));
  }, []);

  const handleMenuClick = useCallback((key: string) => {
    if (key.startsWith('dev-')) {
      message.info('Fitur ini masih dalam tahap pengembangan');
      return;
    }
    if (isMobile) {
      setDrawerOpen(false);
    }
    router.push(key);
  }, [isMobile, router]);

  // Filter menu items based on user role — memoized using rolesKey to prevent re-computation
  const rolesKey = (user?.roles || []).join(',');
  const filteredMenuItems = useMemo(() => {
    const userRolesUpper = (user?.roles || []).map(r => String(r).toUpperCase());
    const isMarketingOnlyUser = userRolesUpper.includes('MARKETING') && 
      !userRolesUpper.some(r => ['SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'ADMIN'].includes(r));

    return menuConfig.map(group => {
      let groupChildren = group.children.filter(item => 
        !item.allowedRoles || item.allowedRoles.some(role => userRolesUpper.includes(String(role).toUpperCase()))
      );

      // Special layout transformation for pure MARKETING role:
      // Move Customer (/customers) under MODULES right above Marketing (/sales), and remove Customer from DATA MASTER
      if (isMarketingOnlyUser) {
        if (group.label === 'MODULES') {
          const customerItem = menuConfig.find(g => g.label === 'DATA MASTER')?.children.find(c => c.key === '/customers');
          if (customerItem) {
            groupChildren = [customerItem, ...groupChildren.filter(c => c.key !== '/customers')];
          }
        } else if (group.label === 'DATA MASTER') {
          groupChildren = groupChildren.filter(c => c.key !== '/customers');
        }
      }

      return {
        ...group,
        children: groupChildren.map(({ key, icon, label }) => ({
          key,
          icon,
          label: (
            <span 
              onMouseEnter={() => {
                if (typeof key === 'string' && key.startsWith('/')) {
                  try { router.prefetch(key); } catch (e) {}
                }
              }}
              onFocus={() => {
                if (typeof key === 'string' && key.startsWith('/')) {
                  try { router.prefetch(key); } catch (e) {}
                }
              }}
              style={{ display: 'inline-block', width: '100%' }}
            >
              {label}
            </span>
          )
        }))
      };
    }).filter(group => group.children.length > 0);
  }, [rolesKey, menuConfig, router]);

  const userMenu = useMemo(() => ({
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
    ],
  }), [logout, router]);

  const menuComponent = useMemo(() => (
    <Menu 
      theme="dark"
      mode="inline" 
      selectedKeys={[currentKey]} 
      items={filteredMenuItems as any} 
      onClick={({ key }) => handleMenuClick(key)}
      className="epms-sidebar-menu"
      style={{ background: 'transparent' }}
    />
  ), [currentKey, filteredMenuItems, handleMenuClick]);

  const brandHeader = useMemo(() => (isCollapsed: boolean) => (
    <div style={{ 
      margin: '18px 12px 14px 12px', 
      padding: isCollapsed ? '6px 4px' : '8px 10px',
      background: 'transparent',
      display: 'flex', 
      justifyContent: 'center',
      alignItems: 'center',
      overflow: 'hidden',
      transition: 'all 0.2s ease'
    }}>
      <img 
        src="/epms-logo.png" 
        alt="EPMS Logo" 
        style={{ 
          height: isCollapsed ? '44px' : '68px',
          width: 'auto',
          maxWidth: '100%',
          objectFit: 'contain',
          display: 'block',
          filter: 'drop-shadow(0 3px 10px rgba(0,0,0,0.5))'
        }} 
      />
    </div>
  ), []);

  return (
    <Layout style={{ minHeight: '100vh' }}>
      {/* Desktop Sidebar */}
      {!isMobile && (
        <Sider 
          collapsible 
          collapsed={collapsed} 
          onCollapse={(value) => setCollapsed(value)}
          trigger={customTrigger}
          width={260} 
          theme="dark" 
          className="epms-sidebar-sider"
          style={{ background: 'linear-gradient(180deg, #0b192c 0%, #07182b 55%, #061322 100%)', borderRight: '1px solid #1e293b', boxShadow: '4px 0 16px rgba(0,0,0,0.25)' }}
        >
          {brandHeader(collapsed)}
          {menuComponent}
        </Sider>
      )}

      {/* Mobile Drawer */}
      {isMobile && (
        <Drawer
          placement="left"
          onClose={() => setDrawerOpen(false)}
          open={drawerOpen}
          width={280}
          bodyStyle={{ padding: 0, background: 'linear-gradient(180deg, #0b192c 0%, #071324 100%)' }}
          headerStyle={{ display: 'none' }}
        >
          {brandHeader(false)}
          {menuComponent}
        </Drawer>
      )}

      <Layout>
        <Header style={{ 
          padding: isMobile ? '0 12px' : '0 24px', 
          background: '#fff', 
          borderBottom: '1px solid #f0f0f0', 
          display: 'flex', 
          justifyContent: 'space-between', 
          alignItems: 'center',
          gap: '12px'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
            {isMobile && (
              <Button 
                type="text"
                icon={<MenuOutlined style={{ fontSize: '18px' }} />}
                onClick={() => setDrawerOpen(true)}
              />
            )}
            {isMobile && (
              <img 
                src="/epms-logo.png" 
                alt="EPMS Logo" 
                style={{ height: '28px', width: 'auto', maxWidth: '140px', objectFit: 'contain' }}
              />
            )}
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: isMobile ? '12px' : '24px' }}>
            <NotificationBell />
            <Dropdown menu={userMenu} placement="bottomRight">
              <Space style={{ cursor: 'pointer' }}>
                <Avatar style={{ backgroundColor: '#1677ff' }} icon={<UserOutlined />} />
                {!isMobile && <span style={{ fontWeight: 500 }}>{user?.email || 'User'}</span>}
              </Space>
            </Dropdown>
          </div>
        </Header>
        <Content style={{ 
          margin: isMobile ? '12px 8px' : '24px 16px', 
          minHeight: 280 
        }}>
          {children}
        </Content>
        {/* Narrow Suspense: only TabKeyUpdater is suspended, not the entire layout */}
        <Suspense fallback={null}>
          <TabKeyUpdater onKeyChange={setCurrentKey} />
        </Suspense>
      </Layout>
    </Layout>
  );
};

export const MainLayout: React.FC<MainLayoutProps> = (props) => (
  <MainLayoutContent {...props} />
);
