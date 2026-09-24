"use client";

import React, { useState } from 'react';
import { ProtectedRoute } from '@/components/ProtectedRoute';
import { useAuth } from '@/context/AuthContext';
import { WorkflowList } from '@/components/workflow-designer/WorkflowList';
import { WorkflowEditor } from '@/components/workflow-designer/WorkflowEditor';

export default function WorkflowRoute() {
  const { user } = useAuth();
  const userRole = user?.roles?.[0] || 'GUEST';
  
  const [selectedWorkflowKey, setSelectedWorkflowKey] = useState<string | null>(null);

  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'HEAD_OF_OPERATIONS', 'PROCUREMENT_MANAGER', 'FINANCE_MANAGER', 'DIRECTOR']}>
      {!selectedWorkflowKey ? (
        <WorkflowList 
          userRole={userRole} 
          userRoles={user?.roles || []}
          onOpenDefinition={setSelectedWorkflowKey} 
        />
      ) : (
        <WorkflowEditor 
          workflowKey={selectedWorkflowKey} 
          userRole={userRole} 
          onBack={() => setSelectedWorkflowKey(null)} 
        />
      )}
    </ProtectedRoute>
  );
}
