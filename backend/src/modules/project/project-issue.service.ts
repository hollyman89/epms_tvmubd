import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException,
  ConflictException,
} from "@nestjs/common";
import { InjectRepository } from "@nestjs/typeorm";
import { Repository, DataSource, Like } from "typeorm";
import { randomUUID } from "node:crypto";
import {
  ProjectIssue,
  ProjectIssueStatus,
} from "../../entities/project-issue.entity";
import { Project } from "../../entities/project.entity";
import { Task } from "../../entities/task.entity";
import { User } from "../../entities/user.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { OutboxEvent, OutboxStatus } from "../../entities/outbox-event.entity";
import { CreateProjectIssueDto } from "./dto/create-project-issue.dto";
import { UpdateProjectIssueDto } from "./dto/update-project-issue.dto";
import { ResolveProjectIssueDto } from "./dto/resolve-project-issue.dto";
import { ReopenProjectIssueDto } from "./dto/reopen-project-issue.dto";
import { CancelProjectIssueDto } from "./dto/cancel-project-issue.dto";
import { TransitionVersionDto } from "./dto/transition-version.dto";
import { QueryProjectIssueDto } from "./dto/query-project-issue.dto";

const OWNER_ELIGIBLE_ROLES = [
  "PROJECT_MANAGER",
  "PMO",
  "HEAD_OF_OPERATIONS",
  "PROCUREMENT",
  "PURCHASING",
  "FINANCE",
  "LEGAL",
  "MARKETING",
  "MANAGER",
  "GENERAL_MANAGER",
];

@Injectable()
export class ProjectIssueService {
  private readonly logger = new Logger(ProjectIssueService.name);

  constructor(
    @InjectRepository(ProjectIssue)
    private readonly issueRepo: Repository<ProjectIssue>,
    @InjectRepository(Project)
    private readonly projectRepo: Repository<Project>,
    @InjectRepository(Task)
    private readonly taskRepo: Repository<Task>,
    @InjectRepository(User)
    private readonly userRepo: Repository<User>,
    @InjectRepository(AuditLog)
    private readonly auditLogRepo: Repository<AuditLog>,
    @InjectRepository(OutboxEvent)
    private readonly outboxRepo: Repository<OutboxEvent>,
    private readonly dataSource: DataSource,
  ) {}

  // -------------------------------------------------------------
  // RBAC & PROJECT SCOPE HELPERS
  // -------------------------------------------------------------
  public async getVerifiedProject(
    projectId: number,
    ensureNotClosed = false,
  ): Promise<Project> {
    const project = await this.projectRepo.findOne({
      where: { id: projectId },
    });
    if (!project) {
      throw new NotFoundException(`Proyek #${projectId} tidak ditemukan`);
    }
    if (ensureNotClosed && project.status === "CLOSED") {
      throw new ConflictException(
        `Proyek #${projectId} telah ditutup (CLOSED). Mutasi issue tidak diizinkan.`,
      );
    }
    return project;
  }

  public validateProjectAccess(
    project: Project,
    userId: number,
    roles: string[],
    allowPortfolioRoles = true,
  ): void {
    const isPortfolio = roles.some((r) =>
      [
        "PMO",
        "HEAD_OF_OPERATIONS",
        "DIRECTOR",
        "ADMIN",
        "SUPER_ADMIN",
      ].includes(r),
    );
    if (allowPortfolioRoles && isPortfolio) {
      return;
    }

    const isPm = roles.includes("PROJECT_MANAGER");
    if (isPm) {
      if (Number(project.managerId) !== Number(userId)) {
        throw new ForbiddenException(
          "Akses ditolak: Anda bukan Project Manager yang ditugaskan pada proyek ini.",
        );
      }
      return;
    }

    const hasOperationalRole = roles.some((r) =>
      OWNER_ELIGIBLE_ROLES.includes(r),
    );
    if (!hasOperationalRole) {
      throw new ForbiddenException(
        "Akses ditolak: Anda tidak memiliki wewenang untuk mengakses proyek ini.",
      );
    }
  }

  public async validateOwnerUser(ownerId: number): Promise<User> {
    const user = await this.userRepo.findOne({
      where: { id: ownerId, isActive: true },
      relations: ["roles"],
    });
    if (!user) {
      throw new BadRequestException(
        `Pengguna #${ownerId} tidak aktif atau tidak ditemukan.`,
      );
    }

    const userRoles = (user.roles || []).map((r) => r.name);
    const hasEligibleRole = userRoles.some((r) =>
      OWNER_ELIGIBLE_ROLES.includes(r),
    );
    if (!hasEligibleRole) {
      throw new BadRequestException(
        `Pengguna #${ownerId} tidak memiliki peran yang berhak menjadi Owner (Eligible: ${OWNER_ELIGIBLE_ROLES.join(", ")}).`,
      );
    }
    return user;
  }

  public async validateTaskBelongsToProject(
    taskId: number,
    projectId: number,
  ): Promise<Task> {
    const task = await this.taskRepo.findOne({ where: { id: taskId } });
    if (!task) {
      throw new BadRequestException(`Task #${taskId} tidak ditemukan.`);
    }
    if (Number(task.projectId) !== Number(projectId)) {
      throw new BadRequestException(
        `Task #${taskId} bukan milik Proyek #${projectId}.`,
      );
    }
    return task;
  }

  public async getEligibleOwners(
    projectId: number,
    userId?: number,
    roles: string[] = [],
  ): Promise<any[]> {
    const project = await this.getVerifiedProject(projectId);

    if (userId !== undefined && userId !== null) {
      this.validateProjectAccess(project, userId, roles, true);
    }

    const users = await this.userRepo.find({
      where: { isActive: true },
      relations: ["roles"],
      select: ["id", "fullName", "email"],
    });

    return users
      .filter((u) => {
        const roles = (u.roles || []).map((r) => r.name);
        return roles.some((r) => OWNER_ELIGIBLE_ROLES.includes(r));
      })
      .map((u) => ({
        id: u.id,
        name: u.fullName,
        email: u.email,
        roles: (u.roles || []).map((r) => r.name),
      }));
  }

  // -------------------------------------------------------------
  // 1. CREATE ISSUE
  // -------------------------------------------------------------
  async createIssue(
    projectId: number,
    dto: CreateProjectIssueDto,
    userId: number,
    roles: string[],
  ): Promise<ProjectIssue> {
    const project = await this.getVerifiedProject(projectId, true);

    // Only assigned PM or PMO can create an Issue
    const isAssignedPm =
      roles.includes("PROJECT_MANAGER") &&
      Number(project.managerId) === Number(userId);
    const isPmo = roles.includes("PMO");
    if (!isAssignedPm && !isPmo) {
      throw new ForbiddenException(
        "Hanya Project Manager yang ditugaskan atau PMO yang berhak membuat Issue.",
      );
    }

    if (dto.taskId) {
      await this.validateTaskBelongsToProject(dto.taskId, projectId);
    }
    await this.validateOwnerUser(dto.ownerId);

    const maxRetries = 5;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    let attempt = 0;
    let savedIssue: ProjectIssue | null = null;

    while (attempt < maxRetries) {
      attempt++;
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const count = await queryRunner.manager.count(ProjectIssue, {
          where: { issueNumber: Like(`ISS-${dateStr}-%`) },
        });
        const seq = String(count + attempt).padStart(3, "0");
        const candidateNumber = `ISS-${dateStr}-${seq}`;

        const issue = queryRunner.manager.create(ProjectIssue, {
          projectId,
          taskId: dto.taskId || null,
          issueNumber: candidateNumber,
          title: dto.title.trim(),
          description: dto.description.trim(),
          category: dto.category,
          severity: dto.severity,
          priority: dto.priority,
          status: ProjectIssueStatus.OPEN,
          ownerId: dto.ownerId,
          reportedById: userId,
          reportedAt: new Date(),
          dueDate: dto.dueDate || null,
          sourceRiskId: null,
          version: 1,
        });

        savedIssue = await queryRunner.manager.save(ProjectIssue, issue);

        // Audit Log
        const audit = queryRunner.manager.create(AuditLog, {
          table_name: "project_issues",
          record_id: savedIssue.id,
          action: "PROJECT_ISSUE_CREATED",
          old_value: null,
          new_value: {
            issueNumber: savedIssue.issueNumber,
            title: savedIssue.title,
            severity: savedIssue.severity,
            priority: savedIssue.priority,
            status: savedIssue.status,
            ownerId: savedIssue.ownerId,
            version: savedIssue.version,
          },
          created_by: userId,
        });
        await queryRunner.manager.save(AuditLog, audit);

        // Outbox Event
        const outbox = queryRunner.manager.create(OutboxEvent, {
          event_id: randomUUID(),
          event_name: "project.issue.created",
          event_version: "1",
          aggregate_type: "ProjectIssue",
          aggregate_id: Number(savedIssue.id),
          payload: {
            issueId: savedIssue.id,
            issueNumber: savedIssue.issueNumber,
            projectId: savedIssue.projectId,
            title: savedIssue.title,
            severity: savedIssue.severity,
            priority: savedIssue.priority,
            ownerId: savedIssue.ownerId,
            reportedById: savedIssue.reportedById,
          },
          status: OutboxStatus.PENDING,
          retry_count: 0,
        });
        await queryRunner.manager.save(OutboxEvent, outbox);

        await queryRunner.commitTransaction();
        break;
      } catch (err: any) {
        await queryRunner.rollbackTransaction();
        const isDuplicateEntry =
          err?.code === "ER_DUP_ENTRY" ||
          err?.errno === 1062 ||
          String(err?.message || "").includes(
            "uq_project_issues_issue_number",
          ) ||
          String(err?.message || "").includes("issue_number");

        if (isDuplicateEntry && attempt < maxRetries) {
          this.logger.warn(
            `Issue number collision on attempt ${attempt}/${maxRetries}. Retrying with candidate increment...`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 50 + 20),
          );
          continue;
        }
        if (isDuplicateEntry) {
          throw new ConflictException(
            "Gagal menghasilkan nomor Issue unik setelah percobaan berulang.",
          );
        }
        throw err;
      } finally {
        await queryRunner.release();
      }
    }

    if (!savedIssue) {
      throw new ConflictException("Gagal menyimpan Issue.");
    }

    return this.getIssueById(projectId, savedIssue.id, userId, roles);
  }

  // -------------------------------------------------------------
  // 2. QUERY ISSUES (LIST)
  // -------------------------------------------------------------
  async getIssues(
    projectId: number,
    query: QueryProjectIssueDto,
    userId: number,
    roles: string[],
  ): Promise<{ data: any[]; total: number; page: number; limit: number }> {
    const project = await this.getVerifiedProject(projectId);

    const isPortfolio = roles.some((r) =>
      [
        "PMO",
        "HEAD_OF_OPERATIONS",
        "DIRECTOR",
        "ADMIN",
        "SUPER_ADMIN",
      ].includes(r),
    );
    const isAssignedPm =
      roles.includes("PROJECT_MANAGER") &&
      Number(project.managerId) === Number(userId);

    // Unassigned PM is strictly rejected
    if (roles.includes("PROJECT_MANAGER") && !isAssignedPm && !isPortfolio) {
      throw new ForbiddenException(
        "Akses ditolak: Anda bukan Project Manager yang ditugaskan pada proyek ini.",
      );
    }

    const qb = this.issueRepo
      .createQueryBuilder("issue")
      .leftJoinAndSelect("issue.owner", "owner")
      .leftJoinAndSelect("issue.reportedBy", "reportedBy")
      .leftJoinAndSelect("issue.resolvedBy", "resolvedBy")
      .leftJoinAndSelect("issue.closedBy", "closedBy")
      .leftJoinAndSelect("issue.task", "task")
      .where("issue.project_id = :projectId", { projectId });

    // Symmetrical Owner Scoping for Non-PM Operational Roles
    if (!isPortfolio && !isAssignedPm) {
      qb.andWhere("issue.owner_id = :userId", { userId });
    } else if (query.ownerId) {
      qb.andWhere("issue.owner_id = :ownerId", { ownerId: query.ownerId });
    }

    if (query.status) {
      qb.andWhere("issue.status = :status", { status: query.status });
    }
    if (query.severity) {
      qb.andWhere("issue.severity = :severity", { severity: query.severity });
    }
    if (query.priority) {
      qb.andWhere("issue.priority = :priority", { priority: query.priority });
    }
    if (query.category) {
      qb.andWhere("issue.category = :category", { category: query.category });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (query.overdueOnly === "true") {
      qb.andWhere("issue.due_date IS NOT NULL AND issue.due_date < :todayStr", {
        todayStr,
      }).andWhere("issue.status NOT IN (:...termStatuses)", {
        termStatuses: [
          ProjectIssueStatus.RESOLVED,
          ProjectIssueStatus.CLOSED,
          ProjectIssueStatus.CANCELLED,
        ],
      });
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    qb.orderBy("issue.id", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    const data = items.map((issue) => this.mapDerivedIssueFields(issue));

    return { data, total, page, limit };
  }

  // -------------------------------------------------------------
  // 3. GET ISSUE DETAIL
  // -------------------------------------------------------------
  async getIssueById(
    projectId: number,
    issueId: number,
    userId: number,
    roles: string[],
  ): Promise<any> {
    const project = await this.getVerifiedProject(projectId);
    const issue = await this.issueRepo.findOne({
      where: { id: issueId, projectId },
      relations: [
        "owner",
        "reportedBy",
        "resolvedBy",
        "closedBy",
        "task",
        "sourceRisk",
      ],
    });

    if (!issue) {
      throw new NotFoundException(
        `Issue #${issueId} tidak ditemukan pada Proyek #${projectId}.`,
      );
    }

    const isPortfolio = roles.some((r) =>
      [
        "PMO",
        "HEAD_OF_OPERATIONS",
        "DIRECTOR",
        "ADMIN",
        "SUPER_ADMIN",
      ].includes(r),
    );
    const isAssignedPm =
      roles.includes("PROJECT_MANAGER") &&
      Number(project.managerId) === Number(userId);

    // Unassigned PM is strictly rejected
    if (roles.includes("PROJECT_MANAGER") && !isAssignedPm && !isPortfolio) {
      throw new ForbiddenException(
        "Akses ditolak: Anda bukan Project Manager yang ditugaskan pada proyek ini.",
      );
    }

    // Non-PM operational user gets access ONLY if they are the owner
    if (
      !isPortfolio &&
      !isAssignedPm &&
      Number(issue.ownerId) !== Number(userId)
    ) {
      throw new ForbiddenException(
        "Akses ditolak: Anda tidak memiliki akses ke Issue ini.",
      );
    }

    return this.mapDerivedIssueFields(issue);
  }

  // -------------------------------------------------------------
  // 4. UPDATE METADATA (PATCH)
  // -------------------------------------------------------------
  async updateIssue(
    projectId: number,
    issueId: number,
    dto: UpdateProjectIssueDto,
    userId: number,
    roles: string[],
  ): Promise<any> {
    const project = await this.getVerifiedProject(projectId, true);
    const isAssignedPm =
      roles.includes("PROJECT_MANAGER") &&
      Number(project.managerId) === Number(userId);
    const isPmo = roles.includes("PMO");

    if (!isAssignedPm && !isPmo) {
      throw new ForbiddenException(
        "Hanya Project Manager yang ditugaskan atau PMO yang berhak mengubah metadata Issue.",
      );
    }

    const issue = await this.issueRepo.findOne({
      where: { id: issueId, projectId },
    });
    if (!issue) {
      throw new NotFoundException(`Issue #${issueId} tidak ditemukan.`);
    }

    if (
      [ProjectIssueStatus.CLOSED, ProjectIssueStatus.CANCELLED].includes(
        issue.status,
      )
    ) {
      throw new BadRequestException(
        "Issue dengan status CLOSED atau CANCELLED tidak dapat diubah metadatanya.",
      );
    }

    if (dto.taskId) {
      await this.validateTaskBelongsToProject(dto.taskId, projectId);
    }
    if (dto.ownerId) {
      await this.validateOwnerUser(dto.ownerId);
    }

    const oldSnapshot = {
      title: issue.title,
      description: issue.description,
      category: issue.category,
      severity: issue.severity,
      priority: issue.priority,
      ownerId: issue.ownerId,
      dueDate: issue.dueDate,
      version: issue.version,
    };

    const updatePayload: any = {
      version: () => "version + 1",
      updatedAt: new Date(),
    };
    if (dto.title !== undefined) updatePayload.title = dto.title.trim();
    if (dto.description !== undefined)
      updatePayload.description = dto.description.trim();
    if (dto.category !== undefined) updatePayload.category = dto.category;
    if (dto.severity !== undefined) updatePayload.severity = dto.severity;
    if (dto.priority !== undefined) updatePayload.priority = dto.priority;
    if (dto.ownerId !== undefined) updatePayload.ownerId = dto.ownerId;
    if (dto.taskId !== undefined) updatePayload.taskId = dto.taskId;
    if (dto.dueDate !== undefined) updatePayload.dueDate = dto.dueDate || null;

    const res = await this.issueRepo
      .createQueryBuilder()
      .update(ProjectIssue)
      .set(updatePayload)
      .where(
        "id = :id AND project_id = :projectId AND version = :expectedVersion",
        {
          id: issueId,
          projectId,
          expectedVersion: dto.expectedVersion,
        },
      )
      .execute();

    if (res.affected === 0) {
      throw new ConflictException(
        "Gagal memperbarui: Versi Issue tidak cocok atau record telah diubah oleh pengguna lain.",
      );
    }

    const updated = await this.issueRepo.findOne({ where: { id: issueId } });

    // Audit Log
    const audit = this.auditLogRepo.create({
      table_name: "project_issues",
      record_id: issueId,
      action:
        dto.ownerId && dto.ownerId !== issue.ownerId
          ? "PROJECT_ISSUE_ASSIGNED"
          : "PROJECT_ISSUE_UPDATED",
      old_value: oldSnapshot,
      new_value: {
        title: updated?.title,
        severity: updated?.severity,
        priority: updated?.priority,
        ownerId: updated?.ownerId,
        version: updated?.version,
      },
      created_by: userId,
    });
    await this.auditLogRepo.save(audit);

    // Outbox on reassignment
    if (dto.ownerId && dto.ownerId !== issue.ownerId) {
      const outbox = this.outboxRepo.create({
        event_id: randomUUID(),
        event_name: "project.issue.assigned",
        event_version: "1",
        aggregate_type: "ProjectIssue",
        aggregate_id: issueId,
        payload: {
          issueId,
          projectId,
          previousOwnerId: issue.ownerId,
          newOwnerId: dto.ownerId,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await this.outboxRepo.save(outbox);
    }

    return this.getIssueById(projectId, issueId, userId, roles);
  }

  // -------------------------------------------------------------
  // 5. START ISSUE (OPEN -> IN_PROGRESS)
  // -------------------------------------------------------------
  async startIssue(
    projectId: number,
    issueId: number,
    dto: TransitionVersionDto,
    userId: number,
    roles: string[],
  ): Promise<any> {
    const project = await this.getVerifiedProject(projectId, true);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const issue = await queryRunner.manager.findOne(ProjectIssue, {
        where: { id: issueId, projectId },
        lock: { mode: "pessimistic_write" },
      });

      if (!issue) {
        throw new NotFoundException(`Issue #${issueId} tidak ditemukan.`);
      }

      const isPortfolio = roles.some((r) =>
        ["PMO", "HEAD_OF_OPERATIONS"].includes(r),
      );
      const isAssignedPm =
        roles.includes("PROJECT_MANAGER") &&
        Number(project.managerId) === Number(userId);
      const isOwner = Number(issue.ownerId) === Number(userId);

      if (roles.includes("PROJECT_MANAGER") && !isAssignedPm && !isPortfolio) {
        throw new ForbiddenException(
          "Akses ditolak: Anda bukan Project Manager yang ditugaskan pada proyek ini.",
        );
      }
      if (!isAssignedPm && !isPortfolio && !isOwner) {
        throw new ForbiddenException(
          "Hanya Project Manager, PMO, atau Owner yang berhak memulai pengerjaan Issue.",
        );
      }

      if (issue.status !== ProjectIssueStatus.OPEN) {
        throw new BadRequestException(
          `Issue tidak dapat dimulai karena berstatus ${issue.status} (harus OPEN).`,
        );
      }
      if (Number(issue.version) !== Number(dto.expectedVersion)) {
        throw new ConflictException(
          "Gagal: Versi Issue tidak cocok (konflik konkurensi).",
        );
      }

      const oldVersion = issue.version;
      issue.status = ProjectIssueStatus.IN_PROGRESS;
      issue.version = oldVersion + 1;
      await queryRunner.manager.save(ProjectIssue, issue);

      const audit = queryRunner.manager.create(AuditLog, {
        table_name: "project_issues",
        record_id: issueId,
        action: "PROJECT_ISSUE_STARTED",
        old_value: { status: ProjectIssueStatus.OPEN, version: oldVersion },
        new_value: {
          status: ProjectIssueStatus.IN_PROGRESS,
          version: issue.version,
        },
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, audit);

      const outbox = queryRunner.manager.create(OutboxEvent, {
        event_id: randomUUID(),
        event_name: "project.issue.started",
        event_version: "1",
        aggregate_type: "ProjectIssue",
        aggregate_id: issueId,
        payload: { issueId, projectId, startedBy: userId },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await queryRunner.manager.save(OutboxEvent, outbox);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.getIssueById(projectId, issueId, userId, roles);
  }

  // -------------------------------------------------------------
  // 6. RESOLVE ISSUE (IN_PROGRESS -> RESOLVED)
  // -------------------------------------------------------------
  async resolveIssue(
    projectId: number,
    issueId: number,
    dto: ResolveProjectIssueDto,
    userId: number,
    roles: string[],
  ): Promise<any> {
    const project = await this.getVerifiedProject(projectId, true);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const issue = await queryRunner.manager.findOne(ProjectIssue, {
        where: { id: issueId, projectId },
        lock: { mode: "pessimistic_write" },
      });

      if (!issue) {
        throw new NotFoundException(`Issue #${issueId} tidak ditemukan.`);
      }

      const isPortfolio = roles.some((r) =>
        ["PMO", "HEAD_OF_OPERATIONS"].includes(r),
      );
      const isAssignedPm =
        roles.includes("PROJECT_MANAGER") &&
        Number(project.managerId) === Number(userId);
      const isOwner = Number(issue.ownerId) === Number(userId);

      if (roles.includes("PROJECT_MANAGER") && !isAssignedPm && !isPortfolio) {
        throw new ForbiddenException(
          "Akses ditolak: Anda bukan Project Manager yang ditugaskan pada proyek ini.",
        );
      }
      if (!isAssignedPm && !isPortfolio && !isOwner) {
        throw new ForbiddenException(
          "Hanya Project Manager, PMO, atau Owner yang berhak menyelesaikan Issue.",
        );
      }

      if (issue.status !== ProjectIssueStatus.IN_PROGRESS) {
        throw new BadRequestException(
          `Issue tidak dapat diselesaikan karena berstatus ${issue.status} (harus IN_PROGRESS).`,
        );
      }
      if (Number(issue.version) !== Number(dto.expectedVersion)) {
        throw new ConflictException(
          "Gagal: Versi Issue tidak cocok (konflik konkurensi).",
        );
      }

      const oldVersion = issue.version;
      issue.status = ProjectIssueStatus.RESOLVED;
      issue.resolution = dto.resolution.trim();
      issue.resolvedById = userId;
      issue.resolvedAt = new Date();
      issue.version = oldVersion + 1;
      await queryRunner.manager.save(ProjectIssue, issue);

      const audit = queryRunner.manager.create(AuditLog, {
        table_name: "project_issues",
        record_id: issueId,
        action: "PROJECT_ISSUE_RESOLVED",
        old_value: {
          status: ProjectIssueStatus.IN_PROGRESS,
          version: oldVersion,
        },
        new_value: {
          status: ProjectIssueStatus.RESOLVED,
          resolution: issue.resolution,
          resolvedById: userId,
          version: issue.version,
        },
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, audit);

      const outbox = queryRunner.manager.create(OutboxEvent, {
        event_id: randomUUID(),
        event_name: "project.issue.resolved",
        event_version: "1",
        aggregate_type: "ProjectIssue",
        aggregate_id: issueId,
        payload: {
          issueId,
          projectId,
          resolution: issue.resolution,
          resolvedBy: userId,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await queryRunner.manager.save(OutboxEvent, outbox);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.getIssueById(projectId, issueId, userId, roles);
  }

  // -------------------------------------------------------------
  // 7. CLOSE ISSUE (RESOLVED -> CLOSED)
  // -------------------------------------------------------------
  async closeIssue(
    projectId: number,
    issueId: number,
    dto: TransitionVersionDto,
    userId: number,
    roles: string[],
  ): Promise<any> {
    const project = await this.getVerifiedProject(projectId, true);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const issue = await queryRunner.manager.findOne(ProjectIssue, {
        where: { id: issueId, projectId },
        lock: { mode: "pessimistic_write" },
      });

      if (!issue) {
        throw new NotFoundException(`Issue #${issueId} tidak ditemukan.`);
      }

      const isPortfolio = roles.some((r) =>
        ["PMO", "HEAD_OF_OPERATIONS"].includes(r),
      );
      const isAssignedPm =
        roles.includes("PROJECT_MANAGER") &&
        Number(project.managerId) === Number(userId);

      // Owner authority does NOT permit closing an issue!
      if (!isAssignedPm && !isPortfolio) {
        throw new ForbiddenException(
          "Hanya Project Manager yang ditugaskan, PMO, atau Head of Operations yang berhak menutup Issue.",
        );
      }

      if (issue.status !== ProjectIssueStatus.RESOLVED) {
        throw new BadRequestException(
          `Issue tidak dapat ditutup karena berstatus ${issue.status} (harus RESOLVED).`,
        );
      }
      if (Number(issue.version) !== Number(dto.expectedVersion)) {
        throw new ConflictException(
          "Gagal: Versi Issue tidak cocok (konflik konkurensi).",
        );
      }

      const oldVersion = issue.version;
      issue.status = ProjectIssueStatus.CLOSED;
      issue.closedById = userId;
      issue.closedAt = new Date();
      issue.version = oldVersion + 1;
      await queryRunner.manager.save(ProjectIssue, issue);

      const audit = queryRunner.manager.create(AuditLog, {
        table_name: "project_issues",
        record_id: issueId,
        action: "PROJECT_ISSUE_CLOSED",
        old_value: { status: ProjectIssueStatus.RESOLVED, version: oldVersion },
        new_value: {
          status: ProjectIssueStatus.CLOSED,
          closedById: userId,
          version: issue.version,
        },
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, audit);

      const outbox = queryRunner.manager.create(OutboxEvent, {
        event_id: randomUUID(),
        event_name: "project.issue.closed",
        event_version: "1",
        aggregate_type: "ProjectIssue",
        aggregate_id: issueId,
        payload: { issueId, projectId, closedBy: userId },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await queryRunner.manager.save(OutboxEvent, outbox);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.getIssueById(projectId, issueId, userId, roles);
  }

  // -------------------------------------------------------------
  // 8. REOPEN ISSUE (RESOLVED/CLOSED -> IN_PROGRESS)
  // -------------------------------------------------------------
  async reopenIssue(
    projectId: number,
    issueId: number,
    dto: ReopenProjectIssueDto,
    userId: number,
    roles: string[],
  ): Promise<any> {
    const project = await this.getVerifiedProject(projectId, true);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const issue = await queryRunner.manager.findOne(ProjectIssue, {
        where: { id: issueId, projectId },
        lock: { mode: "pessimistic_write" },
      });

      if (!issue) {
        throw new NotFoundException(`Issue #${issueId} tidak ditemukan.`);
      }

      const isPmoOrHoo = roles.some((r) =>
        ["PMO", "HEAD_OF_OPERATIONS"].includes(r),
      );
      const isAssignedPm =
        roles.includes("PROJECT_MANAGER") &&
        Number(project.managerId) === Number(userId);

      // Reopening rules:
      // CLOSED -> ONLY PMO or HOO
      // RESOLVED -> Assigned PM, PMO, HOO
      if (issue.status === ProjectIssueStatus.CLOSED) {
        if (!isPmoOrHoo) {
          throw new ForbiddenException(
            "Hanya PMO atau Head of Operations yang berhak membuka kembali Issue yang berstatus CLOSED.",
          );
        }
      } else if (issue.status === ProjectIssueStatus.RESOLVED) {
        if (!isAssignedPm && !isPmoOrHoo) {
          throw new ForbiddenException(
            "Hanya Project Manager yang ditugaskan, PMO, atau HOO yang berhak membuka kembali Issue.",
          );
        }
      } else {
        throw new BadRequestException(
          `Issue dengan status ${issue.status} tidak dapat dibuka kembali (hanya RESOLVED atau CLOSED).`,
        );
      }

      if (Number(issue.version) !== Number(dto.expectedVersion)) {
        throw new ConflictException(
          "Gagal: Versi Issue tidak cocok (konflik konkurensi).",
        );
      }

      const oldSnapshot = {
        status: issue.status,
        resolution: issue.resolution,
        resolvedById: issue.resolvedById,
        resolvedAt: issue.resolvedAt,
        closedById: issue.closedById,
        closedAt: issue.closedAt,
        version: issue.version,
      };

      const oldVersion = issue.version;
      issue.status = ProjectIssueStatus.IN_PROGRESS;
      issue.resolution = null;
      issue.resolvedById = null;
      issue.resolvedAt = null;
      issue.closedById = null;
      issue.closedAt = null;
      issue.version = oldVersion + 1;
      await queryRunner.manager.save(ProjectIssue, issue);

      const audit = queryRunner.manager.create(AuditLog, {
        table_name: "project_issues",
        record_id: issueId,
        action: "PROJECT_ISSUE_REOPENED",
        old_value: oldSnapshot,
        new_value: {
          status: ProjectIssueStatus.IN_PROGRESS,
          reopenedBy: userId,
          reason: dto.reason.trim(),
          version: issue.version,
        },
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, audit);

      const outbox = queryRunner.manager.create(OutboxEvent, {
        event_id: randomUUID(),
        event_name: "project.issue.reopened",
        event_version: "1",
        aggregate_type: "ProjectIssue",
        aggregate_id: issueId,
        payload: {
          issueId,
          projectId,
          reason: dto.reason.trim(),
          reopenedBy: userId,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await queryRunner.manager.save(OutboxEvent, outbox);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.getIssueById(projectId, issueId, userId, roles);
  }

  // -------------------------------------------------------------
  // 9. CANCEL ISSUE (OPEN/IN_PROGRESS -> CANCELLED)
  // -------------------------------------------------------------
  async cancelIssue(
    projectId: number,
    issueId: number,
    dto: CancelProjectIssueDto,
    userId: number,
    roles: string[],
  ): Promise<any> {
    const project = await this.getVerifiedProject(projectId, true);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const issue = await queryRunner.manager.findOne(ProjectIssue, {
        where: { id: issueId, projectId },
        lock: { mode: "pessimistic_write" },
      });

      if (!issue) {
        throw new NotFoundException(`Issue #${issueId} tidak ditemukan.`);
      }

      const isPortfolio = roles.some((r) =>
        ["PMO", "HEAD_OF_OPERATIONS"].includes(r),
      );
      const isAssignedPm =
        roles.includes("PROJECT_MANAGER") &&
        Number(project.managerId) === Number(userId);

      if (!isAssignedPm && !isPortfolio) {
        throw new ForbiddenException(
          "Hanya Project Manager yang ditugaskan, PMO, atau HOO yang berhak membatalkan Issue.",
        );
      }

      if (
        ![ProjectIssueStatus.OPEN, ProjectIssueStatus.IN_PROGRESS].includes(
          issue.status,
        )
      ) {
        throw new BadRequestException(
          `Issue berstatus ${issue.status} tidak dapat dibatalkan (hanya OPEN atau IN_PROGRESS).`,
        );
      }

      if (Number(issue.version) !== Number(dto.expectedVersion)) {
        throw new ConflictException(
          "Gagal: Versi Issue tidak cocok (konflik konkurensi).",
        );
      }

      const oldVersion = issue.version;
      issue.status = ProjectIssueStatus.CANCELLED;
      issue.version = oldVersion + 1;
      await queryRunner.manager.save(ProjectIssue, issue);

      const audit = queryRunner.manager.create(AuditLog, {
        table_name: "project_issues",
        record_id: issueId,
        action: "PROJECT_ISSUE_CANCELLED",
        old_value: { status: issue.status, version: oldVersion },
        new_value: {
          status: ProjectIssueStatus.CANCELLED,
          reason: dto.reason.trim(),
          version: issue.version,
        },
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, audit);

      const outbox = queryRunner.manager.create(OutboxEvent, {
        event_id: randomUUID(),
        event_name: "project.issue.cancelled",
        event_version: "1",
        aggregate_type: "ProjectIssue",
        aggregate_id: issueId,
        payload: {
          issueId,
          projectId,
          reason: dto.reason.trim(),
          cancelledBy: userId,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await queryRunner.manager.save(OutboxEvent, outbox);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.getIssueById(projectId, issueId, userId, roles);
  }

  // -------------------------------------------------------------
  // DERIVED FIELDS
  // -------------------------------------------------------------
  private mapDerivedIssueFields(issue: ProjectIssue): any {
    const isTerminal = [
      ProjectIssueStatus.RESOLVED,
      ProjectIssueStatus.CLOSED,
      ProjectIssueStatus.CANCELLED,
    ].includes(issue.status);

    const isOverdue = Boolean(
      issue.dueDate &&
      new Date(issue.dueDate) < new Date(new Date().toDateString()) &&
      !isTerminal,
    );

    return {
      ...issue,
      isOverdue,
    };
  }
}
