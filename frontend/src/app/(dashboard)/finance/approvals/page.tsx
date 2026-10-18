"use client";

import { useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';

function ApprovalsRedirect() {
  const router = useRouter();
  const searchParams = useSearchParams();

  useEffect(() => {
    const requestId = searchParams.get('requestId') || searchParams.get('id');
    const targetUrl = requestId
      ? `/finance/payments?tab=approvals&requestId=${encodeURIComponent(requestId)}`
      : '/finance/payments?tab=approvals';
    router.replace(targetUrl);
  }, [router, searchParams]);

  return (
    <div style={{ padding: 48, textAlign: 'center', color: '#64748b' }}>
      Mengarahkan ke Workspace Persetujuan Pembayaran Direktur...
    </div>
  );
}

export default function ApprovalsPage() {
  return (
    <Suspense fallback={<div style={{ padding: 48, textAlign: 'center' }}>Memuat...</div>}>
      <ApprovalsRedirect />
    </Suspense>
  );
}
