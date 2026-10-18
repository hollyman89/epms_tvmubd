import 'mysql2';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';
import { BadRequestException, ConflictException, ForbiddenException, NotFoundException } from '@nestjs/common';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as dotenv from 'dotenv';

import { ProjectModule } from './project.module';
import { ProjectService } from './project.service';
import { AuditModule } from '../audit/audit.module';
import { Project } from '../../entities/project.entity';
import { Task } from '../../entities/task.entity';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { User } from '../../entities/user.entity';
import { Document } from '../../entities/document.entity';
import { ProjectBaseline } from '../../entities/project-baseline.entity';
import { ProjectProgressLog } from '../../entities/project-progress-log.entity';
import { ProjectProgressEvidence } from '../../entities/project-progress-evidence.entity';

dotenv.config();
jest.setTimeout(60000);

describe('P6.5-B2 — Critical Progress & Independent Verification Test Suite', () => {
  let moduleRef: TestingModule;
  let service: ProjectService;
  let dataSource: DataSource;

  // Track created entity IDs for clean FK-safe teardown
  const createdEvidenceIds: number[] = [];
  const createdProgressLogIds: number[] = [];
  const createdDocumentIds: number[] = [];
  const createdTaskIds: number[] = [];
  const createdBaselineWbsItemIds: number[] = [];
  const createdBaselineIds: number[] = [];
  const createdWbsIds: number[] = [];
  const createdProjectIds: number[] = [];
  const createdUserIds: number[] = [];

  beforeAll(async () => {
    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'mysql',
          host: process.env.DATABASE_HOST || '127.0.0.1',
          port: parseInt(process.env.DATABASE_PORT || '3306', 10),
          username: process.env.DATABASE_USER || 'epms_app_user',
          password: process.env.DATABASE_PASSWORD || 'Epms_App_Us3r_2026!',
          database: process.env.DATABASE_NAME || 'epms_tvmubd_db',
          entities: [__dirname + '/../../entities/**/*.entity{.ts,.js}'],
          synchronize: false,
          retryAttempts: 1,
        }),
        EventEmitterModule.forRoot(),
        ProjectModule,
        AuditModule,
      ],
    }).compile();

    await moduleRef.init();

    service = moduleRef.get<ProjectService>(ProjectService);
    dataSource = moduleRef.get<DataSource>(DataSource);
  });

  afterAll(async () => {
    if (moduleRef) {
      await moduleRef.close();
    }
  });

  afterEach(async () => {
    // Teardown in strict foreign-key safe order
    if (createdProgressLogIds.length > 0) {
      // 1. Delete evidence referencing these progress logs
      await dataSource.query(
        `DELETE FROM project_progress_evidence WHERE progress_log_id IN (${createdProgressLogIds.join(',')})`,
      );
      // 2. Delete audit logs referencing these progress logs
      await dataSource.query(
        `DELETE FROM audit_logs WHERE table_name = 'ProjectProgressLog' AND record_id IN (${createdProgressLogIds.join(',')})`,
      );
      // 3. Delete progress logs
      await dataSource.query(
        `DELETE FROM project_progress_logs WHERE id IN (${createdProgressLogIds.join(',')})`,
      );
      createdProgressLogIds.length = 0;
    }

    if (createdEvidenceIds.length > 0) {
      await dataSource.query(
        `DELETE FROM project_progress_evidence WHERE id IN (${createdEvidenceIds.join(',')})`,
      );
      createdEvidenceIds.length = 0;
    }

    if (createdDocumentIds.length > 0) {
      await dataSource.query(
        `DELETE FROM documents WHERE id IN (${createdDocumentIds.join(',')})`,
      );
      createdDocumentIds.length = 0;
    }

    if (createdTaskIds.length > 0) {
      await dataSource.query(
        `DELETE FROM tasks WHERE id IN (${createdTaskIds.join(',')})`,
      );
      createdTaskIds.length = 0;
    }

    if (createdBaselineWbsItemIds.length > 0) {
      await dataSource.query(
        `DELETE FROM project_baseline_wbs_items WHERE id IN (${createdBaselineWbsItemIds.join(',')})`,
      );
      createdBaselineWbsItemIds.length = 0;
    }

    if (createdBaselineIds.length > 0) {
      await dataSource.query(
        `DELETE FROM project_baselines WHERE id IN (${createdBaselineIds.join(',')})`,
      );
      createdBaselineIds.length = 0;
    }

    if (createdWbsIds.length > 0) {
      await dataSource.query(
        `DELETE FROM work_breakdown_structures WHERE id IN (${createdWbsIds.join(',')})`,
      );
      createdWbsIds.length = 0;
    }

    if (createdProjectIds.length > 0) {
      await dataSource.query(
        `DELETE FROM projects WHERE id IN (${createdProjectIds.join(',')})`,
      );
      createdProjectIds.length = 0;
    }

    if (createdUserIds.length > 0) {
      await dataSource.query(
        `DELETE FROM users WHERE id IN (${createdUserIds.join(',')})`,
      );
      createdUserIds.length = 0;
    }
  });

  // Local helper functions
  async function createUser(prefix: string): Promise<User> {
    const unique = `${prefix}_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const user = dataSource.getRepository(User).create({
      email: `${unique}@test.epms.tvm.com`,
      passwordHash: '$2b$10$FakeHashForTestingOnly1234567890',
      fullName: `Test User ${unique}`,
      isActive: true,
    });
    const saved = await dataSource.getRepository(User).save(user);
    createdUserIds.push(saved.id);
    return saved;
  }

  async function createProject(managerId: number): Promise<Project> {
    const unique = `PRJ_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const project = dataSource.getRepository(Project).create({
      code: unique,
      name: `Test Project ${unique}`,
      managerId,
      status: 'IN_PROGRESS',
    });
    const saved = await dataSource.getRepository(Project).save(project);
    createdProjectIds.push(saved.id);
    return saved;
  }

  async function createWbs(projectId: number): Promise<WorkBreakdownStructure> {
    const uniqueSuffix = `${Date.now().toString().slice(-4)}_${Math.floor(Math.random() * 1000)}`;
    const wbs = dataSource.getRepository(WorkBreakdownStructure).create({
      projectId,
      code: `1.${uniqueSuffix}`,
      name: `Test Leaf WBS ${uniqueSuffix}`,
      level: 1,
      weightPercentage: 100,
    });
    const saved = await dataSource.getRepository(WorkBreakdownStructure).save(wbs);
    createdWbsIds.push(saved.id);
    return saved;
  }

  async function createTask(
    projectId: number,
    wbsId: number,
    progress = 0,
    isMilestone = false,
  ): Promise<Task> {
    const unique = `Task_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const task = dataSource.getRepository(Task).create({
      projectId,
      wbsId,
      name: unique,
      progress,
      isMilestone,
      status: 'IN_PROGRESS',
    });
    const saved = await dataSource.getRepository(Task).save(task);
    createdTaskIds.push(saved.id);
    return saved;
  }

  async function createBaseline(projectId: number, userId: number): Promise<ProjectBaseline> {
    const baseline = dataSource.getRepository(ProjectBaseline).create({
      project_id: projectId,
      version_number: 1,
      status: 'ACTIVE',
      created_by: userId,
    });
    const saved = await dataSource.getRepository(ProjectBaseline).save(baseline);
    createdBaselineIds.push(saved.id);
    return saved;
  }

  async function createDocument(projectId: number, userId: number): Promise<Document> {
    const unique = `doc_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const doc = dataSource.getRepository(Document).create({
      entityType: 'PROJECT',
      entityId: projectId,
      fileName: `${unique}.pdf`,
      filePath: `projects/${unique}.pdf`,
      createdBy: userId,
    });
    const saved = await dataSource.getRepository(Document).save(doc);
    createdDocumentIds.push(saved.id);
    return saved;
  }

  // TEST CASES (1 to 24)

  // Case 1: Milestone 100% -> PENDING_VERIFICATION
  it('1. Milestone 100% -> PENDING_VERIFICATION', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 50, true);
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    const res = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 100,
        reason: 'Milestone reached 100%',
        documentIds: [doc.id],
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );

    createdProgressLogIds.push(res.id);
    expect(res.status).toBe('PENDING_VERIFICATION');
    expect(res.reportedProgress).toBe(100);
    expect(res.previousProgress).toBe(50);
    expect(res.eventType).toBe('MILESTONE_COMPLETION');

    // Verify task.progress remains unmutated at 50
    const refreshed = await dataSource.getRepository(Task).findOneBy({ id: task.id });
    expect(Number(refreshed!.progress)).toBe(50);
  });

  // Case 2: Valid explicit critical event -> PENDING_VERIFICATION
  it('2. Valid explicit critical event -> PENDING_VERIFICATION', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 40, false);
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    const res = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 75,
        eventType: 'FAT_PASSED',
        reason: 'Factory Acceptance Test passed',
        documentIds: [doc.id],
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );

    createdProgressLogIds.push(res.id);
    expect(res.status).toBe('PENDING_VERIFICATION');
    expect(res.eventType).toBe('FAT_PASSED');
    expect(res.reportedProgress).toBe(75);
    expect(res.previousProgress).toBe(40);
  });

  // Case 3: Unknown event type rejected
  it('3. Unknown event type rejected', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 40, false);
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    await expect(
      service.createProgressClaim(
        project.id,
        task.id,
        {
          reportedProgress: 75,
          eventType: 'UNKNOWN_EVENT',
          reason: 'Testing unknown event',
          documentIds: [doc.id],
        },
        pm.id,
        ['PROJECT_MANAGER'],
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // Case 4: Missing explicit event type rejected (when upward non-milestone)
  it('4. Missing explicit event type rejected', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 40, false);
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    await expect(
      service.createProgressClaim(
        project.id,
        task.id,
        {
          reportedProgress: 60, // Routine upward without eventType or milestone
          reason: 'Routine progress submitted to claim endpoint',
          documentIds: [doc.id],
        },
        pm.id,
        ['PROJECT_MANAGER'],
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // Case 5: Missing reason rejected
  it('5. Missing reason rejected', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 40, false);
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    await expect(
      service.createProgressClaim(
        project.id,
        task.id,
        {
          reportedProgress: 75,
          eventType: 'FAT_PASSED',
          reason: '',
          documentIds: [doc.id],
        },
        pm.id,
        ['PROJECT_MANAGER'],
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // Case 6: Critical claim without evidence rejected
  it('6. Critical claim without evidence rejected', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 40, false);
    await createBaseline(project.id, pm.id);

    await expect(
      service.createProgressClaim(
        project.id,
        task.id,
        {
          reportedProgress: 75,
          eventType: 'COMMISSIONING',
          reason: 'Testing missing evidence',
          documentIds: [],
        },
        pm.id,
        ['PROJECT_MANAGER'],
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // Case 7: Evidence from another project rejected
  it('7. Evidence from another project rejected', async () => {
    const pm = await createUser('pm');
    const project1 = await createProject(pm.id);
    const project2 = await createProject(pm.id);
    const wbs = await createWbs(project1.id);
    const task = await createTask(project1.id, wbs.id, 40, false);
    await createBaseline(project1.id, pm.id);
    // Document belongs to project2!
    const docFromOtherProject = await createDocument(project2.id, pm.id);

    await expect(
      service.createProgressClaim(
        project1.id,
        task.id,
        {
          reportedProgress: 75,
          eventType: 'SAT_PASSED',
          reason: 'Testing cross project doc',
          documentIds: [docFromOtherProject.id],
        },
        pm.id,
        ['PROJECT_MANAGER'],
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // Case 8: Critical claim does not mutate tasks.progress
  it('8. Critical claim does not mutate tasks.progress', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 30, true);
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    const res = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 100,
        reason: 'Milestone 100% claim',
        documentIds: [doc.id],
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(res.id);

    // Initial progress was 30, claim was 100.
    // Assert task remains strictly 30!
    const inDb = await dataSource.getRepository(Task).findOneBy({ id: task.id });
    expect(Number(inDb!.progress)).toBe(30);
  });

  // Case 9: baseline_id captured correctly
  it('9. baseline_id captured correctly', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 20, false);
    const baseline = await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    const res = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 60,
        eventType: 'FAT_PASSED',
        reason: 'Check baseline ID',
        documentIds: [doc.id],
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(res.id);

    expect(Number(res.baselineId)).toBe(Number(baseline.id));
    const inDb = await dataSource.getRepository(ProjectProgressLog).findOneBy({ id: res.id });
    expect(Number(inDb!.baseline_id)).toBe(Number(baseline.id));
  });

  // Case 10: submitted_by captured correctly
  it('10. submitted_by captured correctly', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 20, false);
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    const res = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 50,
        eventType: 'SAT_PASSED',
        reason: 'Check submittedBy',
        documentIds: [doc.id],
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(res.id);

    expect(Number(res.submittedBy)).toBe(pm.id);
    expect(res.verifiedBy).toBeNull();
    expect(res.verifiedAt).toBeNull();
  });

  // Case 11: Assigned PM authorization succeeds
  it('11. Assigned PM authorization succeeds', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 10, true);
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    const res = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 100,
        reason: 'Assigned PM submission',
        documentIds: [doc.id],
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(res.id);
    expect(res.id).toBeDefined();

    // Super Admin administrative compatibility bypass
    const admin = await createUser('admin');
    const doc2 = await createDocument(project.id, admin.id);
    const wbs2 = await createWbs(project.id);
    const task2 = await createTask(project.id, wbs2.id, 20, true);
    const adminRes = await service.createProgressClaim(
      project.id,
      task2.id,
      {
        reportedProgress: 100,
        reason: 'Super Admin submission',
        documentIds: [doc2.id],
      },
      admin.id,
      ['SUPER_ADMIN'],
    );
    createdProgressLogIds.push(adminRes.id);
    expect(adminRes.id).toBeDefined();
  });

  // Case 12: Unauthorized submitter rejected
  it('12. Unauthorized submitter rejected', async () => {
    const pm1 = await createUser('pm1');
    const pm2 = await createUser('pm2');
    const project = await createProject(pm1.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 10, true);
    await createBaseline(project.id, pm1.id);
    const doc = await createDocument(project.id, pm2.id);

    // PM2 is not assigned to project -> rejected
    await expect(
      service.createProgressClaim(
        project.id,
        task.id,
        {
          reportedProgress: 100,
          reason: 'Unassigned PM submission',
          documentIds: [doc.id],
        },
        pm2.id,
        ['PROJECT_MANAGER'],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  // Case 13: PMO approval succeeds
  it('13. PMO approval succeeds', async () => {
    const pm = await createUser('pm');
    const pmo = await createUser('pmo');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 25, true);
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    const claim = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 100,
        reason: 'PMO approval test',
        documentIds: [doc.id],
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(claim.id);

    const verifyRes = await service.verifyProgressLog(
      project.id,
      claim.id,
      'APPROVE',
      null,
      pmo.id,
      ['PMO'],
    );

    expect(verifyRes.status).toBe('OFFICIAL');
    expect(verifyRes.decision).toBe('APPROVE');
    expect(Number(verifyRes.verifiedBy)).toBe(pmo.id);
  });

  // Case 14: HEAD_OF_OPERATIONS approval succeeds
  it('14. HEAD_OF_OPERATIONS approval succeeds', async () => {
    const pm = await createUser('pm');
    const hops = await createUser('hops');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 35, false);
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    const claim = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 90,
        eventType: 'BAST_SUBMITTED',
        reason: 'HOPS approval test',
        documentIds: [doc.id],
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(claim.id);

    const verifyRes = await service.verifyProgressLog(
      project.id,
      claim.id,
      'APPROVE',
      null,
      hops.id,
      ['HEAD_OF_OPERATIONS'],
    );

    expect(verifyRes.status).toBe('OFFICIAL');
    expect(verifyRes.decision).toBe('APPROVE');
    expect(Number(verifyRes.verifiedBy)).toBe(hops.id);
  });

  // Case 15: PM cannot verify own claim
  it('15. PM cannot verify own claim (Segregation of Duties)', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 20, true);
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    const claim = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 100,
        reason: 'Self verify test',
        documentIds: [doc.id],
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(claim.id);

    // PM attempts to verify own claim (even if pretending to have PMO role)
    await expect(
      service.verifyProgressLog(
        project.id,
        claim.id,
        'APPROVE',
        null,
        pm.id,
        ['PMO'],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  // Case 16: Unauthorized verifier rejected
  it('16. Unauthorized verifier rejected', async () => {
    const pm = await createUser('pm');
    const unauthorized = await createUser('finance');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 20, true);
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    const claim = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 100,
        reason: 'Role check test',
        documentIds: [doc.id],
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(claim.id);

    // Finance / normal PM role cannot verify
    await expect(
      service.verifyProgressLog(
        project.id,
        claim.id,
        'APPROVE',
        null,
        unauthorized.id,
        ['FINANCE'],
      ),
    ).rejects.toThrow(ForbiddenException);

    // Super Admin alone is NOT a normal verifier
    const admin = await createUser('admin');
    await expect(
      service.verifyProgressLog(
        project.id,
        claim.id,
        'APPROVE',
        null,
        admin.id,
        ['SUPER_ADMIN'],
      ),
    ).rejects.toThrow(ForbiddenException);
  });

  // Case 17: APPROVE -> OFFICIAL + tasks.progress updated
  it('17. APPROVE -> OFFICIAL + tasks.progress updated', async () => {
    const pm = await createUser('pm');
    const pmo = await createUser('pmo');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    // Initial: 20
    const task = await createTask(project.id, wbs.id, 20, false);
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    // Claim: 80
    const claim = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 80,
        eventType: 'FAT_PASSED',
        reason: 'Approve mutates progress',
        documentIds: [doc.id],
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(claim.id);

    // Before approval: task remains 20
    let taskInDb = await dataSource.getRepository(Task).findOneBy({ id: task.id });
    expect(Number(taskInDb!.progress)).toBe(20);

    // Approve
    await service.verifyProgressLog(project.id, claim.id, 'APPROVE', null, pmo.id, ['PMO']);

    // After approval: task becomes 80
    taskInDb = await dataSource.getRepository(Task).findOneBy({ id: task.id });
    expect(Number(taskInDb!.progress)).toBe(80);
  });

  // Case 18: REJECT -> REJECTED + tasks.progress unchanged
  it('18. REJECT -> REJECTED + tasks.progress unchanged', async () => {
    const pm = await createUser('pm');
    const pmo = await createUser('pmo');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    // Initial: 20
    const task = await createTask(project.id, wbs.id, 20, false);
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    // Claim: 80
    const claim = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 80,
        eventType: 'SAT_PASSED',
        reason: 'Reject preserves progress',
        documentIds: [doc.id],
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(claim.id);

    // Reject with reason
    const verifyRes = await service.verifyProgressLog(
      project.id,
      claim.id,
      'REJECT',
      'Dokumen pengujian tidak lengkap',
      pmo.id,
      ['PMO'],
    );

    expect(verifyRes.status).toBe('REJECTED');
    expect(verifyRes.rejectionReason).toBe('Dokumen pengujian tidak lengkap');

    // After rejection: task remains 20
    const taskInDb = await dataSource.getRepository(Task).findOneBy({ id: task.id });
    expect(Number(taskInDb!.progress)).toBe(20);
  });

  // Case 19: REJECT requires rejection reason
  it('19. REJECT requires rejection reason', async () => {
    const pm = await createUser('pm');
    const pmo = await createUser('pmo');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 20, true);
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    const claim = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 100,
        reason: 'Missing rejection reason test',
        documentIds: [doc.id],
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(claim.id);

    await expect(
      service.verifyProgressLog(
        project.id,
        claim.id,
        'REJECT',
        null, // No rejectionReason!
        pmo.id,
        ['PMO'],
      ),
    ).rejects.toThrow(BadRequestException);
  });

  // Case 20: OFFICIAL / REJECTED cannot be verified again
  it('20. OFFICIAL / REJECTED cannot be verified again', async () => {
    const pm = await createUser('pm');
    const pmo = await createUser('pmo');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 20, true);
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    const claim = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 100,
        reason: 'Idempotency test',
        documentIds: [doc.id],
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(claim.id);

    // 1st verify: Approve
    await service.verifyProgressLog(project.id, claim.id, 'APPROVE', null, pmo.id, ['PMO']);

    // 2nd verify attempt -> ConflictException
    await expect(
      service.verifyProgressLog(project.id, claim.id, 'REJECT', 'Try reject after approve', pmo.id, ['PMO']),
    ).rejects.toThrow(ConflictException);
  });

  // Case 21: Downward correction -> PENDING_VERIFICATION
  it('21. Downward correction -> PENDING_VERIFICATION', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    // Task currently official at 80
    const task = await createTask(project.id, wbs.id, 80, false);
    await createBaseline(project.id, pm.id);

    // Downward correction to 60: evidence is NOT automatically required per BD-03
    const res = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 60,
        reason: 'Scope de-scoping due to client adjustment',
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(res.id);

    expect(res.status).toBe('PENDING_VERIFICATION');
    expect(res.eventType).toBe('DOWNWARD_CORRECTION');
    expect(res.reportedProgress).toBe(60);
    expect(res.previousProgress).toBe(80);
    expect(res.progressDelta).toBe(-20);
  });

  // Case 22: Downward correction does not immediately mutate task
  it('22. Downward correction does not immediately mutate task', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 80, false);
    await createBaseline(project.id, pm.id);

    const res = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 60,
        reason: 'Downward pending test',
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(res.id);

    // Assert task remains 80
    const inDb = await dataSource.getRepository(Task).findOneBy({ id: task.id });
    expect(Number(inDb!.progress)).toBe(80);
  });

  // Case 23: Approved downward correction:
  // - creates NEW OFFICIAL correction event
  // - preserves original OFFICIAL historical event
  // - updates tasks.progress
  it('23. Approved downward correction preserves history and applies update', async () => {
    const pm = await createUser('pm');
    const pmo = await createUser('pmo');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const baseline = await createBaseline(project.id, pm.id);

    // 1. Establish historical 80% OFFICIAL log
    const initialTask = await createTask(project.id, wbs.id, 80, false);
    const originalLog = dataSource.getRepository(ProjectProgressLog).create({
      project_id: project.id,
      task_id: initialTask.id,
      wbs_id: wbs.id,
      baseline_id: baseline.id,
      previous_progress: 0,
      reported_progress: 80,
      progress_delta: 80,
      effective_date: new Date().toISOString().split('T')[0],
      event_type: 'ROUTINE_UPDATE',
      status: 'OFFICIAL',
      submitted_by: pm.id,
      verified_by: null,
      verified_at: null,
      reason: 'Initial official 80%',
    });
    const savedOriginalLog = await dataSource.getRepository(ProjectProgressLog).save(originalLog);
    createdProgressLogIds.push(savedOriginalLog.id);

    // 2. Submit downward correction claim to 60%
    const downwardClaim = await service.createProgressClaim(
      project.id,
      initialTask.id,
      {
        reportedProgress: 60,
        reason: 'Approved downward correction flow',
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(downwardClaim.id);

    // 3. PMO approves downward correction
    await service.verifyProgressLog(
      project.id,
      downwardClaim.id,
      'APPROVE',
      null,
      pmo.id,
      ['PMO'],
    );

    // 4. Assertions:
    // a. Original 80% log remains OFFICIAL (never mutated to REJECTED)
    const refreshedOriginalLog = await dataSource
      .getRepository(ProjectProgressLog)
      .findOneBy({ id: savedOriginalLog.id });
    expect(refreshedOriginalLog!.status).toBe('OFFICIAL');
    expect(Number(refreshedOriginalLog!.reported_progress)).toBe(80);

    // b. New 60% log becomes OFFICIAL
    const refreshedDownwardLog = await dataSource
      .getRepository(ProjectProgressLog)
      .findOneBy({ id: downwardClaim.id });
    expect(refreshedDownwardLog!.status).toBe('OFFICIAL');
    expect(Number(refreshedDownwardLog!.reported_progress)).toBe(60);

    // c. tasks.progress becomes 60
    const refreshedTask = await dataSource.getRepository(Task).findOneBy({ id: initialTask.id });
    expect(Number(refreshedTask!.progress)).toBe(60);
  });

  // Case 24: Evidence association + audit + transaction integrity
  it('24. Evidence association + audit + transaction rollback integrity', async () => {
    const pm = await createUser('pm');
    const pmo = await createUser('pmo');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 10, true);
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    // 1. Evidence association & submission audit verification
    const claim = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 100,
        reason: 'Evidence & audit & transaction test',
        documentIds: [doc.id],
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(claim.id);

    // Check project_progress_evidence was created by production code
    const evidenceRows = await dataSource.query(
      `SELECT * FROM project_progress_evidence WHERE progress_log_id = ? AND document_id = ?`,
      [claim.id, doc.id],
    );
    expect(evidenceRows.length).toBe(1);
    createdEvidenceIds.push(Number(evidenceRows[0].id));

    // Wait microtask for async EventEmitter audit log persistence
    await new Promise((r) => setTimeout(r, 150));

    // Check submission audit log
    const submitAuditRows = await dataSource.query(
      `SELECT * FROM audit_logs WHERE table_name = 'ProjectProgressLog' AND record_id = ? AND action = 'PROGRESS_CLAIM_SUBMITTED'`,
      [claim.id],
    );
    expect(submitAuditRows.length).toBe(1);
    expect(Number(submitAuditRows[0].created_by)).toBe(pm.id);

    // 2. Verification audit check
    await service.verifyProgressLog(project.id, claim.id, 'APPROVE', null, pmo.id, ['PMO']);
    await new Promise((r) => setTimeout(r, 150));

    const verifyAuditRows = await dataSource.query(
      `SELECT * FROM audit_logs WHERE table_name = 'ProjectProgressLog' AND record_id = ? AND action = 'PROGRESS_CLAIM_VERIFIED'`,
      [claim.id],
    );
    expect(verifyAuditRows.length).toBe(1);
    expect(Number(verifyAuditRows[0].created_by)).toBe(pmo.id);

    // 3. Deterministic Transaction Rollback:
    // Cause a failure after partial write: spy on EntityManager.save to fail when saving ProjectProgressEvidence
    // (after ProjectProgressLog has already been inserted by manager.save).
    const doc2 = await createDocument(project.id, pm.id);
    const wbs2 = await createWbs(project.id);
    const task2 = await createTask(project.id, wbs2.id, 15, true);

    const originalSave = EntityManager.prototype.save;
    let progressLogIdDuringFailure: number | null = null;

    jest.spyOn(EntityManager.prototype, 'save').mockImplementation(async function (
      this: any,
      targetOrEntity: any,
      maybeEntity?: any,
    ) {
      // If saving ProjectProgressLog, record its ID
      if (
        (targetOrEntity === ProjectProgressLog || targetOrEntity instanceof ProjectProgressLog) ||
        (maybeEntity instanceof ProjectProgressLog)
      ) {
        const result = await originalSave.apply(this, [targetOrEntity, maybeEntity] as any);
        progressLogIdDuringFailure = Number(result.id);
        return result;
      }
      // If saving ProjectProgressEvidence, simulate an unexpected database failure AFTER progress log write!
      if (
        targetOrEntity === ProjectProgressEvidence ||
        targetOrEntity instanceof ProjectProgressEvidence ||
        maybeEntity instanceof ProjectProgressEvidence
      ) {
        throw new Error('SIMULATED_DB_CRASH_DURING_EVIDENCE_PERSISTENCE');
      }
      return originalSave.apply(this, [targetOrEntity, maybeEntity] as any);
    });

    try {
      await expect(
        service.createProgressClaim(
          project.id,
          task2.id,
          {
            reportedProgress: 100,
            reason: 'Rollback test with partial write',
            documentIds: [doc2.id],
          },
          pm.id,
          ['PROJECT_MANAGER'],
        ),
      ).rejects.toThrow('SIMULATED_DB_CRASH_DURING_EVIDENCE_PERSISTENCE');

      // VERIFY ROLLBACK: The progress log was inserted before failure, but must be completely ROLLED BACK from MySQL!
      expect(progressLogIdDuringFailure).not.toBeNull();
      const rolledBackLog = await dataSource.query(
        `SELECT * FROM project_progress_logs WHERE id = ?`,
        [progressLogIdDuringFailure],
      );
      expect(rolledBackLog.length).toBe(0);

      // Verify no orphaned evidence row
      const orphanedEvidence = await dataSource.query(
        `SELECT * FROM project_progress_evidence WHERE progress_log_id = ?`,
        [progressLogIdDuringFailure],
      );
      expect(orphanedEvidence.length).toBe(0);

      // Verify task progress remains untouched at 15
      const taskInDb = await dataSource.getRepository(Task).findOneBy({ id: task2.id });
      expect(Number(taskInDb!.progress)).toBe(15);
    } finally {
      // Always restore original save
      jest.restoreAllMocks();
    }
  });

  // Case 25: Duplicate pending claim on same task rejected with ConflictException
  it('25. Duplicate pending claim on same task rejected with ConflictException', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 99.99, false);
    await createBaseline(project.id, pm.id);
    const doc1 = await createDocument(project.id, pm.id);
    const doc2 = await createDocument(project.id, pm.id);

    // 1st claim -> 100% PENDING_VERIFICATION
    const res1 = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 100,
        reason: 'Initial 100% claim',
        documentIds: [doc1.id],
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(res1.id);
    expect(res1.status).toBe('PENDING_VERIFICATION');

    // 2nd claim while 1st is still PENDING_VERIFICATION -> ConflictException
    await expect(
      service.createProgressClaim(
        project.id,
        task.id,
        {
          reportedProgress: 100,
          reason: 'Duplicate retry submission',
          documentIds: [doc2.id],
        },
        pm.id,
        ['PROJECT_MANAGER'],
      ),
    ).rejects.toThrow(ConflictException);
  });

  // Case 26: Non-milestone 100% completion requires evidence, approval sets status=COMPLETED and actualFinishAt
  it('26. Non-milestone 100% completion requires evidence, approval sets status=COMPLETED and actualFinishAt', async () => {
    const pm = await createUser('pm');
    const pmo = await createUser('pmo');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id);
    const task = await createTask(project.id, wbs.id, 99.99, false); // non-milestone
    // Ensure actualStartAt is set
    const initialStart = new Date('2026-10-15T10:00:00Z');
    await dataSource.getRepository(Task).update(task.id, {
      actualStartAt: initialStart,
      status: 'IN_PROGRESS',
    });
    await createBaseline(project.id, pm.id);
    const doc = await createDocument(project.id, pm.id);

    // 100% without evidence -> rejected
    await expect(
      service.createProgressClaim(
        project.id,
        task.id,
        {
          reportedProgress: 100,
          reason: 'Attempt 100% without evidence',
          documentIds: [],
        },
        pm.id,
        ['PROJECT_MANAGER'],
      ),
    ).rejects.toThrow(BadRequestException);

    // 100% with evidence -> PENDING_VERIFICATION
    const claim = await service.createProgressClaim(
      project.id,
      task.id,
      {
        reportedProgress: 100,
        reason: 'Task finished completely',
        documentIds: [doc.id],
      },
      pm.id,
      ['PROJECT_MANAGER'],
    );
    createdProgressLogIds.push(claim.id);
    expect(claim.status).toBe('PENDING_VERIFICATION');
    expect(claim.eventType).toBe('TASK_COMPLETION');

    // Official progress still 99.99
    let inDb = await dataSource.getRepository(Task).findOneBy({ id: task.id });
    expect(Number(inDb!.progress)).toBe(99.99);
    expect(inDb!.status).toBe('IN_PROGRESS');
    expect(inDb!.actualFinishAt).toBeNull();

    // PMO approves
    const approved = await service.verifyProgressLog(
      project.id,
      claim.id,
      'APPROVE',
      null,
      pmo.id,
      ['PMO'],
    );
    expect(approved.status).toBe('OFFICIAL');

    // Verify task state in DB:
    inDb = await dataSource.getRepository(Task).findOneBy({ id: task.id });
    expect(Number(inDb!.progress)).toBe(100);
    expect(inDb!.status).toBe('COMPLETED');
    expect(inDb!.actualStartAt).toEqual(initialStart);
    expect(inDb!.actualFinishAt).not.toBeNull();
  });
});
