"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Spin } from 'antd';

const VendorsPage = dynamic(
  () => import('@/components/VendorsPage'),
  {
    loading: () => (
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '60vh',
          background: '#f8fafc',
          borderRadius: '12px'
        }}
      >
        <Spin size="large" tip="Memuat Data Master Vendor..." />
      </div>
    ),
    ssr: false,
  }
);

export default function VendorsRoute() {
  return (
    <ProtectedRoute
      allowedRoles={[
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
      ]}
    >
      <VendorsPage />
    </ProtectedRoute>
  );
}
