import { HttpStatus } from '@nestjs/common';
import { WorkflowService } from './workflow.service';
export declare class WorkflowController {
    private readonly workflowService;
    constructor(workflowService: WorkflowService);
    getWorkflowVisualizerData(id: number): Promise<{
        statusCode: HttpStatus;
        message: string;
        data: {
            instanceId: number;
            workflowName: string;
            activeNodeId: string;
            status: string;
            bpmnXml: string;
            activeNodeMetadata: {
                nodeId: string;
                nodeName: string;
                assignedRole: string;
                approverName: string;
                timeSpent: string;
                status: string;
                comments: string;
            };
            history: {
                nodeId: string;
                nodeName: string;
                performedBy: string;
                action: string;
                completedAt: string;
                comments: string;
            }[];
        };
    }>;
    rollbackWorkflow(id: number, targetNodeId: string, reason: string, req: any): Promise<{
        statusCode: number;
        instanceId: number;
        rolledBackToNode: string;
        message: string;
    }>;
    reassignTask(id: number, newApproverId: number, reason: string, req: any): Promise<{
        statusCode: number;
        instanceId: number;
        reassignedToUser: number;
        message: string;
    }>;
    adminOverrideApprove(id: number, reason: string, req: any): Promise<{
        statusCode: number;
        instanceId: number;
        status: string;
        message: string;
    }>;
}
