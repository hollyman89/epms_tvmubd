import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';
import { useAuth } from '../context/AuthContext';

const COMMON_QUERY_CONFIG = {
  staleTime: 5 * 60 * 1000,
  gcTime: 10 * 60 * 1000,
  retry: 1,
  refetchOnWindowFocus: false,
  refetchOnReconnect: true,
};

export function useDashboardSummaryQuery(period: string = 'all', endpoint: string = '/dashboard/summary', options?: { enabled?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dashboard-summary', endpoint, period, user?.sub],
    queryFn: async () => {
      const url = period === 'all' ? endpoint : `${endpoint}?period=${period}`;
      const res = await apiClient.get(url);
      return res.data?.data?.data || res.data?.data || res.data;
    },
    enabled: options?.enabled ?? true,
    ...COMMON_QUERY_CONFIG,
  });
}

export function useAnalyticsDashboardQuery(period: string = 'YEAR_TO_DATE', options?: { enabled?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['analytics-dashboard', period, user?.sub],
    queryFn: async () => {
      const res = await apiClient.get(`/analytics/dashboard?period=${period}`);
      return res.data?.data?.data || res.data?.data || res.data;
    },
    enabled: options?.enabled ?? true,
    ...COMMON_QUERY_CONFIG,
  });
}

export function usePendingContractsQuery(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['pending-contracts', user?.sub],
    queryFn: async () => {
      const res = await apiClient.get('/legal/contracts/pending');
      return res.data?.data || res.data || [];
    },
    enabled: options?.enabled ?? true,
    ...COMMON_QUERY_CONFIG,
  });
}

export function useDashboardProjectTrendQuery(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dashboard-project-trend', user?.sub],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/project-trend');
      const data = res.data?.data?.data || res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: options?.enabled ?? true,
    ...COMMON_QUERY_CONFIG,
  });
}

export function useDashboardProcurementPendingQuery(options?: { enabled?: boolean }) {
  const { user } = useAuth();
  return useQuery({
    queryKey: ['dashboard-procurement-pending', user?.sub],
    queryFn: async () => {
      const res = await apiClient.get('/dashboard/procurement-pending');
      const data = res.data?.data?.data || res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    enabled: options?.enabled ?? true,
    ...COMMON_QUERY_CONFIG,
  });
}
