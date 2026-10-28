"use client";

import React, { useEffect } from 'react';
import { ExecutiveDashboardPreview } from '@/components/dashboard-preview/ExecutiveDashboardPreview';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';
import { isRoleAllowedForRoute, getCanonicalRoleLandingRoute } from '@/constants/menuConfig';

export default function DashboardPreviewRoutePage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const userRoles = (user?.roles || []).map((r) => String(r).toUpperCase());
  const isAuthorized = isRoleAllowedForRoute('/dashboard', userRoles);

  useEffect(() => {
    if (!isLoading && user) {
      if (!isAuthorized) {
        const fallbackRoute = getCanonicalRoleLandingRoute(userRoles);
        const safeDestination =
          fallbackRoute === '/dashboard' || fallbackRoute === '/'
            ? '/project-delivery'
            : fallbackRoute;
        router.replace(safeDestination);
      }
    }
  }, [user, isLoading, isAuthorized, router, userRoles]);

  if (isLoading || (user && !isAuthorized)) {
    return <Spin size="large" style={{ display: 'block', margin: 'auto', marginTop: '20vh' }} />;
  }

  return <ExecutiveDashboardPreview />;
}
