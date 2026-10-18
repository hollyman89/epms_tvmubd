"use client";

import React from 'react';
import dynamic from 'next/dynamic';
import { useAuth } from '@/context/AuthContext';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';

const SalesPipelinePage = dynamic(
  () => import('@/components/SalesPipelinePage').then((mod) => mod.SalesPipelinePage),
  {
    loading: () => (
      <div 
        style={{ 
          display: 'flex', 
          justifyContent: 'center', 
          alignItems: 'center', 
          minHeight: '60vh',
          background: '#f8fafc',
          borderRadius: '12px'
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Spin size="large" />
          <span style={{ color: '#64748b', fontSize: 14 }}>Memuat Sales Pipeline...</span>
        </div>
      </div>
    ),
    ssr: false,
  }
);

export default function SalesRoute() {
  const { user, isLoading: loading } = useAuth();
  const router = useRouter();
  const [redirecting, setRedirecting] = React.useState(false);

  React.useEffect(() => {
    if (user && !loading) {
      const roles = user.roles || [];
      const isPmOrPmo = roles.includes('PROJECT_MANAGER') || roles.includes('PMO');
      const isMarketing = roles.includes('MARKETING');
      const isSuperAdmin = roles.includes('SUPER_ADMIN') || roles.includes('ADMIN');
      
      // Redirect to /project-delivery if user is strictly PM/PMO and NOT Marketing/SuperAdmin
      if (isPmOrPmo && !isMarketing && !isSuperAdmin) {
        setRedirecting(true);
        router.replace('/project-delivery');
      }
    }
  }, [user, loading, router]);

  if (redirecting) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
          <Spin size="large" />
          <span style={{ color: '#64748b', fontSize: 14 }}>Mengalihkan ke Project Delivery...</span>
        </div>
      </div>
    );
  }

  return <SalesPipelinePage />;
}
