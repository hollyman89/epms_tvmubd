import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { notification } from 'antd';
import { apiClient } from '../lib/axios';
import { queryClient, updateAllTenderCaches, appendTenderToCache, removeTenderFromCache } from '../lib/queryClient';
import { useSocket } from '@/context/SocketProvider';
import { useAuth } from '@/context/AuthContext';

export interface UseTendersQueryOptions {
  period?: string;
  stage?: string;
  enabled?: boolean;
}

// Module-level map for deduplicating toast notifications per tender and action within a short window
const recentToastTimestamps = new Map<string, number>();

export function useTendersQuery(options: UseTendersQueryOptions = {}) {
  const { period = 'all', stage, enabled = true } = options;
  const { socket } = useSocket();
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['tenders', { userId: user?.sub, period, stage }],
    queryFn: async () => {
      const nowStart = new Date().toISOString();
      if (typeof window !== 'undefined') {
        const cacheBefore = queryClient.getQueryData(['tenders', { userId: user?.sub, period, stage }]);
        console.log(`[${nowStart}] [QUERY] REFETCH START`, { queryKey: ['tenders', { userId: user?.sub, period, stage }], cacheBefore });
      }

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

      const nowEnd = new Date().toISOString();
      if (typeof window !== 'undefined') {
        console.log(`[${nowEnd}] [QUERY] REFETCH END`, {
          resultLength: rawData?.length || 0,
          tenderStages: rawData?.map((t: any) => `${t.id}:${t.stage}`)
        });
        console.log("TENDERS QUERY UPDATE", rawData?.map((t: any) => `${t.id}:${t.stage}`));
      }
      return rawData;
    },
    staleTime: 60000,
    gcTime: 300000,
    enabled,
  });

  // Attach Listener to Global Socket for live updates
  useEffect(() => {
    if (typeof window === 'undefined' || !socket) return;

    const handlePipelineUpdated = (payload: any) => {
      const now = new Date().toISOString();
      if (typeof window !== 'undefined') {
        console.log(`[${now}] [SOCKET] EVENT`, payload);
      }

      let cacheUpdatedDirectly = false;

      // Handle CREATED action via appendTenderToCache helper
      if (payload?.action === 'CREATED') {
        const rawPicName = payload.marketingPicName || payload.updatedBy || '';
        const cleanPicName = rawPicName.replace(/\s*\([^)]*\)/g, '').trim();

        const newTender = payload.tender || {
          id: payload.tenderId,
          title: payload.title,
          customer_name: payload.customerName,
          customer_id: payload.customerId,
          customer: { name: payload.customerName },
          estimated_budget: payload.estimatedBudget,
          stage: payload.stage || 'LEAD',
          status: payload.status || 'NEW',
          priority: payload.priority || 'MEDIUM',
          go_nogo_status: payload.go_nogo_status || 'PENDING',
          marketing_pic_name: cleanPicName || '',
          marketingPicName: cleanPicName || '',
          bid_submission_deadline: payload.bidSubmissionDeadline,
          spk_file_key: payload.spkFileKey,
          grace_deadline: payload.graceDeadline,
        };
        cacheUpdatedDirectly = appendTenderToCache(queryClient, newTender);
      } 
      // Handle DELETED action via removeTenderFromCache helper
      else if (payload?.action === 'DELETED') {
        cacheUpdatedDirectly = removeTenderFromCache(queryClient, payload.tenderId);
      } 
      // Handle Patch actions (UPDATED, STAGE_CHANGED, MARKED_WON, MARKED_LOST, GO_NOGO_*, PROPOSAL_UPLOADED)
      else if (payload?.tenderId) {
        const isPatchAction = [
          'UPDATED',
          'STAGE_CHANGED',
          'MARKED_WON',
          'MARKED_LOST',
          'GO_NOGO_SUBMITTED',
          'GO_NOGO_RESUBMITTED',
          'GO_NOGO_APPROVED',
          'GO_NOGO_REJECTED',
          'PROPOSAL_UPLOADED'
        ].includes(payload?.action);

        if (isPatchAction) {
          const deltaData: Record<string, any> = {};
          if (payload.stage) deltaData.stage = payload.stage;
          if (payload.go_nogo_status) deltaData.go_nogo_status = payload.go_nogo_status;
          if (payload.status) deltaData.status = payload.status;
          if (payload.title) deltaData.title = payload.title;
          if (payload.estimatedBudget !== undefined) deltaData.estimated_budget = payload.estimatedBudget;
          if (payload.customerName) deltaData.customer_name = payload.customerName;
          if (payload.spkFileKey) {
            deltaData.spk_file_key = payload.spkFileKey;
            deltaData.spkFileKey = payload.spkFileKey;
          }
          if (payload.graceDeadline !== undefined) {
            deltaData.grace_deadline = payload.graceDeadline;
          }
          if (payload.spkVerificationStatus) {
            deltaData.spk_verification_status = payload.spkVerificationStatus;
          }
          if (payload.delta && typeof payload.delta === 'object') {
            Object.assign(deltaData, payload.delta);
          }

          if (Object.keys(deltaData).length > 0) {
            cacheUpdatedDirectly = updateAllTenderCaches(queryClient, payload.tenderId, deltaData);
          }
        }
      }

      // Fallback: If cache mutation was not successful (returned false) or non-patch action, invalidate queries
      if (!cacheUpdatedDirectly) {
        if (typeof window !== 'undefined') {
          console.log(`[${now}] [QUERY] INVALIDATE FALLBACK`, { queryKey: ['tenders'], action: payload?.action, reason: 'Direct cache match missed or non-patch action' });
        }
        queryClient.invalidateQueries({ queryKey: ['tenders'] });
      } else {
        if (typeof window !== 'undefined') {
          console.log(`[${now}] [QUERY] DIRECT IN-MEMORY CACHE UPDATE SUCCESS`, { tenderId: payload.tenderId, action: payload?.action });
        }
      }

      if (typeof window !== 'undefined') {
        const currentUserId = user?.sub || (user as any)?.id || (user as any)?.userId;
        const updaterIdNum = payload?.updaterId ? Number(payload.updaterId) : undefined;
        const currentUserIdNum = currentUserId ? Number(currentUserId) : undefined;
        const isActor = Boolean(updaterIdNum && currentUserIdNum && updaterIdNum === currentUserIdNum);

        const userRoles: string[] = Array.isArray(user?.roles) ? user.roles : [];
        const isManagement = userRoles.some(r =>
          ['SUPER_ADMIN', 'ADMIN', 'DIRECTOR', 'GENERAL_MANAGER'].includes(String(r).toUpperCase())
        );

        // Background sync (UPDATED, STAGE_CHANGED, cache invalidation) is SILENT.
        // User-facing business action: PM Return triggers a single amber warning notification for Marketing.
        const isPmReturned = payload?.action === 'PM_RETURNED' || payload?.contract_status === 'PM_RETURNED' || payload?.contractStatus === 'PM_RETURNED';
        if (!isActor && !isManagement && isPmReturned) {
          const dedupeKey = `pm-return-${payload?.tenderId || 0}`;
          const nowMs = Date.now();
          const lastShown = recentToastTimestamps.get(dedupeKey) || 0;

          if (nowMs - lastShown > 3000) {
            recentToastTimestamps.set(dedupeKey, nowMs);

            // Clean up stale cache entries
            if (recentToastTimestamps.size > 50) {
              recentToastTimestamps.forEach((t, k) => {
                if (nowMs - t > 10000) recentToastTimestamps.delete(k);
              });
            }

            const tenderLabel = payload?.title || (payload?.tenderId ? `Tender #${payload.tenderId}` : 'Project Charter');
            notification.warning({
              key: dedupeKey,
              message: 'Project Charter Dikembalikan oleh PM',
              description: `${tenderLabel} perlu penyesuaian operasional/RAB.`,
              placement: 'topRight',
              duration: 4,
              style: { width: 360 },
            });
          }
        }

        if (payload?.tenderId) {
          window.dispatchEvent(new CustomEvent('tender:realtime_updated', { detail: payload }));
        }
      }
    };

    socket.on('sales:pipeline_updated', handlePipelineUpdated);

    return () => {
      socket.off('sales:pipeline_updated', handlePipelineUpdated);
    };
  }, [socket, period, stage]);

  return query;
}
