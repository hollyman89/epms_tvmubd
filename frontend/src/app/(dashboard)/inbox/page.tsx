"use client";

import React from 'react';
import { InboxPage as InboxComponent } from '@/components/InboxPage';
import { ProtectedRoute } from '@/components/ProtectedRoute';

export default function InboxRoute() {
  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'GENERAL_MANAGER', 'PROJECT_MANAGER', 'FINANCE', 'DIRECTOR', 'MANAGER']}>
      <InboxComponent />
    </ProtectedRoute>
  );
}
