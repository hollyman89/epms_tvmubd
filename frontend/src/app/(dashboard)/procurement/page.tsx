import React, { Suspense } from 'react';
import { ProcurementPage as ProcurementComponent } from '@/components/ProcurementPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Spin } from 'antd';

export default function ProcurementRoute() {
  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'GENERAL_MANAGER', 'PROJECT_MANAGER', 'FINANCE', 'MANAGER', 'DIRECTOR', 'PROCUREMENT', 'PURCHASING']}>
      <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><Spin size="large" /></div>}>
        <ProcurementComponent />
      </Suspense>
    </ProtectedRoute>
  );
}
