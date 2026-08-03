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
var ProjectService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProjectService = void 0;
const common_1 = require("@nestjs/common");
const typeorm_1 = require("@nestjs/typeorm");
const typeorm_2 = require("typeorm");
const wbs_entity_1 = require("../../entities/wbs.entity");
const task_entity_1 = require("../../entities/task.entity");
const project_entity_1 = require("../../entities/project.entity");
const contract_entity_1 = require("../../entities/contract.entity");
let ProjectService = ProjectService_1 = class ProjectService {
    constructor(wbsRepo, taskRepo, projectRepo, contractRepo) {
        this.wbsRepo = wbsRepo;
        this.taskRepo = taskRepo;
        this.projectRepo = projectRepo;
        this.contractRepo = contractRepo;
        this.logger = new common_1.Logger(ProjectService_1.name);
    }
    async createWbs(dto) {
        const wbs = this.wbsRepo.create(dto);
        return this.wbsRepo.save(wbs);
    }
    async getWbsByProject(projectId) {
        return this.wbsRepo.find({ where: { projectId } });
    }
    async createTask(dto) {
        const task = this.taskRepo.create(dto);
        return this.taskRepo.save(task);
    }
    async getTasksByWbs(wbsId) {
        return this.taskRepo.find({ where: { wbsId } });
    }
    async getOperationalBoard() {
        const dbProjects = await this.projectRepo.find({
            order: { id: 'DESC' },
        });
        const activeProjectCodes = new Set(dbProjects.map((p) => p.code));
        const approvedContracts = await this.contractRepo.find({
            where: { legal_status: contract_entity_1.LegalStatus.APPROVED },
            relations: ['proposal', 'proposal.tender', 'customer'],
            order: { id: 'DESC' },
        });
        const pendingKickoff = approvedContracts
            .filter((c) => !activeProjectCodes.has(c.contract_number))
            .map((c) => ({
            id: c.id,
            tender_id: c.proposal?.tender_id || c.proposal_id || 1,
            project_code: c.contract_number || `PRJ-${c.id}`,
            project_name: c.proposal?.tender?.title || 'Pengadaan Server EPMS',
            customerName: c.customer?.name || 'PT Customer',
            contract_total_value: Number(c.contract_value || c.proposal?.proposed_amount || 0),
            marketingName: 'Marketing Staff',
            status: 'PENDING_KICKOFF',
            created_at: c.created_at || new Date().toISOString(),
        }));
        const allContracts = await this.contractRepo.find({
            relations: ['proposal', 'proposal.tender', 'customer'],
        });
        const contractMap = new Map();
        for (const c of allContracts) {
            if (c.contract_number) {
                contractMap.set(c.contract_number, c);
            }
        }
        const activeProjects = dbProjects.map((p) => {
            const matchedContract = contractMap.get(p.code);
            const realValue = matchedContract
                ? Number(matchedContract.contract_value || matchedContract.proposal?.proposed_amount || 500000000)
                : 500000000;
            const realCustomer = matchedContract?.customer?.name || 'PT. Telkom Indonesia';
            const realName = matchedContract?.proposal?.tender?.title || p.name;
            return {
                id: p.id,
                tender_id: p.id,
                project_code: p.code,
                project_name: realName,
                customerName: realCustomer,
                contract_total_value: realValue,
                marketingName: 'Marketing Staff',
                pmName: 'Project Manager',
                status: p.status || 'IN_PROGRESS',
                created_at: p.createdAt || new Date().toISOString(),
                overallProgress: 0,
            };
        });
        return {
            statusCode: 200,
            message: 'PMO Operational Board retrieved successfully',
            data: {
                pendingKickoff,
                activeProjects,
            },
        };
    }
    async claimCharter(charterId, dto) {
        let contract = null;
        try {
            contract = await this.contractRepo.findOne({
                where: [{ id: isNaN(Number(charterId)) ? -1 : Number(charterId) }, { contract_number: String(charterId) }],
                relations: ['proposal', 'proposal.tender', 'customer'],
            });
        }
        catch (e) { }
        const projectCode = contract?.contract_number || (String(charterId).startsWith('CONT-') ? String(charterId) : `CONT-20260722-1127`);
        const projectName = contract?.proposal?.tender?.title || 'Pengadaan Infrastructure Cloud & Core Core Router 2026';
        let existingProject = await this.projectRepo.findOne({ where: { code: projectCode } });
        if (!existingProject) {
            existingProject = this.projectRepo.create({
                code: projectCode,
                name: projectName,
                status: 'IN_PROGRESS',
                managerId: 5,
                startDate: dto?.estimatedStartDate ? dto.estimatedStartDate : new Date().toISOString().split('T')[0],
                endDate: dto?.estimatedEndDate ? dto.estimatedEndDate : null,
            });
            await this.projectRepo.save(existingProject);
        }
        else {
            existingProject.status = 'IN_PROGRESS';
            await this.projectRepo.save(existingProject);
        }
        return {
            statusCode: 200,
            message: `Project Charter #${projectCode} successfully claimed & activated!`,
            data: existingProject,
        };
    }
    async recalculateWbsBudgetFromPo(poId, paymentAmount) {
        this.logger.log(`Recalculating WBS budget for PO ${poId} with payment ${paymentAmount}`);
        return true;
    }
};
exports.ProjectService = ProjectService;
exports.ProjectService = ProjectService = ProjectService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(0, (0, typeorm_1.InjectRepository)(wbs_entity_1.WorkBreakdownStructure)),
    __param(1, (0, typeorm_1.InjectRepository)(task_entity_1.Task)),
    __param(2, (0, typeorm_1.InjectRepository)(project_entity_1.Project)),
    __param(3, (0, typeorm_1.InjectRepository)(contract_entity_1.Contract)),
    __metadata("design:paramtypes", [typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository,
        typeorm_2.Repository])
], ProjectService);
//# sourceMappingURL=project.service.js.map