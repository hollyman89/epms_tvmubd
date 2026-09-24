"use client";

import React from 'react';
import { ProcurementPage as ProcurementComponent } from '@/components/ProcurementPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function ProcurementRoute() {
  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'GENERAL_MANAGER', 'PROJECT_MANAGER', 'FINANCE', 'MANAGER', 'DIRECTOR', 'PROCUREMENT', 'PURCHASING']}>
      <ProcurementComponent />
    </ProtectedRoute>
  );
}
