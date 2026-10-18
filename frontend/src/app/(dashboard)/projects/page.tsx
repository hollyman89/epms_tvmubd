"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Spin } from 'antd';

const ProjectMasterPage = dynamic(
  () => import('@/components/ProjectMasterPage'),
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
          <span style={{ color: '#64748b', fontSize: 14 }}>Memuat Project Master...</span>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export default function ProjectsRoute() {
  return (
    <ProtectedRoute
      allowedRoles={[
        'SUPER_ADMIN',
        'ADMIN',
        'DIRECTOR',
        'GENERAL_MANAGER',
        'HEAD_OF_OPERATIONS',
        'PMO',
        'PROJECT_MANAGER',
        'PROCUREMENT',
        'PURCHASING',
        'FINANCE',
        'LEGAL',
        'MARKETING',
        'MARKETING_MANAGER',
      ]}
    >
      <ProjectMasterPage />
    </ProtectedRoute>
  );
}
