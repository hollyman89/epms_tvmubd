"use client";

import React from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { queryClient } from '../lib/queryClient';
import { SocketProvider } from '@/context/SocketProvider';

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SocketProvider>
      <QueryClientProvider client={queryClient}>
        {children}
      </QueryClientProvider>
    </SocketProvider>
  );
}
