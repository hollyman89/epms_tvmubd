import { apiClient } from '@/lib/axios';

export interface HealthProbe {
  component: string;
  status: 'UP' | 'DOWN' | 'DEGRADED';
  latencyMs: number;
  details?: Record<string, any>;
}

export interface HealthData {
  status: 'HEALTHY' | 'UNHEALTHY' | 'DEGRADED';
  timestamp: string;
  totalLatencyMs: number;
  probes: HealthProbe[];
}

export interface SliSloItem {
  name: string;
  targetSlo: string;
  currentSli: string;
  status: string;
}

export interface OutboxTelemetry {
  pendingQueue: number;
  publishedCount: number;
  failedCount: number;
  dlqStatus: string;
  oldestPendingCreatedAt?: string;
  oldestPendingAgeMs?: number;
  recentOutboxIssues?: any[];
}

export interface RunbookItem {
  alert: string;
  severity: string;
  runbookUrl: string;
  mitigation: string;
}

export interface ReadinessData {
  readinessStatus: string;
  verifiedAt: string;
  sliSloSummary?: SliSloItem[];
  errorBudgetSummary?: Record<string, any>;
  outboxTelemetry?: OutboxTelemetry;
  runbookIndex?: RunbookItem[];
}

export interface ObservabilityDashboardData {
  timestamp: string;
  environment: string;
  sliSloReport?: SliSloItem[];
  errorBudget?: Record<string, any>;
  capacity?: Record<string, any>;
  security?: Record<string, any>;
  outboxTelemetry?: OutboxTelemetry;
  runbookIndex?: RunbookItem[];
}

export interface UserSessionItem {
  id: string | number;
  user_id: number;
  ip_address: string;
  user_agent: string;
  last_activity: string;
  is_active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface NotificationHealthData {
  status: string;
  timestamp: string;
  services: {
    websocket?: {
      namespace: string;
      status: string;
    };
    redisIoAdapter?: {
      host?: string;
      port?: number;
      status: string;
    };
  };
}

export const SettingsService = {
  async getHealth(): Promise<HealthData> {
    const res = await apiClient.get('/health');
    return res.data?.data || res.data;
  },

  async getReadinessReport(): Promise<ReadinessData> {
    const res = await apiClient.get('/observability/readiness-report');
    return res.data?.data?.data || res.data?.data || res.data;
  },

  async getObservabilityDashboard(): Promise<ObservabilityDashboardData> {
    const res = await apiClient.get('/observability/dashboard');
    return res.data?.data?.data || res.data?.data || res.data;
  },

  async getActiveSessions(): Promise<UserSessionItem[]> {
    const res = await apiClient.get('/auth/sessions');
    return res.data?.data?.data || res.data?.data || [];
  },

  async revokeSession(id: string | number): Promise<void> {
    await apiClient.delete(`/auth/sessions/${id}`);
  },

  async revokeAllOtherSessions(): Promise<void> {
    await apiClient.delete('/auth/sessions/all-others');
  },

  async getNotificationHealth(): Promise<NotificationHealthData> {
    const res = await apiClient.get('/notifications/health/websocket-redis');
    return res.data?.data || res.data;
  },
};
