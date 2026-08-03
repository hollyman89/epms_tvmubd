export interface DashboardAnalyticsResponse {
  period: string; // e.g., 'YEAR_TO_DATE', 'LAST_MONTH'
  kpi: {
    totalPipeline: number;
    winRate: number; // e.g., 0.15 for 15%
    avgDealSize: number;
    totalDeals: number;
    momGrowth: number; // e.g., -0.05 for 5% decrease
  };
  trendLine: Array<{ month: string; value: number }>;
  sectorDistribution: Array<{ sector: string; value: number; percentage: number }>;
  funnel: Array<{ stage: string; count: number }>;
  insights: {
    topInsight: string;
    warningInsight: string;
  };
}
