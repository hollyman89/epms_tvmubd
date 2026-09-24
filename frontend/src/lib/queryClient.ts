import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60000, // 1 Minute
      gcTime: 300000,   // 5 Minutes
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
});

/**
 * Generic Cache Updater for Tenders
 * Loops through all active query keys starting with ['tenders'] to update matching items without triggering a full network refetch.
 */
export function updateAllTenderCaches(queryClientInstance: any, tenderId: number | string, newData: Partial<any>): boolean {
  try {
    if (!queryClientInstance || typeof queryClientInstance.getQueryCache !== 'function' || tenderId === undefined || tenderId === null) return false;
    
    const queryCache = queryClientInstance.getQueryCache();
    const matchingQueries = queryCache.findAll({ queryKey: ['tenders'] });
    if (!matchingQueries || matchingQueries.length === 0) return false;

    const stringTenderId = String(tenderId); // Standarisasi ke String sekali di awal
    let hasUpdated = false;
    const queriesToSync: any[] = [];

    matchingQueries.forEach((query: any) => {
      let queryHasItem = false;

      queryClientInstance.setQueryData(query.queryKey, (oldData: any) => {
        if (!oldData) return oldData;
        
        if (Array.isArray(oldData)) {
          const found = oldData.some((item: any) => String(item.id) === stringTenderId);
          if (found) {
            hasUpdated = true;
            queryHasItem = true;
          }
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
              const found = updated[key].some((item: any) => String(item.id) === stringTenderId);
              if (found) {
                hasUpdated = true;
                queryHasItem = true;
              }
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

      if (!queryHasItem) {
        queriesToSync.push(query.queryKey);
      }
    });

    // Synchronize queries where item was not found in memory (e.g., filter mismatch or new addition)
    if (queriesToSync.length > 0) {
      queriesToSync.forEach((qk) => {
        queryClientInstance.invalidateQueries({ queryKey: qk });
      });
    }

    return hasUpdated;
  } catch (err) {
    return false;
  }
}

/**
 * Helper to normalize and enrich tender object fields (e.g., customer details, PIC names)
 * without hardcoded strings or redundant component mapping logic.
 */
export function enrichTenderItem(item: any, context: { customers?: any[]; users?: any[]; currentUser?: any } = {}): any {
  if (!item || typeof item !== 'object') return item;

  const { customers = [], users = [], currentUser } = context;

  // 1. Resolve Customer reference
  const customerId = item.customer_id || item.customerId;
  let customerObj = item.customer;
  if (!customerObj && customerId && Array.isArray(customers)) {
    const foundCust = customers.find((c: any) => Number(c.id) === Number(customerId));
    if (foundCust) {
      customerObj = { id: foundCust.id, name: foundCust.name, code: foundCust.code };
    }
  }

  // 2. Resolve Marketing PIC Name dynamically without hardcoded fallback strings
  const picId = item.marketing_pic_id || item.marketingPicId;
  let resolvedPicName = item.marketing_pic_name || item.marketingPicName;
  if (!resolvedPicName && picId && Array.isArray(users)) {
    const foundUser = users.find((u: any) => Number(u.id) === Number(picId));
    if (foundUser) {
      resolvedPicName = foundUser.fullName || foundUser.full_name || foundUser.name || foundUser.email;
    }
  }
  if (!resolvedPicName && currentUser) {
    resolvedPicName = currentUser.fullName || currentUser.full_name || currentUser.name || currentUser.email || '';
  }

  return {
    ...item,
    id: item.id,
    title: item.title || item.projectName || '',
    customer_id: customerId,
    customer_name: customerObj?.name || item.customer_name || item.customerName || '',
    customer: customerObj || item.customer || { name: item.customer_name || item.customerName || '' },
    estimated_budget: item.estimated_budget ?? item.estimatedBudget,
    stage: item.stage || 'LEAD',
    status: item.status || 'NEW',
    priority: item.priority || 'MEDIUM',
    go_nogo_status: item.go_nogo_status || 'PENDING',
    marketing_pic_id: picId,
    marketing_pic_name: resolvedPicName || '',
    marketingPicName: resolvedPicName || '',
    bid_submission_deadline: item.bid_submission_deadline || item.bidSubmissionDeadline,
    expected_closing_date: item.expected_closing_date || item.expectedClosingDate,
    created_at: item.created_at || new Date().toISOString(),
  };
}

/**
 * Append Helper for Tenders Cache
 * Adds a new tender item to all active queries starting with ['tenders'] if not already present.
 */
export function appendTenderToCache(
  queryClientInstance: any, 
  newTender: any, 
  context?: { customers?: any[]; users?: any[]; currentUser?: any }
): boolean {
  if (!queryClientInstance || typeof queryClientInstance.getQueryCache !== 'function' || !newTender || !newTender.id) return false;

  const itemToInsert = context ? enrichTenderItem(newTender, context) : newTender;

  const queryCache = queryClientInstance.getQueryCache();
  const matchingQueries = queryCache.findAll({ queryKey: ['tenders'] });
  const stringNewId = String(itemToInsert.id);
  let hasAppended = false;

  matchingQueries.forEach((query: any) => {
    queryClientInstance.setQueryData(query.queryKey, (oldData: any) => {
      if (!oldData) return oldData;

      if (Array.isArray(oldData)) {
        const exists = oldData.some((item: any) => String(item.id) === stringNewId);
        if (!exists) {
          hasAppended = true;
          return [itemToInsert, ...oldData];
        }
        return oldData;
      }

      if (typeof oldData === 'object') {
        const updated = { ...oldData };
        let modified = false;
        Object.keys(updated).forEach((key) => {
          if (Array.isArray(updated[key])) {
            const exists = updated[key].some((item: any) => String(item.id) === stringNewId);
            if (!exists) {
              hasAppended = true;
              modified = true;
              updated[key] = [itemToInsert, ...updated[key]];
            }
          }
        });
        return modified ? updated : oldData;
      }

      return oldData;
    });
  });

  return hasAppended;
}

/**
 * Remove Helper for Tenders Cache
 * Immutably removes a tender item matching tenderId from all active queries starting with ['tenders'].
 */
export function removeTenderFromCache(queryClientInstance: any, tenderId: number | string): boolean {
  if (!queryClientInstance || typeof queryClientInstance.getQueryCache !== 'function' || tenderId === undefined || tenderId === null) return false;

  const queryCache = queryClientInstance.getQueryCache();
  const matchingQueries = queryCache.findAll({ queryKey: ['tenders'] });
  const stringTenderId = String(tenderId);
  let hasRemoved = false;

  matchingQueries.forEach((query: any) => {
    queryClientInstance.setQueryData(query.queryKey, (oldData: any) => {
      if (!oldData) return oldData;

      if (Array.isArray(oldData)) {
        const found = oldData.some((item: any) => String(item.id) === stringTenderId);
        if (found) {
          hasRemoved = true;
          return oldData.filter((item: any) => String(item.id) !== stringTenderId);
        }
        return oldData;
      }

      if (typeof oldData === 'object') {
        const updated = { ...oldData };
        let modified = false;
        Object.keys(updated).forEach((key) => {
          if (Array.isArray(updated[key])) {
            const found = updated[key].some((item: any) => String(item.id) === stringTenderId);
            if (found) {
              hasRemoved = true;
              modified = true;
              updated[key] = updated[key].filter((item: any) => String(item.id) !== stringTenderId);
            }
          }
        });
        return modified ? updated : oldData;
      }

      return oldData;
    });
  });

  return hasRemoved;
}
