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
    status: 'MEETS_SLO' | 'AT_RISK' | 'BREACHED';
}
export interface ErrorBudgetStatus {
    monthlyBudgetPercent: number;
    usedPercent: number;
    remainingPercent: number;
    status: 'HEALTHY' | 'WARNING' | 'EXHAUSTED';
}
export interface CapacityMetric {
    resource: string;
    usagePercent: number;
    status: 'NORMAL' | 'HIGH' | 'CRITICAL';
    trend: 'STABLE' | 'RISING' | 'FALLING';
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
