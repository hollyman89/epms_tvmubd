import React from 'react';
import type { Metadata, Viewport } from 'next';
import { ConfigProvider } from 'antd';
import { CANONICAL_FONT_FAMILY } from '@/constants/theme';
import './globals.css';

export const metadata: Metadata = {
  title: 'EPMS UBD & TVM',
  description: 'Enterprise Project Management System for UBD & TVM',
  manifest: '/manifest.json',
  icons: {
    icon: [
      { url: '/icons/epms-icon-192.png?v=20261105', sizes: '192x192', type: 'image/png' },
      { url: '/icons/epms-icon-512.png?v=20261105', sizes: '512x512', type: 'image/png' },
    ],
    apple: [
      { url: '/icons/epms-icon-192.png?v=20261105', sizes: '192x192', type: 'image/png' },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'EPMS',
  },
};

export const viewport: Viewport = {
  themeColor: '#021329',
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
