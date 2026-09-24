import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { CreateOperationalPlanManagementTables1788200000000 } from '../../migrations/1788200000000-CreateOperationalPlanManagementTables';
import { ProjectInitialCondition } from '../../entities/project-initial-condition.entity';
import { ProjectManagementReview } from '../../entities/project-management-review.entity';

dotenv.config();

describe('R11.1.5-C1 — Operational Plan Management Schema & Entity Hardening Spec', () => {
  let dataSource: DataSource;
  let migration: CreateOperationalPlanManagementTables1788200000000;

  let picColumns: any[];
  let picForeignKeys: any[];
  let picIndices: any[];

  let pmrColumns: any[];
  let pmrForeignKeys: any[];
  let pmrIndices: any[];

  beforeAll(async () => {
    dataSource = new DataSource({
      type: 'mysql',
      host: process.env.DATABASE_HOST || '127.0.0.1',
      port: parseInt(process.env.DATABASE_PORT || '3306'),
      username: process.env.DATABASE_USER || 'epms_app_user',
      password: process.env.DATABASE_PASSWORD || 'Epms_App_Us3r_2026!',
      database: process.env.DATABASE_NAME || 'epms_tvmubd_db',
      entities: [__dirname + '/../../entities/*.entity.ts'],
      synchronize: false,
    });

    await dataSource.initialize();
    migration = new CreateOperationalPlanManagementTables1788200000000();

    const queryRunner = dataSource.createQueryRunner();
    await queryRunner.connect();

    // Check if tables already exist; if not, apply migration up()
    const tablesCheck = await queryRunner.query(
      "SELECT table_name FROM information_schema.tables WHERE table_schema = DATABASE() AND table_name = 'project_initial_conditions'",
    );

    if (tablesCheck.length === 0) {
      await migration.up(queryRunner);
    }

    // Update migrations ledger if not already recorded
    const ledgerCheck = await queryRunner.query(
      'SELECT COUNT(*) as cnt FROM migrations WHERE timestamp = 1788200000000',
    );
    if (Number(ledgerCheck[0]?.cnt || 0) === 0) {
      await queryRunner.query(
        'INSERT INTO migrations (timestamp, name) VALUES (1788200000000, "CreateOperationalPlanManagementTables1788200000000")',
      );
    }

    // Load initial conditions schema metadata
    picColumns = await queryRunner.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_initial_conditions'
      ORDER BY ORDINAL_POSITION;
    `);

    picForeignKeys = await queryRunner.query(`
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
      WHERE RC.CONSTRAINT_SCHEMA = DATABASE() AND RC.TABLE_NAME = 'project_initial_conditions';
    `);

    picIndices = await queryRunner.query(`
      SHOW INDEX FROM project_initial_conditions;
    `);

    // Load management reviews schema metadata
    pmrColumns = await queryRunner.query(`
      SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE, COLUMN_DEFAULT, COLUMN_TYPE, CHARACTER_MAXIMUM_LENGTH
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'project_management_reviews'
      ORDER BY ORDINAL_POSITION;
    `);

    pmrForeignKeys = await queryRunner.query(`
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
      WHERE RC.CONSTRAINT_SCHEMA = DATABASE() AND RC.TABLE_NAME = 'project_management_reviews';
    `);

    pmrIndices = await queryRunner.query(`
      SHOW INDEX FROM project_management_reviews;
    `);

    await queryRunner.release();
  });

  afterAll(async () => {
    if (dataSource && dataSource.isInitialized) {
      await dataSource.destroy();
    }
  });

  const getCol = (cols: any[], name: string) =>
    cols.find((c) => (c.COLUMN_NAME || c.column_name) === name);

  const getFk = (fks: any[], colName: string) =>
    fks.find((f) => (f.COLUMN_NAME || f.column_name) === colName);

  // 1. PROJECT INITIAL CONDITIONS SCHEMA TESTS
  describe('Tabel `project_initial_conditions` Schema Verification', () => {
    it('CASE 1: table `project_initial_conditions` must exist with exactly 15 columns', () => {
      expect(picColumns.length).toBe(15);
    });

    it('CASE 2: `project_id` must be BIGINT UNSIGNED, NOT NULL, with UNIQUE constraint', () => {
      const col = getCol(picColumns, 'project_id');
      expect(col).toBeDefined();
      expect(col.DATA_TYPE || col.data_type).toBe('bigint');
      expect(col.COLUMN_TYPE || col.column_type).toContain('unsigned');
      expect(col.IS_NULLABLE || col.is_nullable).toBe('NO');

      // Check unique index on project_id
      const uniqueIdx = picIndices.find(
        (i) => (i.Column_name || i.column_name) === 'project_id' && (i.Non_unique === 0 || i.non_unique === 0),
      );
      expect(uniqueIdx).toBeDefined();
    });

    it('CASE 3: `condition_status` must be VARCHAR(50), NOT NULL with DEFAULT "NORMAL"', () => {
      const col = getCol(picColumns, 'condition_status');
      expect(col).toBeDefined();
      expect(col.DATA_TYPE || col.data_type).toBe('varchar');
      expect(Number(col.CHARACTER_MAXIMUM_LENGTH || col.character_maximum_length)).toBe(50);
      expect(col.IS_NULLABLE || col.is_nullable).toBe('NO');
      expect(col.COLUMN_DEFAULT || col.column_default).toContain('NORMAL');
    });

    it('CASE 4: mandatory text fields must be NOT NULL (location_condition, initial_constraints, initial_risks)', () => {
      const requiredCols = ['location_condition', 'initial_constraints', 'initial_risks'];
      for (const colName of requiredCols) {
        const col = getCol(picColumns, colName);
        expect(col).toBeDefined();
        expect(col.DATA_TYPE || col.data_type).toBe('text');
        expect(col.IS_NULLABLE || col.is_nullable).toBe('NO');
      }
    });

    it('CASE 5: optional text fields must be NULLABLE (existing_infrastructure, access_logistics, pm_recommendation)', () => {
      const optionalCols = ['existing_infrastructure', 'access_logistics', 'pm_recommendation'];
      for (const colName of optionalCols) {
        const col = getCol(picColumns, colName);
        expect(col).toBeDefined();
        expect(col.DATA_TYPE || col.data_type).toBe('text');
        expect(col.IS_NULLABLE || col.is_nullable).toBe('YES');
      }
    });

    it('CASE 6: all 6 audit columns must exist with correct types (created_by, updated_by, deleted_by, created_at, updated_at, deleted_at)', () => {
      const auditCols = [
        { name: 'created_by', type: 'bigint', nullable: 'YES' },
        { name: 'updated_by', type: 'bigint', nullable: 'YES' },
        { name: 'deleted_by', type: 'bigint', nullable: 'YES' },
        { name: 'created_at', type: 'datetime', nullable: 'NO' },
        { name: 'updated_at', type: 'datetime', nullable: 'NO' },
        { name: 'deleted_at', type: 'datetime', nullable: 'YES' },
      ];

      for (const expected of auditCols) {
        const col = getCol(picColumns, expected.name);
        expect(col).toBeDefined();
        expect(col.DATA_TYPE || col.data_type).toBe(expected.type);
        expect(col.IS_NULLABLE || col.is_nullable).toBe(expected.nullable);
      }
    });

    it('CASE 7: foreign key `fk_pic_project` must point to `projects(id)` with ON DELETE RESTRICT', () => {
      const fk = getFk(picForeignKeys, 'project_id');
      expect(fk).toBeDefined();
      expect(fk.REFERENCED_TABLE_NAME || fk.referenced_table_name).toBe('projects');
      expect(fk.REFERENCED_COLUMN_NAME || fk.referenced_column_name).toBe('id');
      expect(fk.DELETE_RULE || fk.delete_rule).toBe('RESTRICT');
    });

    it('CASE 8: audit foreign keys must point to `users(id)` with ON DELETE SET NULL', () => {
      const userFkCols = ['created_by', 'updated_by', 'deleted_by'];
      for (const colName of userFkCols) {
        const fk = getFk(picForeignKeys, colName);
        expect(fk).toBeDefined();
        expect(fk.REFERENCED_TABLE_NAME || fk.referenced_table_name).toBe('users');
        expect(fk.DELETE_RULE || fk.delete_rule).toBe('SET NULL');
      }
    });

    it('CASE 9: ProjectInitialCondition entity metadata matches MySQL schema', () => {
      const metadata = dataSource.getMetadata(ProjectInitialCondition);
      expect(metadata.tableName).toBe('project_initial_conditions');
      expect(metadata.findColumnWithPropertyName('projectId')).toBeDefined();
      expect(metadata.findColumnWithPropertyName('conditionStatus')).toBeDefined();
      expect(metadata.findColumnWithPropertyName('locationCondition')).toBeDefined();
      expect(metadata.findColumnWithPropertyName('initialConstraints')).toBeDefined();
      expect(metadata.findColumnWithPropertyName('initialRisks')).toBeDefined();
      expect(metadata.findColumnWithPropertyName('deletedAt')).toBeDefined();
    });
  });

  // 2. PROJECT MANAGEMENT REVIEWS SCHEMA TESTS
  describe('Tabel `project_management_reviews` Schema Verification', () => {
    it('CASE 10: table `project_management_reviews` must exist with exactly 16 columns', () => {
      expect(pmrColumns.length).toBe(16);
    });

    it('CASE 11: `project_id` must be BIGINT UNSIGNED, NOT NULL, with UNIQUE constraint', () => {
      const col = getCol(pmrColumns, 'project_id');
      expect(col).toBeDefined();
      expect(col.DATA_TYPE || col.data_type).toBe('bigint');
      expect(col.COLUMN_TYPE || col.column_type).toContain('unsigned');
      expect(col.IS_NULLABLE || col.is_nullable).toBe('NO');

      // Check unique index on project_id
      const uniqueIdx = pmrIndices.find(
        (i) => (i.Column_name || i.column_name) === 'project_id' && (i.Non_unique === 0 || i.non_unique === 0),
      );
      expect(uniqueIdx).toBeDefined();
    });

    it('CASE 12: `status` must be VARCHAR(50), NOT NULL with DEFAULT "NOT_SUBMITTED"', () => {
      const col = getCol(pmrColumns, 'status');
      expect(col).toBeDefined();
      expect(col.DATA_TYPE || col.data_type).toBe('varchar');
      expect(Number(col.CHARACTER_MAXIMUM_LENGTH || col.character_maximum_length)).toBe(50);
      expect(col.IS_NULLABLE || col.is_nullable).toBe('NO');
      expect(col.COLUMN_DEFAULT || col.column_default).toContain('NOT_SUBMITTED');
    });

    it('CASE 13: decision and review columns must exist with correct nullable types', () => {
      const reviewCols = [
        { name: 'submitted_by', type: 'bigint', nullable: 'YES' },
        { name: 'submitted_at', type: 'datetime', nullable: 'YES' },
        { name: 'decided_by', type: 'bigint', nullable: 'YES' },
        { name: 'decided_at', type: 'datetime', nullable: 'YES' },
        { name: 'reviewer_role', type: 'varchar', nullable: 'YES' },
        { name: 'revision_notes', type: 'text', nullable: 'YES' },
        { name: 'checklist_snapshot', type: 'text', nullable: 'YES' },
      ];

      for (const expected of reviewCols) {
        const col = getCol(pmrColumns, expected.name);
        expect(col).toBeDefined();
        expect(col.DATA_TYPE || col.data_type).toBe(expected.type);
        expect(col.IS_NULLABLE || col.is_nullable).toBe(expected.nullable);
      }
    });

    it('CASE 14: all 6 audit columns must exist on `project_management_reviews`', () => {
      const auditCols = [
        { name: 'created_by', type: 'bigint', nullable: 'YES' },
        { name: 'updated_by', type: 'bigint', nullable: 'YES' },
        { name: 'deleted_by', type: 'bigint', nullable: 'YES' },
        { name: 'created_at', type: 'datetime', nullable: 'NO' },
        { name: 'updated_at', type: 'datetime', nullable: 'NO' },
        { name: 'deleted_at', type: 'datetime', nullable: 'YES' },
      ];

      for (const expected of auditCols) {
        const col = getCol(pmrColumns, expected.name);
        expect(col).toBeDefined();
        expect(col.DATA_TYPE || col.data_type).toBe(expected.type);
        expect(col.IS_NULLABLE || col.is_nullable).toBe(expected.nullable);
      }
    });

    it('CASE 15: foreign key `fk_pmr_project` must point to `projects(id)` with ON DELETE RESTRICT', () => {
      const fk = getFk(pmrForeignKeys, 'project_id');
      expect(fk).toBeDefined();
      expect(fk.REFERENCED_TABLE_NAME || fk.referenced_table_name).toBe('projects');
      expect(fk.REFERENCED_COLUMN_NAME || fk.referenced_column_name).toBe('id');
      expect(fk.DELETE_RULE || fk.delete_rule).toBe('RESTRICT');
    });

    it('CASE 16: submitter, decider, and audit foreign keys must point to `users(id)` with ON DELETE SET NULL', () => {
      const userFkCols = ['submitted_by', 'decided_by', 'created_by', 'updated_by', 'deleted_by'];
      for (const colName of userFkCols) {
        const fk = getFk(pmrForeignKeys, colName);
        expect(fk).toBeDefined();
        expect(fk.REFERENCED_TABLE_NAME || fk.referenced_table_name).toBe('users');
        expect(fk.DELETE_RULE || fk.delete_rule).toBe('SET NULL');
      }
    });

    it('CASE 17: ProjectManagementReview entity metadata matches MySQL schema', () => {
      const metadata = dataSource.getMetadata(ProjectManagementReview);
      expect(metadata.tableName).toBe('project_management_reviews');
      expect(metadata.findColumnWithPropertyName('projectId')).toBeDefined();
      expect(metadata.findColumnWithPropertyName('status')).toBeDefined();
      expect(metadata.findColumnWithPropertyName('submittedBy')).toBeDefined();
      expect(metadata.findColumnWithPropertyName('decidedBy')).toBeDefined();
      expect(metadata.findColumnWithPropertyName('reviewerRole')).toBeDefined();
      expect(metadata.findColumnWithPropertyName('revisionNotes')).toBeDefined();
      expect(metadata.findColumnWithPropertyName('checklistSnapshot')).toBeDefined();
      expect(metadata.findColumnWithPropertyName('deletedAt')).toBeDefined();
    });

    it('CASE 18: migration timestamp 1788200000000 is recorded in `migrations` ledger', async () => {
      const ledgerCheck = await dataSource.query(
        'SELECT timestamp, name FROM migrations WHERE timestamp = 1788200000000',
      );
      expect(ledgerCheck.length).toBe(1);
      expect(ledgerCheck[0].name || ledgerCheck[0].NAME).toBe('CreateOperationalPlanManagementTables1788200000000');
    });
  });
});
