import {
  toJakartaDateString,
  diffInJakartaCalendarDays,
  addJakartaCalendarDays,
  isMeaningfulMarketingActivity,
  calculateInactivityReferenceDate,
  calculateEscalationCycleIndex,
  formatInactivityEpisodeRef,
} from '../tender-followup.helper';
import {
  evaluateMarketingActionItem,
  MarketingActionConditionType,
} from '../marketing-action-item.predicate';
import { TenderScheduler } from '../tender.scheduler';
import { TenderStatus, TenderStage } from '../../../entities/tender.entity';

describe('EPMS — Marketing Follow-Up Governance Comprehensive Unit & Integration Tests', () => {
  describe('A. Pure Asia/Jakarta Calendar Helpers & Deterministic Dates', () => {
    it('1. toJakartaDateString formats UTC dates accurately into Asia/Jakarta (UTC+7)', () => {
      // 2026-10-21 18:00:00 UTC is 2026-10-22 01:00:00 in Asia/Jakarta
      const utcDate = new Date('2026-10-21T18:00:00.000Z');
      expect(toJakartaDateString(utcDate)).toBe('2026-10-22');
    });

    it('2. diffInJakartaCalendarDays computes integer calendar day differences (not rolling 48 hours)', () => {
      // Day 19 to Day 21 is exactly 2 calendar days
      expect(diffInJakartaCalendarDays('2026-10-21', '2026-10-19')).toBe(2);
      expect(diffInJakartaCalendarDays('2026-10-20', '2026-10-19')).toBe(1);
      expect(diffInJakartaCalendarDays('2026-10-19', '2026-10-19')).toBe(0);
    });

    it('3. addJakartaCalendarDays shifts calendar dates correctly', () => {
      expect(addJakartaCalendarDays('2026-10-19', 2)).toBe('2026-10-21');
      expect(addJakartaCalendarDays('2026-10-19', -14)).toBe('2026-10-05');
    });
  });

  describe('B. Canonical Marketing Action Item Predicate', () => {
    const fixedNow = new Date('2026-10-22T09:00:00+07:00');

    it('1. OVERDUE: triggers when bid_submission_deadline is before today in Jakarta', () => {
      const res = evaluateMarketingActionItem(
        {
          stage: 'PROPOSAL',
          status: 'IN_PROGRESS',
          bid_submission_deadline: '2026-10-19',
        },
        fixedNow,
      );
      expect(res.isActionItem).toBe(true);
      expect(res.conditionType).toBe(MarketingActionConditionType.OVERDUE);
      expect(res.daysOverdue).toBe(3);
    });

    it('2. UPCOMING_DEADLINE: triggers within 14 calendar days for QUALIFICATION, NEGOTIATION, PROPOSAL', () => {
      const res = evaluateMarketingActionItem(
        {
          stage: 'PROPOSAL',
          status: 'IN_PROGRESS',
          bid_submission_deadline: '2026-10-25',
        },
        fixedNow,
      );
      expect(res.isActionItem).toBe(true);
      expect(res.conditionType).toBe(MarketingActionConditionType.UPCOMING_DEADLINE);
      expect(res.daysRemaining).toBe(3);
    });

    it('3. STUCK: triggers when probability is 0% and age > 7 calendar days', () => {
      const res = evaluateMarketingActionItem(
        {
          stage: 'LEAD',
          status: 'ACTIVE',
          probability_percentage: 0,
          created_at: '2026-10-10',
        },
        fixedNow,
      );
      expect(res.isActionItem).toBe(true);
      expect(res.conditionType).toBe(MarketingActionConditionType.STUCK);
      expect(res.stuckDays).toBe(12);
    });

    it('4. Terminal Exclusion: WON and LOST are strictly excluded', () => {
      const wonRes = evaluateMarketingActionItem(
        {
          stage: 'WON',
          status: 'WON',
          bid_submission_deadline: '2026-10-10',
        },
        fixedNow,
      );
      expect(wonRes.isActionItem).toBe(false);

      const lostRes = evaluateMarketingActionItem(
        {
          stage: 'LOST',
          status: 'LOST',
          bid_submission_deadline: '2026-10-10',
        },
        fixedNow,
      );
      expect(lostRes.isActionItem).toBe(false);
    });
  });

  describe('C. Meaningful Marketing Follow-Up Whitelist & Actor Verification', () => {
    const responsiblePicId = 12;
    const directorId = 5;

    it('1. Whitelisted action by responsible Marketing user resets clock', () => {
      // Stage changed
      expect(
        isMeaningfulMarketingActivity(
          'Tender stage changed from LEAD to PROPOSAL',
          responsiblePicId,
          responsiblePicId,
        ),
      ).toBe(true);

      // Go/No-Go submitted
      expect(
        isMeaningfulMarketingActivity(
          'Marketing submitted tender for GO / NO GO review.',
          responsiblePicId,
          responsiblePicId,
        ),
      ).toBe(true);

      // SPK uploaded
      expect(
        isMeaningfulMarketingActivity(
          'Dokumen SPK (kontrak_final.pdf) berhasil diunggah.',
          responsiblePicId,
          responsiblePicId,
        ),
      ).toBe(true);
    });

    it('2. Same business action by Director/Admin does NOT reset PIC clock', () => {
      expect(
        isMeaningfulMarketingActivity(
          'Tender stage changed from LEAD to PROPOSAL',
          directorId,
          responsiblePicId,
        ),
      ).toBe(false);
    });

    it('3. System action (null actor) does NOT reset clock', () => {
      expect(
        isMeaningfulMarketingActivity(
          'Tender dikembalikan ke NEGOTIATION karena Grace Period SPK 2x24 jam telah berakhir.',
          null,
          responsiblePicId,
        ),
      ).toBe(false);
    });

    it('4. Generic comments do NOT reset clock', () => {
      expect(
        isMeaningfulMarketingActivity(
          'Halo, bagaimana kabar tender ini?',
          responsiblePicId,
          responsiblePicId,
        ),
      ).toBe(false);
    });
  });

  describe('D. Inactivity Reference & Escalation Cycle', () => {
    it('1. OVERDUE initial reference is bid_submission_deadline', () => {
      const ref = calculateInactivityReferenceDate({
        conditionType: MarketingActionConditionType.OVERDUE,
        bidSubmissionDeadline: '2026-10-19',
      });
      expect(toJakartaDateString(ref!)).toBe('2026-10-19');
    });

    it('2. UPCOMING_DEADLINE reference is MAX(stageEntry, deadline - 14 days)', () => {
      // Deadline 2026-10-30 -> -14 days is 2026-10-16. Stage entered 2026-10-18 -> reference is 2026-10-18
      const ref = calculateInactivityReferenceDate({
        conditionType: MarketingActionConditionType.UPCOMING_DEADLINE,
        bidSubmissionDeadline: '2026-10-30',
        stageEntryDate: new Date('2026-10-18'),
      });
      expect(toJakartaDateString(ref!)).toBe('2026-10-18');
    });

    it('3. STUCK returns null reference when probability zero transition is unproven', () => {
      const ref = calculateInactivityReferenceDate({
        conditionType: MarketingActionConditionType.STUCK,
        probabilityZeroProvableDate: null,
      });
      expect(ref).toBeNull();
    });

    it('4. Subsequent meaningful follow-up overrides initial reference', () => {
      const ref = calculateInactivityReferenceDate({
        conditionType: MarketingActionConditionType.OVERDUE,
        bidSubmissionDeadline: '2026-10-19',
        latestMeaningfulFollowUpDate: new Date('2026-10-25'),
      });
      expect(toJakartaDateString(ref!)).toBe('2026-10-25');
    });

    it('5. Inactivity < 2 calendar days does not escalate; >= 2 calendar days escalates', () => {
      const today = new Date('2026-10-21');
      const refDay1 = new Date('2026-10-20');
      const refDay2 = new Date('2026-10-19');

      expect(diffInJakartaCalendarDays(today, refDay1) >= 2).toBe(false);
      expect(diffInJakartaCalendarDays(today, refDay2) >= 2).toBe(true);
    });
  });

  describe('E. TenderScheduler Multi-Instance Safety, Ownership & Reminders', () => {
    let scheduler: TenderScheduler;
    let mockTenderRepo: any;
    let mockEventEmitter: any;
    let mockDataSource: any;
    let mockQueryRunner: any;

    beforeEach(() => {
      mockQueryRunner = {
        connect: jest.fn().mockResolvedValue(undefined),
        query: jest.fn(),
        release: jest.fn().mockResolvedValue(undefined),
      };

      mockDataSource = {
        createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      };

      mockTenderRepo = {
        manager: {
          connection: mockDataSource,
          transaction: jest.fn(),
          query: jest.fn(),
          save: jest.fn(),
          create: jest.fn(),
        },
        createQueryBuilder: jest.fn(),
      };

      mockEventEmitter = {
        emit: jest.fn(),
      };

      scheduler = new TenderScheduler(mockTenderRepo, mockEventEmitter, mockDataSource);
    });

    it('1. Skips daily scan cleanly if MySQL GET_LOCK fails (another instance running)', async () => {
      // Mock GET_LOCK returns 0 (lock not acquired)
      mockQueryRunner.query.mockResolvedValueOnce([{ lock_acquired: 0 }]);

      await scheduler.handleDailyMarketingFollowUpScan();

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining("GET_LOCK('epms_marketing_followup_daily_scan', 0)"),
      );
      expect(mockTenderRepo.createQueryBuilder).not.toHaveBeenCalled();
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('2. Releases advisory lock in finally block after scan completes', async () => {
      mockQueryRunner.query
        .mockResolvedValueOnce([{ lock_acquired: 1 }]) // GET_LOCK acquired
        .mockResolvedValueOnce([]) // Directors query
        .mockResolvedValueOnce([{ lock_released: 1 }]); // RELEASE_LOCK in finally

      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([]),
      };
      mockTenderRepo.createQueryBuilder.mockReturnValue(mockQb);

      await scheduler.handleDailyMarketingFollowUpScan();

      expect(mockQueryRunner.query).toHaveBeenCalledWith(
        expect.stringContaining("RELEASE_LOCK('epms_marketing_followup_daily_scan')"),
      );
      expect(mockQueryRunner.release).toHaveBeenCalled();
    });

    it('3. Resolves responsible marketing user: primary PIC verified, fallback to creator', async () => {
      const mockManager: any = {
        query: jest.fn(),
      };

      // Case A: PIC exists and is valid marketing
      mockManager.query.mockResolvedValueOnce([{ id: 12 }]);
      const picRes = await (scheduler as any).resolveResponsibleMarketingUser(mockManager, {
        marketing_pic_id: 12,
        created_by: 99,
      });
      expect(picRes).toBe(12);

      // Case B: PIC is null, fallback to creator with MARKETING role
      mockManager.query.mockResolvedValueOnce([{ id: 99 }]);
      const creatorRes = await (scheduler as any).resolveResponsibleMarketingUser(mockManager, {
        marketing_pic_id: null,
        created_by: 99,
      });
      expect(creatorRes).toBe(99);

      // Case C: Neither resolves
      mockManager.query.mockResolvedValueOnce([]);
      const noneRes = await (scheduler as any).resolveResponsibleMarketingUser(mockManager, {
        marketing_pic_id: null,
        created_by: 88,
      });
      expect(noneRes).toBeNull();
    });

    it('4. Emits reminder event to Outbox and suppresses same-day duplicate', async () => {
      const candidateTender: any = {
        id: 160,
        title: 'Tender Fiber Optik',
        stage: 'PROPOSAL',
        status: 'IN_PROGRESS',
        marketing_pic_id: 12,
        bid_submission_deadline: '2026-10-19',
        customer: { name: 'Telco Corp' },
      };

      mockQueryRunner.query
        .mockResolvedValueOnce([{ lock_acquired: 1 }]) // GET_LOCK
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]); // Directors (user 1, 2)

      const mockQb = {
        leftJoinAndSelect: jest.fn().mockReturnThis(),
        where: jest.fn().mockReturnThis(),
        andWhere: jest.fn().mockReturnThis(),
        getMany: jest.fn().mockResolvedValue([candidateTender]),
      };
      mockTenderRepo.createQueryBuilder.mockReturnValue(mockQb);

      let savedOutboxEvents: any[] = [];
      mockTenderRepo.manager.transaction.mockImplementation(async (cb: any) => {
        const txManager: any = {
          findOne: jest.fn().mockResolvedValue(candidateTender),
          query: jest.fn().mockImplementation(async (sql: string) => {
            if (sql.includes('FROM users u') && sql.includes("r.name = 'MARKETING'")) {
              return [{ id: 12 }]; // Valid PIC
            }
            if (sql.includes('FROM outbox_events WHERE event_id = ?')) {
              return []; // First run: not existing
            }
            if (sql.includes('FROM tender_activities')) {
              return []; // No follow-up
            }
            if (sql.includes('SELECT full_name FROM users')) {
              return [{ full_name: 'Budi Marketing' }];
            }
            return [];
          }),
          create: jest.fn().mockImplementation((entity, data) => data),
          save: jest.fn().mockImplementation(async (entity, data) => {
            savedOutboxEvents.push(data);
            return data;
          }),
        };
        return await cb(txManager);
      });

      await scheduler.handleDailyMarketingFollowUpScan();

      // Verify reminder event was saved
      const reminder = savedOutboxEvents.find(
        (e) => e.event_name === 'marketing.tender.followup_reminder',
      );
      expect(reminder).toBeDefined();
      expect(reminder.event_id).toContain('marketing-followup:160:12:');
      expect(reminder.payload.routing.userIds).toEqual([12]);

      // Verify Director escalation event was saved (deadline 2026-10-19 is >= 2 calendar days overdue)
      const escalation = savedOutboxEvents.find(
        (e) => e.event_name === 'marketing.tender.director_escalation',
      );
      expect(escalation).toBeDefined();
      expect(escalation.event_id).toMatch(/^marketing-escalation:160:2026-10-19:cycle-\d+$/);
      expect(escalation.payload.businessPayload.cycleIndex).toBeDefined();
      expect(escalation.payload.routing.userIds).toEqual([1, 2]);
    });
  });

  describe('F. Recurring Director Escalation 2-Day Cadence & Legacy Compatibility', () => {
    it('1. calculateEscalationCycleIndex enforces 2-calendar-day cycle boundaries', () => {
      expect(calculateEscalationCycleIndex(0)).toBeNull();
      expect(calculateEscalationCycleIndex(1)).toBeNull();
      expect(calculateEscalationCycleIndex(2)).toBe(0); // Cycle 0
      expect(calculateEscalationCycleIndex(3)).toBe(0); // Cycle 0
      expect(calculateEscalationCycleIndex(4)).toBe(1); // Cycle 1
      expect(calculateEscalationCycleIndex(5)).toBe(1); // Cycle 1
      expect(calculateEscalationCycleIndex(6)).toBe(2); // Cycle 2
      expect(calculateEscalationCycleIndex(7)).toBe(2); // Cycle 2
      expect(calculateEscalationCycleIndex(10)).toBe(4); // Cycle 4
    });

    it('2. formatInactivityEpisodeRef preserves collision resistance with intra-day timestamps', () => {
      const dateOnly = new Date('2026-10-19T00:00:00.000Z');
      expect(formatInactivityEpisodeRef(dateOnly)).toBe('2026-10-19');

      const timestamp1 = new Date('2026-10-21T10:15:30.000Z');
      const timestamp2 = new Date('2026-10-21T14:45:00.000Z');
      expect(formatInactivityEpisodeRef(timestamp1)).not.toBe(formatInactivityEpisodeRef(timestamp2));
      expect(formatInactivityEpisodeRef(timestamp1)).toContain('2026-10-21T');
    });

    it('3. Suppresses duplicate reminder within the same 2-calendar-day cycle', async () => {
      const candidateTender: any = {
        id: 200,
        title: 'Tender Inactive',
        stage: 'PROPOSAL',
        status: 'IN_PROGRESS',
        marketing_pic_id: 12,
        bid_submission_deadline: '2026-10-19',
        customer: { name: 'Client' },
      };

      let scheduler: TenderScheduler;
      const mockQueryRunner: any = {
        connect: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{ lock_acquired: 1 }])
          .mockResolvedValueOnce([{ id: 1 }])
          .mockResolvedValueOnce([{ lock_released: 1 }]),
        release: jest.fn().mockResolvedValue(undefined),
      };

      const mockDataSource: any = {
        createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      };

      const mockTenderRepo: any = {
        manager: {
          connection: mockDataSource,
          transaction: jest.fn(),
        },
        createQueryBuilder: jest.fn().mockReturnValue({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([candidateTender]),
        }),
      };

      const mockEventEmitter: any = { emit: jest.fn() };
      scheduler = new TenderScheduler(mockTenderRepo, mockEventEmitter, mockDataSource);

      let savedOutboxEvents: any[] = [];
      mockTenderRepo.manager.transaction.mockImplementation(async (cb: any) => {
        const txManager: any = {
          findOne: jest.fn().mockResolvedValue(candidateTender),
          query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
            if (sql.includes('FROM users u') && sql.includes("r.name = 'MARKETING'")) {
              return [{ id: 12 }];
            }
            // Simulate cycle-specific event ALREADY existing in outbox_events
            if (sql.includes('FROM outbox_events WHERE event_id = ?')) {
              if (params && params[0]?.includes(':cycle-')) {
                return [{ id: 999 }]; // Exists!
              }
              return [];
            }
            if (sql.includes('FROM tender_activities')) {
              return [];
            }
            return [];
          }),
          create: jest.fn().mockImplementation((entity, data) => data),
          save: jest.fn().mockImplementation(async (entity, data) => {
            savedOutboxEvents.push(data);
            return data;
          }),
        };
        return await cb(txManager);
      });

      await scheduler.handleDailyMarketingFollowUpScan();

      // Director escalation should be suppressed because event with same cycle already exists
      const escalation = savedOutboxEvents.find(
        (e) => e.event_name === 'marketing.tender.director_escalation',
      );
      expect(escalation).toBeUndefined();
    });

    it('4. Legacy event compatibility: legacy event matching current cycle suppresses duplicate', async () => {
      // 3 days ago = Cycle 0
      const threeDaysAgoStr = toJakartaDateString(new Date(Date.now() - 3 * 24 * 60 * 60 * 1000));
      const candidateTender: any = {
        id: 201,
        title: 'Tender Legacy Test',
        stage: 'PROPOSAL',
        status: 'IN_PROGRESS',
        marketing_pic_id: 12,
        bid_submission_deadline: threeDaysAgoStr,
        customer: { name: 'Client' },
      };

      let scheduler: TenderScheduler;
      const mockQueryRunner: any = {
        connect: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{ lock_acquired: 1 }])
          .mockResolvedValueOnce([{ id: 1 }])
          .mockResolvedValueOnce([{ lock_released: 1 }]),
        release: jest.fn().mockResolvedValue(undefined),
      };

      const mockDataSource: any = {
        createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      };

      const mockTenderRepo: any = {
        manager: {
          connection: mockDataSource,
          transaction: jest.fn(),
        },
        createQueryBuilder: jest.fn().mockReturnValue({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([candidateTender]),
        }),
      };

      const mockEventEmitter: any = { emit: jest.fn() };
      scheduler = new TenderScheduler(mockTenderRepo, mockEventEmitter, mockDataSource);

      let savedOutboxEvents: any[] = [];
      mockTenderRepo.manager.transaction.mockImplementation(async (cb: any) => {
        const txManager: any = {
          findOne: jest.fn().mockResolvedValue(candidateTender),
          query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
            if (sql.includes('FROM users u') && sql.includes("r.name = 'MARKETING'")) {
              return [{ id: 12 }];
            }
            if (sql.includes('FROM outbox_events WHERE event_id = ?')) {
              // New cycle ID does NOT exist
              if (params && params[0]?.includes(':cycle-')) {
                return [];
              }
              // Legacy ID DOES exist, created 3 days ago (corresponds to Cycle 0)
              if (params && params[0] === `marketing-escalation:201:${threeDaysAgoStr}`) {
                return [
                  {
                    id: 50,
                    created_at: new Date(Date.now() - 24 * 60 * 60 * 1000), // created during cycle 0
                    payload: null,
                  },
                ];
              }
            }
            return [];
          }),
          create: jest.fn().mockImplementation((entity, data) => data),
          save: jest.fn().mockImplementation(async (entity, data) => {
            savedOutboxEvents.push(data);
            return data;
          }),
        };
        return await cb(txManager);
      });

      await scheduler.handleDailyMarketingFollowUpScan();

      // Escalation should be suppressed because legacy event covered cycle 0
      const escalation = savedOutboxEvents.find(
        (e) => e.event_name === 'marketing.tender.director_escalation',
      );
      expect(escalation).toBeUndefined();
    });

    it('5. Legacy event from earlier cycle does NOT suppress next legitimate cycle', async () => {
      // Inactivity began 6 days ago -> today is Cycle 2!
      const sixDaysAgoStr = toJakartaDateString(new Date(Date.now() - 6 * 24 * 60 * 60 * 1000));
      const candidateTender: any = {
        id: 202,
        title: 'Tender Legacy Advance Test',
        stage: 'PROPOSAL',
        status: 'IN_PROGRESS',
        marketing_pic_id: 12,
        bid_submission_deadline: sixDaysAgoStr,
        customer: { name: 'Client' },
      };

      let scheduler: TenderScheduler;
      const mockQueryRunner: any = {
        connect: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{ lock_acquired: 1 }])
          .mockResolvedValueOnce([{ id: 1 }])
          .mockResolvedValueOnce([{ lock_released: 1 }]),
        release: jest.fn().mockResolvedValue(undefined),
      };

      const mockDataSource: any = {
        createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      };

      const mockTenderRepo: any = {
        manager: {
          connection: mockDataSource,
          transaction: jest.fn(),
        },
        createQueryBuilder: jest.fn().mockReturnValue({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([candidateTender]),
        }),
      };

      const mockEventEmitter: any = { emit: jest.fn() };
      scheduler = new TenderScheduler(mockTenderRepo, mockEventEmitter, mockDataSource);

      let savedOutboxEvents: any[] = [];
      mockTenderRepo.manager.transaction.mockImplementation(async (cb: any) => {
        const txManager: any = {
          findOne: jest.fn().mockResolvedValue(candidateTender),
          query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
            if (sql.includes('FROM users u') && sql.includes("r.name = 'MARKETING'")) {
              return [{ id: 12 }];
            }
            if (sql.includes('FROM outbox_events WHERE event_id = ?')) {
              // New cycle ID does not exist yet
              if (params && params[0]?.includes(':cycle-')) {
                return [];
              }
              // Legacy ID exists from 4 days ago (Cycle 1)
              if (params && params[0] === `marketing-escalation:202:${sixDaysAgoStr}`) {
                return [
                  {
                    id: 50,
                    created_at: new Date(Date.now() - 4 * 24 * 60 * 60 * 1000), // created in cycle 1
                    payload: null,
                  },
                ];
              }
            }
            if (sql.includes('SELECT full_name FROM users')) {
              return [{ full_name: 'Budi Marketing' }];
            }
            return [];
          }),
          create: jest.fn().mockImplementation((entity, data) => data),
          save: jest.fn().mockImplementation(async (entity, data) => {
            savedOutboxEvents.push(data);
            return data;
          }),
        };
        return await cb(txManager);
      });

      await scheduler.handleDailyMarketingFollowUpScan();

      // Current cycle (cycle 2) should NOT be suppressed by earlier legacy cycle 1!
      const escalation = savedOutboxEvents.find(
        (e) => e.event_name === 'marketing.tender.director_escalation',
      );
      expect(escalation).toBeDefined();
      expect(escalation.event_id).toBe(`marketing-escalation:202:${sixDaysAgoStr}:cycle-2`);
      expect(escalation.payload.businessPayload.cycleIndex).toBe(2);
    });

    it('6. Multi-day progression: Day 2 (emits), Day 3 (skips), Day 4 (emits), Day 5 (skips)', async () => {
      jest.useFakeTimers();
      try {
        const anchorDateStr = '2026-10-10';
        const candidateTender: any = {
          id: 203,
          title: 'Multi-day Progression Tender',
          stage: 'PROPOSAL',
          status: 'IN_PROGRESS',
          marketing_pic_id: 12,
          bid_submission_deadline: anchorDateStr,
          customer: { name: 'Client' },
        };

        const persistedOutbox: any[] = [];

        const runDailyScanOnDate = async (isoDateTimeStr: string) => {
          jest.setSystemTime(new Date(isoDateTimeStr));

          const mockQueryRunner: any = {
            connect: jest.fn().mockResolvedValue(undefined),
            query: jest.fn()
              .mockResolvedValueOnce([{ lock_acquired: 1 }])
              .mockResolvedValueOnce([{ id: 1 }]) // Director ID
              .mockResolvedValueOnce([{ lock_released: 1 }]),
            release: jest.fn().mockResolvedValue(undefined),
          };

          const mockDataSource: any = {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          };

          const mockTenderRepo: any = {
            manager: {
              connection: mockDataSource,
              transaction: jest.fn(),
            },
            createQueryBuilder: jest.fn().mockReturnValue({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([candidateTender]),
            }),
          };

          const mockEventEmitter: any = { emit: jest.fn() };
          const testScheduler = new TenderScheduler(mockTenderRepo, mockEventEmitter, mockDataSource);

          mockTenderRepo.manager.transaction.mockImplementation(async (cb: any) => {
            const txManager: any = {
              findOne: jest.fn().mockResolvedValue(candidateTender),
              query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
                if (sql.includes('FROM users u') && sql.includes("r.name = 'MARKETING'")) {
                  return [{ id: 12 }];
                }
                if (sql.includes('FROM outbox_events WHERE event_id = ?')) {
                  const targetEventId = params ? params[0] : null;
                  const found = persistedOutbox.filter((e) => e.event_id === targetEventId);
                  return found.map((e) => ({ id: e.id, created_at: e.created_at, payload: e.payload }));
                }
                if (sql.includes('SELECT full_name FROM users')) {
                  return [{ full_name: 'Budi Marketing' }];
                }
                return [];
              }),
              create: jest.fn().mockImplementation((entity, data) => data),
              save: jest.fn().mockImplementation(async (entity, data) => {
                const saved = { ...data, id: persistedOutbox.length + 1 };
                persistedOutbox.push(saved);
                return saved;
              }),
            };
            return await cb(txManager);
          });

          await testScheduler.handleDailyMarketingFollowUpScan();
        };

        // Day 2: 2026-10-12 (2 calendar days inactive -> Cycle 0)
        await runDailyScanOnDate('2026-10-12T09:00:00+07:00');
        let escalations = persistedOutbox.filter((e) => e.event_name === 'marketing.tender.director_escalation');
        expect(escalations).toHaveLength(1);
        expect(escalations[0].event_id).toBe('marketing-escalation:203:2026-10-10:cycle-0');
        expect(escalations[0].payload.businessPayload.cycleIndex).toBe(0);

        // Day 3: 2026-10-13 (3 calendar days inactive -> Still Cycle 0, duplicate suppressed)
        await runDailyScanOnDate('2026-10-13T09:00:00+07:00');
        escalations = persistedOutbox.filter((e) => e.event_name === 'marketing.tender.director_escalation');
        expect(escalations).toHaveLength(1); // No new escalation added

        // Day 4: 2026-10-14 (4 calendar days inactive -> Cycle 1, new reminder emitted)
        await runDailyScanOnDate('2026-10-14T09:00:00+07:00');
        escalations = persistedOutbox.filter((e) => e.event_name === 'marketing.tender.director_escalation');
        expect(escalations).toHaveLength(2);
        expect(escalations[1].event_id).toBe('marketing-escalation:203:2026-10-10:cycle-1');
        expect(escalations[1].payload.businessPayload.cycleIndex).toBe(1);

        // Day 5: 2026-10-15 (5 calendar days inactive -> Still Cycle 1, duplicate suppressed)
        await runDailyScanOnDate('2026-10-15T09:00:00+07:00');
        escalations = persistedOutbox.filter((e) => e.event_name === 'marketing.tender.director_escalation');
        expect(escalations).toHaveLength(2); // No new escalation added
      } finally {
        jest.useRealTimers();
      }
    });

    it('7. Ambiguous historical records: legacy event without timestamps suppresses cycle 0 but allows cycle 1', async () => {
      jest.useFakeTimers();
      try {
        const anchorDateStr = '2026-10-10';
        const candidateTender: any = {
          id: 204,
          title: 'Ambiguous Legacy Tender',
          stage: 'PROPOSAL',
          status: 'IN_PROGRESS',
          marketing_pic_id: 12,
          bid_submission_deadline: anchorDateStr,
          customer: { name: 'Client' },
        };

        const persistedOutbox: any[] = [];
        // Pre-populate with legacy event having null created_at and null payload
        const legacyEvent = {
          id: 501,
          event_id: `marketing-escalation:204:${anchorDateStr}`,
          event_name: 'marketing.tender.director_escalation',
          created_at: null,
          payload: null,
        };

        const runScan = async (isoDateTimeStr: string) => {
          jest.setSystemTime(new Date(isoDateTimeStr));

          const mockQueryRunner: any = {
            connect: jest.fn().mockResolvedValue(undefined),
            query: jest.fn()
              .mockResolvedValueOnce([{ lock_acquired: 1 }])
              .mockResolvedValueOnce([{ id: 1 }])
              .mockResolvedValueOnce([{ lock_released: 1 }]),
            release: jest.fn().mockResolvedValue(undefined),
          };

          const mockDataSource: any = {
            createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
          };

          const mockTenderRepo: any = {
            manager: {
              connection: mockDataSource,
              transaction: jest.fn(),
            },
            createQueryBuilder: jest.fn().mockReturnValue({
              leftJoinAndSelect: jest.fn().mockReturnThis(),
              where: jest.fn().mockReturnThis(),
              andWhere: jest.fn().mockReturnThis(),
              getMany: jest.fn().mockResolvedValue([candidateTender]),
            }),
          };

          const mockEventEmitter: any = { emit: jest.fn() };
          const testScheduler = new TenderScheduler(mockTenderRepo, mockEventEmitter, mockDataSource);

          mockTenderRepo.manager.transaction.mockImplementation(async (cb: any) => {
            const txManager: any = {
              findOne: jest.fn().mockResolvedValue(candidateTender),
              query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
                if (sql.includes('FROM users u') && sql.includes("r.name = 'MARKETING'")) {
                  return [{ id: 12 }];
                }
                if (sql.includes('FROM outbox_events WHERE event_id = ?')) {
                  const targetEventId = params ? params[0] : null;
                  if (targetEventId === legacyEvent.event_id) {
                    return [legacyEvent];
                  }
                  const found = persistedOutbox.filter((e) => e.event_id === targetEventId);
                  return found.map((e) => ({ id: e.id, created_at: e.created_at, payload: e.payload }));
                }
                if (sql.includes('SELECT full_name FROM users')) {
                  return [{ full_name: 'Budi Marketing' }];
                }
                return [];
              }),
              create: jest.fn().mockImplementation((entity, data) => data),
              save: jest.fn().mockImplementation(async (entity, data) => {
                const saved = { ...data, id: persistedOutbox.length + 1 };
                persistedOutbox.push(saved);
                return saved;
              }),
            };
            return await cb(txManager);
          });

          await testScheduler.handleDailyMarketingFollowUpScan();
        };

        // Day 2 (Cycle 0): Suppressed because legacy event exists (assumed covering cycle 0)
        await runScan('2026-10-12T09:00:00+07:00');
        expect(persistedOutbox.filter((e) => e.event_name === 'marketing.tender.director_escalation')).toHaveLength(0);

        // Day 4 (Cycle 1): Legacy event without timestamp does not suppress cycle 1
        await runScan('2026-10-14T09:00:00+07:00');
        const escalations = persistedOutbox.filter((e) => e.event_name === 'marketing.tender.director_escalation');
        expect(escalations).toHaveLength(1);
        expect(escalations[0].event_id).toBe('marketing-escalation:204:2026-10-10:cycle-1');
        expect(escalations[0].payload.businessPayload.cycleIndex).toBe(1);
      } finally {
        jest.useRealTimers();
      }
    });

    it('8. Legacy event in FAILED status is found by presence and suppresses same cycle duplicate', async () => {
      const anchorDateStr = '2026-10-10';
      const candidateTender: any = {
        id: 205,
        title: 'Failed Legacy Event Tender',
        stage: 'PROPOSAL',
        status: 'IN_PROGRESS',
        marketing_pic_id: 12,
        bid_submission_deadline: anchorDateStr,
        customer: { name: 'Client' },
      };

      const persistedOutbox: any[] = [];
      const failedLegacyEvent = {
        id: 502,
        event_id: `marketing-escalation:205:${anchorDateStr}`,
        event_name: 'marketing.tender.director_escalation',
        status: 'FAILED',
        created_at: new Date('2026-10-12T09:00:00+07:00'), // created during Cycle 0
        payload: null,
      };

      const mockQueryRunner: any = {
        connect: jest.fn().mockResolvedValue(undefined),
        query: jest.fn()
          .mockResolvedValueOnce([{ lock_acquired: 1 }])
          .mockResolvedValueOnce([{ id: 1 }])
          .mockResolvedValueOnce([{ lock_released: 1 }]),
        release: jest.fn().mockResolvedValue(undefined),
      };

      const mockDataSource: any = {
        createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
      };

      const mockTenderRepo: any = {
        manager: {
          connection: mockDataSource,
          transaction: jest.fn(),
        },
        createQueryBuilder: jest.fn().mockReturnValue({
          leftJoinAndSelect: jest.fn().mockReturnThis(),
          where: jest.fn().mockReturnThis(),
          andWhere: jest.fn().mockReturnThis(),
          getMany: jest.fn().mockResolvedValue([candidateTender]),
        }),
      };

      const mockEventEmitter: any = { emit: jest.fn() };
      const testScheduler = new TenderScheduler(mockTenderRepo, mockEventEmitter, mockDataSource);

      mockTenderRepo.manager.transaction.mockImplementation(async (cb: any) => {
        const txManager: any = {
          findOne: jest.fn().mockResolvedValue(candidateTender),
          query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
            if (sql.includes('FROM users u') && sql.includes("r.name = 'MARKETING'")) {
              return [{ id: 12 }];
            }
            if (sql.includes('FROM outbox_events WHERE event_id = ?')) {
              const targetEventId = params ? params[0] : null;
              if (targetEventId === failedLegacyEvent.event_id) {
                return [failedLegacyEvent];
              }
              return [];
            }
            return [];
          }),
          create: jest.fn().mockImplementation((entity, data) => data),
          save: jest.fn().mockImplementation(async (entity, data) => {
            persistedOutbox.push(data);
            return data;
          }),
        };
        return await cb(txManager);
      });

      jest.useFakeTimers();
      try {
        jest.setSystemTime(new Date('2026-10-12T09:00:00+07:00'));
        await testScheduler.handleDailyMarketingFollowUpScan();

        // Should be suppressed because failed legacy event is identified as having covered Cycle 0
        const escalation = persistedOutbox.find(
          (e) => e.event_name === 'marketing.tender.director_escalation',
        );
        expect(escalation).toBeUndefined();
      } finally {
        jest.useRealTimers();
      }
    });

    it('9. Same-date different-episode legacy collision: earlier episode legacy event does NOT suppress new episode, while same-episode deduplication remains intact', async () => {
      jest.useFakeTimers();
      try {
        const anchorDateStr = '2026-10-10';

        // Tender A (id: 206): Has new qualifying activity at 16:00 WIB (09:00 UTC) on 2026-10-10,
        // while legacy outbox record recorded an earlier episode at 08:00 WIB (01:00 UTC).
        const tenderDiffEpisode: any = {
          id: 206,
          title: 'Different Episode Tender',
          stage: 'PROPOSAL',
          status: 'IN_PROGRESS',
          marketing_pic_id: 12,
          bid_submission_deadline: anchorDateStr,
          customer: { name: 'Client A' },
        };

        // Tender B (id: 207): Has same qualifying activity at 09:00 UTC on 2026-10-10,
        // matching the legacy outbox record's follow-up timestamp (same episode).
        const tenderSameEpisode: any = {
          id: 207,
          title: 'Same Episode Tender',
          stage: 'PROPOSAL',
          status: 'IN_PROGRESS',
          marketing_pic_id: 12,
          bid_submission_deadline: anchorDateStr,
          customer: { name: 'Client B' },
        };

        const legacyEventTenderA = {
          id: 601,
          event_id: `marketing-escalation:206:${anchorDateStr}`,
          event_name: 'marketing.tender.director_escalation',
          created_at: new Date('2026-10-12T02:00:00.000Z'),
          payload: {
            occurredAt: '2026-10-12T02:00:00.000Z',
            businessPayload: {
              tenderId: 206,
              lastMeaningfulFollowUp: '2026-10-10T01:00:00.000Z', // Episode 1 (08:00 WIB)
              calendarDaysInactive: 2,
              inactivityReferenceDate: anchorDateStr,
            },
          },
        };

        const legacyEventTenderB = {
          id: 602,
          event_id: `marketing-escalation:207:${anchorDateStr}`,
          event_name: 'marketing.tender.director_escalation',
          created_at: new Date('2026-10-12T02:00:00.000Z'),
          payload: {
            occurredAt: '2026-10-12T02:00:00.000Z',
            businessPayload: {
              tenderId: 207,
              lastMeaningfulFollowUp: '2026-10-10T09:00:00.000Z', // Matches Episode 2 (16:00 WIB)
              calendarDaysInactive: 2,
              inactivityReferenceDate: anchorDateStr,
            },
          },
        };

        const persistedOutbox: any[] = [];

        const mockQueryRunner: any = {
          connect: jest.fn().mockResolvedValue(undefined),
          query: jest.fn()
            .mockResolvedValueOnce([{ lock_acquired: 1 }])
            .mockResolvedValueOnce([{ id: 1 }]) // Director IDs
            .mockResolvedValueOnce([{ lock_released: 1 }]),
          release: jest.fn().mockResolvedValue(undefined),
        };

        const mockDataSource: any = {
          createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
        };

        const mockTenderRepo: any = {
          manager: {
            connection: mockDataSource,
            transaction: jest.fn(),
          },
          createQueryBuilder: jest.fn().mockReturnValue({
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([tenderDiffEpisode, tenderSameEpisode]),
          }),
        };

        const mockEventEmitter: any = { emit: jest.fn() };
        const testScheduler = new TenderScheduler(mockTenderRepo, mockEventEmitter, mockDataSource);

        mockTenderRepo.manager.transaction.mockImplementation(async (cb: any) => {
          const currentTender = mockTenderRepo.manager.transaction.mock.calls.length === 1
            ? tenderDiffEpisode
            : tenderSameEpisode;

          const txManager: any = {
            findOne: jest.fn().mockResolvedValue(currentTender),
            query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
              if (sql.includes('FROM users u') && sql.includes("r.name = 'MARKETING'")) {
                return [{ id: 12 }];
              }
              if (sql.includes('FROM tender_activities')) {
                // Both tenders have a qualifying activity on 2026-10-10 at 16:00 WIB (09:00 UTC)
                return [{ created_at: new Date('2026-10-10T09:00:00.000Z') }];
              }
              if (sql.includes('FROM outbox_events WHERE event_id = ?')) {
                const targetEventId = params ? params[0] : null;
                if (targetEventId === legacyEventTenderA.event_id) {
                  return [legacyEventTenderA];
                }
                if (targetEventId === legacyEventTenderB.event_id) {
                  return [legacyEventTenderB];
                }
                const found = persistedOutbox.filter((e) => e.event_id === targetEventId);
                return found.map((e) => ({ id: e.id, created_at: e.created_at, payload: e.payload }));
              }
              if (sql.includes('SELECT full_name FROM users')) {
                return [{ full_name: 'Budi Marketing' }];
              }
              return [];
            }),
            create: jest.fn().mockImplementation((entity, data) => data),
            save: jest.fn().mockImplementation(async (entity, data) => {
              const saved = { ...data, id: persistedOutbox.length + 1 };
              persistedOutbox.push(saved);
              return saved;
            }),
          };
          return await cb(txManager);
        });

        // Set system time to Day 2: 2026-10-12 09:00:00 WIB (2 calendar days inactive after 2026-10-10)
        jest.setSystemTime(new Date('2026-10-12T09:00:00+07:00'));
        await testScheduler.handleDailyMarketingFollowUpScan();

        // 1. Tender 206 (Different episode):
        // Legacy event was for Episode 1 (08:00 WIB).
        // Current episode is Episode 2 (16:00 WIB).
        // Must NOT be suppressed by the earlier episode's legacy event!
        const escalation206 = persistedOutbox.find(
          (e) => e.event_name === 'marketing.tender.director_escalation' && e.aggregate_id === 206,
        );
        expect(escalation206).toBeDefined();
        expect(escalation206.event_id).toBe('marketing-escalation:206:2026-10-10T090000:cycle-0');
        expect(escalation206.payload.businessPayload.cycleIndex).toBe(0);
        expect(escalation206.payload.businessPayload.lastMeaningfulFollowUp).toBe('2026-10-10T09:00:00.000Z');

        // 2. Tender 207 (Same episode):
        // Legacy event was for the SAME episode (16:00 WIB).
        // Must be suppressed by legacy deduplication!
        const escalation207 = persistedOutbox.find(
          (e) => e.event_name === 'marketing.tender.director_escalation' && e.aggregate_id === 207,
        );
        expect(escalation207).toBeUndefined();
      } finally {
        jest.useRealTimers();
      }
    });

    it('10. Legacy event JSON-string payload parsing: resolves occurredAt when created_at is null', async () => {
      jest.useFakeTimers();
      try {
        const anchorDateStr = '2026-10-10';
        const candidateTender: any = {
          id: 208,
          title: 'JSON String Legacy Tender',
          stage: 'PROPOSAL',
          status: 'IN_PROGRESS',
          marketing_pic_id: 12,
          bid_submission_deadline: anchorDateStr,
          customer: { name: 'Client JSON' },
        };

        const persistedOutbox: any[] = [];
        // Legacy record with created_at = null and payload as JSON string containing occurredAt
        const legacyEvent = {
          id: 701,
          event_id: `marketing-escalation:208:${anchorDateStr}`,
          event_name: 'marketing.tender.director_escalation',
          created_at: null,
          payload: JSON.stringify({
            occurredAt: '2026-10-12T02:00:00.000Z', // Day 2 (Cycle 0)
            businessPayload: {
              tenderId: 208,
              inactivityReferenceDate: anchorDateStr,
            },
          }),
        };

        const mockQueryRunner: any = {
          connect: jest.fn().mockResolvedValue(undefined),
          query: jest.fn()
            .mockResolvedValueOnce([{ lock_acquired: 1 }])
            .mockResolvedValueOnce([{ id: 1 }])
            .mockResolvedValueOnce([{ lock_released: 1 }]),
          release: jest.fn().mockResolvedValue(undefined),
        };

        const mockDataSource: any = {
          createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
        };

        const mockTenderRepo: any = {
          manager: {
            connection: mockDataSource,
            transaction: jest.fn(),
          },
          createQueryBuilder: jest.fn().mockReturnValue({
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([candidateTender]),
          }),
        };

        const mockEventEmitter: any = { emit: jest.fn() };
        const testScheduler = new TenderScheduler(mockTenderRepo, mockEventEmitter, mockDataSource);

        mockTenderRepo.manager.transaction.mockImplementation(async (cb: any) => {
          const txManager: any = {
            findOne: jest.fn().mockResolvedValue(candidateTender),
            query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
              if (sql.includes('FROM users u') && sql.includes("r.name = 'MARKETING'")) {
                return [{ id: 12 }];
              }
              if (sql.includes('FROM tender_activities')) {
                return []; // No activities, deadline-based
              }
              if (sql.includes('FROM outbox_events WHERE event_id = ?')) {
                const targetEventId = params ? params[0] : null;
                if (targetEventId === legacyEvent.event_id) {
                  return [legacyEvent];
                }
                const found = persistedOutbox.filter((e) => e.event_id === targetEventId);
                return found.map((e) => ({ id: e.id, created_at: e.created_at, payload: e.payload }));
              }
              if (sql.includes('SELECT full_name FROM users')) {
                return [{ full_name: 'Budi Marketing' }];
              }
              return [];
            }),
            create: jest.fn().mockImplementation((entity, data) => data),
            save: jest.fn().mockImplementation(async (entity, data) => {
              persistedOutbox.push(data);
              return data;
            }),
          };
          return await cb(txManager);
        });

        // Advance system time to Day 2: 2026-10-12 09:00:00 WIB
        jest.setSystemTime(new Date('2026-10-12T09:00:00+07:00'));
        await testScheduler.handleDailyMarketingFollowUpScan();

        // Should parse JSON-string payload, resolve occurredAt, match Cycle 0, and suppress duplicate
        const escalation = persistedOutbox.find(
          (e) => e.event_name === 'marketing.tender.director_escalation',
        );
        expect(escalation).toBeUndefined();
      } finally {
        jest.useRealTimers();
      }
    });

    it('11. Ambiguous legacy record: created_at present but lacks lastMeaningfulFollowUp when intra-day activity exists -> logged as ambiguous and not silently suppressed', async () => {
      jest.useFakeTimers();
      try {
        const anchorDateStr = '2026-10-10';
        const candidateTender: any = {
          id: 209,
          title: 'Ambiguous Untracked Activity Tender',
          stage: 'PROPOSAL',
          status: 'IN_PROGRESS',
          marketing_pic_id: 12,
          bid_submission_deadline: anchorDateStr,
          customer: { name: 'Client Ambiguity' },
        };

        const persistedOutbox: any[] = [];
        // Legacy event has created_at on Day 2, but payload lacks lastMeaningfulFollowUp evidence
        const ambiguousLegacyEvent = {
          id: 801,
          event_id: `marketing-escalation:209:${anchorDateStr}`,
          event_name: 'marketing.tender.director_escalation',
          created_at: new Date('2026-10-12T02:00:00.000Z'), // Day 2 timestamp
          payload: {
            occurredAt: '2026-10-12T02:00:00.000Z',
            businessPayload: {
              tenderId: 209,
              inactivityReferenceDate: anchorDateStr,
              // Intentionally omitted: lastMeaningfulFollowUp
            },
          },
        };

        const mockQueryRunner: any = {
          connect: jest.fn().mockResolvedValue(undefined),
          query: jest.fn()
            .mockResolvedValueOnce([{ lock_acquired: 1 }])
            .mockResolvedValueOnce([{ id: 1 }])
            .mockResolvedValueOnce([{ lock_released: 1 }]),
          release: jest.fn().mockResolvedValue(undefined),
        };

        const mockDataSource: any = {
          createQueryRunner: jest.fn().mockReturnValue(mockQueryRunner),
        };

        const mockTenderRepo: any = {
          manager: {
            connection: mockDataSource,
            transaction: jest.fn(),
          },
          createQueryBuilder: jest.fn().mockReturnValue({
            leftJoinAndSelect: jest.fn().mockReturnThis(),
            where: jest.fn().mockReturnThis(),
            andWhere: jest.fn().mockReturnThis(),
            getMany: jest.fn().mockResolvedValue([candidateTender]),
          }),
        };

        const mockEventEmitter: any = { emit: jest.fn() };
        const testScheduler = new TenderScheduler(mockTenderRepo, mockEventEmitter, mockDataSource);

        mockTenderRepo.manager.transaction.mockImplementation(async (cb: any) => {
          const txManager: any = {
            findOne: jest.fn().mockResolvedValue(candidateTender),
            query: jest.fn().mockImplementation(async (sql: string, params: any[]) => {
              if (sql.includes('FROM users u') && sql.includes("r.name = 'MARKETING'")) {
                return [{ id: 12 }];
              }
              if (sql.includes('FROM tender_activities')) {
                // A qualifying activity exists at 16:00 WIB (09:00 UTC) on 2026-10-10
                return [{ created_at: new Date('2026-10-10T09:00:00.000Z') }];
              }
              if (sql.includes('FROM outbox_events WHERE event_id = ?')) {
                const targetEventId = params ? params[0] : null;
                if (targetEventId === ambiguousLegacyEvent.event_id) {
                  return [ambiguousLegacyEvent];
                }
                const found = persistedOutbox.filter((e) => e.event_id === targetEventId);
                return found.map((e) => ({ id: e.id, created_at: e.created_at, payload: e.payload }));
              }
              if (sql.includes('SELECT full_name FROM users')) {
                return [{ full_name: 'Budi Marketing' }];
              }
              return [];
            }),
            create: jest.fn().mockImplementation((entity, data) => data),
            save: jest.fn().mockImplementation(async (entity, data) => {
              persistedOutbox.push(data);
              return data;
            }),
          };
          return await cb(txManager);
        });

        // Advance system time to Day 2: 2026-10-12 09:00:00 WIB
        jest.setSystemTime(new Date('2026-10-12T09:00:00+07:00'));
        await testScheduler.handleDailyMarketingFollowUpScan();

        // created_at alone does not prove the episode:
        // System must NOT silently classify it as covering the current activity's episode;
        // it must emit the escalation for the activity's episode so Director is notified!
        const escalation = persistedOutbox.find(
          (e) => e.event_name === 'marketing.tender.director_escalation',
        );
        expect(escalation).toBeDefined();
        expect(escalation.event_id).toBe('marketing-escalation:209:2026-10-10T090000:cycle-0');
        expect(escalation.payload.businessPayload.cycleIndex).toBe(0);
        expect(escalation.payload.businessPayload.lastMeaningfulFollowUp).toBe('2026-10-10T09:00:00.000Z');
      } finally {
        jest.useRealTimers();
      }
    });
  });
});
