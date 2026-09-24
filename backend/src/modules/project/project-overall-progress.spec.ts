import 'mysql2';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { DataSource } from 'typeorm';
import { EventEmitterModule } from '@nestjs/event-emitter';
import * as dotenv from 'dotenv';

import { ProjectModule } from './project.module';
import { ProjectService } from './project.service';
import { AuditModule } from '../audit/audit.module';
import { Project } from '../../entities/project.entity';
import { Task } from '../../entities/task.entity';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { User } from '../../entities/user.entity';
import { ProjectBaseline } from '../../entities/project-baseline.entity';
import { ProjectBaselineWbsItem } from '../../entities/project-baseline-wbs-item.entity';
import { ProjectProgressLog } from '../../entities/project-progress-log.entity';

dotenv.config();
jest.setTimeout(60000);

describe('P6.5-B3 — Project Overall Progress Rollup Spec (BD-01)', () => {
  let moduleRef: TestingModule;
  let service: ProjectService;
  let dataSource: DataSource;

  // Track created entity IDs for clean FK-safe teardown
  const createdProgressLogIds: number[] = [];
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
      await dataSource.query(
        `DELETE FROM project_progress_evidence WHERE progress_log_id IN (${createdProgressLogIds.join(',')})`,
      );
      await dataSource.query(
        `DELETE FROM audit_logs WHERE table_name = 'ProjectProgressLog' AND record_id IN (${createdProgressLogIds.join(',')})`,
      );
      await dataSource.query(
        `DELETE FROM project_progress_logs WHERE id IN (${createdProgressLogIds.join(',')})`,
      );
      createdProgressLogIds.length = 0;
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
        `UPDATE work_breakdown_structures SET parent_wbs_id = NULL WHERE id IN (${createdWbsIds.join(',')})`,
      );
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

  async function createProject(managerId: number, status = 'IN_PROGRESS'): Promise<Project> {
    const unique = `PRJ_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const project = dataSource.getRepository(Project).create({
      code: unique,
      name: `Test Project ${unique}`,
      managerId,
      status,
    });
    const saved = await dataSource.getRepository(Project).save(project);
    createdProjectIds.push(saved.id);
    return saved;
  }

  async function createWbs(
    projectId: number,
    code: string,
    weightPercentage = 0,
    parentWbsId: number | null = null,
  ): Promise<WorkBreakdownStructure> {
    const wbs = dataSource.getRepository(WorkBreakdownStructure).create({
      projectId,
      code,
      name: `WBS ${code}`,
      level: parentWbsId ? 2 : 1,
      parentWbsId,
      weightPercentage,
    });
    const saved = await dataSource.getRepository(WorkBreakdownStructure).save(wbs);
    createdWbsIds.push(saved.id);
    return saved;
  }

  async function createTask(
    projectId: number,
    wbsId: number,
    progress = 0,
    deletedAt: Date | null = null,
  ): Promise<Task> {
    const unique = `Task_${Date.now()}_${Math.floor(Math.random() * 10000)}`;
    const task = dataSource.getRepository(Task).create({
      projectId,
      wbsId,
      name: unique,
      progress,
      isMilestone: false,
      status: 'IN_PROGRESS',
      deletedAt: deletedAt as any,
    });
    const saved = await dataSource.getRepository(Task).save(task);
    createdTaskIds.push(saved.id);
    return saved;
  }

  async function createBaseline(
    projectId: number,
    userId: number,
    status: 'ACTIVE' | 'DRAFT' | 'SUPERSEDED' = 'ACTIVE',
    versionNumber = 1,
  ): Promise<ProjectBaseline> {
    const baseline = dataSource.getRepository(ProjectBaseline).create({
      project_id: projectId,
      version_number: versionNumber,
      status,
      created_by: userId,
    });
    const saved = await dataSource.getRepository(ProjectBaseline).save(baseline);
    createdBaselineIds.push(saved.id);
    return saved;
  }

  async function createBaselineItem(
    baselineId: number,
    wbsId: number,
    code: string,
    weightPercentage: number,
    isLeaf: boolean,
    taskId: number | null = null,
    parentWbsId: number | null = null,
  ): Promise<ProjectBaselineWbsItem> {
    const item = dataSource.getRepository(ProjectBaselineWbsItem).create({
      baseline_id: baselineId,
      wbs_id: wbsId,
      parent_wbs_id: parentWbsId,
      code,
      name: `WBS ${code}`,
      level: parentWbsId ? 2 : 1,
      weight_percentage: weightPercentage,
      is_leaf: isLeaf,
      task_id: taskId,
      task_name_snapshot: taskId ? `Snapshot Task ${taskId}` : null,
    });
    const saved = await dataSource.getRepository(ProjectBaselineWbsItem).save(item);
    createdBaselineWbsItemIds.push(saved.id);
    return saved;
  }

  // TEST SUITE: 12 LOCKED TEST CASES

  // Test 1: Single leaf, weight 100, task progress 50 -> 50.00
  it('1. Single leaf, weight 100, task progress 50 -> 50.00', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const wbs = await createWbs(project.id, '1.1', 100);
    const task = await createTask(project.id, wbs.id, 50);
    const baseline = await createBaseline(project.id, pm.id, 'ACTIVE');
    await createBaselineItem(baseline.id, wbs.id, '1.1', 100, true, task.id);

    // Direct service helper check
    const progress = await service.calculateProjectOverallProgress(project.id);
    expect(progress).toBe(50.0);

    // Operational board endpoint check
    const board = await service.getOperationalBoard(pm.id, ['PROJECT_MANAGER', 'PMO']);
    const boardProject = board.data.activeProjects.find((p: any) => p.id === project.id);
    expect(boardProject).toBeDefined();
    expect(boardProject?.overallProgress).toBe(50.0);
  });

  // Test 2: Two leaves: 60% weight x 50% + 40% weight x 100% -> 70.00
  it('2. Two leaves: 60% weight x 50% + 40% weight x 100% -> 70.00', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const wbs1 = await createWbs(project.id, '1.1', 60);
    const wbs2 = await createWbs(project.id, '1.2', 40);
    const task1 = await createTask(project.id, wbs1.id, 50);
    const task2 = await createTask(project.id, wbs2.id, 100);
    const baseline = await createBaseline(project.id, pm.id, 'ACTIVE');
    await createBaselineItem(baseline.id, wbs1.id, '1.1', 60, true, task1.id);
    await createBaselineItem(baseline.id, wbs2.id, '1.2', 40, true, task2.id);

    const progress = await service.calculateProjectOverallProgress(project.id);
    expect(progress).toBe(70.0);

    const board = await service.getOperationalBoard(pm.id, ['PROJECT_MANAGER', 'PMO']);
    const boardProject = board.data.activeProjects.find((p: any) => p.id === project.id);
    expect(boardProject?.overallProgress).toBe(70.0);
  });

  // Test 3: Four leaves: weights [25, 25, 25, 25], progress [100, 80, 40, 0] -> 55.00
  it('3. Four leaves: weights [25,25,25,25] progress [100,80,40,0] -> 55.00', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const baseline = await createBaseline(project.id, pm.id, 'ACTIVE');

    const progressValues = [100, 80, 40, 0];
    for (let i = 0; i < 4; i++) {
      const code = `1.${i + 1}`;
      const wbs = await createWbs(project.id, code, 25);
      const task = await createTask(project.id, wbs.id, progressValues[i]);
      await createBaselineItem(baseline.id, wbs.id, code, 25, true, task.id);
    }

    const progress = await service.calculateProjectOverallProgress(project.id);
    expect(progress).toBe(55.0);

    const board = await service.getOperationalBoard(pm.id, ['PROJECT_MANAGER', 'PMO']);
    const boardProject = board.data.activeProjects.find((p: any) => p.id === project.id);
    expect(boardProject?.overallProgress).toBe(55.0);
  });

  // Test 4: Parent WBS excluded
  it('4. Parent WBS excluded from progress rollup', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const baseline = await createBaseline(project.id, pm.id, 'ACTIVE');

    // Parent WBS level 1 (weight 100%, is_leaf = false)
    const parentWbs = await createWbs(project.id, '1.0', 100);
    await createBaselineItem(baseline.id, parentWbs.id, '1.0', 100, false, null);

    // Two children level 2 (weights 50% each, is_leaf = true)
    const child1 = await createWbs(project.id, '1.1', 50, parentWbs.id);
    const child2 = await createWbs(project.id, '1.2', 50, parentWbs.id);
    const task1 = await createTask(project.id, child1.id, 40);
    const task2 = await createTask(project.id, child2.id, 60);
    await createBaselineItem(baseline.id, child1.id, '1.1', 50, true, task1.id, parentWbs.id);
    await createBaselineItem(baseline.id, child2.id, '1.2', 50, true, task2.id, parentWbs.id);

    // If parent was included, denominator/weights would be distorted.
    // Leaves only: (50 * 40 + 50 * 60) / 100 = 50.00
    const progress = await service.calculateProjectOverallProgress(project.id);
    expect(progress).toBe(50.0);
  });

  // Test 5: Soft-deleted task contributes 0
  it('5. Soft-deleted task contributes 0', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const baseline = await createBaseline(project.id, pm.id, 'ACTIVE');

    const wbs1 = await createWbs(project.id, '1.1', 60);
    const wbs2 = await createWbs(project.id, '1.2', 40);
    const task1 = await createTask(project.id, wbs1.id, 50);
    // Task 2 has progress 100 but is soft-deleted
    const task2 = await createTask(project.id, wbs2.id, 100, new Date());

    await createBaselineItem(baseline.id, wbs1.id, '1.1', 60, true, task1.id);
    await createBaselineItem(baseline.id, wbs2.id, '1.2', 40, true, task2.id);

    // Contribution: (60 * 50 + 40 * 0) / 100 = 30.00
    const progress = await service.calculateProjectOverallProgress(project.id);
    expect(progress).toBe(30.0);
  });

  // Test 6: Non-leaf WBS excluded
  it('6. Non-leaf WBS excluded even with weight defined', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const baseline = await createBaseline(project.id, pm.id, 'ACTIVE');

    // Summary node (weight 30, is_leaf = false)
    const summary = await createWbs(project.id, '1.0', 30);
    await createBaselineItem(baseline.id, summary.id, '1.0', 30, false, null);

    // Two leaf nodes (weights 35 each, is_leaf = true)
    const leaf1 = await createWbs(project.id, '1.1', 35, summary.id);
    const leaf2 = await createWbs(project.id, '1.2', 35, summary.id);
    const task1 = await createTask(project.id, leaf1.id, 100);
    const task2 = await createTask(project.id, leaf2.id, 100);
    await createBaselineItem(baseline.id, leaf1.id, '1.1', 35, true, task1.id, summary.id);
    await createBaselineItem(baseline.id, leaf2.id, '1.2', 35, true, task2.id, summary.id);

    // Leaves only: (35 * 100 + 35 * 100) / 100 = 70.00
    const progress = await service.calculateProjectOverallProgress(project.id);
    expect(progress).toBe(70.0);
  });

  // Test 7: Live WBS weight changes do not override frozen ACTIVE baseline weight
  it('7. Live WBS weight changes do not override frozen ACTIVE baseline weight', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const baseline = await createBaseline(project.id, pm.id, 'ACTIVE');

    const wbs1 = await createWbs(project.id, '1.1', 60);
    const wbs2 = await createWbs(project.id, '1.2', 40);
    const task1 = await createTask(project.id, wbs1.id, 50);
    const task2 = await createTask(project.id, wbs2.id, 100);

    // Freeze in active baseline with weights 60 and 40
    await createBaselineItem(baseline.id, wbs1.id, '1.1', 60, true, task1.id);
    await createBaselineItem(baseline.id, wbs2.id, '1.2', 40, true, task2.id);

    // Mutate LIVE WBS weights to 90 and 10
    await dataSource.query(
      `UPDATE work_breakdown_structures SET weight_percentage = 90 WHERE id = ?`,
      [wbs1.id],
    );
    await dataSource.query(
      `UPDATE work_breakdown_structures SET weight_percentage = 10 WHERE id = ?`,
      [wbs2.id],
    );

    // Calculation MUST still use frozen baseline weights (60 * 50 + 40 * 100) / 100 = 70.00, NOT (90*50 + 10*100) / 100 = 55.00
    const progress = await service.calculateProjectOverallProgress(project.id);
    expect(progress).toBe(70.0);
  });

  // Test 8: Task progress mutation is reflected on next operational-board read
  it('8. Task progress mutation is reflected on next operational-board read', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const baseline = await createBaseline(project.id, pm.id, 'ACTIVE');
    const wbs = await createWbs(project.id, '1.1', 100);
    const task = await createTask(project.id, wbs.id, 20);
    await createBaselineItem(baseline.id, wbs.id, '1.1', 100, true, task.id);

    // Initial read -> 20.00
    const board1 = await service.getOperationalBoard(pm.id, ['PROJECT_MANAGER', 'PMO']);
    const p1 = board1.data.activeProjects.find((p: any) => p.id === project.id);
    expect(p1?.overallProgress).toBe(20.0);

    // Mutate task progress to 80
    await dataSource.query(`UPDATE tasks SET progress = 80 WHERE id = ?`, [task.id]);

    // Subsequent read -> 80.00
    const board2 = await service.getOperationalBoard(pm.id, ['PROJECT_MANAGER', 'PMO']);
    const p2 = board2.data.activeProjects.find((p: any) => p.id === project.id);
    expect(p2?.overallProgress).toBe(80.0);
  });

  // Test 9: Leaf without active task contributes 0
  it('9. Leaf without active task contributes 0', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const baseline = await createBaseline(project.id, pm.id, 'ACTIVE');

    const wbs1 = await createWbs(project.id, '1.1', 50);
    const wbs2 = await createWbs(project.id, '1.2', 50);
    const task1 = await createTask(project.id, wbs1.id, 80);
    // Leaf 2 has NO active task created
    await createBaselineItem(baseline.id, wbs1.id, '1.1', 50, true, task1.id);
    await createBaselineItem(baseline.id, wbs2.id, '1.2', 50, true, null);

    // Contribution: (50 * 80 + 50 * 0) / 100 = 40.00
    const progress = await service.calculateProjectOverallProgress(project.id);
    expect(progress).toBe(40.0);
  });

  // Test 10: Existing progress log retains original baseline_id and current overall progress uses ACTIVE baseline only
  it('10. Existing progress log retains original baseline_id and current overall progress uses ACTIVE baseline only', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);

    // 1. Old baseline V1 marked SUPERSEDED
    const baselineV1 = await createBaseline(project.id, pm.id, 'SUPERSEDED', 1);
    const wbsV1 = await createWbs(project.id, '1.1', 100);
    const taskV1 = await createTask(project.id, wbsV1.id, 30);
    await createBaselineItem(baselineV1.id, wbsV1.id, '1.1', 100, true, taskV1.id);

    // Create historical progress log anchored to V1
    const historicalLog = dataSource.getRepository(ProjectProgressLog).create({
      project_id: project.id,
      task_id: taskV1.id,
      wbs_id: wbsV1.id,
      baseline_id: baselineV1.id,
      previous_progress: 0,
      reported_progress: 30,
      progress_delta: 30,
      effective_date: '2026-01-01',
      event_type: 'ROUTINE_UPDATE',
      status: 'OFFICIAL',
      submitted_by: pm.id,
      reason: 'Historical V1 log',
    });
    const savedLog = await dataSource.getRepository(ProjectProgressLog).save(historicalLog);
    createdProgressLogIds.push(savedLog.id);

    // 2. New baseline V2 marked ACTIVE
    const baselineV2 = await createBaseline(project.id, pm.id, 'ACTIVE', 2);
    const wbsV2 = await createWbs(project.id, '2.1', 100);
    const taskV2 = await createTask(project.id, wbsV2.id, 85);
    await createBaselineItem(baselineV2.id, wbsV2.id, '2.1', 100, true, taskV2.id);

    // Assert: Historical log retains V1 anchor
    const logInDb = await dataSource.getRepository(ProjectProgressLog).findOneBy({ id: savedLog.id });
    expect(Number(logInDb!.baseline_id)).toBe(Number(baselineV1.id));

    // Assert: Overall progress calculates from ACTIVE baseline V2 (85.00), NOT V1 (30.00)
    const progress = await service.calculateProjectOverallProgress(project.id);
    expect(progress).toBe(85.0);
  });

  // Test 11: Decimal rounding: weights [33.33, 33.33, 33.34], progress [100, 50, 25] -> 58.33
  it('11. Decimal rounding: weights [33.33, 33.33, 33.34] progress [100, 50, 25] -> 58.33', async () => {
    const pm = await createUser('pm');
    const project = await createProject(pm.id);
    const baseline = await createBaseline(project.id, pm.id, 'ACTIVE');

    const weights = [33.33, 33.33, 33.34];
    const progressVals = [100, 50, 25];

    for (let i = 0; i < 3; i++) {
      const code = `1.${i + 1}`;
      const wbs = await createWbs(project.id, code, weights[i]);
      const task = await createTask(project.id, wbs.id, progressVals[i]);
      await createBaselineItem(baseline.id, wbs.id, code, weights[i], true, task.id);
    }

    // (33.33*100 + 33.33*50 + 33.34*25) / 100 = (3333 + 1666.5 + 833.5) / 100 = 5833 / 100 = 58.33
    const progress = await service.calculateProjectOverallProgress(project.id);
    expect(progress).toBe(58.33);
  });

  // Test 12: Project without ACTIVE baseline -> 0.00
  it('12. Project without ACTIVE baseline returns 0.00', async () => {
    const pm = await createUser('pm');
    // Project in IN_PROGRESS with no baseline
    const project = await createProject(pm.id, 'IN_PROGRESS');
    const wbs = await createWbs(project.id, '1.1', 100);
    await createTask(project.id, wbs.id, 75);

    const progress = await service.calculateProjectOverallProgress(project.id);
    expect(progress).toBe(0.0);

    const board = await service.getOperationalBoard(pm.id, ['PROJECT_MANAGER']);
    const activePrj = board.data.activeProjects.find(
      (p: any) => p.projectId === project.id || p.project_code === project.code,
    );
    expect(activePrj).toBeDefined();
    expect(activePrj.overallProgress).toBe(0.0);
  });
});
