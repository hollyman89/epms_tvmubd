"use client";

import React, { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../context/AuthContext';
import { Spin, Result, Button } from 'antd';

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: string[];
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedRoles }) => {
  const { user, isAuthenticated, isLoading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push('/login');
    }
  }, [isLoading, isAuthenticated, router]);

  if (isLoading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <Spin size="large" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return null; // Will redirect in useEffect
  }

  // Check roles if allowedRoles is provided
  if (allowedRoles && allowedRoles.length > 0 && user) {
    const userRolesUpper = (user.roles || []).map(r => String(r).toUpperCase());
    const hasRole = allowedRoles.some(role => userRolesUpper.includes(String(role).toUpperCase()));
    if (!hasRole) {
      return (
        <Result
          status="403"
          title="403"
          subTitle="Maaf, Anda tidak memiliki akses ke halaman ini."
          extra={
            <Button type="primary" onClick={() => router.push(userRolesUpper.includes('MARKETING') ? '/sales' : '/')}>
              Kembali ke Beranda
            </Button>
          }
        />
      );
    }
  }

  return <>{children}</>;
};
