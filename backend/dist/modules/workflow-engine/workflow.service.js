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
var WorkflowService_1;
Object.defineProperty(exports, "__esModule", { value: true });
exports.WorkflowService = void 0;
const common_1 = require("@nestjs/common");
const event_emitter_1 = require("@nestjs/event-emitter");
const notification_gateway_1 = require("../notification/notification.gateway");
const bullmq_1 = require("@nestjs/bullmq");
const bullmq_2 = require("bullmq");
const crypto = require("crypto");
let WorkflowService = WorkflowService_1 = class WorkflowService {
    constructor(eventEmitter, notificationGateway, emailQueue) {
        this.eventEmitter = eventEmitter;
        this.notificationGateway = notificationGateway;
        this.emailQueue = emailQueue;
        this.logger = new common_1.Logger(WorkflowService_1.name);
        this.bpmnXmlCache = new Map();
    }
    generateCorrelationId() {
        return `WF-ERR-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
    }
    async notifyApproverWithFallback(userId, payload) {
        try {
            const room = `room:user:${userId}`;
            if (this.notificationGateway.server) {
                this.notificationGateway.server.to(room).emit('new_notification', payload);
                this.logger.log(`[WebSocket Notification] Successfully sent to ${room}`);
                return;
            }
        }
        catch (wsErr) {
            this.logger.warn(`WebSocket notification failed for User #${userId}. Falling back to Email Queue! Error: ${wsErr.message}`);
        }
        if (payload.emailTo) {
            await this.emailQueue.add('send-email', {
                to: payload.emailTo,
                subject: payload.title,
                text: payload.message,
                html: `<p><strong>${payload.title}</strong></p><p>${payload.message}</p>`,
            });
            this.logger.log(`[Email Fallback Queue] Enqueued fallback email to ${payload.emailTo}`);
        }
    }
    async startWorkflowInstance(data) {
        const correlationId = this.generateCorrelationId();
        try {
            const { entity_type: entityType, entity_id: entityId, total_estimated_amount: amount } = data;
            this.logger.log(`Starting workflow instance for ${entityType} ID ${entityId} [CorrelationId: ${correlationId}]`);
            if (entityType === 'PURCHASE_REQUEST') {
                await this.evaluateApprovalMatrix(entityId, amount);
            }
        }
        catch (err) {
            this.logger.error(`[CorrelationId: ${correlationId}] Workflow start failed: ${err.message}`, err.stack);
            this.eventEmitter.emit('audit.log', {
                action: 'WORKFLOW_EXECUTION_ERROR',
                entityId: data?.entity_id,
                entityName: 'workflow_instances',
                reason: `CorrelationId: ${correlationId} | Error: ${err.message}`,
            });
            throw new common_1.InternalServerErrorException(`Workflow Engine Error [Ref: ${correlationId}]: ${err.message}`);
        }
    }
    async evaluateApprovalMatrix(entityId, amount) {
        let targetRole = 'PROCUREMENT_MANAGER';
        let activeNodeId = 'Node_Approval_PM';
        if (amount < 10000000) {
            targetRole = 'PROCUREMENT_MANAGER';
            activeNodeId = 'Node_Approval_PM';
        }
        else if (amount >= 10000000 && amount <= 50000000) {
            targetRole = 'FINANCE_MANAGER';
            activeNodeId = 'Node_Approval_Finance';
        }
        else if (amount > 50000000 && amount <= 200000000) {
            targetRole = 'GENERAL_MANAGER';
            activeNodeId = 'Node_Approval_GM';
        }
        else {
            targetRole = 'DIRECTOR';
            activeNodeId = 'Node_Approval_Director';
        }
        const isApproverOnLeave = false;
        if (isApproverOnLeave) {
            this.logger.warn(`Approver for role ${targetRole} is ON LEAVE! Escalating to DIRECTOR...`);
            targetRole = 'DIRECTOR';
            activeNodeId = 'Node_Approval_Director';
        }
        this.logger.log(`Matrix evaluated for PR #${entityId} | Amount: ${amount} | Node: ${activeNodeId} (${targetRole})`);
        this.notificationGateway.server?.to(`room:workflow:${entityId}`)?.emit('workflow_step_updated', {
            instanceId: entityId,
            activeNodeId,
            targetRole,
            status: 'IN_PROGRESS',
            updatedAt: new Date().toISOString(),
        });
    }
    async completeTask(taskId, action, userId, comments) {
        this.logger.log(`Task #${taskId} completed with action '${action}' by User #${userId}`);
        this.eventEmitter.emit('workflow.step_completed', { taskId, action, userId, comments });
    }
    async rollbackWorkflow(instanceId, targetNodeId, userId, reason) {
        const correlationId = this.generateCorrelationId();
        this.logger.log(`Rollback requested for Instance #${instanceId} to Node '${targetNodeId}' by User #${userId} [Ref: ${correlationId}]`);
        this.eventEmitter.emit('audit.log', {
            action: 'WORKFLOW_ROLLBACK',
            entityId: instanceId,
            entityName: 'workflow_instances',
            reason: `CorrelationId: ${correlationId} | Rollback to ${targetNodeId}. Reason: ${reason}`,
            userId,
        });
        this.notificationGateway.server?.to(`room:workflow:${instanceId}`)?.emit('workflow_step_updated', {
            instanceId,
            activeNodeId: targetNodeId,
            status: 'ROLLBACK_EXECUTED',
            updatedAt: new Date().toISOString(),
        });
        return {
            statusCode: 200,
            instanceId,
            rolledBackToNode: targetNodeId,
            message: `Workflow instance #${instanceId} successfully rolled back to node '${targetNodeId}'.`,
        };
    }
    async reassignTask(instanceId, newApproverId, adminId, reason) {
        this.logger.log(`Reassigning Task for Instance #${instanceId} to User #${newApproverId} by Admin #${adminId}`);
        this.eventEmitter.emit('audit.log', {
            action: 'WORKFLOW_TASK_REASSIGNED',
            entityId: instanceId,
            entityName: 'workflow_instances',
            reason: `Reassigned to User #${newApproverId}. Reason: ${reason}`,
            userId: adminId,
        });
        await this.notifyApproverWithFallback(newApproverId, {
            title: 'Tugas Approval Dialihkan',
            message: `Tugas approval untuk Workflow #${instanceId} telah dialihkan kepada Anda.`,
        });
        return {
            statusCode: 200,
            instanceId,
            reassignedToUser: newApproverId,
            message: `Workflow task successfully reassigned to User #${newApproverId}.`,
        };
    }
    async adminOverrideApprove(instanceId, adminId, reason) {
        this.logger.warn(`EMERGENCY ADMIN OVERRIDE executed on Instance #${instanceId} by Admin #${adminId}! Reason: ${reason}`);
        this.eventEmitter.emit('audit.log', {
            action: 'WORKFLOW_EMERGENCY_OVERRIDE',
            entityId: instanceId,
            entityName: 'workflow_instances',
            reason: `EMERGENCY BYPASS FORCE APPROVE. Reason: ${reason}`,
            userId: adminId,
        });
        this.notificationGateway.server?.to(`room:workflow:${instanceId}`)?.emit('workflow_step_updated', {
            instanceId,
            activeNodeId: 'Node_End',
            status: 'OVERRIDDEN_APPROVED',
            updatedAt: new Date().toISOString(),
        });
        return {
            statusCode: 200,
            instanceId,
            status: 'APPROVED_BY_ADMIN_OVERRIDE',
            message: `Emergency Admin Override successful. Workflow #${instanceId} force-approved.`,
        };
    }
    async getWorkflowVisualizerData(instanceId) {
        const cacheKey = `bpmn_pr_workflow_v1`;
        let bpmnXml = this.bpmnXmlCache.get(cacheKey);
        if (!bpmnXml) {
            bpmnXml = this.generateSampleBpmnXml();
            this.bpmnXmlCache.set(cacheKey, bpmnXml);
        }
        return {
            instanceId,
            workflowName: 'Purchase Request Approval Workflow (BPMN 2.0)',
            activeNodeId: 'Node_Approval_PM',
            status: 'IN_PROGRESS',
            bpmnXml,
            activeNodeMetadata: {
                nodeId: 'Node_Approval_PM',
                nodeName: 'Persetujuan Procurement Manager',
                assignedRole: 'PROCUREMENT_MANAGER',
                approverName: 'Budi Santoso, S.T. (Procurement Manager)',
                timeSpent: '45 Menit',
                status: 'WAITING_APPROVAL',
                comments: 'Menunggu peninjauan rincian item pengadaan server.',
            },
            history: [
                {
                    nodeId: 'Node_Start',
                    nodeName: 'Pengajuan PR (Initiation)',
                    performedBy: 'Anita Wijaya (Marketing Staff)',
                    action: 'SUBMITTED',
                    completedAt: new Date(Date.now() - 3600000).toISOString(),
                    comments: 'Dokumen pengajuan PR diajukan ke sistem.',
                },
            ],
        };
    }
    generateSampleBpmnXml() {
        return `<?xml version="1.0" encoding="UTF-8"?>
<bpmn:definitions xmlns:bpmn="http://www.omg.org/spec/BPMN/20100524/MODEL"
                  xmlns:bpmndi="http://www.omg.org/spec/BPMN/20100524/DI"
                  xmlns:dc="http://www.omg.org/spec/DD/20100524/DC"
                  xmlns:di="http://www.omg.org/spec/DD/20100524/DI"
                  id="Definitions_1"
                  targetNamespace="http://bpmn.io/schema/bpmn">
  <bpmn:process id="Process_PR_Approval" isExecutable="true">
    <bpmn:startEvent id="Node_Start" name="Pengajuan PR">
      <bpmn:outgoing>Flow_1</bpmn:outgoing>
    </bpmn:startEvent>
    <bpmn:userTask id="Node_Approval_PM" name="Review PM">
      <bpmn:incoming>Flow_1</bpmn:incoming>
      <bpmn:outgoing>Flow_2</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="Node_Approval_Finance" name="Review Finance">
      <bpmn:incoming>Flow_2</bpmn:incoming>
      <bpmn:outgoing>Flow_3</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:userTask id="Node_Approval_Director" name="Approval Direksi">
      <bpmn:incoming>Flow_3</bpmn:incoming>
      <bpmn:outgoing>Flow_4</bpmn:outgoing>
    </bpmn:userTask>
    <bpmn:endEvent id="Node_End" name="Selesai &amp; Rilis PO">
      <bpmn:incoming>Flow_4</bpmn:incoming>
    </bpmn:endEvent>
    <bpmn:sequenceFlow id="Flow_1" sourceRef="Node_Start" targetRef="Node_Approval_PM" />
    <bpmn:sequenceFlow id="Flow_2" sourceRef="Node_Approval_PM" targetRef="Node_Approval_Finance" />
    <bpmn:sequenceFlow id="Flow_3" sourceRef="Node_Approval_Finance" targetRef="Node_Approval_Director" />
    <bpmn:sequenceFlow id="Flow_4" sourceRef="Node_Approval_Director" targetRef="Node_End" />
  </bpmn:process>
</bpmn:definitions>`;
    }
};
exports.WorkflowService = WorkflowService;
__decorate([
    (0, event_emitter_1.OnEvent)('workflow.trigger'),
    __metadata("design:type", Function),
    __metadata("design:paramtypes", [Object]),
    __metadata("design:returntype", Promise)
], WorkflowService.prototype, "startWorkflowInstance", null);
exports.WorkflowService = WorkflowService = WorkflowService_1 = __decorate([
    (0, common_1.Injectable)(),
    __param(2, (0, bullmq_1.InjectQueue)('email-send')),
    __metadata("design:paramtypes", [event_emitter_1.EventEmitter2,
        notification_gateway_1.NotificationGateway,
        bullmq_2.Queue])
], WorkflowService);
//# sourceMappingURL=workflow.service.js.map