"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/context/AuthContext';
import { AuthService } from '@/services/auth.service';
import { getCanonicalRoleLandingRoute } from '@/constants/menuConfig';
import { EpmsWelcomeScreen } from '@/components/common/EpmsWelcomeScreen';
import { Spin } from 'antd';

function RootRedirectContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, isLoading, isAuthenticated } = useAuth();

  // Optimistically determine if an existing authenticated session is stored in client storage
  const [hasSession, setHasSession] = useState<boolean>(() => {
    if (typeof window === 'undefined') return false;
    return Boolean(AuthService.getAccessToken()) && !AuthService.isTokenExpired();
  });

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const active = Boolean(AuthService.getAccessToken()) && !AuthService.isTokenExpired();
      setHasSession(active);
    }
  }, []);

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

  // Transition directly into Workspace Initialization for authenticated cold launch,
  // skipping redundant static welcome screen to eliminate double-branding.
  const showInitializing = (isAuthenticated && Boolean(user)) || (isLoading && hasSession);

  if (showInitializing) {
    return (
      <EpmsWelcomeScreen
        mode="initializing"
        statusText="Menyiapkan workspace..."
      />
    );
  }

  // Neutral session loader for unauthenticated cold launch before redirecting to /login
  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        height: '100vh',
        backgroundColor: '#f8fafc',
      }}
      data-testid="root-redirect-session-loader"
    >
      <Spin size="large" tip="Memverifikasi sesi..." />
    </div>
  );
}

export default function RootRedirectPage() {
  return (
    <Suspense
      fallback={
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            height: '100vh',
            backgroundColor: '#f8fafc',
          }}
          data-testid="root-redirect-fallback"
        >
          <Spin size="large" tip="Memverifikasi sesi..." />
        </div>
      }
    >
      <RootRedirectContent />
    </Suspense>
  );
}
