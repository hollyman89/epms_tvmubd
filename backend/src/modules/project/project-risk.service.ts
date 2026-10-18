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
  ProjectRisk,
  ProjectRiskStatus,
  ProjectRiskLevel,
  ProjectIssueRiskCategory,
} from "../../entities/project-risk.entity";
import {
  ProjectIssue,
  ProjectIssueStatus,
} from "../../entities/project-issue.entity";
import { Project } from "../../entities/project.entity";
import { Task } from "../../entities/task.entity";
import { User } from "../../entities/user.entity";
import { AuditLog } from "../../entities/audit-log.entity";
import { OutboxEvent, OutboxStatus } from "../../entities/outbox-event.entity";
import { CreateProjectRiskDto } from "./dto/create-project-risk.dto";
import { UpdateProjectRiskDto } from "./dto/update-project-risk.dto";
import { AssessProjectRiskDto } from "./dto/assess-project-risk.dto";
import { MaterializeProjectRiskDto } from "./dto/materialize-project-risk.dto";
import { CancelProjectRiskDto } from "./dto/cancel-project-risk.dto";
import { TransitionVersionDto } from "./dto/transition-version.dto";
import { QueryProjectRiskDto } from "./dto/query-project-risk.dto";

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
export class ProjectRiskService {
  private readonly logger = new Logger(ProjectRiskService.name);

  constructor(
    @InjectRepository(ProjectRisk)
    private readonly riskRepo: Repository<ProjectRisk>,
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
        `Proyek #${projectId} telah ditutup (CLOSED). Mutasi risiko tidak diizinkan.`,
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

    // Operational roles handled via record-level check
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

  // -------------------------------------------------------------
  // RISK SCORING CALCULATION
  // -------------------------------------------------------------
  public static calculateRiskScoreAndLevel(
    probability?: number | null,
    impact?: number | null,
  ): { riskScore: number | null; riskLevel: ProjectRiskLevel | null } {
    if (
      probability === null ||
      probability === undefined ||
      impact === null ||
      impact === undefined
    ) {
      return { riskScore: null, riskLevel: null };
    }

    const probNum = Number(probability);
    const impNum = Number(impact);

    if (probNum < 1 || probNum > 5 || impNum < 1 || impNum > 5) {
      throw new BadRequestException(
        "Probabilitas dan dampak harus berada dalam rentang 1 hingga 5.",
      );
    }

    const riskScore = probNum * impNum;
    let riskLevel: ProjectRiskLevel;

    if (riskScore <= 4) {
      riskLevel = ProjectRiskLevel.LOW;
    } else if (riskScore <= 9) {
      riskLevel = ProjectRiskLevel.MEDIUM;
    } else if (riskScore <= 14) {
      riskLevel = ProjectRiskLevel.HIGH;
    } else {
      riskLevel = ProjectRiskLevel.CRITICAL;
    }

    return { riskScore, riskLevel };
  }

  // -------------------------------------------------------------
  // 1. CREATE RISK
  // -------------------------------------------------------------
  async createRisk(
    projectId: number,
    dto: CreateProjectRiskDto,
    userId: number,
    roles: string[],
  ): Promise<ProjectRisk> {
    const project = await this.getVerifiedProject(projectId, true);

    // Only assigned PM or PMO can create a Risk
    const isAssignedPm =
      roles.includes("PROJECT_MANAGER") &&
      Number(project.managerId) === Number(userId);
    const isPmo = roles.includes("PMO");
    if (!isAssignedPm && !isPmo) {
      throw new ForbiddenException(
        "Hanya Project Manager yang ditugaskan atau PMO yang berhak membuat Risiko.",
      );
    }

    if (dto.taskId) {
      await this.validateTaskBelongsToProject(dto.taskId, projectId);
    }
    await this.validateOwnerUser(dto.ownerId);

    // Assessment check: Both or neither
    const probProvided =
      dto.probability !== undefined && dto.probability !== null;
    const impProvided = dto.impact !== undefined && dto.impact !== null;

    if ((probProvided && !impProvided) || (!probProvided && impProvided)) {
      throw new BadRequestException(
        "Harap isi kedua probabilitas dan dampak atau kosongkan keduanya.",
      );
    }

    let initialStatus = ProjectRiskStatus.IDENTIFIED;
    let score: number | null = null;
    let level: ProjectRiskLevel | null = null;

    if (probProvided && impProvided) {
      const calc = ProjectRiskService.calculateRiskScoreAndLevel(
        dto.probability,
        dto.impact,
      );
      score = calc.riskScore;
      level = calc.riskLevel;
      initialStatus = ProjectRiskStatus.ASSESSED;
    }

    const maxRetries = 5;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    let attempt = 0;
    let savedRisk: ProjectRisk | null = null;

    while (attempt < maxRetries) {
      attempt++;
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const count = await queryRunner.manager.count(ProjectRisk, {
          where: { riskNumber: Like(`RSK-${dateStr}-%`) },
        });
        const seq = String(count + attempt).padStart(3, "0");
        const candidateNumber = `RSK-${dateStr}-${seq}`;

        const risk = queryRunner.manager.create(ProjectRisk, {
          projectId,
          taskId: dto.taskId || null,
          riskNumber: candidateNumber,
          title: dto.title.trim(),
          description: dto.description.trim(),
          category: dto.category,
          probability: probProvided ? dto.probability : null,
          impact: impProvided ? dto.impact : null,
          riskScore: score,
          riskLevel: level,
          status: initialStatus,
          ownerId: dto.ownerId,
          identifiedById: userId,
          identifiedAt: new Date(),
          mitigationPlan: dto.mitigationPlan ? dto.mitigationPlan.trim() : null,
          contingencyPlan: dto.contingencyPlan
            ? dto.contingencyPlan.trim()
            : null,
          targetDate: dto.targetDate || null,
          reviewDate: dto.reviewDate || null,
          version: 1,
        });

        savedRisk = await queryRunner.manager.save(ProjectRisk, risk);

        // Audit Log
        const audit = queryRunner.manager.create(AuditLog, {
          table_name: "project_risks",
          record_id: savedRisk.id,
          action: "PROJECT_RISK_CREATED",
          old_value: null,
          new_value: {
            riskNumber: savedRisk.riskNumber,
            title: savedRisk.title,
            category: savedRisk.category,
            probability: savedRisk.probability,
            impact: savedRisk.impact,
            riskScore: savedRisk.riskScore,
            riskLevel: savedRisk.riskLevel,
            status: savedRisk.status,
            ownerId: savedRisk.ownerId,
            version: savedRisk.version,
          },
          created_by: userId,
        });
        await queryRunner.manager.save(AuditLog, audit);

        // Outbox Event
        const outbox = queryRunner.manager.create(OutboxEvent, {
          event_id: randomUUID(),
          event_name: "project.risk.created",
          event_version: "1",
          aggregate_type: "ProjectRisk",
          aggregate_id: Number(savedRisk.id),
          payload: {
            riskId: savedRisk.id,
            riskNumber: savedRisk.riskNumber,
            projectId: savedRisk.projectId,
            title: savedRisk.title,
            riskScore: savedRisk.riskScore,
            riskLevel: savedRisk.riskLevel,
            status: savedRisk.status,
            ownerId: savedRisk.ownerId,
            identifiedById: savedRisk.identifiedById,
          },
          status: OutboxStatus.PENDING,
          retry_count: 0,
        });
        await queryRunner.manager.save(OutboxEvent, outbox);

        // If created directly as CRITICAL, emit critical detected event
        if (savedRisk.riskLevel === ProjectRiskLevel.CRITICAL) {
          const critOutbox = queryRunner.manager.create(OutboxEvent, {
            event_id: randomUUID(),
            event_name: "project.risk.critical_detected",
            event_version: "1",
            aggregate_type: "ProjectRisk",
            aggregate_id: Number(savedRisk.id),
            payload: {
              riskId: savedRisk.id,
              riskNumber: savedRisk.riskNumber,
              projectId: savedRisk.projectId,
              title: savedRisk.title,
              riskScore: savedRisk.riskScore,
              riskLevel: savedRisk.riskLevel,
              ownerId: savedRisk.ownerId,
            },
            status: OutboxStatus.PENDING,
            retry_count: 0,
          });
          await queryRunner.manager.save(OutboxEvent, critOutbox);
        }

        await queryRunner.commitTransaction();
        break;
      } catch (err: any) {
        await queryRunner.rollbackTransaction();
        const isDuplicateEntry =
          err?.code === "ER_DUP_ENTRY" ||
          err?.errno === 1062 ||
          String(err?.message || "").includes("uq_project_risks_risk_number") ||
          String(err?.message || "").includes("risk_number");

        if (isDuplicateEntry && attempt < maxRetries) {
          this.logger.warn(
            `Risk number collision on attempt ${attempt}/${maxRetries}. Retrying with candidate increment...`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 50 + 20),
          );
          continue;
        }
        if (isDuplicateEntry) {
          throw new ConflictException(
            "Gagal menghasilkan nomor Risiko unik setelah percobaan berulang.",
          );
        }
        throw err;
      } finally {
        await queryRunner.release();
      }
    }

    if (!savedRisk) {
      throw new ConflictException("Gagal menyimpan Risiko.");
    }

    return this.getRiskById(projectId, savedRisk.id, userId, roles);
  }

  // -------------------------------------------------------------
  // 2. QUERY RISKS (LIST)
  // -------------------------------------------------------------
  async getRisks(
    projectId: number,
    query: QueryProjectRiskDto,
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

    const qb = this.riskRepo
      .createQueryBuilder("risk")
      .leftJoinAndSelect("risk.owner", "owner")
      .leftJoinAndSelect("risk.identifiedBy", "identifiedBy")
      .leftJoinAndSelect("risk.closedBy", "closedBy")
      .leftJoinAndSelect("risk.task", "task")
      .where("risk.project_id = :projectId", { projectId });

    // Symmetrical Owner Scoping for Non-PM Operational Roles
    if (!isPortfolio && !isAssignedPm) {
      qb.andWhere("risk.owner_id = :userId", { userId });
    } else if (query.ownerId) {
      qb.andWhere("risk.owner_id = :ownerId", { ownerId: query.ownerId });
    }

    if (query.status) {
      qb.andWhere("risk.status = :status", { status: query.status });
    }
    if (query.riskLevel) {
      qb.andWhere("risk.risk_level = :riskLevel", {
        riskLevel: query.riskLevel,
      });
    }
    if (query.category) {
      qb.andWhere("risk.category = :category", { category: query.category });
    }

    const todayStr = new Date().toISOString().slice(0, 10);
    if (query.reviewOverdueOnly === "true") {
      qb.andWhere(
        "risk.review_date IS NOT NULL AND risk.review_date < :todayStr",
        { todayStr },
      ).andWhere("risk.status NOT IN (:...termStatuses)", {
        termStatuses: [
          ProjectRiskStatus.MATERIALIZED,
          ProjectRiskStatus.CLOSED,
          ProjectRiskStatus.CANCELLED,
        ],
      });
    }

    const page = Math.max(1, Number(query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(query.limit) || 10));
    qb.orderBy("risk.id", "DESC")
      .skip((page - 1) * limit)
      .take(limit);

    const [items, total] = await qb.getManyAndCount();

    const data = items.map((risk) => this.mapDerivedRiskFields(risk));

    return { data, total, page, limit };
  }

  // -------------------------------------------------------------
  // 3. GET RISK DETAIL
  // -------------------------------------------------------------
  async getRiskById(
    projectId: number,
    riskId: number,
    userId: number,
    roles: string[],
  ): Promise<any> {
    const project = await this.getVerifiedProject(projectId);
    const risk = await this.riskRepo.findOne({
      where: { id: riskId, projectId },
      relations: ["owner", "identifiedBy", "closedBy", "task"],
    });

    if (!risk) {
      throw new NotFoundException(
        `Risiko #${riskId} tidak ditemukan pada Proyek #${projectId}.`,
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
      Number(risk.ownerId) !== Number(userId)
    ) {
      throw new ForbiddenException(
        "Akses ditolak: Anda tidak memiliki akses ke Risiko ini.",
      );
    }

    // Also look up any materialized issue linked to this risk
    const linkedIssue = await this.issueRepo.findOne({
      where: { sourceRiskId: riskId },
      select: ["id", "issueNumber", "status", "severity", "priority", "title"],
    });

    return {
      ...this.mapDerivedRiskFields(risk),
      materializedIssue: linkedIssue || null,
    };
  }

  // -------------------------------------------------------------
  // 4. UPDATE RISK METADATA (PATCH)
  // -------------------------------------------------------------
  async updateRisk(
    projectId: number,
    riskId: number,
    dto: UpdateProjectRiskDto,
    userId: number,
    roles: string[],
  ): Promise<any> {
    const project = await this.getVerifiedProject(projectId, true);
    const isPortfolio = roles.some((r) =>
      ["PMO", "HEAD_OF_OPERATIONS"].includes(r),
    );
    const isAssignedPm =
      roles.includes("PROJECT_MANAGER") &&
      Number(project.managerId) === Number(userId);

    const risk = await this.riskRepo.findOne({
      where: { id: riskId, projectId },
    });
    if (!risk) {
      throw new NotFoundException(`Risiko #${riskId} tidak ditemukan.`);
    }

    const isOwner = Number(risk.ownerId) === Number(userId);

    // Authorization checks
    if (!isAssignedPm && !isPortfolio && !isOwner) {
      throw new ForbiddenException(
        "Akses ditolak: Anda tidak memiliki wewenang untuk mengubah Risiko ini.",
      );
    }

    // Non-PM owner may only update mitigationPlan and contingencyPlan
    if (isOwner && !isAssignedPm && !isPortfolio) {
      if (
        dto.title !== undefined ||
        dto.description !== undefined ||
        dto.category !== undefined ||
        dto.ownerId !== undefined ||
        dto.taskId !== undefined ||
        dto.targetDate !== undefined ||
        dto.reviewDate !== undefined
      ) {
        throw new ForbiddenException(
          "Owner hanya berwenang memperbarui mitigationPlan dan contingencyPlan pada Risiko.",
        );
      }
    }

    if (
      [
        ProjectRiskStatus.MATERIALIZED,
        ProjectRiskStatus.CLOSED,
        ProjectRiskStatus.CANCELLED,
      ].includes(risk.status)
    ) {
      throw new BadRequestException(
        `Risiko dengan status ${risk.status} tidak dapat diubah metadatanya.`,
      );
    }

    if (dto.taskId) {
      await this.validateTaskBelongsToProject(dto.taskId, projectId);
    }
    if (dto.ownerId) {
      await this.validateOwnerUser(dto.ownerId);
    }

    const oldSnapshot = {
      title: risk.title,
      description: risk.description,
      category: risk.category,
      ownerId: risk.ownerId,
      mitigationPlan: risk.mitigationPlan,
      contingencyPlan: risk.contingencyPlan,
      targetDate: risk.targetDate,
      reviewDate: risk.reviewDate,
      version: risk.version,
    };

    const updatePayload: any = {
      version: () => "version + 1",
      updatedAt: new Date(),
    };
    if (dto.title !== undefined) updatePayload.title = dto.title.trim();
    if (dto.description !== undefined)
      updatePayload.description = dto.description.trim();
    if (dto.category !== undefined) updatePayload.category = dto.category;
    if (dto.ownerId !== undefined) updatePayload.ownerId = dto.ownerId;
    if (dto.taskId !== undefined) updatePayload.taskId = dto.taskId;
    if (dto.mitigationPlan !== undefined)
      updatePayload.mitigationPlan = dto.mitigationPlan
        ? dto.mitigationPlan.trim()
        : null;
    if (dto.contingencyPlan !== undefined)
      updatePayload.contingencyPlan = dto.contingencyPlan
        ? dto.contingencyPlan.trim()
        : null;
    if (dto.targetDate !== undefined)
      updatePayload.targetDate = dto.targetDate || null;
    if (dto.reviewDate !== undefined)
      updatePayload.reviewDate = dto.reviewDate || null;

    const res = await this.riskRepo
      .createQueryBuilder()
      .update(ProjectRisk)
      .set(updatePayload)
      .where(
        "id = :id AND project_id = :projectId AND version = :expectedVersion",
        {
          id: riskId,
          projectId,
          expectedVersion: dto.expectedVersion,
        },
      )
      .execute();

    if (res.affected === 0) {
      throw new ConflictException(
        "Gagal memperbarui: Versi Risiko tidak cocok atau record telah diubah oleh pengguna lain.",
      );
    }

    const updated = await this.riskRepo.findOne({ where: { id: riskId } });

    // Determine audit action
    let action = "PROJECT_RISK_UPDATED";
    if (dto.ownerId && dto.ownerId !== risk.ownerId) {
      action = "PROJECT_RISK_ASSIGNED";
    } else if (
      (dto.mitigationPlan !== undefined || dto.contingencyPlan !== undefined) &&
      !dto.title &&
      !dto.description
    ) {
      action = "PROJECT_RISK_MITIGATION_UPDATED";
    }

    const audit = this.auditLogRepo.create({
      table_name: "project_risks",
      record_id: riskId,
      action,
      old_value: oldSnapshot,
      new_value: {
        title: updated?.title,
        ownerId: updated?.ownerId,
        mitigationPlan: updated?.mitigationPlan,
        contingencyPlan: updated?.contingencyPlan,
        version: updated?.version,
      },
      created_by: userId,
    });
    await this.auditLogRepo.save(audit);

    // Outbox on reassignment
    if (dto.ownerId && dto.ownerId !== risk.ownerId) {
      const outbox = this.outboxRepo.create({
        event_id: randomUUID(),
        event_name: "project.risk.assigned",
        event_version: "1",
        aggregate_type: "ProjectRisk",
        aggregate_id: riskId,
        payload: {
          riskId,
          projectId,
          previousOwnerId: risk.ownerId,
          newOwnerId: dto.ownerId,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await this.outboxRepo.save(outbox);
    }

    return this.getRiskById(projectId, riskId, userId, roles);
  }

  // -------------------------------------------------------------
  // 5. ASSESS RISK
  // -------------------------------------------------------------
  async assessRisk(
    projectId: number,
    riskId: number,
    dto: AssessProjectRiskDto,
    userId: number,
    roles: string[],
  ): Promise<any> {
    const project = await this.getVerifiedProject(projectId, true);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const risk = await queryRunner.manager.findOne(ProjectRisk, {
        where: { id: riskId, projectId },
        lock: { mode: "pessimistic_write" },
      });

      if (!risk) {
        throw new NotFoundException(`Risiko #${riskId} tidak ditemukan.`);
      }

      const isPortfolio = roles.some((r) =>
        ["PMO", "HEAD_OF_OPERATIONS"].includes(r),
      );
      const isAssignedPm =
        roles.includes("PROJECT_MANAGER") &&
        Number(project.managerId) === Number(userId);

      if (roles.includes("PROJECT_MANAGER") && !isAssignedPm && !isPortfolio) {
        throw new ForbiddenException(
          "Akses ditolak: Anda bukan Project Manager yang ditugaskan pada proyek ini.",
        );
      }
      if (!isAssignedPm && !isPortfolio) {
        throw new ForbiddenException(
          "Hanya Project Manager yang ditugaskan atau PMO yang berhak melakukan asesmen Risiko.",
        );
      }

      const allowedStatuses = [
        ProjectRiskStatus.IDENTIFIED,
        ProjectRiskStatus.ASSESSED,
        ProjectRiskStatus.MITIGATING,
        ProjectRiskStatus.MONITORING,
      ];
      if (!allowedStatuses.includes(risk.status)) {
        throw new BadRequestException(
          `Risiko dengan status ${risk.status} tidak dapat dinilai kembali.`,
        );
      }

      if (Number(risk.version) !== Number(dto.expectedVersion)) {
        throw new ConflictException(
          "Gagal: Versi Risiko tidak cocok (konflik konkurensi).",
        );
      }

      const oldSnapshot = {
        probability: risk.probability,
        impact: risk.impact,
        riskScore: risk.riskScore,
        riskLevel: risk.riskLevel,
        status: risk.status,
        version: risk.version,
      };

      const calc = ProjectRiskService.calculateRiskScoreAndLevel(
        dto.probability,
        dto.impact,
      );
      const oldLevel = risk.riskLevel;
      const newLevel = calc.riskLevel;

      risk.probability = dto.probability;
      risk.impact = dto.impact;
      risk.riskScore = calc.riskScore;
      risk.riskLevel = newLevel;

      // Status transition: IDENTIFIED -> ASSESSED; others retain current status
      if (risk.status === ProjectRiskStatus.IDENTIFIED) {
        risk.status = ProjectRiskStatus.ASSESSED;
      }
      risk.version = risk.version + 1;

      await queryRunner.manager.save(ProjectRisk, risk);

      // Audit Log
      const audit = queryRunner.manager.create(AuditLog, {
        table_name: "project_risks",
        record_id: riskId,
        action: "PROJECT_RISK_ASSESSED",
        old_value: oldSnapshot,
        new_value: {
          probability: risk.probability,
          impact: risk.impact,
          riskScore: risk.riskScore,
          riskLevel: risk.riskLevel,
          status: risk.status,
          version: risk.version,
        },
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, audit);

      // Outbox: assessed
      const outbox = queryRunner.manager.create(OutboxEvent, {
        event_id: randomUUID(),
        event_name: "project.risk.assessed",
        event_version: "1",
        aggregate_type: "ProjectRisk",
        aggregate_id: riskId,
        payload: {
          riskId,
          projectId,
          probability: risk.probability,
          impact: risk.impact,
          riskScore: risk.riskScore,
          riskLevel: risk.riskLevel,
          assessedBy: userId,
        },
        status: OutboxStatus.PENDING,
        retry_count: 0,
      });
      await queryRunner.manager.save(OutboxEvent, outbox);

      // Critical dedupe: Emit critical event ONLY when previous level != CRITICAL and new level == CRITICAL
      if (
        oldLevel !== ProjectRiskLevel.CRITICAL &&
        newLevel === ProjectRiskLevel.CRITICAL
      ) {
        const critOutbox = queryRunner.manager.create(OutboxEvent, {
          event_id: randomUUID(),
          event_name: "project.risk.critical_detected",
          event_version: "1",
          aggregate_type: "ProjectRisk",
          aggregate_id: riskId,
          payload: {
            riskId,
            riskNumber: risk.riskNumber,
            projectId,
            title: risk.title,
            riskScore: risk.riskScore,
            riskLevel: risk.riskLevel,
            ownerId: risk.ownerId,
          },
          status: OutboxStatus.PENDING,
          retry_count: 0,
        });
        await queryRunner.manager.save(OutboxEvent, critOutbox);
      }

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.getRiskById(projectId, riskId, userId, roles);
  }

  // -------------------------------------------------------------
  // 6. MITIGATION / MONITORING TRANSITION
  // -------------------------------------------------------------
  async transitionRiskStatus(
    projectId: number,
    riskId: number,
    targetStatus: ProjectRiskStatus.MITIGATING | ProjectRiskStatus.MONITORING,
    dto: TransitionVersionDto,
    userId: number,
    roles: string[],
  ): Promise<any> {
    const project = await this.getVerifiedProject(projectId, true);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const risk = await queryRunner.manager.findOne(ProjectRisk, {
        where: { id: riskId, projectId },
        lock: { mode: "pessimistic_write" },
      });

      if (!risk) {
        throw new NotFoundException(`Risiko #${riskId} tidak ditemukan.`);
      }

      const isPortfolio = roles.some((r) =>
        ["PMO", "HEAD_OF_OPERATIONS"].includes(r),
      );
      const isAssignedPm =
        roles.includes("PROJECT_MANAGER") &&
        Number(project.managerId) === Number(userId);

      if (!isAssignedPm && !isPortfolio) {
        throw new ForbiddenException(
          "Hanya Project Manager yang ditugaskan atau PMO yang berhak mengubah status mitigasi Risiko.",
        );
      }

      if (Number(risk.version) !== Number(dto.expectedVersion)) {
        throw new ConflictException(
          "Gagal: Versi Risiko tidak cocok (konflik konkurensi).",
        );
      }

      if (targetStatus === ProjectRiskStatus.MITIGATING) {
        if (
          ![ProjectRiskStatus.ASSESSED, ProjectRiskStatus.MONITORING].includes(
            risk.status,
          )
        ) {
          throw new BadRequestException(
            `Risiko tidak dapat diubah ke MITIGATING dari status ${risk.status} (harus ASSESSED atau MONITORING).`,
          );
        }
        if (!risk.mitigationPlan || risk.mitigationPlan.trim().length === 0) {
          throw new BadRequestException(
            "Rencana mitigasi (mitigationPlan) wajib diisi sebelum beralih ke status MITIGATING.",
          );
        }
      } else if (targetStatus === ProjectRiskStatus.MONITORING) {
        if (risk.status !== ProjectRiskStatus.MITIGATING) {
          throw new BadRequestException(
            `Risiko tidak dapat diubah ke MONITORING dari status ${risk.status} (harus MITIGATING).`,
          );
        }
      }

      const oldVersion = risk.version;
      const oldStatus = risk.status;
      risk.status = targetStatus;
      risk.version = oldVersion + 1;
      await queryRunner.manager.save(ProjectRisk, risk);

      const audit = queryRunner.manager.create(AuditLog, {
        table_name: "project_risks",
        record_id: riskId,
        action: "PROJECT_RISK_UPDATED",
        old_value: { status: oldStatus, version: oldVersion },
        new_value: { status: targetStatus, version: risk.version },
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, audit);

      await queryRunner.commitTransaction();
    } catch (err) {
      await queryRunner.rollbackTransaction();
      throw err;
    } finally {
      await queryRunner.release();
    }

    return this.getRiskById(projectId, riskId, userId, roles);
  }

  // -------------------------------------------------------------
  // 7. MATERIALIZE RISK -> ISSUE (POST .../materialize)
  // -------------------------------------------------------------
  async materializeRisk(
    projectId: number,
    riskId: number,
    dto: MaterializeProjectRiskDto,
    userId: number,
    roles: string[],
  ): Promise<any> {
    const project = await this.getVerifiedProject(projectId, true);

    const isPortfolio = roles.some((r) =>
      ["PMO", "HEAD_OF_OPERATIONS"].includes(r),
    );
    const isAssignedPm =
      roles.includes("PROJECT_MANAGER") &&
      Number(project.managerId) === Number(userId);

    if (!isAssignedPm && !isPortfolio) {
      throw new ForbiddenException(
        "Hanya Project Manager yang ditugaskan, PMO, atau Head of Operations yang berhak mematerialisasi Risiko menjadi Issue.",
      );
    }

    if (dto.ownerId) {
      await this.validateOwnerUser(dto.ownerId);
    }

    const maxRetries = 5;
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, "");
    let attempt = 0;
    let createdIssue: ProjectIssue | null = null;

    while (attempt < maxRetries) {
      attempt++;
      const queryRunner = this.dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.startTransaction();

      try {
        const risk = await queryRunner.manager.findOne(ProjectRisk, {
          where: { id: riskId, projectId },
          lock: { mode: "pessimistic_write" },
        });

        if (!risk) {
          throw new NotFoundException(`Risiko #${riskId} tidak ditemukan.`);
        }

        if (Number(risk.version) !== Number(dto.expectedVersion)) {
          throw new ConflictException(
            "Gagal: Versi Risiko tidak cocok (konflik konkurensi).",
          );
        }

        const eligibleStatuses = [
          ProjectRiskStatus.ASSESSED,
          ProjectRiskStatus.MITIGATING,
          ProjectRiskStatus.MONITORING,
        ];
        if (!eligibleStatuses.includes(risk.status)) {
          throw new BadRequestException(
            `Risiko dengan status ${risk.status} tidak dapat dimaterialisasi (harus ASSESSED, MITIGATING, atau MONITORING).`,
          );
        }

        // Strict 0..1 Cardinality check: verify no ProjectIssue exists with sourceRiskId = risk.id
        const existingIssue = await queryRunner.manager.findOne(ProjectIssue, {
          where: { sourceRiskId: riskId },
        });
        if (existingIssue) {
          throw new ConflictException(
            `Risiko #${riskId} sudah dimaterialisasi menjadi Issue #${existingIssue.issueNumber}.`,
          );
        }

        // Target Issue owner
        const targetOwnerId = dto.ownerId || risk.ownerId;

        // Concurrency-safe number generation for Issue
        const count = await queryRunner.manager.count(ProjectIssue, {
          where: { issueNumber: Like(`ISS-${dateStr}-%`) },
        });
        const seq = String(count + attempt).padStart(3, "0");
        const candidateIssueNumber = `ISS-${dateStr}-${seq}`;

        // 1. INSERT new ProjectIssue
        const newIssue = queryRunner.manager.create(ProjectIssue, {
          projectId: risk.projectId,
          taskId: risk.taskId || null,
          issueNumber: candidateIssueNumber,
          title: risk.title,
          description: risk.description,
          category: risk.category,
          severity: dto.severity,
          priority: dto.priority,
          status: ProjectIssueStatus.OPEN,
          ownerId: targetOwnerId,
          reportedById: userId,
          reportedAt: new Date(),
          dueDate: dto.dueDate || null,
          sourceRiskId: risk.id,
          version: 1,
        });

        createdIssue = await queryRunner.manager.save(ProjectIssue, newIssue);

        // 2. UPDATE ProjectRisk: status = MATERIALIZED, version = version + 1
        const oldRiskVersion = risk.version;
        risk.status = ProjectRiskStatus.MATERIALIZED;
        risk.version = oldRiskVersion + 1;
        await queryRunner.manager.save(ProjectRisk, risk);

        // 3. AUDIT LOGS
        const riskAudit = queryRunner.manager.create(AuditLog, {
          table_name: "project_risks",
          record_id: risk.id,
          action: "PROJECT_RISK_MATERIALIZED",
          old_value: { status: risk.status, version: oldRiskVersion },
          new_value: {
            status: ProjectRiskStatus.MATERIALIZED,
            materializedIssueId: createdIssue.id,
            materializedIssueNumber: createdIssue.issueNumber,
            version: risk.version,
          },
          created_by: userId,
        });
        await queryRunner.manager.save(AuditLog, riskAudit);

        const issueAudit = queryRunner.manager.create(AuditLog, {
          table_name: "project_issues",
          record_id: createdIssue.id,
          action: "PROJECT_ISSUE_CREATED",
          old_value: null,
          new_value: {
            issueNumber: createdIssue.issueNumber,
            title: createdIssue.title,
            severity: createdIssue.severity,
            priority: createdIssue.priority,
            status: createdIssue.status,
            ownerId: createdIssue.ownerId,
            sourceRiskId: risk.id,
            version: createdIssue.version,
          },
          created_by: userId,
        });
        await queryRunner.manager.save(AuditLog, issueAudit);

        // 4. OUTBOX EVENTS
        const riskOutbox = queryRunner.manager.create(OutboxEvent, {
          event_id: randomUUID(),
          event_name: "project.risk.materialized",
          event_version: "1",
          aggregate_type: "ProjectRisk",
          aggregate_id: Number(risk.id),
          payload: {
            riskId: risk.id,
            projectId: risk.projectId,
            materializedIssueId: createdIssue.id,
            materializedIssueNumber: createdIssue.issueNumber,
            actorId: userId,
          },
          status: OutboxStatus.PENDING,
          retry_count: 0,
        });
        await queryRunner.manager.save(OutboxEvent, riskOutbox);

        const issueOutbox = queryRunner.manager.create(OutboxEvent, {
          event_id: randomUUID(),
          event_name: "project.issue.created",
          event_version: "1",
          aggregate_type: "ProjectIssue",
          aggregate_id: Number(createdIssue.id),
          payload: {
            issueId: createdIssue.id,
            issueNumber: createdIssue.issueNumber,
            projectId: createdIssue.projectId,
            title: createdIssue.title,
            severity: createdIssue.severity,
            priority: createdIssue.priority,
            ownerId: createdIssue.ownerId,
            reportedById: createdIssue.reportedById,
            sourceRiskId: risk.id,
          },
          status: OutboxStatus.PENDING,
          retry_count: 0,
        });
        await queryRunner.manager.save(OutboxEvent, issueOutbox);

        await queryRunner.commitTransaction();
        break;
      } catch (err: any) {
        await queryRunner.rollbackTransaction();

        const isIssueNumberCollision =
          (err?.code === "ER_DUP_ENTRY" || err?.errno === 1062) &&
          (String(err?.message || "").includes(
            "uq_project_issues_issue_number",
          ) ||
            String(err?.message || "").includes("issue_number"));

        if (isIssueNumberCollision && attempt < maxRetries) {
          this.logger.warn(
            `Issue number collision during risk materialization on attempt ${attempt}/${maxRetries}. Retrying...`,
          );
          await new Promise((resolve) =>
            setTimeout(resolve, Math.random() * 50 + 20),
          );
          continue;
        }

        // If duplicate sourceRiskId constraint failed (e.g., concurrent materialization):
        const isSourceRiskCollision =
          (err?.code === "ER_DUP_ENTRY" || err?.errno === 1062) &&
          (String(err?.message || "").includes(
            "uq_project_issues_source_risk",
          ) ||
            String(err?.message || "").includes("source_risk_id"));
        if (isSourceRiskCollision) {
          throw new ConflictException(
            "Risiko ini telah dimaterialisasi oleh proses lain.",
          );
        }

        if (isIssueNumberCollision) {
          throw new ConflictException(
            "Gagal menghasilkan nomor Issue unik untuk materialisasi.",
          );
        }

        throw err;
      } finally {
        await queryRunner.release();
      }
    }

    if (!createdIssue) {
      throw new ConflictException("Gagal memproses materialisasi Risiko.");
    }

    return {
      issue: createdIssue,
      risk: await this.getRiskById(projectId, riskId, userId, roles),
    };
  }

  // -------------------------------------------------------------
  // 8. CLOSE RISK
  // -------------------------------------------------------------
  async closeRisk(
    projectId: number,
    riskId: number,
    dto: TransitionVersionDto,
    userId: number,
    roles: string[],
  ): Promise<any> {
    const project = await this.getVerifiedProject(projectId, true);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const risk = await queryRunner.manager.findOne(ProjectRisk, {
        where: { id: riskId, projectId },
        lock: { mode: "pessimistic_write" },
      });

      if (!risk) {
        throw new NotFoundException(`Risiko #${riskId} tidak ditemukan.`);
      }

      const isPortfolio = roles.some((r) =>
        ["PMO", "HEAD_OF_OPERATIONS"].includes(r),
      );
      const isAssignedPm =
        roles.includes("PROJECT_MANAGER") &&
        Number(project.managerId) === Number(userId);

      // Non-PM Owner authority CANNOT close risk!
      if (!isAssignedPm && !isPortfolio) {
        throw new ForbiddenException(
          "Hanya Project Manager yang ditugaskan, PMO, atau Head of Operations yang berhak menutup Risiko.",
        );
      }

      const allowedStatuses = [
        ProjectRiskStatus.ASSESSED,
        ProjectRiskStatus.MITIGATING,
        ProjectRiskStatus.MONITORING,
      ];
      if (!allowedStatuses.includes(risk.status)) {
        throw new BadRequestException(
          `Risiko tidak dapat ditutup dari status ${risk.status} (harus ASSESSED, MITIGATING, atau MONITORING).`,
        );
      }

      if (Number(risk.version) !== Number(dto.expectedVersion)) {
        throw new ConflictException(
          "Gagal: Versi Risiko tidak cocok (konflik konkurensi).",
        );
      }

      const oldVersion = risk.version;
      const oldStatus = risk.status;
      risk.status = ProjectRiskStatus.CLOSED;
      risk.closedById = userId;
      risk.closedAt = new Date();
      risk.version = oldVersion + 1;
      await queryRunner.manager.save(ProjectRisk, risk);

      const audit = queryRunner.manager.create(AuditLog, {
        table_name: "project_risks",
        record_id: riskId,
        action: "PROJECT_RISK_CLOSED",
        old_value: { status: oldStatus, version: oldVersion },
        new_value: {
          status: ProjectRiskStatus.CLOSED,
          closedById: userId,
          version: risk.version,
        },
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, audit);

      const outbox = queryRunner.manager.create(OutboxEvent, {
        event_id: randomUUID(),
        event_name: "project.risk.closed",
        event_version: "1",
        aggregate_type: "ProjectRisk",
        aggregate_id: riskId,
        payload: { riskId, projectId, closedBy: userId },
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

    return this.getRiskById(projectId, riskId, userId, roles);
  }

  // -------------------------------------------------------------
  // 9. CANCEL RISK
  // -------------------------------------------------------------
  async cancelRisk(
    projectId: number,
    riskId: number,
    dto: CancelProjectRiskDto,
    userId: number,
    roles: string[],
  ): Promise<any> {
    const project = await this.getVerifiedProject(projectId, true);
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      const risk = await queryRunner.manager.findOne(ProjectRisk, {
        where: { id: riskId, projectId },
        lock: { mode: "pessimistic_write" },
      });

      if (!risk) {
        throw new NotFoundException(`Risiko #${riskId} tidak ditemukan.`);
      }

      const isPortfolio = roles.some((r) =>
        ["PMO", "HEAD_OF_OPERATIONS"].includes(r),
      );
      const isAssignedPm =
        roles.includes("PROJECT_MANAGER") &&
        Number(project.managerId) === Number(userId);

      if (!isAssignedPm && !isPortfolio) {
        throw new ForbiddenException(
          "Hanya Project Manager yang ditugaskan, PMO, atau Head of Operations yang berhak membatalkan Risiko.",
        );
      }

      const allowedStatuses = [
        ProjectRiskStatus.IDENTIFIED,
        ProjectRiskStatus.ASSESSED,
        ProjectRiskStatus.MITIGATING,
        ProjectRiskStatus.MONITORING,
      ];
      if (!allowedStatuses.includes(risk.status)) {
        throw new BadRequestException(
          `Risiko tidak dapat dibatalkan dari status ${risk.status} (hanya IDENTIFIED, ASSESSED, MITIGATING, atau MONITORING).`,
        );
      }

      if (Number(risk.version) !== Number(dto.expectedVersion)) {
        throw new ConflictException(
          "Gagal: Versi Risiko tidak cocok (konflik konkurensi).",
        );
      }

      const oldVersion = risk.version;
      const oldStatus = risk.status;
      risk.status = ProjectRiskStatus.CANCELLED;
      risk.version = oldVersion + 1;
      await queryRunner.manager.save(ProjectRisk, risk);

      const audit = queryRunner.manager.create(AuditLog, {
        table_name: "project_risks",
        record_id: riskId,
        action: "PROJECT_RISK_CANCELLED",
        old_value: { status: oldStatus, version: oldVersion },
        new_value: {
          status: ProjectRiskStatus.CANCELLED,
          reason: dto.reason.trim(),
          version: risk.version,
        },
        created_by: userId,
      });
      await queryRunner.manager.save(AuditLog, audit);

      const outbox = queryRunner.manager.create(OutboxEvent, {
        event_id: randomUUID(),
        event_name: "project.risk.cancelled",
        event_version: "1",
        aggregate_type: "ProjectRisk",
        aggregate_id: riskId,
        payload: {
          riskId,
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

    return this.getRiskById(projectId, riskId, userId, roles);
  }

  // -------------------------------------------------------------
  // DERIVED FIELDS
  // -------------------------------------------------------------
  private mapDerivedRiskFields(risk: ProjectRisk): any {
    const isTerminal = [
      ProjectRiskStatus.MATERIALIZED,
      ProjectRiskStatus.CLOSED,
      ProjectRiskStatus.CANCELLED,
    ].includes(risk.status);

    const isReviewOverdue = Boolean(
      risk.reviewDate &&
      new Date(risk.reviewDate) < new Date(new Date().toDateString()) &&
      !isTerminal,
    );

    return {
      ...risk,
      isReviewOverdue,
    };
  }
}
