import { Repository, DataSource } from 'typeorm';
import { OutboxEvent } from '../../entities/outbox-event.entity';
import { Contract } from '../../entities/contract.entity';
import { Tender } from '../../entities/tender.entity';
import { Project } from '../../entities/project.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import { SliSloTarget, ErrorBudgetStatus, CapacityMetric, SecurityEventMetric, HealthCheckProbeResult } from './observability.interface';
export declare class ObservabilityService {
    private readonly dataSource;
    private outboxRepo;
    private contractRepo;
    private tenderRepo;
    private projectRepo;
    private auditRepo;
    private readonly logger;
    constructor(dataSource: DataSource, outboxRepo: Repository<OutboxEvent>, contractRepo: Repository<Contract>, tenderRepo: Repository<Tender>, projectRepo: Repository<Project>, auditRepo: Repository<AuditLog>);
    getDeepHealthCheck(): Promise<{
        status: string;
        timestamp: string;
        totalLatencyMs: number;
        probes: HealthCheckProbeResult[];
    }>;
    getOperationalDashboard(): Promise<{
        statusCode: number;
        message: string;
        data: {
            timestamp: string;
            environment: string;
            sliSloReport: SliSloTarget[];
            errorBudget: ErrorBudgetStatus;
            capacityMetrics: CapacityMetric[];
            securityMetrics: SecurityEventMetric[];
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
}
