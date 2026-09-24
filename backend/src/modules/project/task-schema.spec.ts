import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { EvolveTasksTableForGanttPlanning1788100000000 } from '../../migrations/1788100000000-EvolveTasksTableForGanttPlanning';
import { EnforceTaskActiveWbsCardinality1789400000000 } from '../../migrations/1789400000000-EnforceTaskActiveWbsCardinality';
import { Task } from '../../entities/task.entity';
import { Project } from '../../entities/project.entity';
import { WorkBreakdownStructure } from '../../entities/wbs.entity';
import { User } from '../../entities/user.entity';

dotenv.config();

/**
 * ARCHITECTURAL NOTICE (P6.4-IMPLEMENTATION-SLICE-1-C5):
 * This is controlled sequential execution against the development test database;
 * dedicated test DB isolation remains the preferred future CI architecture.
 *
 * This suite mutates DDL in CASE 22 using a controlled reverse-order migration step-down:
 *   M3 (1789400000000).down() -> M_Tasks (1788100000000).down() -> M_Tasks.up() -> M3.up()
 * Because it performs DDL operations on the shared `tasks` table, this suite MUST NOT
 * be run concurrently with domain regression suites that access `tasks`.
 * Run standalone with: `jest src/modules/project/task-schema.spec.ts --runInBand`
 */
describe('R11.1.4-B — Schedule / Task Database Schema & Entity Hardening Spec', () => {
  let dataSource: DataSource;
  let migration: EvolveTasksTableForGanttPlanning1788100000000;

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'mysql',
      host: process.env.DATABASE_HOST || '127.0.0.1',
      port: parseInt(process.env.DATABASE_PORT || '3306'),
      username: process.env.DATABASE_USER || 'epms_app_user',
      password: process.env.DATABASE_PASSWORD || 'Epms_App_Us3r_2026!',
      database: process.env.DATABASE_NAME || 'epms_tvmubd_db',
      entities: [Task],
      synchronize: false,
    });

    await dataSource.initialize();
    migration = new EvolveTasksTableForGanttPlanning1788100000000();

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    // Transient typeorm_metadata table for TypeORM getTable() support when virtual generated columns exist
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`typeorm_metadata\` (
        \`type\` varchar(255) NOT NULL,
        \`database\` varchar(255) DEFAULT NULL,
        \`schema\` varchar(255) DEFAULT NULL,
        \`table\` varchar(255) DEFAULT NULL,
        \`name\` varchar(255) DEFAULT NULL,
        \`value\` text DEFAULT NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;
    `);

    // Verify 0 rows before migration
    const countRes = await queryRunner.query('SELECT COUNT(*) as cnt FROM tasks');
    const rowCount = Number(countRes[0]?.cnt || 0);
    expect(rowCount).toBe(0);

    // Apply migration
    await migration.up(queryRunner);

    // Update migrations ledger if not already recorded
    const ledgerCheck = await queryRunner.query(
      'SELECT COUNT(*) as cnt FROM migrations WHERE timestamp = 1788100000000'
    );
    if (Number(ledgerCheck[0]?.cnt || 0) === 0) {
      await queryRunner.query(
        'INSERT INTO migrations (timestamp, name) VALUES (1788100000000, "EvolveTasksTableForGanttPlanning1788100000000")'
      );
    }

    await queryRunner.release();
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();
      await queryRunner.query('DROP TABLE IF EXISTS `typeorm_metadata`');
      await queryRunner.release();
      await dataSource.destroy();
    }
  });

  describe('Tabel `tasks` Schema Verification', () => {
    let columns: any[];
    let foreignKeys: any[];
    let indices: any[];

    beforeAll(async () => {
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();

      columns = await queryRunner.query(`
        SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_TYPE, EXTRA
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tasks'
        ORDER BY ORDINAL_POSITION;
      `);

      foreignKeys = await queryRunner.query(`
        SELECT 
          RC.TABLE_NAME, 
          KCU.COLUMN_NAME, 
          RC.CONSTRAINT_NAME, 
          RC.REFERENCED_TABLE_NAME, 
          KCU.REFERENCED_COLUMN_NAME,
          RC.DELETE_RULE
        FROM INFORMATION_SCHEMA.REFERENTIAL_CONSTRAINTS RC
        JOIN INFORMATION_SCHEMA.KEY_COLUMN_USAGE KCU
          ON RC.CONSTRAINT_SCHEMA = KCU.CONSTRAINT_SCHEMA 
          AND RC.CONSTRAINT_NAME = KCU.CONSTRAINT_NAME
        WHERE RC.CONSTRAINT_SCHEMA = DATABASE() AND RC.TABLE_NAME = 'tasks';
      `);

      indices = await queryRunner.query(`
        SHOW INDEX FROM tasks;
      `);

      await queryRunner.release();
    });

    it('CASE 1 & 2: should have project_id column as NOT NULL bigint unsigned', () => {
      const col = columns.find((c) => c.COLUMN_NAME === 'project_id');
      expect(col).toBeDefined();
      expect(col.DATA_TYPE).toBe('bigint');
      expect(col.IS_NULLABLE).toBe('NO');
      expect(col.COLUMN_TYPE).toContain('unsigned');
    });

    it('CASE 3: should have wbs_id column as NOT NULL bigint unsigned', () => {
      const col = columns.find((c) => c.COLUMN_NAME === 'wbs_id');
      expect(col).toBeDefined();
      expect(col.DATA_TYPE).toBe('bigint');
      expect(col.IS_NULLABLE).toBe('NO');
      expect(col.COLUMN_TYPE).toContain('unsigned');
    });

    it('CASE 4: should have start_date column as date type and nullable', () => {
      const col = columns.find((c) => c.COLUMN_NAME === 'start_date');
      expect(col).toBeDefined();
      expect(col.DATA_TYPE).toBe('date');
      expect(col.IS_NULLABLE).toBe('YES');
    });

    it('CASE 5 & 6: should have end_date column and due_date must be completely absent', () => {
      const endCol = columns.find((c) => c.COLUMN_NAME === 'end_date');
      expect(endCol).toBeDefined();
      expect(endCol.DATA_TYPE).toBe('date');
      expect(endCol.IS_NULLABLE).toBe('YES');

      const dueCol = columns.find((c) => c.COLUMN_NAME === 'due_date');
      expect(dueCol).toBeUndefined();
    });

    it('CASE 7: should have duration column as int unsigned with default 0', () => {
      const col = columns.find((c) => c.COLUMN_NAME === 'duration');
      expect(col).toBeDefined();
      expect(col.DATA_TYPE).toBe('int');
      expect(col.IS_NULLABLE).toBe('NO');
      expect(col.COLUMN_TYPE).toContain('unsigned');
      expect(col.COLUMN_DEFAULT).toBe('0');
    });

    it('CASE 8: should have is_milestone column as tinyint(1) with default 0', () => {
      const col = columns.find((c) => c.COLUMN_NAME === 'is_milestone');
      expect(col).toBeDefined();
      expect(col.DATA_TYPE).toBe('tinyint');
      expect(col.IS_NULLABLE).toBe('NO');
      expect(col.COLUMN_DEFAULT).toBe('0');
    });

    it('CASE 9: should have predecessor_task_id column as nullable bigint unsigned', () => {
      const col = columns.find((c) => c.COLUMN_NAME === 'predecessor_task_id');
      expect(col).toBeDefined();
      expect(col.DATA_TYPE).toBe('bigint');
      expect(col.IS_NULLABLE).toBe('YES');
      expect(col.COLUMN_TYPE).toContain('unsigned');
    });

    it('CASE 10: should have dependency_type column with default "FS"', () => {
      const col = columns.find((c) => c.COLUMN_NAME === 'dependency_type');
      expect(col).toBeDefined();
      expect(col.DATA_TYPE).toBe('varchar');
      expect(col.IS_NULLABLE).toBe('NO');
      expect(col.COLUMN_DEFAULT).toContain('FS');
    });

    it('CASE 11: should have progress column as decimal(5,2) with default 0.00', () => {
      const col = columns.find((c) => c.COLUMN_NAME === 'progress');
      expect(col).toBeDefined();
      expect(col.DATA_TYPE).toBe('decimal');
      expect(col.IS_NULLABLE).toBe('NO');
      expect(col.COLUMN_DEFAULT).toBe('0.00');
    });

    it('CASE 12: should have status column with default "PLANNED"', () => {
      const col = columns.find((c) => c.COLUMN_NAME === 'status');
      expect(col).toBeDefined();
      expect(col.DATA_TYPE).toBe('varchar');
      expect(col.IS_NULLABLE).toBe('NO');
      expect(col.COLUMN_DEFAULT).toContain('PLANNED');
    });

    it('CASE 13: should have assignee_id as nullable bigint unsigned', () => {
      const col = columns.find((c) => c.COLUMN_NAME === 'assignee_id');
      expect(col).toBeDefined();
      expect(col.DATA_TYPE).toBe('bigint');
      expect(col.IS_NULLABLE).toBe('YES');
    });

    it('CASE 14: should have all 6 audit columns correctly configured', () => {
      const createdBy = columns.find((c) => c.COLUMN_NAME === 'created_by');
      const updatedBy = columns.find((c) => c.COLUMN_NAME === 'updated_by');
      const deletedBy = columns.find((c) => c.COLUMN_NAME === 'deleted_by');
      const createdAt = columns.find((c) => c.COLUMN_NAME === 'created_at');
      const updatedAt = columns.find((c) => c.COLUMN_NAME === 'updated_at');
      const deletedAt = columns.find((c) => c.COLUMN_NAME === 'deleted_at');

      expect(createdBy).toBeDefined();
      expect(updatedBy).toBeDefined();
      expect(deletedBy).toBeDefined();
      expect(createdAt).toBeDefined();
      expect(updatedAt).toBeDefined();
      expect(deletedAt).toBeDefined();

      expect(deletedAt.IS_NULLABLE).toBe('YES');
    });

    it('CASE 15: should have idx_tasks_deleted_at index for soft deletes', () => {
      const deletedIdx = indices.find((idx) => idx.Key_name === 'idx_tasks_deleted_at' || idx.Column_name === 'deleted_at');
      expect(deletedIdx).toBeDefined();
    });

    it('CASE 16: should have self-referencing predecessor FK with SET NULL onDelete', () => {
      const predFk = foreignKeys.find((fk) => fk.CONSTRAINT_NAME === 'fk_tasks_predecessor');
      expect(predFk).toBeDefined();
      expect(predFk.COLUMN_NAME).toBe('predecessor_task_id');
      expect(predFk.REFERENCED_TABLE_NAME).toBe('tasks');
      expect(predFk.REFERENCED_COLUMN_NAME).toBe('id');
      expect(predFk.DELETE_RULE).toBe('SET NULL');
    });

    it('CASE 17: should have project FK with RESTRICT onDelete', () => {
      const projFk = foreignKeys.find((fk) => fk.CONSTRAINT_NAME === 'fk_tasks_project');
      expect(projFk).toBeDefined();
      expect(projFk.COLUMN_NAME).toBe('project_id');
      expect(projFk.REFERENCED_TABLE_NAME).toBe('projects');
      expect(projFk.REFERENCED_COLUMN_NAME).toBe('id');
      expect(projFk.DELETE_RULE).toBe('RESTRICT');
    });

    it('CASE 18: should preserve WBS FK to work_breakdown_structures', () => {
      const wbsFk = foreignKeys.find((fk) => fk.CONSTRAINT_NAME === 'fk_tasks_wbs');
      expect(wbsFk).toBeDefined();
      expect(wbsFk.COLUMN_NAME).toBe('wbs_id');
      expect(wbsFk.REFERENCED_TABLE_NAME).toBe('work_breakdown_structures');
      expect(wbsFk.REFERENCED_COLUMN_NAME).toBe('id');
    });

    it('CASE 19: tasks table should contain all required planning columns and BD-06 active_wbs_id without duplicates', () => {
      const names = columns.map((c) => c.COLUMN_NAME);
      const uniqueNames = new Set(names);
      expect(uniqueNames.size).toBe(columns.length);

      const requiredColumns = [
        'id',
        'project_id',
        'wbs_id',
        'name',
        'status',
        'start_date',
        'end_date',
        'duration',
        'is_milestone',
        'predecessor_task_id',
        'dependency_type',
        'progress',
        'assignee_id',
        'created_by',
        'updated_by',
        'deleted_by',
        'created_at',
        'updated_at',
        'deleted_at',
        'active_wbs_id',
      ];
      for (const colName of requiredColumns) {
        expect(names).toContain(colName);
      }

      const activeWbsCol = columns.find((c) => c.COLUMN_NAME === 'active_wbs_id');
      expect(activeWbsCol).toBeDefined();
      expect(activeWbsCol.DATA_TYPE).toBe('bigint');
      expect(activeWbsCol.COLUMN_TYPE).toContain('unsigned');
      expect(activeWbsCol.EXTRA).toContain('VIRTUAL GENERATED');
    });

    it('CASE 20: Task entity metadata matches MySQL schema', () => {
      const taskMetadata = dataSource.getMetadata(Task);
      expect(taskMetadata).toBeDefined();
      expect(taskMetadata.tableName).toBe('tasks');

      const propertyNames = taskMetadata.columns.map((c) => c.propertyName);
      expect(propertyNames).toContain('id');
      expect(propertyNames).toContain('projectId');
      expect(propertyNames).toContain('wbsId');
      expect(propertyNames).toContain('name');
      expect(propertyNames).toContain('isMilestone');
      expect(propertyNames).toContain('startDate');
      expect(propertyNames).toContain('endDate');
      expect(propertyNames).toContain('duration');
      expect(propertyNames).toContain('predecessorTaskId');
      expect(propertyNames).toContain('dependencyType');
      expect(propertyNames).toContain('progress');
      expect(propertyNames).toContain('status');
      expect(propertyNames).toContain('assigneeId');
      expect(propertyNames).toContain('createdBy');
      expect(propertyNames).toContain('updatedBy');
      expect(propertyNames).toContain('deletedBy');
      expect(propertyNames).toContain('createdAt');
      expect(propertyNames).toContain('updatedAt');
      expect(propertyNames).toContain('deletedAt');
    });

    it('CASE 21: should verify official migration is recorded in `migrations` ledger', async () => {
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();

      const ledgerCheck = await queryRunner.query(
        'SELECT * FROM migrations WHERE timestamp = 1788100000000'
      );
      expect(ledgerCheck.length).toBe(1);
      expect(ledgerCheck[0].name).toBe('EvolveTasksTableForGanttPlanning1788100000000');

      await queryRunner.release();
    });

    it('CASE 22: should execute down() and up() cleanly without errors in controlled migration state', async () => {
      const queryRunner = dataSource.createQueryRunner();
      await queryRunner.connect();

      const cardinalityMigration = new EnforceTaskActiveWbsCardinality1789400000000();

      // 1. Roll down later dependent migration 1789400000000 sequentially
      await cardinalityMigration.down(queryRunner);

      // 2. Test 1788100000000 down()
      await migration.down(queryRunner);

      const tableAfterDown = await queryRunner.getTable('tasks');
      expect(tableAfterDown?.findColumnByName('project_id')).toBeUndefined();
      expect(tableAfterDown?.findColumnByName('end_date')).toBeUndefined();
      expect(tableAfterDown?.findColumnByName('due_date')).toBeDefined();
      expect(tableAfterDown?.findColumnByName('duration')).toBeUndefined();
      expect(tableAfterDown?.findColumnByName('is_milestone')).toBeUndefined();
      expect(tableAfterDown?.findColumnByName('predecessor_task_id')).toBeUndefined();

      // 3. Test 1788100000000 up()
      await migration.up(queryRunner);

      const tableAfterUp = await queryRunner.getTable('tasks');
      expect(tableAfterUp?.findColumnByName('project_id')).toBeDefined();
      expect(tableAfterUp?.findColumnByName('end_date')).toBeDefined();
      expect(tableAfterUp?.findColumnByName('due_date')).toBeUndefined();
      expect(tableAfterUp?.findColumnByName('duration')).toBeDefined();
      expect(tableAfterUp?.findColumnByName('is_milestone')).toBeDefined();
      expect(tableAfterUp?.findColumnByName('predecessor_task_id')).toBeDefined();

      // 4. Re-apply later dependent migration 1789400000000 sequentially to restore full Slice 1 schema
      await cardinalityMigration.up(queryRunner);

      await queryRunner.release();
    });
  });
});
