import { Repository } from 'typeorm';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { Task } from '../../entities/task.entity';
import { Project } from '../../entities/project.entity';
import { Contract } from '../../entities/contract.entity';
import { CreateWbsDto } from './dto/create-wbs.dto';
import { CreateTaskDto } from './dto/create-task.dto';
export declare class ProjectService {
    private wbsRepo;
    private taskRepo;
    private projectRepo;
    private contractRepo;
    private readonly logger;
    constructor(wbsRepo: Repository<WorkBreakdownStructure>, taskRepo: Repository<Task>, projectRepo: Repository<Project>, contractRepo: Repository<Contract>);
    createWbs(dto: CreateWbsDto): Promise<WorkBreakdownStructure>;
    getWbsByProject(projectId: number): Promise<WorkBreakdownStructure[]>;
    createTask(dto: CreateTaskDto): Promise<Task>;
    getTasksByWbs(wbsId: number): Promise<Task[]>;
    getOperationalBoard(): Promise<{
        statusCode: number;
        message: string;
        data: {
            pendingKickoff: {
                id: number;
                tender_id: number;
                project_code: string;
                project_name: string;
                customerName: string;
                contract_total_value: number;
                marketingName: string;
                status: string;
                created_at: string | Date;
            }[];
            activeProjects: {
                id: number;
                tender_id: number;
                project_code: string;
                project_name: string;
                customerName: string;
                contract_total_value: number;
                marketingName: string;
                pmName: string;
                status: string;
                created_at: string | Date;
                overallProgress: number;
            }[];
        };
    }>;
    claimCharter(charterId: any, dto: any): Promise<{
        statusCode: number;
        message: string;
        data: Project;
    }>;
    recalculateWbsBudgetFromPo(poId: number, paymentAmount: number): Promise<boolean>;
}
