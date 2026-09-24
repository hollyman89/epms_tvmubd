import {
  Injectable,
  ConflictException,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  OnModuleInit,
  Logger,
  Optional,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import { EventEmitter2 } from '@nestjs/event-emitter';
import { WorkflowDefinition } from '../../entities/workflow-definition.entity';
import { WorkflowVersion } from '../../entities/workflow-version.entity';
import {
  WorkflowInstance,
  WorkflowInstanceStatus,
} from '../../entities/workflow-instance.entity';
import { WorkflowTask } from '../../entities/workflow-task.entity';
import { WorkflowTransition } from '../../entities/workflow-transition.entity';
import { AuditLog } from '../../entities/audit-log.entity';
import {
  CreateWorkflowDefinitionDto,
  CreateWorkflowVersionDto,
} from './dto/workflow-definition.dto';

export const PROTECTED_CANONICAL_WORKFLOW_KEYS = Object.freeze([
  'PROJECT_PLAN_REVIEW_WORKFLOW',
  'PURCHASE_REQUEST_WORKFLOW',
]);

@Injectable()
export class WorkflowDefinitionService implements OnModuleInit {
  private readonly logger = new Logger(WorkflowDefinitionService.name);

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
    private readonly dataSource: DataSource,
    @Optional()
    private readonly eventEmitter?: EventEmitter2,
  ) {}

  async onModuleInit() {
    await this.ensureProjectGovernanceWorkflow();
  }

  async createDefinition(dto: CreateWorkflowDefinitionDto, userId?: number): Promise<WorkflowDefinition> {
    const existing = await this.definitionRepo.findOne({ where: { workflowKey: dto.workflowKey } });
    if (existing) {
      throw new ConflictException(`Workflow key '${dto.workflowKey}' already exists.`);
    }

    return this.dataSource.transaction(async (manager) => {
      const def = manager.create(WorkflowDefinition, {
        workflowKey: dto.workflowKey,
        name: dto.name,
        description: dto.description,
        domain: dto.domain,
        status: 'DRAFT',
        createdBy: userId,
      });
      const savedDef = await manager.save(def);

      const v1 = manager.create(WorkflowVersion, {
        workflowDefinitionId: savedDef.id,
        version: 1,
        bpmnJson: {}, // Empty JSON for draft by default
        status: 'DRAFT',
        createdBy: userId,
      });
      await manager.save(v1);

      return savedDef;
    });
  }

  async getDefinitions(includeArchived: boolean = false): Promise<WorkflowDefinition[]> {
    if (includeArchived) {
      return this.definitionRepo.find({
        relations: ['versions'],
        order: { createdAt: 'DESC' },
      });
    }

    return this.definitionRepo
      .createQueryBuilder('def')
      .leftJoinAndSelect('def.versions', 'versions')
      .where('def.status != :archivedStatus', { archivedStatus: 'ARCHIVED' })
      .andWhere('(def.isActive = 1 OR def.isActive IS NULL)')
      .orderBy('def.createdAt', 'DESC')
      .getMany();
  }

  async getDefinition(keyOrId: string | number): Promise<WorkflowDefinition> {
    const isNumeric =
      typeof keyOrId === 'number' || (typeof keyOrId === 'string' && /^\d+$/.test(keyOrId));
    let def: WorkflowDefinition | null = null;
    if (isNumeric) {
      def = await this.definitionRepo.findOne({
        where: [{ id: Number(keyOrId) }, { workflowKey: String(keyOrId) }],
        relations: ['versions'],
      });
    } else {
      def = await this.definitionRepo.findOne({
        where: { workflowKey: String(keyOrId) },
        relations: ['versions'],
      });
    }
    if (!def) {
      throw new NotFoundException(`Workflow definition '${keyOrId}' not found.`);
    }
    return def;
  }

  async getDefinitionByKey(workflowKey: string): Promise<WorkflowDefinition> {
    return this.getDefinition(workflowKey);
  }

  async createVersion(workflowKey: string, dto?: CreateWorkflowVersionDto, userId?: number): Promise<WorkflowVersion> {
    const def = await this.getDefinitionByKey(workflowKey);

    if (PROTECTED_CANONICAL_WORKFLOW_KEYS.includes(def.workflowKey)) {
      throw new ForbiddenException(
        `Canonical workflow '${def.workflowKey}' is protected and its version lifecycle cannot be modified.`,
      );
    }

    if (def.status === 'ARCHIVED' || def.isActive === 0) {
      throw new BadRequestException(
        `Cannot create a new version for archived or inactive workflow '${workflowKey}'.`,
      );
    }
    
    // Find the latest version number
    const maxVersion = def.versions.reduce((max, v) => (v.version > max ? v.version : max), 0);
    const newVersionNumber = maxVersion + 1;

    // Clone JSON from active version, latest version, or use provided DTO
    let bpmnJson = {};
    if (dto && dto.bpmnJson) {
      bpmnJson = dto.bpmnJson;
    } else {
      const latestOrActive = def.versions.find((v) => v.version === (def.activeVersion || maxVersion));
      if (latestOrActive) {
        bpmnJson = latestOrActive.bpmnJson;
      }
    }

    const newVersion = this.versionRepo.create({
      workflowDefinitionId: def.id,
      version: newVersionNumber,
      bpmnJson,
      status: 'DRAFT',
      createdBy: userId,
    });

    return this.versionRepo.save(newVersion);
  }

  async getVersions(workflowKey: string): Promise<WorkflowVersion[]> {
    const def = await this.getDefinitionByKey(workflowKey);
    return def.versions;
  }

  async getVersion(workflowKey: string, versionNumber: number): Promise<WorkflowVersion> {
    const def = await this.getDefinitionByKey(workflowKey);
    const v = def.versions.find((v) => v.version === versionNumber);
    if (!v) {
      throw new NotFoundException(`Version ${versionNumber} not found for workflow '${workflowKey}'.`);
    }
    return v;
  }

  async updateVersion(workflowKey: string, versionNumber: number, bpmnJson: any, userId?: number): Promise<WorkflowVersion> {
    const def = await this.getDefinitionByKey(workflowKey);

    if (PROTECTED_CANONICAL_WORKFLOW_KEYS.includes(def.workflowKey)) {
      throw new ForbiddenException(
        `Canonical workflow '${def.workflowKey}' is protected and its version lifecycle cannot be modified.`,
      );
    }

    if (def.status === 'ARCHIVED' || def.isActive === 0) {
      throw new BadRequestException(
        `Cannot update version for archived or inactive workflow '${workflowKey}'.`,
      );
    }

    const version = await this.getVersion(workflowKey, versionNumber);
    
    if (version.status === 'PUBLISHED') {
      throw new BadRequestException(`Cannot edit version ${versionNumber} because it is already PUBLISHED (immutable).`);
    }

    version.bpmnJson = bpmnJson;
    version.updatedBy = userId;
    return this.versionRepo.save(version);
  }

  async publishVersion(workflowKey: string, versionNumber: number, userId?: number): Promise<WorkflowVersion> {
    const def = await this.getDefinitionByKey(workflowKey);

    if (PROTECTED_CANONICAL_WORKFLOW_KEYS.includes(def.workflowKey)) {
      throw new ForbiddenException(
        `Canonical workflow '${def.workflowKey}' is protected and its version lifecycle cannot be modified.`,
      );
    }

    if (def.status === 'ARCHIVED' || def.isActive === 0) {
      throw new BadRequestException(
        `Cannot publish version for archived or inactive workflow '${workflowKey}'.`,
      );
    }

    const version = def.versions.find((v) => v.version === versionNumber);
    
    if (!version) {
      throw new NotFoundException(`Version ${versionNumber} not found for workflow '${workflowKey}'.`);
    }

    if (version.status === 'PUBLISHED') {
      throw new BadRequestException(`Version ${versionNumber} is already PUBLISHED.`);
    }

    return this.dataSource.transaction(async (manager) => {
      // Set version to PUBLISHED
      version.status = 'PUBLISHED';
      version.publishedAt = new Date();
      version.updatedBy = userId;
      const savedVersion = await manager.save(version);

      // Update Definition pointer
      def.activeVersion = version.version;
      def.status = 'PUBLISHED';
      def.updatedBy = userId;
      await manager.save(def);

      return savedVersion;
    });
  }

  async deleteDefinition(
    keyOrId: string | number,
    userId?: number,
  ): Promise<{ id: number; workflowKey: string; deleted: boolean }> {
    const def = await this.getDefinition(keyOrId);

    // 1. Canonical protection
    if (PROTECTED_CANONICAL_WORKFLOW_KEYS.includes(def.workflowKey)) {
      throw new ForbiddenException(
        `Canonical workflow '${def.workflowKey}' is protected and cannot be deleted.`,
      );
    }

    // 2. Only DRAFT status allowed
    if (def.status !== 'DRAFT') {
      throw new ConflictException(
        `Workflow '${def.workflowKey}' cannot be deleted because its status is '${def.status}' (only DRAFT workflows can be deleted).`,
      );
    }

    // 3. Reject if active version exists
    if (def.activeVersion !== null && def.activeVersion !== undefined) {
      throw new ConflictException(
        `Workflow '${def.workflowKey}' cannot be deleted because it has an active published version (${def.activeVersion}).`,
      );
    }

    // 4. Reject if any version is PUBLISHED
    const hasPublishedVersion = (def.versions || []).some(
      (v) => v.status === 'PUBLISHED' || v.publishedAt !== null,
    );
    if (hasPublishedVersion) {
      throw new ConflictException(
        `Workflow '${def.workflowKey}' cannot be deleted because it contains published version(s).`,
      );
    }

    // 5. Check workflow_instances (including soft-deleted)
    const instanceCount = await this.instanceRepo
      .createQueryBuilder('wi')
      .withDeleted()
      .where('wi.workflowDefinitionId = :defId', { defId: def.id })
      .getCount();
    if (instanceCount > 0) {
      throw new ConflictException(
        `Workflow '${def.workflowKey}' cannot be deleted because it has execution history (${instanceCount} instance(s) found).`,
      );
    }

    // 6. Check workflow_tasks
    const taskCount = await this.taskRepo
      .createQueryBuilder('task')
      .innerJoin('task.workflowInstance', 'wi')
      .where('wi.workflowDefinitionId = :defId', { defId: def.id })
      .getCount();
    if (taskCount > 0) {
      throw new ConflictException(
        `Workflow '${def.workflowKey}' cannot be deleted because ${taskCount} workflow task(s) exist for it.`,
      );
    }

    // 7. Check workflow_transitions
    const versionIds = (def.versions || []).map((v) => v.id);
    if (versionIds.length > 0) {
      const transitionCount = await this.transitionRepo.count({
        where: { versionId: In(versionIds) },
      });
      if (transitionCount > 0) {
        throw new ConflictException(
          `Workflow '${def.workflowKey}' cannot be deleted because ${transitionCount} workflow transition(s) exist for its versions.`,
        );
      }
    }

    // 8. Transactional deletion
    await this.dataSource.transaction(async (manager) => {
      // Delete parent definition (DB foreign key constraint fk_wv_definition ON DELETE CASCADE handles versions)
      await manager.delete(WorkflowDefinition, { id: def.id });

      // Record AuditLog
      const audit = manager.create(AuditLog, {
        table_name: 'workflow_definitions',
        record_id: Number(def.id),
        action: 'DELETE',
        old_value: {
          workflowKey: def.workflowKey,
          name: def.name,
          domain: def.domain,
          status: def.status,
        },
        new_value: null,
        created_by: userId ? Number(userId) : null,
      });
      await manager.save(AuditLog, audit);
    });

    // Emit audit event
    this.eventEmitter?.emit('audit.log', {
      action: 'WORKFLOW_DEFINITION_DELETED',
      entityId: def.id,
      entityName: 'workflow_definitions',
      userId,
      oldValue: {
        workflowKey: def.workflowKey,
        name: def.name,
      },
    });

    return {
      id: def.id,
      workflowKey: def.workflowKey,
      deleted: true,
    };
  }

  async archiveDefinition(
    keyOrId: string | number,
    userId?: number,
  ): Promise<WorkflowDefinition> {
    const def = await this.getDefinition(keyOrId);

    // 1. Canonical protection
    if (PROTECTED_CANONICAL_WORKFLOW_KEYS.includes(def.workflowKey)) {
      throw new ForbiddenException(
        `Canonical workflow '${def.workflowKey}' is protected and cannot be archived.`,
      );
    }

    // 2. Already archived check
    if (def.status === 'ARCHIVED' && (def.isActive === 0 || (def.isActive as any) === false)) {
      throw new ConflictException(
        `Workflow '${def.workflowKey}' is already archived.`,
      );
    }

    // 3. Active instances check (IN_PROGRESS)
    const activeInstanceCount = await this.instanceRepo.count({
      where: {
        workflowDefinitionId: def.id,
        status: WorkflowInstanceStatus.IN_PROGRESS,
      },
    });
    if (activeInstanceCount > 0) {
      throw new ConflictException(
        `Workflow '${def.workflowKey}' cannot be archived because it has ${activeInstanceCount} active (IN_PROGRESS) instance(s).`,
      );
    }

    const previousStatus = def.status;
    const previousIsActive = def.isActive;

    // 4. Transactional update & audit logging
    const saved = await this.dataSource.transaction(async (manager) => {
      def.status = 'ARCHIVED';
      def.isActive = 0;
      def.updatedBy = userId;
      const updated = await manager.save(WorkflowDefinition, def);

      const audit = manager.create(AuditLog, {
        table_name: 'workflow_definitions',
        record_id: Number(def.id),
        action: 'ARCHIVE',
        old_value: { status: previousStatus, isActive: previousIsActive },
        new_value: { status: 'ARCHIVED', isActive: 0 },
        created_by: userId ? Number(userId) : null,
      });
      await manager.save(AuditLog, audit);

      return updated;
    });

    this.eventEmitter?.emit('audit.log', {
      action: 'WORKFLOW_DEFINITION_ARCHIVED',
      entityId: def.id,
      entityName: 'workflow_definitions',
      userId,
      oldValue: { status: previousStatus, isActive: previousIsActive },
      newValue: { status: 'ARCHIVED', isActive: 0 },
    });

    return saved;
  }

  async ensureProjectGovernanceWorkflow(): Promise<WorkflowDefinition | null> {
    try {
      const existing = await this.definitionRepo.findOne({
        where: { workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW' },
        relations: ['versions'],
      });

      if (existing && existing.activeVersion && existing.status === 'PUBLISHED') {
        return existing;
      }

      const bpmnJson = {
        nodes: [
          {
            id: 'node_start',
            type: 'customNode',
            position: { x: 100, y: 200 },
            data: { role: 'PROJECT_MANAGER', type: 'START', label: 'PM Submit Plan' },
          },
          {
            id: 'node_hops_review',
            type: 'customNode',
            position: { x: 300, y: 200 },
            data: { role: 'HEAD_OF_OPERATIONS', type: 'TASK', label: 'Head of Operations Review' },
          },
          {
            id: 'node_procurement_review',
            type: 'customNode',
            position: { x: 550, y: 200 },
            data: { role: 'PROCUREMENT', type: 'TASK', label: 'Procurement Plan Review' },
          },
          {
            id: 'node_finance_review',
            type: 'customNode',
            position: { x: 800, y: 200 },
            data: { role: 'FINANCE', type: 'TASK', label: 'Finance Plan Review' },
          },
          {
            id: 'node_director_approval',
            type: 'customNode',
            position: { x: 1050, y: 200 },
            data: { role: 'DIRECTOR', type: 'TASK', label: 'Director Final Approval' },
          },
          {
            id: 'node_pm_revision_hops',
            type: 'customNode',
            position: { x: 300, y: 380 },
            data: { role: 'PROJECT_MANAGER', type: 'TASK', label: 'PM Plan Revision (HOPS)' },
          },
          {
            id: 'node_pm_revision_procurement',
            type: 'customNode',
            position: { x: 550, y: 380 },
            data: { role: 'PROJECT_MANAGER', type: 'TASK', label: 'PM Plan Revision (Procurement)' },
          },
          {
            id: 'node_pm_revision_finance',
            type: 'customNode',
            position: { x: 800, y: 380 },
            data: { role: 'PROJECT_MANAGER', type: 'TASK', label: 'PM Plan Revision (Finance)' },
          },
          {
            id: 'node_pm_revision_director',
            type: 'customNode',
            position: { x: 1050, y: 380 },
            data: { role: 'PROJECT_MANAGER', type: 'TASK', label: 'PM Plan Revision (Director)' },
          },
          {
            id: 'node_end',
            type: 'customNode',
            position: { x: 1300, y: 200 },
            data: { type: 'END', label: 'Ready for Kickoff' },
          },
        ],
        edges: [
          { id: 'e_start_to_hops', source: 'node_start', target: 'node_hops_review' },
          { id: 'e_hops_to_proc', source: 'node_hops_review', target: 'node_procurement_review', label: 'APPROVE' },
          { id: 'e_hops_to_rev', source: 'node_hops_review', target: 'node_pm_revision_hops', label: 'RETURN' },
          { id: 'e_rev_hops_to_hops', source: 'node_pm_revision_hops', target: 'node_hops_review', label: 'RESUBMIT' },
          { id: 'e_proc_to_fin', source: 'node_procurement_review', target: 'node_finance_review', label: 'APPROVE' },
          { id: 'e_proc_to_rev', source: 'node_procurement_review', target: 'node_pm_revision_procurement', label: 'RETURN' },
          { id: 'e_rev_proc_to_proc', source: 'node_pm_revision_procurement', target: 'node_procurement_review', label: 'RESUBMIT' },
          { id: 'e_fin_to_dir', source: 'node_finance_review', target: 'node_director_approval', label: 'APPROVE' },
          { id: 'e_fin_to_rev', source: 'node_finance_review', target: 'node_pm_revision_finance', label: 'RETURN' },
          { id: 'e_rev_fin_to_fin', source: 'node_pm_revision_finance', target: 'node_finance_review', label: 'RESUBMIT' },
          { id: 'e_dir_to_end', source: 'node_director_approval', target: 'node_end', label: 'APPROVE' },
          { id: 'e_dir_to_rev', source: 'node_director_approval', target: 'node_pm_revision_director', label: 'RETURN' },
          { id: 'e_rev_dir_to_dir', source: 'node_pm_revision_director', target: 'node_director_approval', label: 'RESUBMIT' },
        ],
      };

      if (!existing) {
        await this.createDefinition({
          workflowKey: 'PROJECT_PLAN_REVIEW_WORKFLOW',
          name: 'Project Plan Review Workflow',
          description: 'Canonical Project Governance Review Flow (HOPS -> Procurement -> Finance -> Director -> Ready for Kickoff)',
          domain: 'PROJECT',
        });
        await this.updateVersion('PROJECT_PLAN_REVIEW_WORKFLOW', 1, bpmnJson);
        await this.publishVersion('PROJECT_PLAN_REVIEW_WORKFLOW', 1);
        this.logger.log('Successfully registered and published PROJECT_PLAN_REVIEW_WORKFLOW v1.');
        return await this.getDefinitionByKey('PROJECT_PLAN_REVIEW_WORKFLOW');
      } else {
        let v1 = existing.versions?.find((v) => v.version === 1);
        if (!v1) {
          v1 = await this.createVersion('PROJECT_PLAN_REVIEW_WORKFLOW', { bpmnJson });
        } else if (v1.status !== 'PUBLISHED') {
          await this.updateVersion('PROJECT_PLAN_REVIEW_WORKFLOW', 1, bpmnJson);
        }
        if (v1.status !== 'PUBLISHED') {
          await this.publishVersion('PROJECT_PLAN_REVIEW_WORKFLOW', 1);
          return await this.getDefinitionByKey('PROJECT_PLAN_REVIEW_WORKFLOW');
        }
        return existing;
      }
    } catch (err) {
      this.logger.warn(`ensureProjectGovernanceWorkflow warning: ${err.message}`);
      return null;
    }
  }
}
