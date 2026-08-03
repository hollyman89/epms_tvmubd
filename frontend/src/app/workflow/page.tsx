"use client";

import React from 'react';
import { WorkflowDesigner as WorkflowComponent } from '../../components/WorkflowDesigner';
import { MainLayout } from '../../components/MainLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';

export default function WorkflowRoute() {
  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'PROJECT_MANAGER']}>
      <MainLayout>
        <WorkflowComponent />
      </MainLayout>
    </ProtectedRoute>
  );
}
