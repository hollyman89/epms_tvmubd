import { toJakartaDateString, diffInJakartaCalendarDays } from './tender-followup.helper';

export enum MarketingActionConditionType {
  OVERDUE = "OVERDUE",
  UPCOMING_DEADLINE = "UPCOMING_DEADLINE",
  STUCK = "STUCK",
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
 * Canonical Marketing Action Item Predicate (SSOT)
 * Evaluates whether an active Tender requires immediate operational marketing attention.
 *
 * Invariants:
 * 1. WON and LOST tenders (both stage and status) are strictly EXCLUDED.
 * 2. OVERDUE: bid_submission_deadline is prior to current calendar day in Asia/Jakarta.
 * 3. UPCOMING_DEADLINE: stage in QUALIFICATION, NEGOTIATION, PROPOSAL and deadline within 14 calendar days (0 <= diffDays <= 14).
 * 4. STUCK: probability_percentage is 0% and tender age > 7 calendar days.
 * 5. Deterministic priority ordering: OVERDUE > UPCOMING_DEADLINE > STUCK.
 */
export function evaluateMarketingActionItem(
  tender: TenderActionItemInput,
  now: Date = new Date(),
): MarketingActionItemEvaluation {
  const stage = (tender.stage || "").toUpperCase();
  const status = (tender.status || "").toUpperCase();

  // 1. Strict Exclusion: WON and LOST stages/statuses
  if (
    status === "WON" ||
    status === "LOST" ||
    stage === "WON" ||
    stage === "LOST"
  ) {
    return { isActionItem: false, conditionType: null };
  }

  const todayStr = toJakartaDateString(now);

  // 2. Condition A: OVERDUE (Deadline strictly before today in Asia/Jakarta)
  if (tender.bid_submission_deadline) {
    const deadlineStr = toJakartaDateString(tender.bid_submission_deadline);
    if (deadlineStr < todayStr) {
      const daysOverdue = diffInJakartaCalendarDays(todayStr, deadlineStr);
      return {
        isActionItem: true,
        conditionType: MarketingActionConditionType.OVERDUE,
        daysOverdue,
        reason: `Batas waktu pengajuan penawaran telah lewat ${daysOverdue} hari.`,
      };
    }
  }

  // 3. Condition B: UPCOMING DEADLINE (Within 14 calendar days, for QUALIFICATION, NEGOTIATION, PROPOSAL)
  const isQualOrNegOrProposal =
    stage === "QUALIFICATION" ||
    stage === "NEGOTIATION" ||
    stage === "PROPOSAL";
  if (isQualOrNegOrProposal && tender.bid_submission_deadline) {
    const deadlineStr = toJakartaDateString(tender.bid_submission_deadline);
    const diffDays = diffInJakartaCalendarDays(deadlineStr, todayStr);

    if (diffDays <= 14 && diffDays >= 0) {
      return {
        isActionItem: true,
        conditionType: MarketingActionConditionType.UPCOMING_DEADLINE,
        daysRemaining: diffDays,
        reason:
          diffDays === 0
            ? "Batas waktu pengajuan penawaran jatuh tempo HARI INI."
            : `Batas waktu pengajuan penawaran tersisa ${diffDays} hari.`,
      };
    }
  }

  // 4. Condition C: STUCK OPPORTUNITY (0% probability and age > 7 days)
  const prob =
    tender.probability_percentage !== null &&
    tender.probability_percentage !== undefined
      ? Number(tender.probability_percentage)
      : null;

  if (prob === 0) {
    const rawDate = tender.created_at || tender.createdAt || now;
    const diffDays = diffInJakartaCalendarDays(todayStr, rawDate);

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
