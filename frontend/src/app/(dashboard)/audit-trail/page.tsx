"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Spin } from 'antd';

const AuditTrailPage = dynamic(
  () => import('@/components/AuditTrailPage'),
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
            <span style={{ color: '#64748b', fontSize: 14 }}>Memuat Jejak Audit...</span>
          </div>
    ),
    ssr: false,
  }
);

export default function AuditTrailRoute() {
  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
      <AuditTrailPage />
    </ProtectedRoute>
  );
}
