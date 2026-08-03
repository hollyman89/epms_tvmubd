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
exports.GetAnalyticsQueryDto = exports.DashboardPeriod = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
var DashboardPeriod;
(function (DashboardPeriod) {
    DashboardPeriod["THIS_MONTH"] = "THIS_MONTH";
    DashboardPeriod["LAST_QUARTER"] = "LAST_QUARTER";
    DashboardPeriod["YEAR_TO_DATE"] = "YEAR_TO_DATE";
    DashboardPeriod["LAST_MONTH"] = "LAST_MONTH";
    DashboardPeriod["THIS_QUARTER"] = "THIS_QUARTER";
    DashboardPeriod["CUSTOM"] = "CUSTOM";
})(DashboardPeriod || (exports.DashboardPeriod = DashboardPeriod = {}));
class GetAnalyticsQueryDto {
    constructor() {
        this.period = DashboardPeriod.YEAR_TO_DATE;
    }
}
exports.GetAnalyticsQueryDto = GetAnalyticsQueryDto;
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ enum: DashboardPeriod, default: DashboardPeriod.YEAR_TO_DATE }),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsEnum)(DashboardPeriod),
    __metadata("design:type", String)
], GetAnalyticsQueryDto.prototype, "period", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], GetAnalyticsQueryDto.prototype, "startDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)(),
    (0, class_validator_1.IsOptional)(),
    (0, class_validator_1.IsDateString)(),
    __metadata("design:type", String)
], GetAnalyticsQueryDto.prototype, "endDate", void 0);
//# sourceMappingURL=get-analytics.dto.js.map