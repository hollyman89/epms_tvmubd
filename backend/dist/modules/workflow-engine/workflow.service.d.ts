import { EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationGateway } from '../notification/notification.gateway';
import { Queue } from 'bullmq';
export declare class WorkflowService {
    private readonly eventEmitter;
    private readonly notificationGateway;
    private emailQueue;
    private readonly logger;
    private bpmnXmlCache;
    constructor(eventEmitter: EventEmitter2, notificationGateway: NotificationGateway, emailQueue: Queue);
    private generateCorrelationId;
    notifyApproverWithFallback(userId: number, payload: {
        title: string;
        message: string;
        emailTo?: string;
    }): Promise<void>;
    startWorkflowInstance(data: any): Promise<void>;
    private evaluateApprovalMatrix;
    completeTask(taskId: number, action: 'APPROVE' | 'REJECT', userId: number, comments?: string): Promise<void>;
    rollbackWorkflow(instanceId: number, targetNodeId: string, userId: number, reason: string): Promise<{
        statusCode: number;
        instanceId: number;
        rolledBackToNode: string;
        message: string;
    }>;
    reassignTask(instanceId: number, newApproverId: number, adminId: number, reason: string): Promise<{
        statusCode: number;
        instanceId: number;
        reassignedToUser: number;
        message: string;
    }>;
    adminOverrideApprove(instanceId: number, adminId: number, reason: string): Promise<{
        statusCode: number;
        instanceId: number;
        status: string;
        message: string;
    }>;
    getWorkflowVisualizerData(instanceId: number): Promise<{
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
    }>;
    private generateSampleBpmnXml;
}
