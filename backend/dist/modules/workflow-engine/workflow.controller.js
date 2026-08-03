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
exports.WorkflowController = void 0;
const common_1 = require("@nestjs/common");
const workflow_service_1 = require("./workflow.service");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
const swagger_1 = require("@nestjs/swagger");
let WorkflowController = class WorkflowController {
    constructor(workflowService) {
        this.workflowService = workflowService;
    }
    async getWorkflowVisualizerData(id) {
        const data = await this.workflowService.getWorkflowVisualizerData(id);
        return {
            statusCode: common_1.HttpStatus.OK,
            message: 'BPMN visualizer data retrieved successfully',
            data,
        };
    }
    async rollbackWorkflow(id, targetNodeId, reason, req) {
        const userId = req.user?.sub || req.user?.userId;
        return await this.workflowService.rollbackWorkflow(id, targetNodeId || 'Node_Approval_PM', userId, reason);
    }
    async reassignTask(id, newApproverId, reason, req) {
        const adminId = req.user?.sub || req.user?.userId;
        return await this.workflowService.reassignTask(id, newApproverId, adminId, reason);
    }
    async adminOverrideApprove(id, reason, req) {
        const adminId = req.user?.sub || req.user?.userId;
        return await this.workflowService.adminOverrideApprove(id, adminId, reason);
    }
};
exports.WorkflowController = WorkflowController;
__decorate([
    (0, common_1.Get)('visualizer/:id'),
    (0, swagger_1.ApiOperation)({ summary: 'Fetch BPMN 2.0 XML definition, active node state, and metadata for visualizer' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "getWorkflowVisualizerData", null);
__decorate([
    (0, common_1.Post)('instances/:id/rollback'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'HEAD_OF_OPERATIONS'),
    (0, swagger_1.ApiOperation)({ summary: 'Rollback workflow instance to a previous node state' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)('targetNodeId')),
    __param(2, (0, common_1.Body)('reason')),
    __param(3, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, String, Object]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "rollbackWorkflow", null);
__decorate([
    (0, common_1.Post)('instances/:id/reassign'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN', 'HEAD_OF_OPERATIONS'),
    (0, swagger_1.ApiOperation)({ summary: 'Reassign / Delegate workflow approval task to another user' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)('newApproverId', common_1.ParseIntPipe)),
    __param(2, (0, common_1.Body)('reason')),
    __param(3, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, Number, String, Object]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "reassignTask", null);
__decorate([
    (0, common_1.Post)('instances/:id/override'),
    (0, roles_decorator_1.Roles)('SUPER_ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Emergency Admin Override (Force-approve stuck workflow node)' }),
    __param(0, (0, common_1.Param)('id', common_1.ParseIntPipe)),
    __param(1, (0, common_1.Body)('reason')),
    __param(2, (0, common_1.Request)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number, String, Object]),
    __metadata("design:returntype", Promise)
], WorkflowController.prototype, "adminOverrideApprove", null);
exports.WorkflowController = WorkflowController = __decorate([
    (0, swagger_1.ApiTags)('Workflow Engine & Admin Intervention Controls'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('workflow'),
    __metadata("design:paramtypes", [workflow_service_1.WorkflowService])
], WorkflowController);
//# sourceMappingURL=workflow.controller.js.map