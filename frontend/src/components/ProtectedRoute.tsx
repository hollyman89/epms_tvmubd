"use client";

import React, { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { AuthService } from '@/services/auth.service';
import { Spin, Result, Button } from 'antd';
import { getRouteAllowedRoles } from '@/constants/menuConfig';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading || !isAuthenticated) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" tip="Memverifikasi sesi..." />
      </div>
    );
  }

  // Resolve allowed roles: explicit prop takes precedence, otherwise fallback to SSOT menuConfig
  const effectiveAllowedRoles = allowedRoles && allowedRoles.length > 0 
    ? allowedRoles 
    : getRouteAllowedRoles(pathname);

  // Check roles if effectiveAllowedRoles is provided
  if (effectiveAllowedRoles && effectiveAllowedRoles.length > 0 && user) {
    const userRolesUpper = (user.roles || []).map(r => String(r).toUpperCase());
    const hasRole = effectiveAllowedRoles.some(role => userRolesUpper.includes(String(role).toUpperCase()));
    if (!hasRole) {
      let homeRoute = '/';
      if (userRolesUpper.includes('MARKETING') && !userRolesUpper.some(r => ['SUPER_ADMIN', 'DIRECTOR', 'GENERAL_MANAGER'].includes(r))) {
        homeRoute = '/sales';
      } else if (userRolesUpper.includes('PROJECT_MANAGER') && !userRolesUpper.some(r => ['SUPER_ADMIN', 'DIRECTOR', 'GENERAL_MANAGER'].includes(r))) {
        homeRoute = '/project-delivery';
      } else if (userRolesUpper.includes('LEGAL') && !userRolesUpper.some(r => ['SUPER_ADMIN', 'DIRECTOR', 'GENERAL_MANAGER'].includes(r))) {
        homeRoute = '/legal/review';
      }

      // If user opened '/' but is not authorized for Executive Dashboard, redirect seamlessly without 403 flash
      if (pathname === '/') {
        if (homeRoute !== '/') {
          router.replace(homeRoute);
          return (
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
              <Spin size="large" tip="Mengalihkan ke beranda kerja..." />
            </div>
          );
        }
      }

      return (
        <Result
          status="403"
          title="403"
          subTitle="Maaf, Anda tidak memiliki akses ke halaman ini."
          extra={
            <Button type="primary" onClick={() => router.push(homeRoute)}>
              Kembali ke Beranda
            </Button>
          }
        />
      );
    }
  }

  return <>{children}</>;
};

