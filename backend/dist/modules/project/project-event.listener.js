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
var ProjectEventListener_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectEventListener = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const project_service_1 = require("./project.service");
let ProjectEventListener = ProjectEventListener_1 = class ProjectEventListener {
    constructor(projectService) {
        this.projectService = projectService;
        this.logger = new common_1.Logger(ProjectEventListener_1.name);
    }
    async handlePaymentProcessed(payload) {
        this.logger.log(`🔥 [ProjectEventListener] Payment Processed Event Received: Invoice ${payload.invoiceId}, Amount: ${payload.paymentAmount}`);
        if (payload.poId) {
            await this.projectService.recalculateWbsBudgetFromPo(payload.poId, payload.paymentAmount);
        }
    }
};
exports.ProjectEventListener = ProjectEventListener;
__decorate([
    (0, event_emitter_1.OnEvent)('finance.payment_processed'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], ProjectEventListener.prototype, "handlePaymentProcessed", null);
exports.ProjectEventListener = ProjectEventListener = ProjectEventListener_1 = __decorate([
    (0, common_1.Injectable)(),
    __metadata("design:paramtypes", [project_service_1.ProjectService])
], ProjectEventListener);
//# sourceMappingURL=project-event.listener.js.map