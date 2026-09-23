export interface MetricEntry {
  name: string;
  value: number;
  unit: string;
  timestamp: string;
  labels?: Record<string, string>;
}

export interface SliSloTarget {
  name: string;
  targetSlo: string;
  currentSli: string;
  status: 'MEETS_SLO' | 'AT_RISK' | 'BREACHED' | 'NOT_MEASURED';
}

export interface ErrorBudgetStatus {
  monthlyBudgetPercent: number | null;
  usedPercent: number | null;
  remainingPercent: number | null;
  status: 'HEALTHY' | 'WARNING' | 'EXHAUSTED' | 'NOT_MEASURED';
}

export interface CapacityMetric {
  resource: string;
  usagePercent: number | null;
  status: 'NORMAL' | 'HIGH' | 'CRITICAL' | 'NOT_MEASURED';
  trend: 'STABLE' | 'RISING' | 'FALLING' | 'NOT_MEASURED';
}

export interface OutboxIssueDiagnostic {
  eventId: string;
  eventName: string;
  status: string;
  retryCount: number;
  errorMessage: string | null;
  createdAt: string | null;
}

export interface OutboxTelemetry {
  pendingQueue: number;
  publishedCount: number;
  failedCount: number;
  dlqStatus: 'ACTION_REQUIRED' | 'CLEAR';
  oldestPendingCreatedAt: string | null;
  oldestPendingAgeMs: number | null;
  recentOutboxIssues: OutboxIssueDiagnostic[];
}

export interface SecurityEventMetric {
  eventType: string;
  count: number;
  severity: 'INFO' | 'WARNING' | 'HIGH' | 'CRITICAL';
  lastOccurred: string;
}

export interface HealthCheckProbeResult {
  component: string;
  status: 'UP' | 'DOWN' | 'DEGRADED';
  latencyMs: number;
  details?: Record<string, any>;
}

export interface IMetricsAdapter {
  recordMetric(metric: MetricEntry): void;
  getSliSloReport(): SliSloTarget[];
  getErrorBudget(): ErrorBudgetStatus;
}

export interface ITracingAdapter {
  startSpan(name: string, correlationId: string): any;
  injectContext(headers: Record<string, string>, correlationId: string): void;
}
