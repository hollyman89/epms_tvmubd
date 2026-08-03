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
exports.CreateGoodsReceiptDto = exports.GoodsReceiptItemDto = void 0;
const class_validator_1 = require("class-validator");
const class_transformer_1 = require("class-transformer");
const swagger_1 = require("@nestjs/swagger");
class GoodsReceiptItemDto {
}
exports.GoodsReceiptItemDto = GoodsReceiptItemDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'ID of the Purchase Order Item' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], GoodsReceiptItemDto.prototype, "poItemId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: 5, description: 'Quantity received' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.Min)(0.01),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], GoodsReceiptItemDto.prototype, "receivedQuantity", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Box slightly damaged', description: 'Remarks for this specific item' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], GoodsReceiptItemDto.prototype, "remarks", void 0);
class CreateGoodsReceiptDto {
}
exports.CreateGoodsReceiptDto = CreateGoodsReceiptDto;
__decorate([
    (0, swagger_1.ApiProperty)({ example: 1, description: 'ID of the Purchase Order' }),
    (0, class_validator_1.IsNumber)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Number)
], CreateGoodsReceiptDto.prototype, "purchaseOrderId", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ example: '2026-07-09T10:00:00Z', description: 'Date of receipt' }),
    (0, class_validator_1.IsDateString)(),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", String)
], CreateGoodsReceiptDto.prototype, "receiptDate", void 0);
__decorate([
    (0, swagger_1.ApiPropertyOptional)({ example: 'Received by warehouse staff A', description: 'General remarks for the receipt' }),
    (0, class_validator_1.IsString)(),
    (0, class_validator_1.IsOptional)(),
    __metadata("design:type", String)
], CreateGoodsReceiptDto.prototype, "remarks", void 0);
__decorate([
    (0, swagger_1.ApiProperty)({ type: [GoodsReceiptItemDto], description: 'List of received items' }),
    (0, class_validator_1.IsArray)(),
    (0, class_validator_1.ValidateNested)({ each: true }),
    (0, class_transformer_1.Type)(() => GoodsReceiptItemDto),
    (0, class_validator_1.IsNotEmpty)(),
    __metadata("design:type", Array)
], CreateGoodsReceiptDto.prototype, "items", void 0);
//# sourceMappingURL=create-gr.dto.js.map