import { Test, TestingModule } from '@nestjs/testing';
import { Reflector } from '@nestjs/core';
import { getQueueToken } from '@nestjs/bullmq';
import { QueueMonitoringController } from './queue-monitoring.controller';

describe('QueueMonitoringController - RBAC Role Metadata Tests (P0-1)', () => {
  let controller: QueueMonitoringController;
  let reflector: Reflector;

  const mockQueue = {
    getJobCounts: jest.fn().mockResolvedValue({
      active: 0,
      completed: 0,
      failed: 0,
      delayed: 0,
      waiting: 0,
    }),
    getJobs: jest.fn().mockResolvedValue([]),
    add: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [QueueMonitoringController],
      providers: [
        {
          provide: getQueueToken('email-send'),
          useValue: mockQueue,
        },
        {
          provide: getQueueToken('email-dlq'),
          useValue: mockQueue,
        },
        {
          provide: getQueueToken('pdf-generation'),
          useValue: mockQueue,
        },
        Reflector,
      ],
    }).compile();

    controller = module.get<QueueMonitoringController>(QueueMonitoringController);
    reflector = module.get<Reflector>(Reflector);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('class level should require canonical SUPER_ADMIN role and NO phantom MONITORING role', () => {
    const roles = reflector.get<string[]>('roles', QueueMonitoringController);
    expect(roles).toBeDefined();
    expect(roles).toContain('SUPER_ADMIN');
    expect(roles).not.toContain('MONITORING');
  });
});
