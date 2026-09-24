"use client";

import React, { useEffect } from 'react';
import { DashboardPage as DashboardComponent } from '@/components/DashboardPage';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';

export default function DashboardPage() {
  const { user, isLoading } = useAuth();
  const router = useRouter();

  const userRolesUpper = (user?.roles || []).map((r) => String(r).toUpperCase());
  const isMarketingOnly =
    userRolesUpper.includes('MARKETING') &&
    !userRolesUpper.some((r) =>
      ['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'DIRECTOR'].includes(r)
    );
  const isLegalOnly =
    userRolesUpper.includes('LEGAL') &&
    !userRolesUpper.some((r) =>
      ['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'DIRECTOR'].includes(r)
    );
  const isPmUser =
    userRolesUpper.includes('PROJECT_MANAGER') &&
    !userRolesUpper.some((r) =>
      ['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'DIRECTOR'].includes(r)
    );

  const shouldRedirect = isMarketingOnly || isLegalOnly || isPmUser;

  useEffect(() => {
    if (!isLoading && user) {
      if (isMarketingOnly) {
        router.replace('/sales');
      } else if (isLegalOnly) {
        router.replace('/legal/review');
      } else if (isPmUser) {
        router.replace('/project-delivery');
      }
    }
  }, [user, isLoading, router, isMarketingOnly, isLegalOnly, isPmUser]);

  if (isLoading || (user && shouldRedirect)) {
    return <Spin size="large" style={{ display: 'block', margin: 'auto', marginTop: '20vh' }} />;
  }

  return <DashboardComponent />;
}

