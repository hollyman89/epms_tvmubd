"use client";

import React, { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { io, Socket } from 'socket.io-client';
import { AuthService } from '@/services/auth.service';
import { queryClient } from '@/lib/queryClient';
import { BoundedEventDedup } from '@/lib/eventDedup';

interface SocketContextType {
  socket: Socket | null;
  salesSocket: Socket | null;
  notificationSocket: Socket | null;
  isConnected: boolean;
}

const SocketContext = createContext<SocketContextType>({
  socket: null,
  salesSocket: null,
  notificationSocket: null,
  isConnected: false,
});

export const SocketProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const salesSocketRef = useRef<Socket | null>(null);
  const notificationSocketRef = useRef<Socket | null>(null);
  const eventDedupRef = useRef(new BoundedEventDedup(500));
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [token, setToken] = useState<string | null>(null);

  // Monitor authentication token state dynamically
  useEffect(() => {
    if (typeof window === 'undefined') return;

    const checkToken = () => {
      const currentToken = AuthService.getAccessToken();
      const currentUser = AuthService.getUser();
      const validToken =
        currentToken &&
        currentToken !== 'undefined' &&
        currentToken !== 'null' &&
        currentUser
          ? currentToken
          : null;

      setToken((prev) => (prev !== validToken ? validToken : prev));
    };

    checkToken();
    const interval = setInterval(checkToken, 30000);
    window.addEventListener('storage', checkToken);
    window.addEventListener('focus', checkToken);
    document.addEventListener('visibilitychange', checkToken);

    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkToken);
      window.removeEventListener('focus', checkToken);
      document.removeEventListener('visibilitychange', checkToken);
    };
  }, []);

  // Manage WebSockets lifecycle based on token state
  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Helper: Disconnect and clean up active sockets
    const cleanupSockets = () => {
      if (salesSocketRef.current) {
        console.log(`[${new Date().toISOString()}] 🧹 DISCONNECT SALES SOCKET & CLEANUP LISTENERS`);
        salesSocketRef.current.removeAllListeners();
        salesSocketRef.current.disconnect();
        salesSocketRef.current = null;
        if (typeof window !== 'undefined') {
          delete (window as any).__salesSocket;
          delete (window as any).__socket;
        }
      }
      if (notificationSocketRef.current) {
        console.log(`[${new Date().toISOString()}] 🧹 DISCONNECT NOTIFICATION SOCKET & CLEANUP LISTENERS`);
        notificationSocketRef.current.removeAllListeners();
        notificationSocketRef.current.disconnect();
        notificationSocketRef.current = null;
        if (typeof window !== 'undefined') {
          delete (window as any).__notificationSocket;
        }
      }
      setIsConnected(false);
    };

    if (!token) {
      cleanupSockets();
      return;
    }

    const baseUrl = process.env.NEXT_PUBLIC_SOCKET_URL || '';
    const salesUrl = baseUrl ? `${baseUrl}/sales` : '/sales';
    const notificationUrl = baseUrl ? `${baseUrl}/notifications` : '/notifications';

    // 1. Initialize Sales Socket (/sales)
    if (!salesSocketRef.current) {
      const salesSocket = io(salesUrl, {
        transports: ['websocket'],
        auth: { token: `Bearer ${token}` },
      });

      salesSocketRef.current = salesSocket;
      (window as any).__salesSocket = salesSocket;
      (window as any).__socket = salesSocket;

      salesSocket.on('connect', () => {
        console.log(`[${new Date().toISOString()}] 🟢 GLOBAL SALES SOCKET CONNECT`, { socketId: salesSocket.id });
        setIsConnected(true);
        salesSocket.emit('join-sales-room');
      });

      salesSocket.on('disconnect', () => {
        console.log(`[${new Date().toISOString()}] 🔴 GLOBAL SALES SOCKET DISCONNECT`, { socketId: salesSocket.id });
        setIsConnected(false);
      });
    }

    // 2. Initialize Notification Socket (/notifications)
    if (!notificationSocketRef.current) {
      const notificationSocket = io(notificationUrl, {
        transports: ['websocket'],
        auth: { token: `Bearer ${token}` },
      });

      notificationSocketRef.current = notificationSocket;
      (window as any).__notificationSocket = notificationSocket;

      notificationSocket.on('connect', () => {
        console.log(`[${new Date().toISOString()}] 🟢 GLOBAL NOTIFICATION SOCKET CONNECT`, { socketId: notificationSocket.id });

        // Bounded active prefix invalidations on reconnect (NO global queryClient.invalidateQueries())
        queryClient.invalidateQueries({ queryKey: ['procurement'], type: 'active' });
        queryClient.invalidateQueries({ queryKey: ['governance-tasks'], type: 'active' });
        queryClient.invalidateQueries({ queryKey: ['dashboard-summary'], type: 'active' });
        queryClient.invalidateQueries({ queryKey: ['analytics-dashboard'], type: 'active' });
        queryClient.invalidateQueries({ queryKey: ['dashboard-project-trend'], type: 'active' });
        queryClient.invalidateQueries({ queryKey: ['dashboard-procurement-pending'], type: 'active' });
        queryClient.invalidateQueries({ queryKey: ['rfq'], type: 'active' });
        queryClient.invalidateQueries({ queryKey: ['pr-workflow-instance-review-modal'], type: 'active' });

        // Trigger authoritative fetch for active manual-state screens
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('epms:reconnect-resync'));
        }
      });

      notificationSocket.on('disconnect', () => {
        console.log(`[${new Date().toISOString()}] 🔴 GLOBAL NOTIFICATION SOCKET DISCONNECT`, { socketId: notificationSocket.id });
      });

      // Canonical Phase G Cross-User Synchronization Listener
      notificationSocket.on('business:sync', (envelope: any) => {
        if (!envelope || !envelope.eventId) return;

        // Session-level bounded dedup: ignore duplicate deliveries from AT-LEAST-ONCE socket transport
        if (eventDedupRef.current.isDuplicate(envelope.eventId)) {
          console.debug(`[SocketProvider] Duplicate canonical event ignored: ${envelope.eventId} (${envelope.eventName})`);
          return;
        }

        console.log(`[SocketProvider] Processing canonical sync event: ${envelope.eventName} (ID: ${envelope.eventId})`);

        const eventName = envelope.eventName as string;

        // Targeted TanStack Query Invalidation based on approved event matrix
        if (eventName.startsWith('workflow.')) {
          queryClient.invalidateQueries({ queryKey: ['governance-tasks'], type: 'active' });
          // Prefix invalidation, NO fake PR ID derived from aggregateId!
          queryClient.invalidateQueries({ queryKey: ['pr-workflow-instance-review-modal'], type: 'active' });
        } else if (eventName.startsWith('procurement.package.')) {
          queryClient.invalidateQueries({ queryKey: ['procurement', 'packages'], type: 'active' });
        } else if (eventName === 'procurement.rfq.created') {
          queryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'], type: 'active' });
          queryClient.invalidateQueries({ queryKey: ['rfq'], type: 'active' });
        } else if (eventName === 'procurement.po.issued') {
          queryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'], type: 'active' });
          queryClient.invalidateQueries({ queryKey: ['procurement', 'packages'], type: 'active' });
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'], type: 'active' });
          queryClient.invalidateQueries({ queryKey: ['dashboard-procurement-pending'], type: 'active' });
        } else if (eventName === 'procurement.gr.received') {
          queryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'], type: 'active' });
          queryClient.invalidateQueries({ queryKey: ['procurement', 'reconciliations'], type: 'active' });
        } else if (eventName.startsWith('project.')) {
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'], type: 'active' });
          queryClient.invalidateQueries({ queryKey: ['analytics-dashboard'], type: 'active' });
          queryClient.invalidateQueries({ queryKey: ['dashboard-project-trend'], type: 'active' });
          queryClient.invalidateQueries({ queryKey: ['dashboard-procurement-pending'], type: 'active' });
        } else if (eventName.startsWith('finance.invoice.')) {
          queryClient.invalidateQueries({ queryKey: ['procurement', 'prs-pos'], type: 'active' });
        } else if (eventName === 'finance.payment.recorded') {
          queryClient.invalidateQueries({ queryKey: ['procurement', 'reconciliations'], type: 'active' });
          queryClient.invalidateQueries({ queryKey: ['dashboard-summary'], type: 'active' });
        }

        // Notify active manual-state screens via browser event with canonical envelope
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('epms:business-sync', { detail: envelope }));
        }
      });
    }

    return () => {
      cleanupSockets();
    };
  }, [token]);

  const contextValue = useMemo(
    () => ({
      socket: salesSocketRef.current,
      salesSocket: salesSocketRef.current,
      notificationSocket: notificationSocketRef.current,
      isConnected,
    }),
    [isConnected]
  );

  return (
    <SocketContext.Provider value={contextValue}>
      {children}
    </SocketContext.Provider>
  );
};

export const useSocket = (): SocketContextType => {
  return useContext(SocketContext);
};
