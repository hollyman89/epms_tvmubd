import React from 'react';
import type { Metadata } from 'next';
import { Inter } from 'next/font/google';
import { ConfigProvider } from 'antd';
import './globals.css';

const inter = Inter({ subsets: ['latin'] });

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
      <body className={inter.className}>
        <Providers>
          <AuthProvider>
            <ConfigProvider theme={{ token: { colorPrimary: '#1677ff' } }}>
              {children}
            </ConfigProvider>
          </AuthProvider>
        </Providers>
      </body>
    </html>
  );
}
