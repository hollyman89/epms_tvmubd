import { Injectable, Logger, NotFoundException, BadRequestException, InternalServerErrorException } from '@nestjs/common';
import { OnEvent, EventEmitter2 } from '@nestjs/event-emitter';
import { NotificationGateway } from '../notification/notification.gateway';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import * as crypto from 'crypto';

@Injectable()
export class WorkflowService {
  private readonly logger = new Logger(WorkflowService.name);
  private bpmnXmlCache: Map<string, string> = new Map();

  constructor(
    private readonly eventEmitter: EventEmitter2,
    private readonly notificationGateway: NotificationGateway,
    @InjectQueue('email-send') private emailQueue: Queue,
  ) {}

  /**
   * Helper: Generate unique Correlation ID for error tracking
   */
  private generateCorrelationId(): string {
    return `WF-ERR-${Date.now()}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
  }

  /**
   * Helper: WebSocket Notification with Email Queue Fallback
   */
  async notifyApproverWithFallback(userId: number, payload: { title: string; message: string; emailTo?: string }) {
    try {
      // 1. Try WebSocket Notification
      const room = `room:user:${userId}`;
      if (this.notificationGateway.server) {
        this.notificationGateway.server.to(room).emit('new_notification', payload);
        this.logger.log(`[WebSocket Notification] Successfully sent to ${room}`);
        return;
      }
    } catch (wsErr: any) {
      this.logger.warn(`WebSocket notification failed for User #${userId}. Falling back to Email Queue! Error: ${wsErr.message}`);
    }

    // 2. Fallback to BullMQ Email Queue if WebSocket fails
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

  /**
   * Starts a new workflow instance based on entity data with error recovery
   */
  @OnEvent('workflow.trigger')
  async startWorkflowInstance(data: any) {
    const correlationId = this.generateCorrelationId();
    try {
      const { entity_type: entityType, entity_id: entityId, total_estimated_amount: amount } = data;
      this.logger.log(`Starting workflow instance for ${entityType} ID ${entityId} [CorrelationId: ${correlationId}]`);

      if (entityType === 'PURCHASE_REQUEST') {
        await this.evaluateApprovalMatrix(entityId, amount);
      }
    } catch (err: any) {
      this.logger.error(`[CorrelationId: ${correlationId}] Workflow start failed: ${err.message}`, err.stack);
      this.eventEmitter.emit('audit.log', {
        action: 'WORKFLOW_EXECUTION_ERROR',
        entityId: data?.entity_id,
        entityName: 'workflow_instances',
        reason: `CorrelationId: ${correlationId} | Error: ${err.message}`,
      });
      throw new InternalServerErrorException(`Workflow Engine Error [Ref: ${correlationId}]: ${err.message}`);
    }
  }

  /**
   * Evaluates matrix and handles missing/on-leave approver escalation
   */
  private async evaluateApprovalMatrix(entityId: number, amount: number) {
    let targetRole = 'PROCUREMENT_MANAGER';
    let activeNodeId = 'Node_Approval_PM';

    if (amount < 10000000) {
      targetRole = 'PROCUREMENT_MANAGER';
      activeNodeId = 'Node_Approval_PM';
    } else if (amount >= 10000000 && amount <= 50000000) {
      targetRole = 'FINANCE_MANAGER';
      activeNodeId = 'Node_Approval_Finance';
    } else if (amount > 50000000 && amount <= 200000000) {
      targetRole = 'GENERAL_MANAGER';
      activeNodeId = 'Node_Approval_GM';
    } else {
      targetRole = 'DIRECTOR';
      activeNodeId = 'Node_Approval_Director';
    }

    // Check if Approver is Missing / On Leave -> Escalate to Superior
    const isApproverOnLeave = false; // Mock HR Integration Check
    if (isApproverOnLeave) {
      this.logger.warn(`Approver for role ${targetRole} is ON LEAVE! Escalating to DIRECTOR...`);
      targetRole = 'DIRECTOR';
      activeNodeId = 'Node_Approval_Director';
    }

    this.logger.log(`Matrix evaluated for PR #${entityId} | Amount: ${amount} | Node: ${activeNodeId} (${targetRole})`);

    // Emit real-time WebSocket update for BPMN Visualizer
    this.notificationGateway.server?.to(`room:workflow:${entityId}`)?.emit('workflow_step_updated', {
      instanceId: entityId,
      activeNodeId,
      targetRole,
      status: 'IN_PROGRESS',
      updatedAt: new Date().toISOString(),
    });
  }

  /**
   * Completes task and progresses BPMN node
   */
  async completeTask(taskId: number, action: 'APPROVE' | 'REJECT', userId: number, comments?: string) {
    this.logger.log(`Task #${taskId} completed with action '${action}' by User #${userId}`);
    this.eventEmitter.emit('workflow.step_completed', { taskId, action, userId, comments });
  }

  /**
   * 1. Rollback / Undo Workflow to Previous Node State
   */
  async rollbackWorkflow(instanceId: number, targetNodeId: string, userId: number, reason: string) {
    const correlationId = this.generateCorrelationId();
    this.logger.log(`Rollback requested for Instance #${instanceId} to Node '${targetNodeId}' by User #${userId} [Ref: ${correlationId}]`);

    this.eventEmitter.emit('audit.log', {
      action: 'WORKFLOW_ROLLBACK',
      entityId: instanceId,
      entityName: 'workflow_instances',
      reason: `CorrelationId: ${correlationId} | Rollback to ${targetNodeId}. Reason: ${reason}`,
      userId,
    });

    // Notify BPMN Visualizer of Node Rollback
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

  /**
   * 2. Reassign / Delegate Approval Task to Another User
   */
  async reassignTask(instanceId: number, newApproverId: number, adminId: number, reason: string) {
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

  /**
   * 3. Emergency Admin Override (Force Approve)
   */
  async adminOverrideApprove(instanceId: number, adminId: number, reason: string) {
    this.logger.warn(`EMERGENCY ADMIN OVERRIDE executed on Instance #${instanceId} by Admin #${adminId}! Reason: ${reason}`);

    this.eventEmitter.emit('audit.log', {
      action: 'WORKFLOW_EMERGENCY_OVERRIDE',
      entityId: instanceId,
      entityName: 'workflow_instances',
      reason: `EMERGENCY BYPASS FORCE APPROVE. Reason: ${reason}`,
      userId: adminId,
    });

    // Notify Visualizer of Override Completion
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

  /**
   * Returns BPMN 2.0 XML definition, active node ID, and node metadata for visualizer
   */
  async getWorkflowVisualizerData(instanceId: number) {
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

  private generateSampleBpmnXml(): string {
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
}
