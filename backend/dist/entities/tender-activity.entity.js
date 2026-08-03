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
exports.TenderActivity = exports.ActivityType = void 0;
const typeorm_1 = require("typeorm");
const tender_entity_1 = require("./tender.entity");
const user_entity_1 = require("./user.entity");
var ActivityType;
(function (ActivityType) {
    ActivityType["SYSTEM"] = "SYSTEM";
    ActivityType["COMMENT"] = "COMMENT";
})(ActivityType || (exports.ActivityType = ActivityType = {}));
let TenderActivity = class TenderActivity {
};
exports.TenderActivity = TenderActivity;
__decorate([
    (0, typeorm_1.PrimaryGeneratedColumn)('increment', { type: 'bigint', unsigned: true }),
    __metadata("design:type", Number)
], TenderActivity.prototype, "id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', unsigned: true }),
    __metadata("design:type", Number)
], TenderActivity.prototype, "tender_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'bigint', unsigned: true, nullable: true }),
    __metadata("design:type", Number)
], TenderActivity.prototype, "user_id", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'enum', enum: ActivityType, default: ActivityType.COMMENT }),
    __metadata("design:type", String)
], TenderActivity.prototype, "type", void 0);
__decorate([
    (0, typeorm_1.Column)({ type: 'text' }),
    __metadata("design:type", String)
], TenderActivity.prototype, "content", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => tender_entity_1.Tender),
    (0, typeorm_1.JoinColumn)({ name: 'tender_id' }),
    __metadata("design:type", tender_entity_1.Tender)
], TenderActivity.prototype, "tender", void 0);
__decorate([
    (0, typeorm_1.ManyToOne)(() => user_entity_1.User),
    (0, typeorm_1.JoinColumn)({ name: 'user_id' }),
    __metadata("design:type", user_entity_1.User)
], TenderActivity.prototype, "user", void 0);
__decorate([
    (0, typeorm_1.CreateDateColumn)(),
    __metadata("design:type", Date)
], TenderActivity.prototype, "created_at", void 0);
exports.TenderActivity = TenderActivity = __decorate([
    (0, typeorm_1.Entity)('tender_activities')
], TenderActivity);
//# sourceMappingURL=tender-activity.entity.js.map