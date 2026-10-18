export enum MarketingActionConditionType {
  OVERDUE = 'OVERDUE',
  UPCOMING_DEADLINE = 'UPCOMING_DEADLINE',
  STUCK = 'STUCK',
}

export interface MarketingActionItemEvaluation {
  isActionItem: boolean;
  conditionType: MarketingActionConditionType | null;
  daysOverdue?: number;
  daysRemaining?: number;
  stuckDays?: number;
  reason?: string;
}

export interface TenderActionItemInput {
  stage?: string | null;
  status?: string | null;
  bid_submission_deadline?: Date | string | null;
  probability_percentage?: number | null;
  created_at?: Date | string | null;
  createdAt?: Date | string | null;
}

/**
 * Frontend Canonical Marketing Action Item Predicate (Aligned with Backend SSOT)
 */
export function evaluateMarketingActionItem(
  tender: TenderActionItemInput,
  now: Date = new Date(),
): MarketingActionItemEvaluation {
  const stage = (tender.stage || '').toUpperCase();
  const status = (tender.status || '').toUpperCase();

  // 1. Strict Exclusion: WON and LOST stages/statuses
  if (status === 'WON' || status === 'LOST' || stage === 'WON' || stage === 'LOST') {
    return { isActionItem: false, conditionType: null };
  }

  const today = new Date(now);
  today.setHours(0, 0, 0, 0);

  // 2. Condition A: OVERDUE (Deadline strictly before today 00:00:00)
  if (tender.bid_submission_deadline) {
    const deadline = new Date(tender.bid_submission_deadline);
    const deadlineDay = new Date(deadline);
    deadlineDay.setHours(0, 0, 0, 0);

    if (deadlineDay < today) {
      const daysOverdue = Math.floor((today.getTime() - deadlineDay.getTime()) / (1000 * 60 * 60 * 24));
      return {
        isActionItem: true,
        conditionType: MarketingActionConditionType.OVERDUE,
        daysOverdue,
        reason: `Batas waktu pengajuan penawaran telah lewat ${daysOverdue} hari.`,
      };
    }
  }

  // 3. Condition B: UPCOMING DEADLINE (Within 14 calendar days, for QUALIFICATION, NEGOTIATION, PROPOSAL)
  const isQualOrNegOrProposal = stage === 'QUALIFICATION' || stage === 'NEGOTIATION' || stage === 'PROPOSAL';
  if (isQualOrNegOrProposal && tender.bid_submission_deadline) {
    const deadline = new Date(tender.bid_submission_deadline);
    const diffTime = deadline.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays <= 14 && diffDays >= 0) {
      return {
        isActionItem: true,
        conditionType: MarketingActionConditionType.UPCOMING_DEADLINE,
        daysRemaining: diffDays,
        reason: diffDays === 0
          ? 'Batas waktu pengajuan penawaran jatuh tempo HARI INI.'
          : `Batas waktu pengajuan penawaran tersisa ${diffDays} hari.`,
      };
    }
  }

  // 4. Condition C: STUCK OPPORTUNITY (0% probability and age > 7 days)
  const prob = tender.probability_percentage !== null && tender.probability_percentage !== undefined
    ? Number(tender.probability_percentage)
    : null;

  if (prob === 0) {
    const rawDate = tender.created_at || tender.createdAt;
    const created = rawDate ? new Date(rawDate) : now;
    const diffTime = now.getTime() - created.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays > 7) {
      return {
        isActionItem: true,
        conditionType: MarketingActionConditionType.STUCK,
        stuckDays: diffDays,
        reason: `Peluang dengan probabilitas 0% belum mengalami kemajuan selama ${diffDays} hari.`,
      };
    }
  }

  return { isActionItem: false, conditionType: null };
}
