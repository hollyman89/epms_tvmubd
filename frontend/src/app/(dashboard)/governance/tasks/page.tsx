import React, { Suspense } from 'react';
import { ProjectGovernanceTaskCenter } from '@/components/governance/ProjectGovernanceTaskCenter';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { Spin } from 'antd';

export default function GovernanceTasksPage() {
  return (
    <ProtectedRoute
      allowedRoles={[
        'HEAD_OF_OPERATIONS',
        'GENERAL_MANAGER',
        'PROCUREMENT',
        'PURCHASING',
        'FINANCE',
        'DIRECTOR',
        'SUPER_ADMIN',
      ]}
    >
      <Suspense fallback={<div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}><Spin size="large" /></div>}>
        <ProjectGovernanceTaskCenter />
      </Suspense>
    </ProtectedRoute>
  );
}
