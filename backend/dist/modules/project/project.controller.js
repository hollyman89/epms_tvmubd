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
exports.ProjectController = void 0;
const common_1 = require("@nestjs/common");
const swagger_1 = require("@nestjs/swagger");
const project_service_1 = require("./project.service");
const create_wbs_dto_1 = require("./dto/create-wbs.dto");
const create_task_dto_1 = require("./dto/create-task.dto");
const jwt_auth_guard_1 = require("../auth/guards/jwt-auth.guard");
const roles_guard_1 = require("../auth/guards/roles.guard");
const roles_decorator_1 = require("../auth/decorators/roles.decorator");
let ProjectController = class ProjectController {
    constructor(projectService) {
        this.projectService = projectService;
    }
    async getOperationalBoard() {
        return this.projectService.getOperationalBoard();
    }
    async createWbs(createWbsDto) {
        return this.projectService.createWbs(createWbsDto);
    }
    async getWbsByProject(projectId) {
        return this.projectService.getWbsByProject(projectId);
    }
    async createTask(createTaskDto) {
        return this.projectService.createTask(createTaskDto);
    }
    async getTasksByWbs(wbsId) {
        return this.projectService.getTasksByWbs(wbsId);
    }
    async claimCharterPatch(id, body) {
        return this.projectService.claimCharter(id, body);
    }
    async claimCharterPost(id, body) {
        return this.projectService.claimCharter(id, body);
    }
};
exports.ProjectController = ProjectController;
__decorate([
    (0, common_1.Get)('operational-board'),
    (0, swagger_1.ApiOperation)({ summary: 'Get official PMO operational board (Pending kickoff and active projects)' }),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", []),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "getOperationalBoard", null);
__decorate([
    (0, common_1.Post)('wbs'),
    (0, roles_decorator_1.Roles)('PROJECT_MANAGER', 'SUPER_ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new Work Breakdown Structure (WBS)' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_wbs_dto_1.CreateWbsDto]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "createWbs", null);
__decorate([
    (0, common_1.Get)(':projectId/wbs'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all WBS for a specific project' }),
    __param(0, (0, common_1.Param)('projectId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "getWbsByProject", null);
__decorate([
    (0, common_1.Post)('tasks'),
    (0, roles_decorator_1.Roles)('PROJECT_MANAGER', 'SUPER_ADMIN'),
    (0, swagger_1.ApiOperation)({ summary: 'Create a new Task under a WBS' }),
    __param(0, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [create_task_dto_1.CreateTaskDto]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "createTask", null);
__decorate([
    (0, common_1.Get)('wbs/:wbsId/tasks'),
    (0, swagger_1.ApiOperation)({ summary: 'Get all tasks for a specific WBS' }),
    __param(0, (0, common_1.Param)('wbsId')),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Number]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "getTasksByWbs", null);
__decorate([
    (0, common_1.Patch)('charters/:id/claim'),
    (0, swagger_1.ApiOperation)({ summary: 'Claim and kickoff a project charter into active project' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "claimCharterPatch", null);
__decorate([
    (0, common_1.Post)('charters/:id/claim'),
    (0, swagger_1.ApiOperation)({ summary: 'Claim and kickoff a project charter into active project' }),
    __param(0, (0, common_1.Param)('id')),
    __param(1, (0, common_1.Body)()),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [String, Object]),
    __metadata("design:returntype", Promise)
], ProjectController.prototype, "claimCharterPost", null);
exports.ProjectController = ProjectController = __decorate([
    (0, swagger_1.ApiTags)('Project'),
    (0, swagger_1.ApiBearerAuth)(),
    (0, common_1.UseGuards)(jwt_auth_guard_1.JwtAuthGuard, roles_guard_1.RolesGuard),
    (0, common_1.Controller)('project'),
    __metadata("design:paramtypes", [project_service_1.ProjectService])
], ProjectController);
//# sourceMappingURL=project.controller.js.map