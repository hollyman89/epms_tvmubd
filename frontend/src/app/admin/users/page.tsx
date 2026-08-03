"use client";

import React from 'react';
import { AdminUserPage as AdminUserComponent } from '../../../components/AdminUserPage';
import { MainLayout } from '../../../components/MainLayout';
import { ProtectedRoute } from '../../../components/ProtectedRoute';

export default function AdminUsersRoute() {
  return (
    <ProtectedRoute allowedRoles={['SUPER_ADMIN']}>
      <MainLayout>
        <AdminUserComponent />
      </MainLayout>
    </ProtectedRoute>
  );
}
