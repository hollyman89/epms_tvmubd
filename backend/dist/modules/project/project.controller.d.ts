import { ProjectService } from './project.service';
import { CreateWbsDto } from './dto/create-wbs.dto';
import { CreateTaskDto } from './dto/create-task.dto';
export declare class ProjectController {
    private readonly projectService;
    constructor(projectService: ProjectService);
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
    createWbs(createWbsDto: CreateWbsDto): Promise<import("../../entities/wbs.entity").WorkBreakdownStructure>;
    getWbsByProject(projectId: number): Promise<import("../../entities/wbs.entity").WorkBreakdownStructure[]>;
    createTask(createTaskDto: CreateTaskDto): Promise<import("../../entities/task.entity").Task>;
    getTasksByWbs(wbsId: number): Promise<import("../../entities/task.entity").Task[]>;
    claimCharterPatch(id: string, body: any): Promise<{
        statusCode: number;
        message: string;
        data: import("../../entities/project.entity").Project;
    }>;
    claimCharterPost(id: string, body: any): Promise<{
        statusCode: number;
        message: string;
        data: import("../../entities/project.entity").Project;
    }>;
}
