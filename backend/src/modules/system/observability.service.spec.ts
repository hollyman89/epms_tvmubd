import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { ObservabilityService } from './observability.service';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';
import { Contract } from '../../entities/contract.entity';
import { Tender } from '../../entities/tender.entity';
import { Project } from '../../entities/project.entity';
import { AuditLog } from '../../entities/audit-log.entity';

describe('Phase H: ObservabilityService (Real Outbox Metrics & Operational Diagnostics)', () => {
  let service: ObservabilityService;
  let outboxRepo: any;
  let contractRepo: any;
  let tenderRepo: any;
  let projectRepo: any;
  let auditRepo: any;
  let dataSource: any;

  beforeEach(async () => {
    outboxRepo = {
      count: jest.fn(),
      findOne: jest.fn(),
      find: jest.fn(),
    };
    contractRepo = { count: jest.fn().mockResolvedValue(5) };
    tenderRepo = { count: jest.fn().mockResolvedValue(10) };
    projectRepo = { count: jest.fn().mockResolvedValue(3) };
    auditRepo = { count: jest.fn().mockResolvedValue(100) };
    dataSource = { query: jest.fn() };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ObservabilityService,
        { provide: DataSource, useValue: dataSource },
        { provide: getRepositoryToken(OutboxEvent), useValue: outboxRepo },
        { provide: getRepositoryToken(Contract), useValue: contractRepo },
        { provide: getRepositoryToken(Tender), useValue: tenderRepo },
        { provide: getRepositoryToken(Project), useValue: projectRepo },
        { provide: getRepositoryToken(AuditLog), useValue: auditRepo },
      ],
    }).compile();

    service = module.get<ObservabilityService>(ObservabilityService);
  });

  it('1-3. PENDING, PUBLISHED, and FAILED counts remain correct in outboxTelemetry', async () => {
    outboxRepo.count.mockImplementation(({ where }: any) => {
      if (where.status === OutboxStatus.PENDING) return Promise.resolve(4);
      if (where.status === OutboxStatus.PUBLISHED) return Promise.resolve(96);
      if (where.status === OutboxStatus.FAILED) return Promise.resolve(2);
      return Promise.resolve(0);
    });
    outboxRepo.findOne.mockResolvedValue(null);
    outboxRepo.find.mockResolvedValue([]);

    const result = await service.getOperationalDashboard();

    expect(result.data.outboxTelemetry.pendingQueue).toBe(4);
    expect(result.data.outboxTelemetry.publishedCount).toBe(96);
    expect(result.data.outboxTelemetry.failedCount).toBe(2);
    expect(result.data.outboxTelemetry.dlqStatus).toBe('ACTION_REQUIRED');
  });

  it('4-5. oldest pending row identified correctly and oldestPendingAgeMs derived from real created_at', async () => {
    const fixedNow = new Date('2026-09-24T00:00:10.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(fixedNow);

    const createdAt = new Date('2026-09-24T00:00:07.500Z'); // 2.5s ago
    outboxRepo.count.mockResolvedValue(1);
    outboxRepo.findOne.mockResolvedValue({
      id: 42,
      created_at: createdAt,
    });
    outboxRepo.find.mockResolvedValue([]);

    const result = await service.getOperationalDashboard();

    expect(outboxRepo.findOne).toHaveBeenCalledWith({
      select: ['id', 'created_at'],
      where: { status: OutboxStatus.PENDING },
      order: { created_at: 'ASC' },
    });

    expect(result.data.outboxTelemetry.oldestPendingCreatedAt).toBe(createdAt.toISOString());
    expect(result.data.outboxTelemetry.oldestPendingAgeMs).toBe(2500);

    const ageSli = result.data.sliSloReport.find(s => s.name === 'Oldest Pending Outbox Age');
    expect(ageSli).toBeDefined();
    expect(ageSli?.currentSli).toBe('2.50 s');
    expect(ageSli?.status).toBe('AT_RISK'); // > 2.0s

    jest.spyOn(Date, 'now').mockRestore();
  });

  it('6. no pending events handled safely (null created_at, null ageMs, idle queue)', async () => {
    outboxRepo.count.mockResolvedValue(0);
    outboxRepo.findOne.mockResolvedValue(null);
    outboxRepo.find.mockResolvedValue([]);

    const result = await service.getOperationalDashboard();

    expect(result.data.outboxTelemetry.oldestPendingCreatedAt).toBeNull();
    expect(result.data.outboxTelemetry.oldestPendingAgeMs).toBeNull();

    const ageSli = result.data.sliSloReport.find(s => s.name === 'Oldest Pending Outbox Age');
    expect(ageSli?.currentSli).toBe('0.00 s (Queue Idle)');
    expect(ageSli?.status).toBe('MEETS_SLO');
  });

  it('7-9. failed diagnostics bounded (<= 10), error_message surfaced, business payload NOT surfaced', async () => {
    const rawFailedRows = Array.from({ length: 15 }, (_, i) => ({
      id: i + 1,
      event_id: `evt-failed-${i + 1}`,
      event_name: 'procurement.po.issued',
      retry_count: 5,
      error_message: `Transport socket timeout error #${i + 1}`,
      payload: { sensitiveVendorFinancials: 'SECRET_PAYLOAD', amount: 999999999 },
      created_at: new Date('2026-09-24T00:00:00.000Z'),
    }));

    outboxRepo.count.mockResolvedValue(15);
    outboxRepo.findOne.mockResolvedValue(null);
    // Repository find called with take: 10
    outboxRepo.find.mockImplementation(({ take }: any) => {
      return Promise.resolve(rawFailedRows.slice(0, take));
    });

    const result = await service.getOperationalDashboard();

    expect(outboxRepo.find).toHaveBeenCalledWith({
      select: ['event_id', 'event_name', 'retry_count', 'error_message', 'created_at'],
      where: { status: OutboxStatus.FAILED },
      order: { created_at: 'DESC' },
      take: 10,
    });

    const diagnostics = result.data.outboxTelemetry.recentFailedEvents;
    expect(diagnostics).toHaveLength(10);
    expect(diagnostics[0].eventId).toBe('evt-failed-1');
    expect(diagnostics[0].errorMessage).toBe('Transport socket timeout error #1');
    expect(diagnostics[0].retryCount).toBe(5);

    // CRITICAL: business payload MUST NOT be present in diagnostics
    diagnostics.forEach((diag: any) => {
      expect(diag.payload).toBeUndefined();
      expect(diag.sensitiveVendorFinancials).toBeUndefined();
      expect(diag.amount).toBeUndefined();
    });
  });

  it('10. no hardcoded 0.35s used as real Outbox metric', async () => {
    outboxRepo.count.mockResolvedValue(0);
    outboxRepo.findOne.mockResolvedValue(null);
    outboxRepo.find.mockResolvedValue([]);

    const result = await service.getOperationalDashboard();

    const sliEntries = result.data.sliSloReport;
    sliEntries.forEach(entry => {
      expect(entry.currentSli).not.toBe('0.35 s');
    });

    // Verify unmeasured APM metrics are classified as NOT_MEASURED
    const availability = sliEntries.find(s => s.name === 'API System Availability');
    expect(availability?.currentSli).toBe('NOT_MEASURED');
    expect(availability?.status).toBe('NOT_MEASURED');
  });
});
