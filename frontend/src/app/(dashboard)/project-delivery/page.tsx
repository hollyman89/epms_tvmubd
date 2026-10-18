"use client";

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Typography, Spin } from 'antd';
import { setupProjectDeliverySync } from '@/lib/workflowSync';
import { useQueryClient } from '@tanstack/react-query';

const { Title } = Typography;

const ProjectOperationTab = dynamic(
  () => import('@/components/ProjectOperationTab').then((mod) => mod.ProjectOperationTab),
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
        <Spin size="large" tip="Memuat Project Delivery Workspace..." />
      </div>
    ),
    ssr: false,
  }
);

export default function ProjectDeliveryRoute() {
  const [pmoRefreshTrigger, setPmoRefreshTrigger] = useState(0);
  const queryClient = useQueryClient();

  // Canonical Realtime Synchronization & Reconnect Recovery (Phase W8-CP3)
  useEffect(() => {
    return setupProjectDeliverySync({
      onRefresh: () => {
        setPmoRefreshTrigger(prev => prev + 1);
        queryClient.invalidateQueries({ queryKey: ['project', 'operational-board'] });
      },
    });
  }, [queryClient]);

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'PROJECT_MANAGER', 'PMO', 'DIRECTOR']}>
      <div style={{ padding: '24px', background: '#fff', borderRadius: '12px', minHeight: '80vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Title level={3} style={{ margin: 0, fontSize: '24px', fontWeight: 600, lineHeight: '32px', color: '#0f172a' }}>
            Project Delivery Workspace
          </Title>
        </div>
        <React.Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh', background: '#f8fafc', borderRadius: '12px' }}><Spin size="large" tip="Memuat Project Delivery Workspace..." /></div>}>
          <ProjectOperationTab refreshTrigger={pmoRefreshTrigger} />
        </React.Suspense>
      </div>
    </ProtectedRoute>
  );
}
