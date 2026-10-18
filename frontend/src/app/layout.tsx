import React from 'react';
import type { Metadata } from 'next';
import { ConfigProvider } from 'antd';
import { CANONICAL_FONT_FAMILY } from '@/constants/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'EPMS UBD & TVM',
  description: 'Enterprise Project Management System',
};

export const viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

import { AuthProvider } from '../context/AuthContext';
import { Providers } from './providers';

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <Providers>
          <AuthProvider>
            <ConfigProvider
              theme={{
                token: {
                  colorPrimary: '#1677ff',
                  fontFamily: CANONICAL_FONT_FAMILY,
                },
              }}
            >
              {children}
            </ConfigProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
