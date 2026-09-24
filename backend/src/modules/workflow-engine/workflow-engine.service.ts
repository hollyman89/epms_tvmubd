import {
  Injectable,
  NotFoundException,
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, EntityManager } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import * as crypto from 'crypto';

import { WorkflowDefinition } from '../../entities/workflow-definition.entity';
import { WorkflowVersion } from '../../entities/workflow-version.entity';
import {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from '../../entities/workflow-instance.entity';
import {
  WorkflowTask,
  WorkflowTaskStatus,
} from '../../entities/workflow-task.entity';
import { WorkflowTransition } from '../../entities/workflow-transition.entity';
import { Role } from '../../entities/role.entity';
import { PurchaseRequest } from '../../entities/purchase-request.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';
import { OutboxEvent, OutboxStatus } from '../../entities/outbox-event.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import {
  StartWorkflowInstanceDto,
  CompleteWorkflowTaskDto,
} from './dto/workflow-engine.dto';
import { ConditionEvaluator } from './condition-evaluator';
import { BusinessEvent, NotificationPolicy } from '../../shared/contracts/business-event.contract';

interface BpmnNode {
  id: string;
  type: string;
  data?: {
    label?: string;
    taskKey?: string;
    type?: string;
    role?: string;
    assigneeRole?: string;
    assignedRole?: string;
    condition?: string;
    action?: string;
    [key: string]: any;
  };
}

interface BpmnEdge {
  id: string;
  source: string;
  target: string;
  label?: string;
  data?: {
    condition?: string;
    action?: string;
    [key: string]: any;
  };
}

interface BpmnGraph {
  nodes: BpmnNode[];
  edges: BpmnEdge[];
}

@Injectable()
export class WorkflowEngineService {
  private readonly logger = new Logger(WorkflowEngineService.name);

  constructor(
    @InjectRepository(WorkflowDefinition)
    private readonly definitionRepo: Repository<WorkflowDefinition>,
    @InjectRepository(WorkflowVersion)
    private readonly versionRepo: Repository<WorkflowVersion>,
    @InjectRepository(WorkflowInstance)
    private readonly instanceRepo: Repository<WorkflowInstance>,
    @InjectRepository(WorkflowTask)
    private readonly taskRepo: Repository<WorkflowTask>,
    @InjectRepository(WorkflowTransition)
    private readonly transitionRepo: Repository<WorkflowTransition>,
    @InjectRepository(Role)
    private readonly roleRepo: Repository<Role>,
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
    private readonly dataSource: DataSource,
    private readonly eventEmitter: EventEmitter2,
  ) {}

  // 1. START WORKFLOW INSTANCE

  /**
   * Instantiates and begins execution of a Published Workflow Definition.
   * Enforces immutability via version snapshot and ensures idempotency.
   */
  async startInstance(
    dto: StartWorkflowInstanceDto,
    userId?: number,
  ): Promise<WorkflowInstance> {
    const { workflowKey, entityType, entityId, context = {} } = dto;

    // 1. Resolve Definition
    const definition = await this.definitionRepo.findOne({
      where: { workflowKey },
      relations: ['versions'],
    });

    if (!definition) {
      throw new NotFoundException(
        `Workflow definition '${workflowKey}' not found.`,
      );
    }

    if (definition.status === 'ARCHIVED' || definition.isActive === 0) {
      throw new BadRequestException(
        `Cannot start an instance for archived or inactive workflow '${workflowKey}'.`,
      );
    }

    // 2. Resolve Active/Published Version
    if (!definition.activeVersion) {
      throw new BadRequestException(
        `Workflow '${workflowKey}' does not have an active published version.`,
      );
    }

    const publishedVersion = definition.versions.find(
      (v) => v.version === definition.activeVersion && v.status === 'PUBLISHED',
    );

    if (!publishedVersion) {
      throw new BadRequestException(
        `Active version ${definition.activeVersion} for workflow '${workflowKey}' is not published or cannot be found.`,
      );
    }

    // 3. Validate Graph
    const graph = this.parseGraph(publishedVersion.bpmnJson);
    this.validateGraph(graph);

    // 4. Check Idempotency (Prevent multiple active instances for the same entity + workflow)
    const existingActive = await this.instanceRepo.findOne({
      where: {
        workflowDefinitionId: definition.id,
        entityType,
        entityId,
        status: WorkflowInstanceStatus.IN_PROGRESS,
      },
    });

    if (existingActive) {
      throw new ConflictException(
        `An active workflow instance (#${existingActive.id}) already exists for ${entityType} #${entityId}.`,
      );
    }

    // 5. Execute within a strict Database Transaction
    return this.dataSource.transaction(async (manager) => {
      // Find START node
      const startNode = graph.nodes.find(
        (n) => (n.data?.type || n.type) === 'START',
      )!;

      // Create WorkflowInstance entity with immutable version snapshot
      const instance = manager.create(WorkflowInstance, {
        workflowDefinitionId: definition.id,
        workflowVersionId: publishedVersion.id,
        entityType,
        entityId,
        status: WorkflowInstanceStatus.IN_PROGRESS,
        currentNodeId: startNode.id,
        context: { ...context },
        currentStateData: { initiatedAt: new Date().toISOString() },
        createdBy: userId,
      });

      const savedInstance = await manager.save(instance);

      // Record START transition
      await this.recordTransition(manager, {
        instanceId: savedInstance.id,
        fromNodeId: 'INIT',
        toNodeId: startNode.id,
        action: 'START',
        actorId: userId,
        reason: 'Workflow instance initialized',
        versionId: publishedVersion.id,
        contextSnapshot: savedInstance.context,
      });

      // Auto-progress from START node to first connected node
      const outgoingEdges = graph.edges.filter((e) => e.source === startNode.id);
      if (outgoingEdges.length === 0) {
        throw new BadRequestException(
          `START node '${startNode.id}' has no outgoing connections.`,
        );
      }

      const firstEdge = outgoingEdges[0];
      const targetNode = graph.nodes.find((n) => n.id === firstEdge.target);
      if (!targetNode) {
        throw new BadRequestException(
          `Target node '${firstEdge.target}' connected to START node was not found in definition.`,
        );
      }

      // Progress to the target node
      await this.progressToNode(
        manager,
        savedInstance,
        graph,
        startNode,
        targetNode,
        publishedVersion,
        'AUTO',
        userId,
      );

      // Save durable Outbox event for workflow.instance.started was removed as it was scope creep

      // Emit ephemeral audit log
      this.eventEmitter.emit('audit.log', {
        action: 'WORKFLOW_INSTANCE_STARTED',
        entityId: savedInstance.id,
        entityName: 'workflow_instances',
        userId,
        newValue: {
          workflowKey,
          version: publishedVersion.version,
          entityType,
          entityId,
        },
      });

      return savedInstance;
    });
  }

  // 2. COMPLETE WORKFLOW TASK

  /**
   * Executes a decision (APPROVE, REJECT, RETURN) on a pending task.
   * Atomically transitions the instance to next node, creates new tasks, or completes.
   */
  async completeTask(
    taskId: number,
    dto: CompleteWorkflowTaskDto,
    actorId: number,
    actorRoles: string[] = [],
  ): Promise<{ task: WorkflowTask; instance: WorkflowInstance }> {
    const { action, reason, contextUpdate } = dto;

    return this.dataSource.transaction(async (manager) => {
      // 1. Load Task with Pessimistic Write Lock for strict Concurrency Protection
      const task = await manager
        .createQueryBuilder(WorkflowTask, 'task')
        .setLock('pessimistic_write')
        .leftJoinAndSelect('task.workflowInstance', 'instance')
        .leftJoinAndSelect('task.assigneeRole', 'role')
        .where('task.id = :taskId', { taskId })
        .getOne();

      if (!task) {
        throw new NotFoundException(`Workflow task #${taskId} not found.`);
      }

      // 2. Idempotency Check: Task must be PENDING
      if (task.status !== WorkflowTaskStatus.PENDING) {
        throw new ConflictException(
          `Task #${taskId} has already been completed with status '${task.status}' (Action: ${task.action}).`,
        );
      }

      const instance = task.workflowInstance;
      if (!instance || instance.status !== WorkflowInstanceStatus.IN_PROGRESS) {
        throw new BadRequestException(
          `Associated workflow instance #${instance?.id} is not in progress (Status: ${instance?.status}).`,
        );
      }

      // 3. Server-side Authorization Check
      this.validateActorAuthorization(task, actorId, actorRoles);

      // 4. Load exact snapshot version for the instance
      const version = await manager.findOne(WorkflowVersion, {
        where: { id: instance.workflowVersionId },
      });

      if (!version) {
        throw new NotFoundException(
          `Workflow version #${instance.workflowVersionId} for instance #${instance.id} not found.`,
        );
      }

      const graph = this.parseGraph(version.bpmnJson);

      // 5. Update Task
      task.status =
        action === 'APPROVE'
          ? WorkflowTaskStatus.COMPLETED
          : action === 'REJECT'
          ? WorkflowTaskStatus.REJECTED
          : WorkflowTaskStatus.RETURNED;
      task.action = action;
      task.decidedBy = actorId;
      task.decidedAt = new Date();
      task.comments = reason || null;
      task.updatedBy = actorId;
      await manager.save(task);

      // 6. Update Instance Context if provided
      if (contextUpdate) {
        instance.context = {
          ...(instance.context || {}),
          ...contextUpdate,
        };
      }

      // 7. Find Current Node in graph
      const currentNodeId = task.nodeId || instance.currentNodeId;
      const currentNode = graph.nodes.find((n) => n.id === currentNodeId);
      if (!currentNode) {
        throw new BadRequestException(
          `Current node '${currentNodeId}' not found in workflow definition version #${version.version}.`,
        );
      }

      // 8. Resolve Next Transition based on decision action and condition
      const nextNode = this.resolveNextNode(graph, currentNode, action, instance.context);

      // 9. Record Transition Audit
      await this.recordTransition(manager, {
        instanceId: instance.id,
        taskId: task.id,
        fromNodeId: currentNode.id,
        toNodeId: nextNode.id,
        action,
        actorId,
        reason,
        versionId: version.id,
        contextSnapshot: instance.context,
      });

      // 10. Progress to Next Node
      await this.progressToNode(
        manager,
        instance,
        graph,
        currentNode,
        nextNode,
        version,
        action,
        actorId,
        reason,
      );

      // 11. Save Outbox Event
      const isReturned = action === 'RETURN' || action === 'RESUBMIT';
      const eventName = isReturned ? 'workflow.task.returned' : 'workflow.task.completed';
      const recipientUser = nextNode.data?.assigneeUserId;
      const recipientRole = nextNode.data?.role || nextNode.data?.assigneeRole;

      await this.saveOutboxEvent(manager, {
        eventId: crypto.randomUUID(),
        eventName,
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'WORKFLOW_TASK',
        aggregateId: task.id,
        projectId: instance.entityType === 'PROJECT' ? Number(instance.entityId) : undefined,
        actor: { userId: actorId },
        routing: isReturned 
          ? { 
              userIds: recipientUser ? [recipientUser] : [],
              roles: recipientRole ? [recipientRole] : [],
            }
          : undefined, // NEEDS MORE EVIDENCE for actual task completed consumers
        notificationPolicy: isReturned ? NotificationPolicy.NOTIFICATION_AND_SYNC : NotificationPolicy.SYNC_ONLY,
        payload: {
          taskId: task.id,
          instanceId: instance.id,
          action,
          decidedBy: actorId,
          fromNode: currentNode.id,
          toNode: nextNode.id,
          reason,
        },
      });

      // 12. Emit Audit Log
      this.eventEmitter.emit('audit.log', {
        action: `WORKFLOW_TASK_${action}`,
        entityId: task.id,
        entityName: 'workflow_tasks',
        userId: actorId,
        newValue: {
          instanceId: instance.id,
          action,
          fromNode: currentNode.id,
          toNode: nextNode.id,
        },
      });

      // 13. Emit real-time domain event for zero-refresh UI synchronization
      this.eventEmitter.emit('internal.workflow.task.completed', {
        taskId: task.id,
        instanceId: instance.id,
        action,
        decidedBy: actorId,
        fromNode: currentNode.id,
        toNode: nextNode.id,
        entityType: instance.entityType,
        entityId: instance.entityId,
      });

      return { task, instance };
    });
  }

  // 3. NODE PROGRESSION & CONDITION EVALUATION

  private async progressToNode(
    manager: EntityManager,
    instance: WorkflowInstance,
    graph: BpmnGraph,
    fromNode: BpmnNode,
    targetNode: BpmnNode,
    version: WorkflowVersion,
    action: string,
    actorId?: number,
    reason?: string,
  ): Promise<void> {
    const nodeType = (targetNode.data?.type || targetNode.type || '').toUpperCase();

    instance.currentNodeId = targetNode.id;

    if (nodeType === 'END') {
      // Workflow reached terminal node
      instance.status =
        action === 'REJECT'
          ? WorkflowInstanceStatus.REJECTED
          : WorkflowInstanceStatus.COMPLETED;
      instance.completedAt = new Date();
      instance.updatedBy = actorId;
      await manager.save(instance);

      // Synchronize business entity status on completion/termination
      await this.syncBusinessEntity(manager, instance, targetNode, action, actorId, reason);

      await this.recordTransition(manager, {
        instanceId: instance.id,
        fromNodeId: targetNode.id,
        toNodeId: 'TERMINAL',
        action: 'END',
        actorId,
        reason: `Workflow completed with status ${instance.status}`,
        versionId: version.id,
        contextSnapshot: instance.context,
      });

      await this.saveOutboxEvent(manager, {
        eventId: crypto.randomUUID(),
        eventName: 'workflow.instance.completed',
        eventVersion: 1,
        occurredAt: new Date().toISOString(),
        aggregateType: 'WORKFLOW_INSTANCE',
        aggregateId: instance.id,
        projectId: instance.entityType === 'PROJECT' ? Number(instance.entityId) : undefined,
        actor: actorId ? { userId: actorId } : undefined,
        routing: undefined, // NEEDS MORE EVIDENCE to accurately resolve PM/PMO without tight coupling to Project entity here
        notificationPolicy: NotificationPolicy.SYNC_ONLY,
        payload: {
          instanceId: instance.id,
          finalStatus: instance.status,
          completedAt: instance.completedAt,
        },
      });

      // Emit real-time domain event for zero-refresh UI synchronization
      this.eventEmitter.emit('internal.workflow.instance.completed', {
        instanceId: instance.id,
        entityType: instance.entityType,
        entityId: instance.entityId,
        finalStatus: instance.status,
      });

      return;
    }

    if (nodeType === 'CONDITION') {
      // Evaluate Condition Node expression and auto-route
      const conditionExpr = targetNode.data?.condition;
      let evaluatedCondition = false;
      if (conditionExpr) {
        evaluatedCondition = ConditionEvaluator.evaluate(
          conditionExpr,
          instance.context || {},
        );
      }

      // Find branch: TRUE branch or matching edge
      const outgoing = graph.edges.filter((e) => e.source === targetNode.id);
      if (outgoing.length === 0) {
        throw new BadRequestException(
          `Condition node '${targetNode.id}' has no outgoing branch edges.`,
        );
      }

      let selectedEdge: BpmnEdge | undefined;

      if (outgoing.length === 1) {
        selectedEdge = outgoing[0];
      } else {
        // Find edge with matching condition or label
        selectedEdge = outgoing.find((e) => {
          const edgeExpr = e.data?.condition || e.label;
          if (!edgeExpr) return false;
          if (edgeExpr.toUpperCase() === 'TRUE' && evaluatedCondition) return true;
          if (edgeExpr.toUpperCase() === 'FALSE' && !evaluatedCondition) return true;
          try {
            return ConditionEvaluator.evaluate(edgeExpr, instance.context || {});
          } catch {
            return false;
          }
        });

        // Default to first outgoing edge if no explicit match
        if (!selectedEdge) {
          selectedEdge = outgoing[0];
        }
      }

      const nextTarget = graph.nodes.find((n) => n.id === selectedEdge.target);
      if (!nextTarget) {
        throw new BadRequestException(
          `Target node '${selectedEdge.target}' for condition node not found.`,
        );
      }

      await this.recordTransition(manager, {
        instanceId: instance.id,
        fromNodeId: targetNode.id,
        toNodeId: nextTarget.id,
        action: 'CONDITION_EVALUATED',
        actorId,
        reason: `Condition evaluated: ${conditionExpr || 'Default'} -> Result: ${evaluatedCondition}`,
        versionId: version.id,
        contextSnapshot: instance.context,
      });

      // Recurse to next node
      await this.progressToNode(
        manager,
        instance,
        graph,
        targetNode,
        nextTarget,
        version,
        'AUTO',
        actorId,
        reason,
      );
      return;
    }

    // Default: User Task / Approval Node
    instance.status = WorkflowInstanceStatus.IN_PROGRESS;
    instance.updatedBy = actorId;
    await manager.save(instance);

    // Resolve Role ID if assigned
    const roleName = targetNode.data?.role || targetNode.data?.assigneeRole || targetNode.data?.assignedRole;
    let roleId: number | null = null;

    if (roleName) {
      const role = await manager.findOne(Role, { where: { name: roleName } });
      if (role) {
        roleId = role.id;
      } else {
        this.logger.warn(`Role '${roleName}' specified on node '${targetNode.id}' was not found in roles table.`);
      }
    }

    // Create pending WorkflowTask
    const task = manager.create(WorkflowTask, {
      workflowInstanceId: instance.id,
      nodeId: targetNode.id,
      taskKey: targetNode.data?.taskKey || targetNode.data?.label || targetNode.id,
      assigneeRoleId: roleId,
      assigneeUserId: targetNode.data?.assigneeUserId || null,
      status: WorkflowTaskStatus.PENDING,
      createdBy: actorId,
    });

    await manager.save(task);

    await this.saveOutboxEvent(manager, {
      eventId: crypto.randomUUID(),
      eventName: 'workflow.task.assigned',
      eventVersion: 1,
      occurredAt: new Date().toISOString(),
      aggregateType: 'WORKFLOW_TASK',
      aggregateId: task.id,
      projectId: instance.entityType === 'PROJECT' ? Number(instance.entityId) : undefined,
      actor: actorId ? { userId: actorId } : undefined,
      routing: {
        userIds: task.assigneeUserId ? [task.assigneeUserId] : [],
        roles: roleName ? [roleName] : [],
      },
      notificationPolicy: NotificationPolicy.NOTIFICATION_AND_SYNC,
      payload: {
        taskId: task.id,
        workflowInstanceId: instance.id,
        nodeId: targetNode.id,
        assignedRoleId: roleId,
        assignedUserId: task.assigneeUserId,
      },
    });

    // Synchronize business entity status on task creation
    await this.syncBusinessEntity(manager, instance, targetNode, action, actorId, reason);
  }

  // 4. BUSINESS ENTITY SYNCHRONIZATION

  private async syncBusinessEntity(
    manager: EntityManager,
    instance: WorkflowInstance,
    targetNode: BpmnNode,
    action: string,
    actorId?: number,
    reason?: string,
  ): Promise<void> {
    if (instance.entityType === 'PURCHASE_REQUEST' && instance.entityId) {
      const nodeType = (targetNode.data?.type || targetNode.type || '').toUpperCase();
      let newStatus: string | null = null;

      if (nodeType === 'END') {
        newStatus = action.toUpperCase() === 'REJECT' ? 'REJECTED' : 'APPROVED';
      } else if (targetNode.id === 'node_director_approval') {
        newStatus = 'DIRECTOR_APPROVAL';
      } else if (targetNode.id === 'node_procurement_revision') {
        newStatus = 'REJECTED_TO_PROCUREMENT';
      } else if (targetNode.id === 'node_finance_review') {
        newStatus = 'SUBMITTED';
      }

      if (newStatus) {
        // 1. Load current PurchaseRequest to capture old status
        const pr = await manager.findOne(PurchaseRequest, {
          where: { id: Number(instance.entityId) },
        });
        const oldStatus = pr ? pr.status : null;

        // 2. Update status as existing behavior
        await manager.update(
          PurchaseRequest,
          { id: Number(instance.entityId) },
          { status: newStatus },
        );

        // 3. Create canonical AuditLog for authoritative decision transitions
        if (
          newStatus === 'APPROVED' ||
          newStatus === 'REJECTED' ||
          newStatus === 'REJECTED_TO_PROCUREMENT'
        ) {
          const auditAction = newStatus === 'APPROVED' ? 'APPROVE' : 'REJECT';

          const audit = manager.create(AuditLog, {
            table_name: 'purchase_requests',
            record_id: Number(instance.entityId),
            action: auditAction,
            old_value: { status: oldStatus },
            new_value: {
              status: newStatus,
              prNumber: pr?.prNumber,
              decidedBy: actorId || null,
              reason: reason || null,
              workflowInstanceId: instance.id,
              targetNodeId: targetNode.id,
            },
            created_by: actorId ? Number(actorId) : null,
          });

          await manager.save(AuditLog, audit);
        }
      }
    } else if (instance.entityType === 'PROJECT' && instance.entityId) {
      const nodeType = (targetNode.data?.type || targetNode.type || '').toUpperCase();
      let newStatus: string | null = null;

      if (nodeType === 'END') {
        newStatus = action.toUpperCase() === 'REJECT' ? 'REJECTED' : 'READY_FOR_KICKOFF';
      } else if (targetNode.id.startsWith('node_pm_revision')) {
        newStatus = 'NEEDS_REVISION';
      } else {
        newStatus = 'REVIEW_PENDING';
      }

      if (newStatus) {
        let review = await manager.findOne(ProjectManagementReview, {
          where: { projectId: Number(instance.entityId) },
        });
        const oldStatus = review ? review.status : null;

        if (review) {
          review.status = newStatus;
          if (newStatus === 'READY_FOR_KICKOFF' || newStatus === 'REJECTED') {
            review.decidedBy = actorId ? Number(actorId) : null;
            review.decidedAt = new Date();
            review.reviewerRole = targetNode.data?.role || 'DIRECTOR';
          } else if (newStatus === 'NEEDS_REVISION') {
            review.decidedBy = actorId ? Number(actorId) : null;
            review.decidedAt = new Date();
            review.reviewerRole = targetNode.data?.role || null;
            review.revisionNotes = reason || null;
          }
          review.updatedBy = actorId ? Number(actorId) : null;
          await manager.save(ProjectManagementReview, review);
        } else {
          review = manager.create(ProjectManagementReview, {
            projectId: Number(instance.entityId),
            status: newStatus,
            decidedBy: (newStatus === 'READY_FOR_KICKOFF' || newStatus === 'REJECTED') && actorId ? Number(actorId) : null,
            decidedAt: (newStatus === 'READY_FOR_KICKOFF' || newStatus === 'REJECTED') ? new Date() : null,
            reviewerRole: (newStatus === 'READY_FOR_KICKOFF' || newStatus === 'REJECTED') ? (targetNode.data?.role || 'DIRECTOR') : null,
            revisionNotes: newStatus === 'NEEDS_REVISION' ? (reason || null) : null,
            createdBy: actorId ? Number(actorId) : null,
            updatedBy: actorId ? Number(actorId) : null,
          });
          await manager.save(ProjectManagementReview, review);
        }

        if (
          newStatus === 'READY_FOR_KICKOFF' ||
          newStatus === 'REJECTED' ||
          newStatus === 'NEEDS_REVISION'
        ) {
          const auditAction =
            newStatus === 'READY_FOR_KICKOFF'
              ? 'APPROVE'
              : newStatus === 'NEEDS_REVISION'
              ? 'RETURN'
              : 'REJECT';

          const audit = manager.create(AuditLog, {
            table_name: 'project_management_reviews',
            record_id: Number(instance.entityId),
            action: auditAction,
            old_value: { status: oldStatus },
            new_value: {
              status: newStatus,
              decidedBy: actorId || null,
              reason: reason || null,
              workflowInstanceId: instance.id,
              targetNodeId: targetNode.id,
            },
            created_by: actorId ? Number(actorId) : null,
          });

          await manager.save(AuditLog, audit);
        }
      }
    }
  }

  // 4. TRANSITION RESOLUTION & HELPERS

  private resolveNextNode(
    graph: BpmnGraph,
    currentNode: BpmnNode,
    action: string,
    context: Record<string, any>,
  ): BpmnNode {
    const outgoing = graph.edges.filter((e) => e.source === currentNode.id);
    if (outgoing.length === 0) {
      throw new BadRequestException(
        `Current node '${currentNode.id}' has no outgoing transitions.`,
      );
    }

    const upperAction = action.toUpperCase();

    // 1. Exact match by edge label or edge action (e.g. 'APPROVE', 'RETURN', 'REJECT', 'RESUBMIT')
    let matchedEdge = outgoing.find(
      (e) =>
        (e.label && e.label.toUpperCase() === upperAction) ||
        (e.data?.action && e.data.action.toUpperCase() === upperAction),
    );

    // 2. Strict semantic aliases (PASS -> APPROVE, REJECT <-> RETURN). NEVER ALIAS RESUBMIT = APPROVE.
    if (!matchedEdge) {
      if (upperAction === 'PASS') {
        matchedEdge = outgoing.find((e) => (e.label || e.data?.action || '').toUpperCase() === 'APPROVE');
      } else if (upperAction === 'REJECT') {
        matchedEdge = outgoing.find((e) => (e.label || e.data?.action || '').toUpperCase() === 'RETURN');
      } else if (upperAction === 'RETURN') {
        matchedEdge = outgoing.find((e) => (e.label || e.data?.action || '').toUpperCase() === 'REJECT');
      }
    }

    // 3. Look for condition on edge (GATEWAY / CONDITION evaluation)
    if (!matchedEdge) {
      matchedEdge = outgoing.find((e) => {
        const cond = e.data?.condition;
        if (!cond) return false;
        try {
          return ConditionEvaluator.evaluate(cond, context);
        } catch {
          return false;
        }
      });
    }

    // 4. If outgoing has only 1 edge without explicit label (e.g. START node default step)
    if (!matchedEdge && outgoing.length === 1 && !outgoing[0].label && !outgoing[0].data?.action) {
      matchedEdge = outgoing[0];
    }

    if (!matchedEdge) {
      throw new BadRequestException(
        `No valid transition found from node '${currentNode.id}' matching action '${action}'.`,
      );
    }

    const nextNode = graph.nodes.find((n) => n.id === matchedEdge.target);
    if (!nextNode) {
      throw new BadRequestException(
        `Destination node '${matchedEdge.target}' connected from '${currentNode.id}' was not found.`,
      );
    }

    return nextNode;
  }

  private validateActorAuthorization(
    task: WorkflowTask,
    actorId: number,
    actorRoles: string[],
  ): void {
    // Super admin can always perform any action
    if (actorRoles.includes('SUPER_ADMIN')) {
      return;
    }

    // If specific user assigned
    if (task.assigneeUserId && task.assigneeUserId === actorId) {
      return;
    }

    // If role assigned
    if (task.assigneeRole && actorRoles.includes(task.assigneeRole.name)) {
      return;
    }

    // If no specific assignment on task, default to authorized
    if (!task.assigneeRoleId && !task.assigneeUserId) {
      return;
    }

    throw new ForbiddenException(
      `User #${actorId} (Roles: [${actorRoles.join(', ')}]) is not authorized to complete Task #${task.id} (Required Role: ${task.assigneeRole?.name || 'User #' + task.assigneeUserId}).`,
    );
  }

  private async recordTransition(
    manager: EntityManager,
    data: {
      instanceId: number;
      taskId?: number;
      fromNodeId: string;
      toNodeId: string;
      action: string;
      actorId?: number;
      reason?: string;
      versionId: number;
      contextSnapshot?: any;
    },
  ): Promise<WorkflowTransition> {
    const transition = manager.create(WorkflowTransition, {
      instanceId: data.instanceId,
      taskId: data.taskId || null,
      fromNodeId: data.fromNodeId,
      toNodeId: data.toNodeId,
      action: data.action,
      actorId: data.actorId || null,
      reason: data.reason || null,
      versionId: data.versionId,
      contextSnapshot: data.contextSnapshot || null,
    });
    return manager.save(transition);
  }

  private async saveOutboxEvent(
    manager: EntityManager,
    eventData: BusinessEvent<any>,
  ): Promise<OutboxEvent> {
    const event = manager.create(OutboxEvent, {
      event_id: eventData.eventId,
      event_name: eventData.eventName,
      event_version: String(eventData.eventVersion),
      aggregate_type: eventData.aggregateType,
      aggregate_id: Number(eventData.aggregateId),
      correlation_id: eventData.correlationId || null,
      payload: {
        occurredAt: eventData.occurredAt,
        projectId: eventData.projectId,
        actor: eventData.actor,
        routing: eventData.routing,
        notificationPolicy: eventData.notificationPolicy,
        businessPayload: eventData.payload,
      },
      status: OutboxStatus.PENDING,
      retry_count: 0,
    });
    return manager.save(event);
  }

  // 5. GRAPH PARSER & VALIDATION

  private parseGraph(bpmnJson: any): BpmnGraph {
    if (!bpmnJson) {
      throw new BadRequestException('Workflow definition JSON is missing.');
    }

    const nodes: BpmnNode[] = Array.isArray(bpmnJson.nodes) ? bpmnJson.nodes : [];
    const edges: BpmnEdge[] = Array.isArray(bpmnJson.edges) ? bpmnJson.edges : [];

    return { nodes, edges };
  }

  private validateGraph(graph: BpmnGraph): void {
    const { nodes, edges } = graph;

    if (nodes.length === 0) {
      throw new BadRequestException('Workflow graph contains no nodes.');
    }

    const startNodes = nodes.filter(
      (n) => (n.data?.type || n.type || '').toUpperCase() === 'START',
    );
    if (startNodes.length !== 1) {
      throw new BadRequestException(
        `Workflow must have exactly one START node. Found: ${startNodes.length}`,
      );
    }

    const endNodes = nodes.filter(
      (n) => (n.data?.type || n.type || '').toUpperCase() === 'END',
    );
    if (endNodes.length < 1) {
      throw new BadRequestException(
        `Workflow must have at least one END node. Found: ${endNodes.length}`,
      );
    }

    // Verify END is reachable from START (no disconnected components)
    const reachable = new Set<string>();
    const queue = [startNodes[0].id];
    reachable.add(startNodes[0].id);

    while (queue.length > 0) {
      const curr = queue.shift()!;
      const outgoing = edges.filter((e) => e.source === curr);
      for (const edge of outgoing) {
        if (!reachable.has(edge.target)) {
          reachable.add(edge.target);
          queue.push(edge.target);
        }
      }
    }

    const hasReachableEnd = endNodes.some((en) => reachable.has(en.id));
    if (!hasReachableEnd) {
      throw new BadRequestException(
        'Invalid workflow graph: No END node is reachable from the START node.',
      );
    }
  }

  // 6. QUERY METHODS

  async getInstance(id: number): Promise<WorkflowInstance> {
    const instance = await this.instanceRepo.findOne({
      where: { id },
      relations: [
        'workflowDefinition',
        'workflowVersion',
        'tasks',
        'tasks.assigneeRole',
        'tasks.decidedByUser',
        'transitions',
      ],
    });

    if (!instance) {
      throw new NotFoundException(`Workflow instance #${id} not found.`);
    }

    return instance;
  }

  async getMyTasks(
    userId: number,
    roles: string[] = [],
  ): Promise<WorkflowTask[]> {
    const query = this.taskRepo
      .createQueryBuilder('task')
      .leftJoinAndSelect('task.workflowInstance', 'instance')
      .leftJoinAndSelect('instance.workflowDefinition', 'definition')
      .leftJoinAndSelect('task.assigneeRole', 'role')
      .where('task.status = :status', { status: WorkflowTaskStatus.PENDING });

    if (!roles.includes('SUPER_ADMIN')) {
      query.andWhere(
        '(task.assignee_user_id = :userId OR role.name IN (:...roles) OR (task.assignee_role_id IS NULL AND task.assignee_user_id IS NULL))',
        { userId, roles: roles.length > 0 ? roles : ['__NONE__'] },
      );
    }

    return query.orderBy('task.createdAt', 'DESC').getMany();
  }

  async getTransitions(instanceId: number): Promise<WorkflowTransition[]> {
    return this.transitionRepo.find({
      where: { instanceId },
      relations: ['actor'],
      order: { createdAt: 'ASC' },
    });
  }

  async getInstanceByEntity(
    entityType: string,
    entityId: string | number,
  ): Promise<WorkflowInstance | null> {
    if (entityType !== 'PURCHASE_REQUEST' && entityType !== 'PROJECT') {
      throw new BadRequestException(
        `Unsupported entityType: '${entityType}'. Supported types are 'PURCHASE_REQUEST' and 'PROJECT'.`,
      );
    }

    const relations = [
      'tasks',
      'tasks.assigneeRole',
      'transitions',
      'transitions.actor',
      'workflowDefinition',
      'workflowVersion',
    ];

    // 1. Check for active IN_PROGRESS instance first
    const activeInstance = await this.instanceRepo.findOne({
      where: {
        entityType,
        entityId: Number(entityId),
        status: WorkflowInstanceStatus.IN_PROGRESS,
      },
      relations,
      order: { id: 'DESC' },
    });

    if (activeInstance) {
      return activeInstance;
    }

    // 2. If no active instance, return latest workflow instance for this entity
    return this.instanceRepo.findOne({
      where: {
        entityType,
        entityId: Number(entityId),
      },
      relations,
      order: { id: 'DESC' },
    });
  }
}
