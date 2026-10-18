import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Tender } from '../../entities/tender.entity';
import { GetAnalyticsQueryDto, DashboardPeriod } from './dto/get-analytics.dto';

@Injectable()
export class AnalyticsService {
  constructor(
    @InjectRepository(Tender)
    private tenderRepository: Repository<Tender>,
    private dataSource: DataSource,
  ) {}

  async getDashboardAnalytics(query: GetAnalyticsQueryDto, userId?: number, roles?: string[]) {
    const { period, startDate, endDate } = query;
    const { start, end, prevStart, prevEnd } = this.calculateDateRange(period, startDate, endDate);

    const isManagement = roles ? roles.some(r => ['SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER'].includes(r)) : true;

    // Run all 5 queries in parallel using Promise.all
    const [kpiData, prevKpiData, sectorData, funnelData, trendData] = await Promise.all([
      this.getKpi(start, end, userId, isManagement),
      this.getKpi(prevStart, prevEnd, userId, isManagement),
      this.getSectorDistribution(start, end, userId, isManagement),
      this.getFunnel(start, end, userId, isManagement),
      this.getTrendLine(end, userId, isManagement), // Trendline always uses 'end' as the reference point for the 12 months
    ]);

    // Calculate MoM Growth
    const prevTotal = Number(prevKpiData.totalPipeline);
    const currTotal = Number(kpiData.totalPipeline);
    let momGrowth = 0;
    if (prevTotal === 0 && currTotal > 0) {
      momGrowth = 1; // 100% growth
    } else if (prevTotal > 0) {
      momGrowth = (currTotal - prevTotal) / prevTotal;
    }

    // Generate NLG Insights
    const insights = this.generateInsights(Number(kpiData.totalDeals), momGrowth);

    return {
      period,
      kpi: {
        totalPipeline: Number(kpiData.totalPipeline),
        winRate: Number(kpiData.winRate),
        avgDealSize: Number(kpiData.avgDealSize),
        totalDeals: Number(kpiData.totalDeals),
        momGrowth: momGrowth,
      },
      trendLine: trendData,
      sectorDistribution: sectorData,
      funnel: funnelData,
      insights,
    };
  }

  public calculateDateRange(period: DashboardPeriod, startDate?: string, endDate?: string) {
    const now = new Date();
    let start = new Date();
    let end = new Date();
    let prevStart = new Date();
    let prevEnd = new Date();

    if (period === DashboardPeriod.CUSTOM && startDate && endDate) {
      start = new Date(startDate);
      end = new Date(endDate);
      const diffTime = Math.abs(end.getTime() - start.getTime());
      prevEnd = new Date(start.getTime() - 1);
      prevStart = new Date(prevEnd.getTime() - diffTime);
      return { start, end, prevStart, prevEnd };
    }

    start.setHours(0, 0, 0, 0);
    end.setHours(23, 59, 59, 999);
    prevStart.setHours(0, 0, 0, 0);
    prevEnd.setHours(23, 59, 59, 999);

    if (period === DashboardPeriod.THIS_MONTH) {
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
    } else if (period === DashboardPeriod.LAST_MONTH) {
      start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
      prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
      prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
    } else if (period === DashboardPeriod.THIS_QUARTER) {
      const quarter = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), quarter * 3, 1);
      prevStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
      prevEnd = new Date(now.getFullYear(), quarter * 3, 0);
    } else if (period === DashboardPeriod.LAST_QUARTER) {
      const quarter = Math.floor(now.getMonth() / 3) - 1;
      start = new Date(now.getFullYear(), quarter * 3, 1);
      end = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
      prevStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
      prevEnd = new Date(now.getFullYear(), quarter * 3, 0, 23, 59, 59, 999);
    } else {
      // YEAR_TO_DATE (Default)
      start = new Date(now.getFullYear(), 0, 1);
      prevStart = new Date(now.getFullYear() - 1, 0, 1);
      prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
    }

    return { start, end, prevStart, prevEnd };
  }

  private async getKpi(start: Date, end: Date, userId?: number, isManagement?: boolean) {
    let userFilter = '';
    const params: any[] = [start, end];
    if (userId && !isManagement) {
      userFilter = 'AND (marketing_pic_id = ? OR (marketing_pic_id IS NULL AND created_by = ?))';
      params.push(userId, userId);
    }

    // Amendment 1: COALESCE ganda to guarantee 0 instead of null
    const result = await this.tenderRepository.query(`
      SELECT 
        COALESCE(SUM(COALESCE(negotiated_price, estimated_budget)), 0) as totalPipeline,
        COALESCE((COUNT(CASE WHEN status = 'WON' THEN 1 END) * 1.0 / NULLIF(COUNT(id), 0)), 0) as winRate,
        COALESCE(AVG(CASE WHEN status = 'WON' THEN negotiated_price END), 0) as avgDealSize,
        COUNT(id) as totalDeals
      FROM tenders
      WHERE created_at BETWEEN ? AND ? AND deleted_at IS NULL ${userFilter}
    `, params);

    return result[0];
  }

  private async getSectorDistribution(start: Date, end: Date, userId?: number, isManagement?: boolean) {
    let userFilter = '';
    const params: any[] = [start, end];
    if (userId && !isManagement) {
      userFilter = 'AND (marketing_pic_id = ? OR (marketing_pic_id IS NULL AND created_by = ?))';
      params.push(userId, userId);
    }

    const result = await this.tenderRepository.query(`
      SELECT 
        COALESCE(business_sector, 'Lainnya') as sector, 
        SUM(COALESCE(negotiated_price, estimated_budget)) as value
      FROM tenders
      WHERE created_at BETWEEN ? AND ? AND deleted_at IS NULL ${userFilter}
      GROUP BY COALESCE(business_sector, 'Lainnya')
      HAVING SUM(COALESCE(negotiated_price, estimated_budget)) > 0
      ORDER BY value DESC
    `, params);

    const total = result.reduce((acc, curr) => acc + Number(curr.value), 0);
    return result
      .map(item => ({
        sector: item.sector,
        value: Number(item.value),
        percentage: total > 0 ? Math.round((Number(item.value) / total) * 100) : 0,
      }))
      .filter(item => item.value > 0);
  }

  private async getFunnel(start: Date, end: Date, userId?: number, isManagement?: boolean) {
    let userFilter = '';
    const params: any[] = [start, end];
    if (userId && !isManagement) {
      userFilter = 'AND (marketing_pic_id = ? OR (marketing_pic_id IS NULL AND created_by = ?))';
      params.push(userId, userId);
    }

    const result = await this.tenderRepository.query(`
      SELECT 
        stage, 
        COUNT(id) as count
      FROM tenders
      WHERE created_at BETWEEN ? AND ? AND deleted_at IS NULL ${userFilter}
      GROUP BY stage
    `, params);

    // Map stage values (including WON/LOST as they passed through all earlier stages)
    const stageMap = new Map<string, number>(result.map((r: any) => [String(r.stage || '').toUpperCase(), Number(r.count)]));
    
    // Cumulative funnel: each stage count includes all tenders that reached that stage or beyond
    const wonCount: number = stageMap.get('WON') ?? 0;
    const lostCount: number = stageMap.get('LOST') ?? 0;
    const negCount: number = (stageMap.get('NEGOTIATION') ?? 0) + (stageMap.get('PENDING_APPROVAL') ?? 0) + wonCount + lostCount;
    const propCount: number = (stageMap.get('PROPOSAL') ?? 0) + negCount;
    const qualCount: number = (stageMap.get('QUALIFICATION') ?? 0) + propCount;
    const waitingGoNoGoCount: number = (stageMap.get('WAITING_GO_NO_GO') ?? 0) + qualCount;
    const leadCount: number = (stageMap.get('LEAD') ?? 0) + waitingGoNoGoCount;

    return [
      { stage: 'LEAD', count: leadCount },
      { stage: 'WAITING_GO_NO_GO', count: waitingGoNoGoCount },
      { stage: 'QUALIFICATION', count: qualCount },
      { stage: 'PROPOSAL', count: propCount },
      { stage: 'NEGOTIATION', count: negCount },
      { stage: 'WON', count: wonCount },
    ];
  }


  private async getTrendLine(referenceDate: Date, userId?: number, isManagement?: boolean) {
    // Get data for the last 12 months up to the reference date
    const startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 11, 1);
    
    let userFilter = '';
    const params: any[] = [startDate, referenceDate];
    if (userId && !isManagement) {
      userFilter = 'AND (marketing_pic_id = ? OR (marketing_pic_id IS NULL AND created_by = ?))';
      params.push(userId, userId);
    }

    const result = await this.tenderRepository.query(`
      SELECT 
        YEAR(created_at) as year, 
        MONTH(created_at) as month, 
        SUM(COALESCE(negotiated_price, estimated_budget)) as value
      FROM tenders
      WHERE created_at BETWEEN ? AND ? AND deleted_at IS NULL ${userFilter}
      GROUP BY YEAR(created_at), MONTH(created_at)
    `, params);

    const dataMap = new Map();
    result.forEach(r => {
      dataMap.set(`${r.year}-${r.month}`, Number(r.value));
    });

    // Amendment 3: Force 12 absolute elements, padded with 0
    const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    const trendLine = [];
    
    for (let i = 11; i >= 0; i--) {
      const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
      const year = d.getFullYear();
      const month = d.getMonth() + 1; // 1-12
      const value = dataMap.get(`${year}-${month}`) || 0;
      
      trendLine.push({
        month: months[month - 1], // short month name
        value,
      });
    }

    return trendLine;
  }

  private generateInsights(totalDeals: number, momGrowth: number) {
    // Amendment 4: Hard logic based NLG
    if (totalDeals === 0) {
      return {
        topInsight: "Belum ada aktivitas tender untuk periode ini. Fokus pada pengisian pipeline.",
        warningInsight: "Belum ada aktivitas tender untuk periode ini. Fokus pada pengisian pipeline."
      };
    }

    let topInsight = "";
    let warningInsight = "";

    if (momGrowth > 0.10) {
      topInsight = `Pipeline tumbuh fantastis sebesar ${(momGrowth * 100).toFixed(1)}% dibanding periode lalu. Momentum yang sangat baik!`;
    } else if (momGrowth >= 0) {
      topInsight = `Pipeline stabil dengan pertumbuhan ${(momGrowth * 100).toFixed(1)}%. Lanjutkan eksekusi strategi yang ada.`;
    } else {
      topInsight = `Terdapat kontraksi pada pipeline sebesar ${Math.abs(momGrowth * 100).toFixed(1)}%.`;
    }

    if (momGrowth < -0.10) {
      warningInsight = `Pipeline turun signifikan (${Math.abs(momGrowth * 100).toFixed(1)}%) dibanding bulan lalu. Periksa tender yang terhambat di tahap Proposal.`;
    } else {
      warningInsight = `Monitor pergerakan tender di tahap NEGOTIATION untuk mempercepat closing dan meningkatkan Win Rate.`;
    }

    return { topInsight, warningInsight };
  }

  async getMarketingPerformance(query: GetAnalyticsQueryDto) {
    const { period, startDate, endDate } = query;
    const { start, end } = this.calculateDateRange(period, startDate, endDate);

    const rawData = await this.tenderRepository.query(
      `
      SELECT 
        COALESCE(t.marketing_pic_id, t.created_by) AS marketingId,
        COALESCE(u.full_name, 'Unassigned') AS marketingName,
        COUNT(t.id) AS totalTender,
        COALESCE(SUM(COALESCE(t.negotiated_price, t.estimated_budget)), 0) AS pipelineValue,
        COUNT(CASE WHEN t.status = 'WON' THEN 1 END) AS wonTender,
        COALESCE(ROUND((COUNT(CASE WHEN t.status = 'WON' THEN 1 END) * 100.0 / NULLIF(COUNT(t.id), 0)), 1), 0) AS winRate,
        COALESCE(AVG(CASE WHEN t.status = 'WON' THEN t.negotiated_price END), 0) AS averageDealSize
      FROM tenders t
      LEFT JOIN users u ON u.id = COALESCE(t.marketing_pic_id, t.created_by)
      WHERE t.created_at BETWEEN ? AND ? AND t.deleted_at IS NULL
      GROUP BY COALESCE(t.marketing_pic_id, t.created_by), COALESCE(u.full_name, 'Unassigned')
      ORDER BY pipelineValue DESC
      `,
      [start, end],
    );

    return rawData.map((row: any) => ({
      marketingId: row.marketingId ? Number(row.marketingId) : null,
      marketingName: row.marketingName,
      totalTender: Number(row.totalTender || 0),
      pipelineValue: Number(row.pipelineValue || 0),
      wonTender: Number(row.wonTender || 0),
      winRate: Number(row.winRate || 0),
      averageDealSize: Number(row.averageDealSize || 0),
    }));
  }
}
