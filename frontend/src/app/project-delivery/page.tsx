"use client";

import React, { useEffect, useState } from 'react';
import { io } from 'socket.io-client';
import { AuthService } from '@/services';
import { MainLayout } from '../../components/MainLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';
import { ProjectOperationTab } from '../../components/ProjectOperationTab';
import { Typography } from 'antd';

const { Title } = Typography;

export default function ProjectDeliveryRoute() {
  const [pmoRefreshTrigger, setPmoRefreshTrigger] = useState(0);

  useEffect(() => {
    const token = AuthService.getAccessToken();
    if (!token) return;

    const socketInstance = io(process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000/notifications', {
      transports: ['websocket'],
      auth: { token: `Bearer ${token}` }
    });

    const handleRealtimeUpdate = (payload?: any) => {
      console.log('📢 Project Delivery Real-time update diterima:', payload);
      // Trigger refetch di ProjectOperationTab
      setPmoRefreshTrigger(prev => prev + 1);
    };

    socketInstance.on('legal.queue.updated', handleRealtimeUpdate);
    socketInstance.on('marketing.tender.management_update', handleRealtimeUpdate);

    return () => {
      socketInstance.off('legal.queue.updated', handleRealtimeUpdate);
      socketInstance.off('marketing.tender.management_update', handleRealtimeUpdate);
      socketInstance.disconnect();
    };
  }, []);

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'ADMIN', 'GENERAL_MANAGER', 'PROJECT_MANAGER', 'PMO', 'DIRECTOR']}>
      <MainLayout>
        <div style={{ padding: '24px', background: '#fff', borderRadius: '12px', minHeight: '80vh' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
            <Title level={3} style={{ margin: 0, background: 'linear-gradient(90deg, #1677ff, #722ed1)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
              Project Delivery Workspace
            </Title>
          </div>
          <ProjectOperationTab refreshTrigger={pmoRefreshTrigger} />
        </div>
      </MainLayout>
    </ProtectedRoute>
  );
}
