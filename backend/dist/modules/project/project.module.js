"use strict";
var __decorate = (this && this.__decorate) || function (decorators, target, key, desc) {
    var c = arguments.length, r = c < 3 ? target : desc === null ? desc = Object.getOwnPropertyDescriptor(target, key) : desc, d;
    if (typeof Reflect === "object" && typeof Reflect.decorate === "function") r = Reflect.decorate(decorators, target, key, desc);
    else for (var i = decorators.length - 1; i >= 0; i--) if (d = decorators[i]) r = (c < 3 ? d(r) : c > 3 ? d(target, key, r) : d(target, key)) || r;
    return c > 3 && r && Object.defineProperty(target, key, r), r;
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectModule = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const project_controller_1 = require("./project.controller");
const project_service_1 = require("./project.service");
const wbs_entity_1 = require("../../entities/wbs.entity");
const task_entity_1 = require("../../entities/task.entity");
const project_entity_1 = require("../../entities/project.entity");
const contract_entity_1 = require("../../entities/contract.entity");
const project_event_listener_1 = require("./project-event.listener");
let ProjectModule = class ProjectModule {
};
exports.ProjectModule = ProjectModule;
exports.ProjectModule = ProjectModule = __decorate([
    (0, common_1.Module)({
        imports: [typeorm_1.TypeOrmModule.forFeature([wbs_entity_1.WorkBreakdownStructure, task_entity_1.Task, project_entity_1.Project, contract_entity_1.Contract])],
        controllers: [project_controller_1.ProjectController],
        providers: [project_service_1.ProjectService, project_event_listener_1.ProjectEventListener],
        exports: [project_service_1.ProjectService],
    })
], ProjectModule);
//# sourceMappingURL=project.module.js.map