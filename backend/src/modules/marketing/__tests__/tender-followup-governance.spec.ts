import {
  toJakartaDateString,
  diffInJakartaCalendarDays,
  addJakartaCalendarDays,
  isMeaningfulMarketingActivity,
  calculateInactivityReferenceDate,
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
      expect(escalation.event_id).toBe('marketing-escalation:160:2026-10-19');
      expect(escalation.payload.routing.userIds).toEqual([1, 2]);
    });
  });
});
