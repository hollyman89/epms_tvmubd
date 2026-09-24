"use client";

import React, { useEffect, useState } from 'react';
import dynamic from 'next/dynamic';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Typography, Spin } from 'antd';
import { useSocket } from '@/context/SocketProvider';
import { setupProjectDeliverySync } from '@/lib/workflowSync';

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
  const { notificationSocket } = useSocket();

  // Active Pre-Kickoff Socket Transports (Legal & Marketing)
  useEffect(() => {
    if (!notificationSocket) return;

    const handleRealtimeUpdate = (payload?: any) => {
      console.log('[Project Delivery] Real-time update diterima:', payload);
      // Trigger refetch di ProjectOperationTab
      setPmoRefreshTrigger(prev => prev + 1);
    };

    notificationSocket.on('legal.queue.updated', handleRealtimeUpdate);
    notificationSocket.on('marketing.tender.management_update', handleRealtimeUpdate);

    return () => {
      notificationSocket.off('legal.queue.updated', handleRealtimeUpdate);
      notificationSocket.off('marketing.tender.management_update', handleRealtimeUpdate);
    };
  }, [notificationSocket]);

  // Canonical Workflow Realtime Synchronization & Reconnect Recovery
  useEffect(() => {
    return setupProjectDeliverySync({
      onRefresh: () => setPmoRefreshTrigger(prev => prev + 1),
    });
  }, []);

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'PROJECT_MANAGER', 'PMO', 'DIRECTOR']}>
      <div style={{ padding: '24px', background: '#fff', borderRadius: '12px', minHeight: '80vh' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
          <Title level={3} style={{ margin: 0, background: 'linear-gradient(90deg, #1677ff, #722ed1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
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
