"use client";

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Spin } from 'antd';
import { useAuth } from '@/context/AuthContext';
import { getCanonicalRoleLandingRoute } from '@/constants/menuConfig';

function RootRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, isAuthenticated } = useAuth();

  useEffect(() => {
    if (isLoading) return;

    if (!isAuthenticated || !user) {
      const qs = searchParams ? searchParams.toString() : '';
      const dest = qs ? `/login?${qs}` : '/login';
      router.replace(dest);
      return;
    }

    const landing = getCanonicalRoleLandingRoute(user.roles || []);
    const qs = searchParams ? searchParams.toString() : '';
    const destination = qs ? `${landing}?${qs}` : landing;
    router.replace(destination);
  }, [router, searchParams, user, isLoading, isAuthenticated]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
      <Spin size="large" />
    </div>
  );
}

export default function RootRedirectPage() {
  return (
    <Suspense
      fallback={
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: '60vh' }}>
          <Spin size="large" />
        </div>
      }
    >
      <RootRedirectContent />
    </Suspense>
  );
}
