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
      <Spin size="large" tip="Mengalihkan ke Command Center..." />
    </div>
  );
}
