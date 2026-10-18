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
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Spin size="large" />
          <span style={{ color: '#64748b', fontSize: 14 }}>Memuat Data Master Vendor...</span>
        </div>
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
