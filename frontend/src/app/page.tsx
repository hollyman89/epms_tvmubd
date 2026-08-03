"use client";

import React, { useEffect } from 'react';
import { DashboardPage as DashboardComponent } from '../components/DashboardPage';
import { MainLayout } from '../components/MainLayout';
import { ProtectedRoute } from '../components/ProtectedRoute';
import { useAuth } from '../context/AuthContext';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && user) {
      if (user.roles?.includes('MARKETING')) {
        router.replace('/sales');
      } else if (user.roles?.includes('LEGAL')) {
        router.replace('/legal/review');
      }
    }
  }, [user, isLoading, router]);

  if (isLoading || (user && (user.roles?.includes('MARKETING') || user.roles?.includes('LEGAL')))) {
    return <Spin size="large" style={{ display: 'block', margin: 'auto', marginTop: '20vh' }} />;
  }

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'GENERAL_MANAGER', 'PROJECT_MANAGER', 'FINANCE', 'DIRECTOR', 'MANAGER']}>
      <MainLayout>
        <DashboardComponent />
      </MainLayout>
    </ProtectedRoute>
  );
}
