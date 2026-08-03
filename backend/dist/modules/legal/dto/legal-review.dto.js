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
exports.LegalReviewDto = void 0;
const class_validator_1 = require("class-validator");
const swagger_1 = require("@nestjs/swagger");
class LegalReviewDto {
}
exports.LegalReviewDto = LegalReviewDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'ID of the Proposal', required: false }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Number)
], LegalReviewDto.prototype, "proposalId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'ID or Number of the Contract', required: false }),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", Object)
], LegalReviewDto.prototype, "contractId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'APPROVED', enum: ['DRAFT', 'ON_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED'] }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], LegalReviewDto.prototype, "legalStatus", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 'All clauses look good.', required: false }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], LegalReviewDto.prototype, "legalNotes", void 0);
//# sourceMappingURL=legal-review.dto.js.map