"use client";

import React from 'react';
import CustomersPage from '../../components/CustomersPage';
import { MainLayout } from '../../components/MainLayout';
import { ProtectedRoute } from '../../components/ProtectedRoute';

export default function CustomersRoute() {
  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN', 'MARKETING', 'GENERAL_MANAGER']}>
      <MainLayout>
        <CustomersPage />
      </MainLayout>
    </ProtectedRoute>
  );
}
