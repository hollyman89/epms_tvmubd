import { Repository, DataSource } from 'typeorm';
import { Tender } from '../../entities/tender.entity';
import { GetAnalyticsQueryDto, DashboardPeriod } from './dto/get-analytics.dto';
export declare class AnalyticsService {
    private tenderRepository;
    private dataSource;
    constructor(tenderRepository: Repository<Tender>, dataSource: DataSource);
    getDashboardAnalytics(query: GetAnalyticsQueryDto, userId?: number, roles?: string[]): Promise<{
        period: DashboardPeriod;
        kpi: {
            totalPipeline: number;
            winRate: number;
            avgDealSize: number;
            totalDeals: number;
            momGrowth: number;
        };
        trendLine: any[];
        sectorDistribution: any;
        funnel: {
            stage: string;
            count: number;
        }[];
        insights: {
            topInsight: string;
            warningInsight: string;
        };
    }>;
    private calculateDateRange;
    private getKpi;
    private getSectorDistribution;
    private getFunnel;
    private getTrendLine;
    private generateInsights;
}
