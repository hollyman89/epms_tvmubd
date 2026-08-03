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
exports.WorkBreakdownStructure = void 0;
const typeorm_1 = require("typeorm");
let WorkBreakdownStructure = class WorkBreakdownStructure {
};
exports.WorkBreakdownStructure = WorkBreakdownStructure;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)(),
    __metadata("design:type", Number)
], WorkBreakdownStructure.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'project_id' }),
    __metadata("design:type", Number)
], WorkBreakdownStructure.prototype, "projectId", void 0);
__decorate([
    (0, typeorm_1.Column)({ name: 'parent_wbs_id', nullable: true }),
    __metadata("design:type", Number)
], WorkBreakdownStructure.prototype, "parentWbsId", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WorkBreakdownStructure.prototype, "code", void 0);
__decorate([
    (0, typeorm_1.Column)(),
    __metadata("design:type", String)
], WorkBreakdownStructure.prototype, "name", void 0);
__decorate([
    (0, typeorm_1.Column)({ default: 1 }),
    __metadata("design:type", Number)
], WorkBreakdownStructure.prototype, "level", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)({ name: 'created_at' }),
    __metadata("design:type", Date)
], WorkBreakdownStructure.prototype, "createdAt", void 0);
__decorate([
    (0, typeorm_1.UpdateDateColumn)({ name: 'updated_at' }),
    __metadata("design:type", Date)
], WorkBreakdownStructure.prototype, "updatedAt", void 0);
__decorate([
    (0, typeorm_1.DeleteDateColumn)({ name: 'deleted_at' }),
    __metadata("design:type", Date)
], WorkBreakdownStructure.prototype, "deletedAt", void 0);
exports.WorkBreakdownStructure = WorkBreakdownStructure = __decorate([
    (0, typeorm_1.Entity)('work_breakdown_structures')
], WorkBreakdownStructure);
//# sourceMappingURL=wbs.entity.js.map