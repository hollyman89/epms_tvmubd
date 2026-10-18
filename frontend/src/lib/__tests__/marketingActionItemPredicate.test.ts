import {
  evaluateMarketingActionItem,
  MarketingActionConditionType,
} from '../marketingActionItemPredicate';

describe('marketingActionItemPredicate (Frontend SSOT Alignment)', () => {
  const fixedNow = new Date('2026-10-05T12:00:00.000Z');

  it('excludes WON and LOST tenders', () => {
    expect(
      evaluateMarketingActionItem(
        { stage: 'WON', status: 'WON', bid_submission_deadline: '2026-09-01' },
        fixedNow
      ).isActionItem
    ).toBe(false);

    expect(
      evaluateMarketingActionItem(
        { stage: 'LOST', status: 'LOST', bid_submission_deadline: '2026-09-01' },
        fixedNow
      ).isActionItem
    ).toBe(false);
  });

  it('detects OVERDUE tenders', () => {
    const res = evaluateMarketingActionItem(
      { stage: 'LEAD', bid_submission_deadline: '2026-09-20' },
      fixedNow
    );
    expect(res.isActionItem).toBe(true);
    expect(res.conditionType).toBe(MarketingActionConditionType.OVERDUE);
    expect(res.daysOverdue).toBe(15);
  });

  it('detects UPCOMING_DEADLINE tenders within 14 days for proposal/qualification/negotiation', () => {
    const res = evaluateMarketingActionItem(
      { stage: 'PROPOSAL', bid_submission_deadline: '2026-10-12' },
      fixedNow
    );
    expect(res.isActionItem).toBe(true);
    expect(res.conditionType).toBe(MarketingActionConditionType.UPCOMING_DEADLINE);
    expect(res.daysRemaining).toBe(7);
  });

  it('ignores upcoming deadlines for other stages such as LEAD (> 0 days)', () => {
    const res = evaluateMarketingActionItem(
      { stage: 'LEAD', bid_submission_deadline: '2026-10-12', probability_percentage: 10 },
      fixedNow
    );
    expect(res.isActionItem).toBe(false);
  });

  it('detects STUCK opportunity when probability = 0% and age > 7 days', () => {
    const created10DaysAgo = new Date('2026-09-25T12:00:00.000Z');
    const res = evaluateMarketingActionItem(
      { stage: 'LEAD', probability_percentage: 0, created_at: created10DaysAgo },
      fixedNow
    );
    expect(res.isActionItem).toBe(true);
    expect(res.conditionType).toBe(MarketingActionConditionType.STUCK);
    expect(res.stuckDays).toBe(10);
  });
});
