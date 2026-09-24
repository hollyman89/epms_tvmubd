'use client';

import React from 'react';
import { ProjectGovernanceTaskCenter } from '@/components/governance/ProjectGovernanceTaskCenter';
import { ProtectedRoute } from '@/components/ProtectedRoute';

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
      <ProjectGovernanceTaskCenter />
    </ProtectedRoute>
  );
}
