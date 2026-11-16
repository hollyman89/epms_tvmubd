export interface DashboardAnalyticsResponse {
  period: string; // e.g., 'YEAR_TO_DATE', 'LAST_MONTH'
  kpi: {
    totalPipeline: number;
    winRate: number | null; // e.g., 0.15 for 15%, null if no decided outcomes
    winRateStatus?: 'AVAILABLE' | 'UNAVAILABLE';
    wonCount?: number;
    lostCount?: number;
    openCount?: number;
    openPipelineValue?: number;
    wonValue?: number;
    lostValue?: number;
    closedValueWinRate?: number | null;
    overallConversionYield?: number;
    avgDealSize: number;
    totalDeals: number;
    momGrowth: number | null; // e.g., -0.05 for 5% decrease, null if no baseline
    growthStatus?: 'POSITIVE' | 'NEGATIVE' | 'ZERO' | 'NO_PRIOR_BASELINE' | 'NO_ACTIVITY';
    growthPeriodLabel?: string;
    wonDeals?: number;
    lostDeals?: number;
  };
  trendLine: Array<{ month: string; value: number }>;
  sectorDistribution: Array<{ sector: string; value: number; percentage: number }>;
  funnel: Array<{ stage: string; count: number }>;
  insights: {
    topInsight: string;
    warningInsight: string;
  };
}
