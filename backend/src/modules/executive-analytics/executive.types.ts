export const EXECUTIVE_PERIODS = ['YEAR_TO_DATE', 'THIS_MONTH', 'LAST_MONTH', 'THIS_QUARTER', 'LAST_QUARTER'] as const;
export type ExecutivePeriod = typeof EXECUTIVE_PERIODS[number];
export type Availability = 'AVAILABLE' | 'PARTIAL' | 'UNAVAILABLE';
export type FactKind = 'OPPORTUNITY' | 'CONTRACT' | 'PROJECT' | 'VENDOR_PAYMENT' | 'PROJECT_RISK' | 'WORKFLOW_TASK';

/** One source entity at one analytics cut-off. Amounts are never JS floats. */
export interface ExecutiveFact {
  kind: FactKind;
  sourceId: string;
  amount: string | null;
  occurredOn: string | null;
  data: Record<string, any>;
}
export interface KpiTarget {
  metricCode: string;
  startDate: string;
  endDate: string;
  amount: string;
  version: number;
}
export interface PeriodWindow { type: ExecutivePeriod; startDate: string; endDate: string }
export interface TrendPoint { date: string; actual: string | null; target: string | null }
export interface ExecutiveKpi {
  code: string;
  label: string;
  unit: 'IDR' | 'PERCENT';
  basis: 'SNAPSHOT' | 'PERIOD';
  actual: string | null;
  target: string | null;
  targetVersion: number | null;
  variance: string | null;
  attainmentPct: string | null;
  availability: Availability;
  reason: string | null;
  definition: string;
  evidence: string[];
  trend: TrendPoint[];
}
export interface ExecutiveRisk {
  id: string;
  title: string;
  severity: 'HIGH' | 'CRITICAL' | 'MEDIUM';
  exposure: string | null;
  exposureBasis: string;
  owner: string;
  dueOn: string | null;
  reason: string;
  actionTarget: string | null;
  evidence: string[];
}
export interface ExecutiveAction {
  id: string;
  title: string;
  description: string | null;
  actionTarget: string | null;
  dueAt: string | null;
  exposure: string | null;
  ctaLabel: string;
}
export interface ExecutiveOverview {
  meta: {
    schemaVersion: 1; snapshotId: string; asOf: string; generatedAt: string;
    timezone: 'Asia/Jakarta'; scope: 'INSTALLATION'; currency: 'IDR';
    period: PeriodWindow; freshness: 'FRESH' | 'STALE'; availability: Availability;
    sources: Array<{ name: string; availability: Availability; reason: string | null }>;
  };
  kpis: ExecutiveKpi[];
  flow: {
    mode: 'SNAPSHOT'; conversionRate: null; reason: string;
    stages: Array<{ code: string; label: string; value: string | null; availability: Availability; note: string }>;
  };
  risks: { items: ExecutiveRisk[]; evaluatedRules: string[]; unavailableRules: string[]; coverage: 'PARTIAL' };
  sla: { basis: string; overdue: number; withoutDeadline: number; availability: Availability; note: string };
  forecast: { label: string; amount: string | null; nominal: string | null; horizonEnd: string; availability: Availability; method: string; assumptions: string[]; covered: number; excluded: number };
  brief: Array<{ text: string; evidence: string[]; tone: 'NEUTRAL' | 'WARNING' }>;
  actions?: { items: ExecutiveAction[]; availability: Availability; asOf: string | null; note: string };
}

export function jakartaDay(date: Date): string {
  return new Date(date.getTime() + 7 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

export function periodWindow(type: ExecutivePeriod, now: Date): PeriodWindow {
  const today = jakartaDay(now);
  const year = Number(today.slice(0, 4));
  const month = Number(today.slice(5, 7)) - 1;
  const iso = (y: number, m: number, day: number) => new Date(Date.UTC(y, m, day)).toISOString().slice(0, 10);
  let startDate = iso(year, 0, 1);
  let endDate = today;
  if (type === 'THIS_MONTH') startDate = iso(year, month, 1);
  if (type === 'LAST_MONTH') { startDate = iso(year, month - 1, 1); endDate = iso(year, month, 0); }
  if (type === 'THIS_QUARTER') startDate = iso(year, Math.floor(month / 3) * 3, 1);
  if (type === 'LAST_QUARTER') { const q = Math.floor(month / 3) * 3; startDate = iso(year, q - 3, 1); endDate = iso(year, q, 0); }
  return { type, startDate, endDate };
}

/** Only known internal workspaces; malformed/external destinations are never rendered as CTAs. */
export function safeExecutiveTarget(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\/(sales|procurement|project-delivery|governance\/tasks|legal\/review|finance\/(invoices|payments))(\?|$)/.test(value)) return null;
  if (/[\\\r\n]/.test(value)) return null;
  return value;
}
