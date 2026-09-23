import { Test, TestingModule } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import { DataSource, MoreThan, Not, IsNull } from 'typeorm';
import { ObservabilityService } from './observability.service';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';
import { Contract } from '../../entities/contract.entity';
import { Tender } from '../../entities/tender.entity';
import { Project } from '../../entities/project.entity';
import { AuditLog } from '../../entities/audit-log.entity';

describe('Phase H: ObservabilityService (Aligned Outbox Metrics & Operational Diagnostics)', () => {
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

  describe('Outbox Operational Diagnostics (recentOutboxIssues)', () => {
    it('1-3. retrying PENDING and FAILED appear in recentOutboxIssues, clean PENDING is excluded', async () => {
      outboxRepo.count.mockResolvedValue(0);
      outboxRepo.findOne.mockResolvedValue(null);

      // Candidate pool containing retrying PENDING, FAILED, and clean PENDING
      const candidates = [
        {
          id: 1,
          event_id: 'evt-retrying-1',
          event_name: 'procurement.po.issued',
          status: OutboxStatus.PENDING,
          retry_count: 2,
          error_message: 'Connection timeout',
          created_at: new Date('2026-09-24T00:00:03.000Z'),
        },
        {
          id: 2,
          event_id: 'evt-failed-1',
          event_name: 'finance.payment.recorded',
          status: OutboxStatus.FAILED,
          retry_count: 5,
          error_message: 'Max retries exhausted',
          created_at: new Date('2026-09-24T00:00:02.000Z'),
        },
        {
          id: 3,
          event_id: 'evt-retrying-error',
          event_name: 'procurement.gr.received',
          status: OutboxStatus.PENDING,
          retry_count: 0,
          error_message: 'Deadlock encountered',
          created_at: new Date('2026-09-24T00:00:01.000Z'),
        },
        {
          id: 4,
          event_id: 'evt-clean-pending',
          event_name: 'procurement.rfq.created',
          status: OutboxStatus.PENDING,
          retry_count: 0,
          error_message: null,
          created_at: new Date('2026-09-24T00:00:00.000Z'),
        },
      ];

      // Simulate TypeORM evaluation of WHERE: FAILED OR retry_count > 0 OR error_message IS NOT NULL
      outboxRepo.find.mockImplementation(({ where, take }: any) => {
        expect(where).toEqual([
          { status: OutboxStatus.FAILED },
          { retry_count: MoreThan(0) },
          { error_message: Not(IsNull()) },
        ]);

        const filtered = candidates.filter(
          c => c.status === OutboxStatus.FAILED || c.retry_count > 0 || c.error_message !== null,
        );
        return Promise.resolve(filtered.slice(0, take));
      });

      const result = await service.getOperationalDashboard();
      const issues = result.data.outboxTelemetry.recentOutboxIssues;

      expect(issues).toBeDefined();
      expect(issues.map((i: any) => i.eventId)).toEqual([
        'evt-retrying-1',
        'evt-failed-1',
        'evt-retrying-error',
      ]);

      // Clean PENDING MUST NOT appear
      expect(issues.some((i: any) => i.eventId === 'evt-clean-pending')).toBe(false);
    });

    it('4-6. issue list bounded to 10, status field exposed, payload strictly excluded', async () => {
      outboxRepo.count.mockResolvedValue(20);
      outboxRepo.findOne.mockResolvedValue(null);

      const mockRows = Array.from({ length: 15 }, (_, i) => ({
        id: i + 1,
        event_id: `evt-issue-${i + 1}`,
        event_name: 'procurement.po.issued',
        status: i % 2 === 0 ? OutboxStatus.FAILED : OutboxStatus.PENDING,
        retry_count: i + 1,
        error_message: `Transport socket timeout error #${i + 1}`,
        payload: { secretFinancialToken: 'CONFIDENTIAL', amount: 1000000 },
        businessPayload: { sensitive: true },
        actor: 'user-admin',
        routing: 'finance-room',
        aggregateType: 'PurchaseOrder',
        aggregateId: 100 + i,
        correlationId: 'corr-xyz',
        transactionId: 'tx-abc',
        created_at: new Date('2026-09-24T00:00:00.000Z'),
      }));

      outboxRepo.find.mockImplementation(({ take }: any) => {
        return Promise.resolve(mockRows.slice(0, take));
      });

      const result = await service.getOperationalDashboard();

      expect(outboxRepo.find).toHaveBeenCalledWith({
        select: ['event_id', 'event_name', 'status', 'retry_count', 'error_message', 'created_at'],
        where: [
          { status: OutboxStatus.FAILED },
          { retry_count: MoreThan(0) },
          { error_message: Not(IsNull()) },
        ],
        order: { created_at: 'DESC' },
        take: 10,
      });

      const issues = result.data.outboxTelemetry.recentOutboxIssues;
      // 4. Bounded to 10
      expect(issues).toHaveLength(10);

      // 5. status field exposed
      expect(issues[0].status).toBe(OutboxStatus.FAILED);
      expect(issues[1].status).toBe(OutboxStatus.PENDING);
      expect(issues[0].retryCount).toBe(1);
      expect(issues[0].errorMessage).toBe('Transport socket timeout error #1');

      // 6. Sensitive and routing fields NOT exposed
      issues.forEach((issue: any) => {
        expect(issue.payload).toBeUndefined();
        expect(issue.businessPayload).toBeUndefined();
        expect(issue.actor).toBeUndefined();
        expect(issue.routing).toBeUndefined();
        expect(issue.aggregateType).toBeUndefined();
        expect(issue.aggregateId).toBeUndefined();
        expect(issue.correlationId).toBeUndefined();
        expect(issue.transactionId).toBeUndefined();
      });
    });
  });

  describe('Oldest Pending Outbox Age & Queue Idle Semantics', () => {
    it('7-8. oldest PENDING selected correctly and oldestPendingAgeMs derived from actual created_at', async () => {
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

    it('9. empty pending queue returns null age, null created_at, and Queue Idle presentation', async () => {
      outboxRepo.count.mockResolvedValue(0);
      outboxRepo.findOne.mockResolvedValue(null);
      outboxRepo.find.mockResolvedValue([]);

      const result = await service.getOperationalDashboard();

      expect(result.data.outboxTelemetry.oldestPendingCreatedAt).toBeNull();
      expect(result.data.outboxTelemetry.oldestPendingAgeMs).toBeNull();

      const ageSli = result.data.sliSloReport.find(s => s.name === 'Oldest Pending Outbox Age');
      expect(ageSli?.currentSli).toBe('Queue Idle');
      expect(ageSli?.status).toBe('MEETS_SLO');
    });
  });

  describe('Removal of Invalid Formulas & Fake Telemetry', () => {
    it('10-11. Outbox delivery success rate is NOT_MEASURED and published/(published+failed) formula is removed', async () => {
      outboxRepo.count.mockImplementation(({ where }: any) => {
        if (where.status === OutboxStatus.PENDING) return Promise.resolve(5);
        if (where.status === OutboxStatus.PUBLISHED) return Promise.resolve(95);
        if (where.status === OutboxStatus.FAILED) return Promise.resolve(1);
        return Promise.resolve(0);
      });
      outboxRepo.findOne.mockResolvedValue(null);
      outboxRepo.find.mockResolvedValue([]);

      const result = await service.getOperationalDashboard();

      // Formula published/(published+failed) MUST NOT be present in outboxTelemetry
      expect((result.data.outboxTelemetry as any).deliverySuccessRate).toBeUndefined();

      const deliverySli = result.data.sliSloReport.find(s => s.name === 'Outbox Event Delivery Success Rate');
      expect(deliverySli).toBeDefined();
      expect(deliverySli?.currentSli).toBe('NOT_MEASURED');
      expect(deliverySli?.status).toBe('NOT_MEASURED');
    });

    it('12-13. hardcoded 0.35s no longer exists, and unsupported telemetry has no fake measured numbers', async () => {
      outboxRepo.count.mockResolvedValue(0);
      outboxRepo.findOne.mockResolvedValue(null);
      outboxRepo.find.mockResolvedValue([]);

      const result = await service.getOperationalDashboard();

      // 12. No 0.35s
      const sliEntries = result.data.sliSloReport;
      sliEntries.forEach(entry => {
        expect(entry.currentSli).not.toBe('0.35 s');
        expect(entry.currentSli).not.toBe('99.99%');
      });

      // 13. Unsupported metrics have status = NOT_MEASURED and null numeric fields
      const availability = sliEntries.find(s => s.name === 'API System Availability');
      expect(availability?.currentSli).toBe('NOT_MEASURED');
      expect(availability?.status).toBe('NOT_MEASURED');

      const latency = sliEntries.find(s => s.name === 'API P95 Response Latency');
      expect(latency?.currentSli).toBe('NOT_MEASURED');
      expect(latency?.status).toBe('NOT_MEASURED');

      const approval = sliEntries.find(s => s.name === 'Approval Transaction Success Rate');
      expect(approval?.currentSli).toBe('NOT_MEASURED');
      expect(approval?.status).toBe('NOT_MEASURED');

      const errorBudget = result.data.errorBudget;
      expect(errorBudget.status).toBe('NOT_MEASURED');
      expect(errorBudget.monthlyBudgetPercent).toBeNull();
      expect(errorBudget.usedPercent).toBeNull();
      expect(errorBudget.remainingPercent).toBeNull();

      const capacity = result.data.capacityMetrics;
      const cpu = capacity.find(c => c.resource === 'CPU Utilization');
      expect(cpu?.status).toBe('NOT_MEASURED');
      expect(cpu?.trend).toBe('NOT_MEASURED');
      expect(cpu?.usagePercent).toBeNull();

      const ram = capacity.find(c => c.resource === 'Memory Utilization (RAM)');
      expect(ram?.status).toBe('NOT_MEASURED');
      expect(ram?.trend).toBe('NOT_MEASURED');
      expect(ram?.usagePercent).toBeNull();

      const db = capacity.find(c => c.resource === 'Database Connections');
      expect(db?.status).toBe('NOT_MEASURED');
      expect(db?.trend).toBe('NOT_MEASURED');
      expect(db?.usagePercent).toBeNull();
    });
  });
});
