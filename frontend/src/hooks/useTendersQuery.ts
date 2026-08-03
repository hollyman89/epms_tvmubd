import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { apiClient } from '../lib/axios';
import { queryClient, updateAllTenderCaches } from '../lib/queryClient';
import { io } from 'socket.io-client';

export interface UseTendersQueryOptions {
  period?: string;
  stage?: string;
  enabled?: boolean;
}

export function useTendersQuery(options: UseTendersQueryOptions = {}) {
  const { period = 'all', stage, enabled = true } = options;

  const query = useQuery({
    queryKey: ['tenders', { period, stage }],
    queryFn: async () => {
      const response = await apiClient.get('/marketing/tenders', {
        params: { period, stage }
      });
      const resObj = response.data;
      let rawData: any[] = [];
      if (Array.isArray(resObj)) {
        rawData = resObj;
      } else if (Array.isArray(resObj?.data)) {
        rawData = resObj.data;
      } else if (Array.isArray(resObj?.tenders)) {
        rawData = resObj.tenders;
      } else if (Array.isArray(resObj?.data?.tenders)) {
        rawData = resObj.data.tenders;
      }
      return rawData;
    },
    staleTime: 60000,
    gcTime: 300000,
    enabled,
  });

  // Listen to Global Socket & Custom Event for live updates
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Socket.io Real-time Delta Listener
    const token = localStorage.getItem('access_token') || localStorage.getItem('accessToken');
    const socket = io(`${process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:4000'}/sales`, {
      transports: ['websocket'],
      auth: { token: `Bearer ${token}` },
    });

    if (typeof window !== 'undefined') {
      (window as any).__socket = socket;
    }

    socket.on('connect', () => {
      console.log('🟢 Socket connected, joining room:sales...');
      socket.emit('join-sales-room');
    });

    const handlePipelineUpdated = (payload: any) => {
      console.log('🔥🔥🔥 SOCKET RAW EVENT DITERIMA!', payload);
      queryClient.invalidateQueries({ queryKey: ['tenders', { period, stage }] });
    };

    socket.on('sales:pipeline_updated', handlePipelineUpdated);

    return () => {
      socket.off('sales:pipeline_updated', handlePipelineUpdated);
      socket.disconnect();
    };
  }, [period, stage]);

  return query;
}
