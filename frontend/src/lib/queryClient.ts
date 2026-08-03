import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000, // 1 Minute
      gcTime: 300000,   // 5 Minutes
      refetchOnWindowFocus: true,
      retry: 1,
    },
  },
});

/**
 * Generic Cache Updater for Tenders
 * Loops through all active query keys starting with ['tenders'] to update matching items without triggering a full network refetch.
 */
export function updateAllTenderCaches(queryClientInstance: any, tenderId: number | string, newData: Partial<any>) {
  if (!queryClientInstance || typeof queryClientInstance.getQueryCache !== 'function') return;
  
  const queryCache = queryClientInstance.getQueryCache();
  const matchingQueries = queryCache.findAll({ queryKey: ['tenders'] });
  const stringTenderId = String(tenderId); // Standarisasi ke String sekali di awal

  matchingQueries.forEach((query: any) => {
    queryClientInstance.setQueryData(query.queryKey, (oldData: any) => {
      if (!oldData) return oldData;
      
      if (Array.isArray(oldData)) {
        return oldData.map((item: any) =>
          String(item.id) === stringTenderId
            ? { ...item, ...newData, version: (item.version || 1) + 1 }
            : item
        );
      }
      
      if (typeof oldData === 'object') {
        const updated = { ...oldData };
        Object.keys(updated).forEach((key) => {
          if (Array.isArray(updated[key])) {
            updated[key] = updated[key].map((item: any) =>
              String(item.id) === stringTenderId
                ? { ...item, ...newData, version: (item.version || 1) + 1 }
                : item
            );
          }
        });
        return updated;
      }
      return oldData;
    });
  });
}
