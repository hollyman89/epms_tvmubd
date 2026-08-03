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
var DashboardService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const project_entity_1 = require("../../entities/project.entity");
const payment_entity_1 = require("../../entities/payment.entity");
const purchase_order_entity_1 = require("../../entities/purchase-order.entity");
const purchase_request_entity_1 = require("../../entities/purchase-request.entity");
let DashboardService = DashboardService_1 = class DashboardService {
    constructor(projectRepo, paymentRepo, poRepo, prRepo) {
        this.projectRepo = projectRepo;
        this.paymentRepo = paymentRepo;
        this.poRepo = poRepo;
        this.prRepo = prRepo;
        this.logger = new common_1.Logger(DashboardService_1.name);
    }
    async getSummary() {
        this.logger.log('Fetching dashboard summary from DB...');
        const totalProjects = await this.projectRepo.count({
            where: { status: 'ACTIVE' }
        });
        const revenueResult = await this.paymentRepo
            .createQueryBuilder('payment')
            .select('SUM(payment.amount_paid)', 'total')
            .getRawOne();
        const totalRevenue = revenueResult?.total ? parseFloat(revenueResult.total) : 0;
        const totalBudget = 5000000000;
        const poResult = await this.poRepo
            .createQueryBuilder('po')
            .select('SUM(po.total_amount)', 'totalExpense')
            .getRawOne();
        const totalExpense = poResult?.totalExpense ? parseFloat(poResult.totalExpense) : 0;
        let avgProfitMargin = 0;
        if (totalBudget > 0) {
            avgProfitMargin = ((totalBudget - totalExpense) / totalBudget) * 100;
            avgProfitMargin = Math.min(100, Math.max(0, avgProfitMargin));
        }
        else {
            avgProfitMargin = 25.5;
        }
        const pendingPRs = await this.prRepo.count({ where: { status: 'DRAFT' } });
        const pendingPOs = await this.poRepo.count({ where: { status: 'DRAFT' } });
        const pendingApprovals = pendingPRs + pendingPOs;
        const onTimeRate = 92.4;
        return {
            totalProjects,
            totalRevenue,
            avgProfitMargin: parseFloat(avgProfitMargin.toFixed(2)),
            pendingApprovals,
            onTimeRate
        };
    }
    async getProjectTrend() {
        const trend = [];
        const today = new Date();
        for (let i = 30; i >= 0; i -= 3) {
            const d = new Date(today);
            d.setDate(d.getDate() - i);
            const completed = Math.floor(Math.random() * 5) + Math.floor((30 - i) / 2);
            const onHold = Math.floor(Math.random() * 3);
            trend.push({
                date: d.toISOString().split('T')[0],
                type: 'Selesai',
                value: completed
            });
            trend.push({
                date: d.toISOString().split('T')[0],
                type: 'Tertahan',
                value: onHold
            });
        }
        return trend;
    }
    async getProcurementPending() {
        const prs = await this.prRepo.find({
            where: { status: 'DRAFT' },
            order: { createdAt: 'ASC' },
            take: 10
        });
        const pos = await this.poRepo.find({
            where: { status: 'DRAFT' },
            order: { createdAt: 'ASC' },
            take: 10
        });
        const pendingList = [
            ...prs.map(pr => ({
                id: `PR-${pr.id}`,
                type: 'Purchase Request',
                number: pr.prNumber,
                date: pr.createdAt,
                status: 'Menunggu Persetujuan'
            })),
            ...pos.map(po => ({
                id: `PO-${po.id}`,
                type: 'Purchase Order',
                number: po.poNumber,
                date: po.createdAt,
                status: 'Menunggu Persetujuan Manajer'
            }))
        ];
        return pendingList.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime()).slice(0, 5);
    }
};
exports.DashboardService = DashboardService;
exports.DashboardService = DashboardService = DashboardService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(project_entity_1.Project)),
    __param(1, (0, typeorm_1.InjectRepository)(payment_entity_1.Payment)),
    __param(2, (0, typeorm_1.InjectRepository)(purchase_order_entity_1.PurchaseOrder)),
    __param(3, (0, typeorm_1.InjectRepository)(purchase_request_entity_1.PurchaseRequest)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], DashboardService);
//# sourceMappingURL=dashboard.service.js.map