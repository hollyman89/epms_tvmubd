import { apiClient } from '@/lib/axios';

export interface SafeActor {
  id: number;
  full_name: string;
  email: string;
}

export interface AuditLogRecord {
  id: number;
  table_name: string;
  record_id: number;
  action: string;
  old_value: any;
  new_value: any;
  ip_address: string | null;
  user_agent: string | null;
  created_by: number | null;
  created_at: string;
  actor: SafeActor | null;
}

export interface AuditQueryParams {
  page?: number;
  limit?: number;
  search?: string;
  dateFrom?: string;
  dateTo?: string;
  tableName?: string;
  action?: string;
  actorId?: number;
}

export interface PaginatedAuditLogs {
  data: AuditLogRecord[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

export class AuditService {
  /**
   * Fetch paginated audit logs from canonical backend read API.
   * STRICT READ ONLY.
   */
  static async getAuditLogs(params?: AuditQueryParams): Promise<PaginatedAuditLogs> {
    // Clean params to avoid sending empty strings or undefined
    const cleanParams: Record<string, any> = {};
    if (params) {
      if (params.page !== undefined && params.page !== null) cleanParams.page = params.page;
      if (params.limit !== undefined && params.limit !== null) cleanParams.limit = params.limit;
      if (params.search && params.search.trim()) cleanParams.search = params.search.trim();
      if (params.dateFrom) cleanParams.dateFrom = params.dateFrom;
      if (params.dateTo) cleanParams.dateTo = params.dateTo;
      if (params.tableName && params.tableName.trim()) cleanParams.tableName = params.tableName.trim();
      if (params.action && params.action.trim()) cleanParams.action = params.action.trim();
      if (params.actorId !== undefined && params.actorId !== null) cleanParams.actorId = params.actorId;
    }

    const res = await apiClient.get('/audit-logs', { params: cleanParams });

    // Handle TransformInterceptor wrapper format: res.data.data or res.data
    const responseData = res.data?.data || res.data;

    return {
      data: Array.isArray(responseData?.data) ? responseData.data : [],
      total: typeof responseData?.total === 'number' ? responseData.total : 0,
      page: typeof responseData?.page === 'number' ? responseData.page : 1,
      limit: typeof responseData?.limit === 'number' ? responseData.limit : 20,
      totalPages: typeof responseData?.totalPages === 'number' ? responseData.totalPages : 1,
    };
  }
}

export default AuditService;
