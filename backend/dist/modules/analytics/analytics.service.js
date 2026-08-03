"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
var __metadata = (this && this.__metadata) || function (k, v) {
    if (typeof Reflect === "object" && typeof Reflect.metadata === "function") return Reflect.metadata(k, v);
};
var __param = (this && this.__param) || function (paramIndex, decorator) {
    return function (target, key) { decorator(target, key, paramIndex); }
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.AnalyticsService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const tender_entity_1 = require("../../entities/tender.entity");
const get_analytics_dto_1 = require("./dto/get-analytics.dto");
let AnalyticsService = class AnalyticsService {
    constructor(tenderRepository, dataSource) {
        this.tenderRepository = tenderRepository;
        this.dataSource = dataSource;
    }
    async getDashboardAnalytics(query, userId, roles) {
        const { period, startDate, endDate } = query;
        const { start, end, prevStart, prevEnd } = this.calculateDateRange(period, startDate, endDate);
        const isManagement = roles ? roles.some(r => ['SUPER_ADMIN', 'GENERAL_MANAGER', 'DIRECTOR', 'MANAGER'].includes(r)) : true;
        const [kpiData, prevKpiData, sectorData, funnelData, trendData] = await Promise.all([
            this.getKpi(start, end, userId, isManagement),
            this.getKpi(prevStart, prevEnd, userId, isManagement),
            this.getSectorDistribution(start, end, userId, isManagement),
            this.getFunnel(start, end, userId, isManagement),
            this.getTrendLine(end, userId, isManagement),
        ]);
        const prevTotal = Number(prevKpiData.totalPipeline);
        const currTotal = Number(kpiData.totalPipeline);
        let momGrowth = 0;
        if (prevTotal === 0 && currTotal > 0) {
            momGrowth = 1;
        }
        else if (prevTotal > 0) {
            momGrowth = (currTotal - prevTotal) / prevTotal;
        }
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
    calculateDateRange(period, startDate, endDate) {
        const now = new Date();
        let start = new Date();
        let end = new Date();
        let prevStart = new Date();
        let prevEnd = new Date();
        if (period === get_analytics_dto_1.DashboardPeriod.CUSTOM && startDate && endDate) {
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
        if (period === get_analytics_dto_1.DashboardPeriod.THIS_MONTH) {
            start = new Date(now.getFullYear(), now.getMonth(), 1);
            prevStart = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            prevEnd = new Date(now.getFullYear(), now.getMonth(), 0);
        }
        else if (period === get_analytics_dto_1.DashboardPeriod.LAST_MONTH) {
            start = new Date(now.getFullYear(), now.getMonth() - 1, 1);
            end = new Date(now.getFullYear(), now.getMonth(), 0, 23, 59, 59, 999);
            prevStart = new Date(now.getFullYear(), now.getMonth() - 2, 1);
            prevEnd = new Date(now.getFullYear(), now.getMonth() - 1, 0, 23, 59, 59, 999);
        }
        else if (period === get_analytics_dto_1.DashboardPeriod.THIS_QUARTER) {
            const quarter = Math.floor(now.getMonth() / 3);
            start = new Date(now.getFullYear(), quarter * 3, 1);
            prevStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
            prevEnd = new Date(now.getFullYear(), quarter * 3, 0);
        }
        else if (period === get_analytics_dto_1.DashboardPeriod.LAST_QUARTER) {
            const quarter = Math.floor(now.getMonth() / 3) - 1;
            start = new Date(now.getFullYear(), quarter * 3, 1);
            end = new Date(now.getFullYear(), (quarter + 1) * 3, 0, 23, 59, 59, 999);
            prevStart = new Date(now.getFullYear(), (quarter - 1) * 3, 1);
            prevEnd = new Date(now.getFullYear(), quarter * 3, 0, 23, 59, 59, 999);
        }
        else {
            start = new Date(now.getFullYear(), 0, 1);
            prevStart = new Date(now.getFullYear() - 1, 0, 1);
            prevEnd = new Date(now.getFullYear() - 1, 11, 31, 23, 59, 59, 999);
        }
        return { start, end, prevStart, prevEnd };
    }
    async getKpi(start, end, userId, isManagement) {
        let userFilter = '';
        const params = [start, end];
        if (userId && !isManagement) {
            userFilter = 'AND marketing_pic_id = ?';
            params.push(userId);
        }
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
    async getSectorDistribution(start, end, userId, isManagement) {
        let userFilter = '';
        const params = [start, end];
        if (userId && !isManagement) {
            userFilter = 'AND marketing_pic_id = ?';
            params.push(userId);
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
    async getFunnel(start, end, userId, isManagement) {
        let userFilter = '';
        const params = [start, end];
        if (userId && !isManagement) {
            userFilter = 'AND marketing_pic_id = ?';
            params.push(userId);
        }
        const result = await this.tenderRepository.query(`
      SELECT 
        stage, 
        COUNT(id) as count
      FROM tenders
      WHERE created_at BETWEEN ? AND ? AND deleted_at IS NULL ${userFilter}
      GROUP BY stage
    `, params);
        const stageMap = new Map(result.map((r) => [String(r.stage || '').toUpperCase(), Number(r.count)]));
        const wonCount = stageMap.get('WON') ?? 0;
        const lostCount = stageMap.get('LOST') ?? 0;
        const negCount = (stageMap.get('NEGOTIATION') ?? 0) + (stageMap.get('PENDING_APPROVAL') ?? 0) + wonCount + lostCount;
        const propCount = (stageMap.get('PROPOSAL') ?? 0) + negCount;
        const qualCount = (stageMap.get('QUALIFICATION') ?? 0) + propCount;
        const leadCount = (stageMap.get('LEAD') ?? 0) + qualCount;
        return [
            { stage: 'LEAD', count: leadCount },
            { stage: 'QUALIFICATION', count: qualCount },
            { stage: 'PROPOSAL', count: propCount },
            { stage: 'NEGOTIATION', count: negCount },
            { stage: 'WON', count: wonCount },
        ];
    }
    async getTrendLine(referenceDate, userId, isManagement) {
        const startDate = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - 11, 1);
        let userFilter = '';
        const params = [startDate, referenceDate];
        if (userId && !isManagement) {
            userFilter = 'AND marketing_pic_id = ?';
            params.push(userId);
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
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        const trendLine = [];
        for (let i = 11; i >= 0; i--) {
            const d = new Date(referenceDate.getFullYear(), referenceDate.getMonth() - i, 1);
            const year = d.getFullYear();
            const month = d.getMonth() + 1;
            const value = dataMap.get(`${year}-${month}`) || 0;
            trendLine.push({
                month: months[month - 1],
                value,
            });
        }
        return trendLine;
    }
    generateInsights(totalDeals, momGrowth) {
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
        }
        else if (momGrowth >= 0) {
            topInsight = `Pipeline stabil dengan pertumbuhan ${(momGrowth * 100).toFixed(1)}%. Lanjutkan eksekusi strategi yang ada.`;
        }
        else {
            topInsight = `Terdapat kontraksi pada pipeline sebesar ${Math.abs(momGrowth * 100).toFixed(1)}%.`;
        }
        if (momGrowth < -0.10) {
            warningInsight = `Pipeline turun signifikan (${Math.abs(momGrowth * 100).toFixed(1)}%) dibanding bulan lalu. Periksa tender yang terhambat di tahap Proposal.`;
        }
        else {
            warningInsight = `Monitor pergerakan tender di tahap NEGOTIATION untuk mempercepat closing dan meningkatkan Win Rate.`;
        }
        return { topInsight, warningInsight };
    }
};
exports.AnalyticsService = AnalyticsService;
exports.AnalyticsService = AnalyticsService = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(tender_entity_1.Tender)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.DataSource])
], AnalyticsService);
//# sourceMappingURL=analytics.service.js.map