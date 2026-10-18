'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';

/**
 * Legacy Finance Review Route — Deprecated in G2.
 * Automatically redirects all traffic to the canonical Project Governance Task Center (/governance/tasks).
 */
export default function FinanceReviewPage() {
  const router = useRouter();

  useEffect(() => {
    router.replace('/governance/tasks');
  }, [router]);

  return (
    <div
      style={{
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '60vh',
      }}
    >
      <Spin tip="Mengalihkan ke Approval Center..." size="large" />
    </div>
  );
}
