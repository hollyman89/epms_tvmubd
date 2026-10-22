import { MarketingActionConditionType } from './marketing-action-item.predicate';

/**
 * Returns YYYY-MM-DD representation in Asia/Jakarta timezone.
 */
export function toJakartaDateString(dateInput: Date | string = new Date()): string {
  const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(date);
}

/**
 * Calculates calendar day difference between two dates in Asia/Jakarta timezone.
 * Returns: currentDate - referenceDate in integer calendar days.
 * Example: 2026-10-21 minus 2026-10-19 = 2.
 */
export function diffInJakartaCalendarDays(
  currentDateInput: Date | string,
  referenceDateInput: Date | string,
): number {
  const currentStr = toJakartaDateString(currentDateInput);
  const refStr = toJakartaDateString(referenceDateInput);
  const [cy, cm, cd] = currentStr.split('-').map(Number);
  const [ry, rm, rd] = refStr.split('-').map(Number);
  const currentUtc = Date.UTC(cy, cm - 1, cd);
  const refUtc = Date.UTC(ry, rm - 1, rd);
  return Math.floor((currentUtc - refUtc) / (24 * 60 * 60 * 1000));
}

/**
 * Adds or subtracts calendar days in Asia/Jakarta timezone and returns YYYY-MM-DD string.
 */
export function addJakartaCalendarDays(dateInput: Date | string, days: number): string {
  const str = toJakartaDateString(dateInput);
  const [y, m, d] = str.split('-').map(Number);
  const utc = Date.UTC(y, m - 1, d) + days * 24 * 60 * 60 * 1000;
  const newDate = new Date(utc);
  return newDate.toISOString().slice(0, 10);
}

/**
 * Validates whether an activity content matches the whitelisted canonical meaningful marketing follow-up actions.
 */
export function isMeaningfulMarketingActivity(
  content: string,
  actorUserId: number | null | undefined,
  responsibleUserId: number,
): boolean {
  if (!actorUserId || actorUserId !== responsibleUserId) {
    return false;
  }
  if (!content || typeof content !== 'string') {
    return false;
  }

  // 1. Stage progression (SYSTEM: Tender stage changed from % to %)
  if (content.startsWith('Tender stage changed from ')) {
    return true;
  }

  // 2. Go/No-Go submission / resubmission
  if (
    content.startsWith('Marketing submitted tender for GO / NO GO review') ||
    content.startsWith('Marketing resubmitted tender for GO / NO GO review')
  ) {
    return true;
  }

  // 3. SPK / Revision SPK upload
  if (
    (content.startsWith('Dokumen SPK (') || content.startsWith('Dokumen revisi SPK (')) &&
    content.includes('berhasil diunggah')
  ) {
    return true;
  }

  return false;
}

export interface InactivityReferenceParams {
  conditionType: MarketingActionConditionType;
  bidSubmissionDeadline?: Date | string | null;
  createdAt?: Date | string | null;
  latestMeaningfulFollowUpDate?: Date | null;
  stageEntryDate?: Date | null;
  probabilityZeroProvableDate?: Date | null;
}

/**
 * Calculates the canonical inactivity reference date based on reason and meaningful history.
 * Invariant: Returns null if reference cannot be proven from canonical history.
 */
export function calculateInactivityReferenceDate(
  params: InactivityReferenceParams,
): Date | null {
  // If subsequent meaningful follow-up exists, it becomes the authoritative reference
  if (params.latestMeaningfulFollowUpDate) {
    return new Date(params.latestMeaningfulFollowUpDate);
  }

  switch (params.conditionType) {
    case MarketingActionConditionType.OVERDUE:
      if (!params.bidSubmissionDeadline) return null;
      return new Date(params.bidSubmissionDeadline);

    case MarketingActionConditionType.UPCOMING_DEADLINE: {
      if (!params.bidSubmissionDeadline) return null;
      const upcomingThresholdStr = addJakartaCalendarDays(params.bidSubmissionDeadline, -14);
      if (params.stageEntryDate) {
        const stageEntryStr = toJakartaDateString(params.stageEntryDate);
        const refStr = stageEntryStr > upcomingThresholdStr ? stageEntryStr : upcomingThresholdStr;
        return new Date(refStr);
      }
      // Conservative deterministic fallback: exactly 14 days before deadline
      return new Date(upcomingThresholdStr);
    }

    case MarketingActionConditionType.STUCK:
      // Per Section 7: If probability-zero transition timestamp cannot be proven,
      // return null so Director escalation is NOT sent based on an invented historical date.
      if (!params.probabilityZeroProvableDate) {
        return null;
      }
      return new Date(addJakartaCalendarDays(params.probabilityZeroProvableDate, 7));

    default:
      return null;
  }
}
