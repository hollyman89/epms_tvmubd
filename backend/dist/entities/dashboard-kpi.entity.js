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
Object.defineProperty(exports, "__esModule", { value: true });
exports.DashboardKpi = void 0;
const typeorm_1 = require("typeorm");
let DashboardKpi = class DashboardKpi {
};
exports.DashboardKpi = DashboardKpi;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment', { type: 'bigint', unsigned: true }),
    __metadata("design:type", Number)
], DashboardKpi.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'kpi_type', type: 'varchar', length: 50 }),
    __metadata("design:type", String)
], DashboardKpi.prototype, "kpiType", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'kpi_value', type: 'decimal', precision: 19, scale: 2 }),
    __metadata("design:type", Number)
], DashboardKpi.prototype, "kpiValue", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'period_date', type: 'date' }),
    __metadata("design:type", Date)
], DashboardKpi.prototype, "periodDate", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'json', nullable: true }),
    __metadata("design:type", Object)
], DashboardKpi.prototype, "metadata", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at', type: 'datetime' }),
    __metadata("design:type", Date)
], DashboardKpi.prototype, "createdAt", void 0);
exports.DashboardKpi = DashboardKpi = __decorate([
    (0, typeorm_1.Entity)('dashboard_kpis'),
    (0, typeorm_1.Index)('idx_kpi_period', ['periodDate'])
], DashboardKpi);
//# sourceMappingURL=dashboard-kpi.entity.js.map