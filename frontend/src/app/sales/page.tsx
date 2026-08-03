"use client";

import React from 'react';
import { SalesPipelinePage } from '../../components/SalesPipelinePage';
import { MainLayout } from '../../components/MainLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { useAuth } from '../../context/AuthContext';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';

export default function SalesRoute() {
  const { user, isLoading: loading } = useAuth();
  const router = useRouter();
  const [redirecting, setRedirecting] = React.useState(false);

  React.useEffect(() => {
    if (user && !loading) {
      const roles = user.roles || [];
      const isPmOrPmo = roles.includes('PROJECT_MANAGER') || roles.includes('PMO');
      const isMarketing = roles.includes('MARKETING');
      const isSuperAdmin = roles.includes('SUPER_ADMIN') || roles.includes('ADMIN');
      
      // Redirect to /project-delivery if user is strictly PM/PMO and NOT Marketing/SuperAdmin
      if (isPmOrPmo && !isMarketing && !isSuperAdmin) {
        setRedirecting(true);
        router.replace('/project-delivery');
      }
    }
  }, [user, loading, router]);

  if (redirecting) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Mengalihkan ke Project Delivery..." />
      </div>
    );
  }

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'PROJECT_MANAGER', 'PMO', 'FINANCE', 'DIRECTOR', 'MANAGER', 'MARKETING']}>
      <MainLayout>
        <SalesPipelinePage />
      </MainLayout>
    </ProtectedRoute>
  );
}
