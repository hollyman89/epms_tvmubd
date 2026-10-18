"use client";

import React from 'react';
import { InboxPage as InboxComponent } from '@/components/InboxPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function InboxRoute() {
  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'GENERAL_MANAGER', 'HEAD_OF_OPERATIONS', 'PROJECT_MANAGER', 'PMO', 'FINANCE', 'DIRECTOR', 'MANAGER', 'PROCUREMENT', 'PURCHASING', 'LEGAL', 'MARKETING']}>
      <InboxComponent />
    </ProtectedRoute>
  );
}
