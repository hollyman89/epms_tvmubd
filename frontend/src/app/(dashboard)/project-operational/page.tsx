'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Spin } from 'antd';

export default function ProjectOperationalPage() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/project-delivery');
  }, [router]);

  return (
    <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh' }}>
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
        <Spin size="large" />
        <span style={{ color: '#64748b', fontSize: 14 }}>Mengalihkan ke Command Center...</span>
      </div>
    </div>
  );
}
