import { useQuery } from '@tanstack/react-query';
import { apiClient } from '@/lib/axios';

export interface CustomerParams {
  page?: number;
  limit?: number;
  search?: string;
  sector?: string;
}

export function useCustomersQuery(endpoint: string = '/marketing/customers', params?: CustomerParams, options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['customers', endpoint, params],
    queryFn: async () => {
      const res = await apiClient.get(endpoint, { params });
      const responseBody = res.data?.data || res.data;
      return responseBody;
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 1,
    enabled: options?.enabled ?? true,
  });
}

export function useUsersQuery(options?: { enabled?: boolean }) {
  return useQuery({
    queryKey: ['marketing-users-pics'],
    queryFn: async () => {
      const res = await apiClient.get('/marketing/pics');
      const data = res.data?.data || res.data;
      return Array.isArray(data) ? data : [];
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    refetchOnReconnect: true,
    retry: 1,
    enabled: options?.enabled ?? true,
  });
}
