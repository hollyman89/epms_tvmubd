"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Spin } from 'antd';

const CustomersPage = dynamic(
  () => import('@/components/CustomersPage'),
  {
    loading: () => (
      <div 
        style={{ 
          display: 'flex', flexDirection: 'column', gap: 12, 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '60vh',
          background: '#f8fafc',
          borderRadius: '12px'
        }}
      >
            <Spin size="large" />
            <span style={{ color: '#64748b', fontSize: 14 }}>Memuat Data Pelanggan...</span>
          </div>
    ),
    ssr: false,
  }
);

export default function CustomersRoute() {
  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MARKETING', 'GENERAL_MANAGER', 'DIRECTOR']}>
      <CustomersPage />
    </ProtectedRoute>
  );
}
