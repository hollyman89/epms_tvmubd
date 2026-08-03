import { ObservabilityService } from './observability.service';
export declare class ObservabilityController {
    private readonly observabilityService;
    constructor(observabilityService: ObservabilityService);
    getHealth(): Promise<{
        status: string;
        timestamp: string;
        totalLatencyMs: number;
        probes: import("./observability.interface").HealthCheckProbeResult[];
    }>;
    getApiHealth(): Promise<{
        status: string;
        timestamp: string;
        totalLatencyMs: number;
        probes: import("./observability.interface").HealthCheckProbeResult[];
    }>;
    getObservabilityDashboard(): Promise<{
        statusCode: number;
        message: string;
        data: {
            timestamp: string;
            environment: string;
            sliSloReport: import("./observability.interface").SliSloTarget[];
            errorBudget: import("./observability.interface").ErrorBudgetStatus;
            capacityMetrics: import("./observability.interface").CapacityMetric[];
            securityMetrics: import("./observability.interface").SecurityEventMetric[];
            businessMetrics: {
                approvalsToday: number;
                tendersWon: number;
                projectsCreated: number;
                auditLogsRecorded: number;
                meanApprovalTimeMinutes: number;
            };
            outboxTelemetry: {
                pendingQueue: number;
                publishedCount: number;
                failedCount: number;
                dlqStatus: string;
            };
            runbookIndex: {
                alert: string;
                severity: string;
                runbookUrl: string;
                mitigation: string;
            }[];
        };
    }>;
    getReadinessReport(): Promise<{
        statusCode: number;
        message: string;
        data: {
            readinessStatus: string;
            verifiedAt: string;
            sliSloSummary: import("./observability.interface").SliSloTarget[];
            errorBudgetSummary: import("./observability.interface").ErrorBudgetStatus;
            outboxTelemetry: {
                pendingQueue: number;
                publishedCount: number;
                failedCount: number;
                dlqStatus: string;
            };
            runbookIndex: {
                alert: string;
                severity: string;
                runbookUrl: string;
                mitigation: string;
            }[];
        };
    }>;
}
