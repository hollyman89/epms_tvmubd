import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateOperationalPlanManagementTables1788200000000
  implements MigrationInterface
{
  name = 'CreateOperationalPlanManagementTables1788200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create project_initial_conditions table
    await queryRunner.createTable(
      new Table({
        name: 'project_initial_conditions',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            unsigned: true,
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'project_id',
            type: 'bigint',
            unsigned: true,
            isNullable: false,
          },
          {
            name: 'condition_status',
            type: 'varchar',
            length: '50',
            default: "'NORMAL'",
            isNullable: false,
          },
          {
            name: 'location_condition',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'existing_infrastructure',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'access_logistics',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'initial_constraints',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'initial_risks',
            type: 'text',
            isNullable: false,
          },
          {
            name: 'pm_recommendation',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_by',
            type: 'bigint',
            unsigned: true,
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'bigint',
            unsigned: true,
            isNullable: true,
          },
          {
            name: 'deleted_by',
            type: 'bigint',
            unsigned: true,
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'deleted_at',
            type: 'datetime',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Add Unique Key for project_id on project_initial_conditions
    await queryRunner.createIndex(
      'project_initial_conditions',
      new TableIndex({
        name: 'uq_pic_project_id',
        columnNames: ['project_id'],
        isUnique: true,
      }),
    );

    // Add Index for deleted_at on project_initial_conditions
    await queryRunner.createIndex(
      'project_initial_conditions',
      new TableIndex({
        name: 'idx_pic_deleted_at',
        columnNames: ['deleted_at'],
      }),
    );

    // Add Foreign Keys for project_initial_conditions
    await queryRunner.createForeignKey(
      'project_initial_conditions',
      new TableForeignKey({
        name: 'fk_pic_project',
        columnNames: ['project_id'],
        referencedTableName: 'projects',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createForeignKey(
      'project_initial_conditions',
      new TableForeignKey({
        name: 'fk_pic_created_by',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'project_initial_conditions',
      new TableForeignKey({
        name: 'fk_pic_updated_by',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'project_initial_conditions',
      new TableForeignKey({
        name: 'fk_pic_deleted_by',
        columnNames: ['deleted_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // 2. Create project_management_reviews table
    await queryRunner.createTable(
      new Table({
        name: 'project_management_reviews',
        columns: [
          {
            name: 'id',
            type: 'bigint',
            unsigned: true,
            isPrimary: true,
            isGenerated: true,
            generationStrategy: 'increment',
          },
          {
            name: 'project_id',
            type: 'bigint',
            unsigned: true,
            isNullable: false,
          },
          {
            name: 'status',
            type: 'varchar',
            length: '50',
            default: "'NOT_SUBMITTED'",
            isNullable: false,
          },
          {
            name: 'submitted_by',
            type: 'bigint',
            unsigned: true,
            isNullable: true,
          },
          {
            name: 'submitted_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'decided_by',
            type: 'bigint',
            unsigned: true,
            isNullable: true,
          },
          {
            name: 'decided_at',
            type: 'datetime',
            isNullable: true,
          },
          {
            name: 'reviewer_role',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'revision_notes',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'checklist_snapshot',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'created_by',
            type: 'bigint',
            unsigned: true,
            isNullable: true,
          },
          {
            name: 'updated_by',
            type: 'bigint',
            unsigned: true,
            isNullable: true,
          },
          {
            name: 'deleted_by',
            type: 'bigint',
            unsigned: true,
            isNullable: true,
          },
          {
            name: 'created_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'updated_at',
            type: 'datetime',
            default: 'CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP',
            isNullable: false,
          },
          {
            name: 'deleted_at',
            type: 'datetime',
            isNullable: true,
          },
        ],
      }),
      true,
    );

    // Add Unique Key for project_id on project_management_reviews
    await queryRunner.createIndex(
      'project_management_reviews',
      new TableIndex({
        name: 'uq_pmr_project_id',
        columnNames: ['project_id'],
        isUnique: true,
      }),
    );

    // Add Index for status on project_management_reviews
    await queryRunner.createIndex(
      'project_management_reviews',
      new TableIndex({
        name: 'idx_pmr_status',
        columnNames: ['status'],
      }),
    );

    // Add Index for deleted_at on project_management_reviews
    await queryRunner.createIndex(
      'project_management_reviews',
      new TableIndex({
        name: 'idx_pmr_deleted_at',
        columnNames: ['deleted_at'],
      }),
    );

    // Add Foreign Keys for project_management_reviews
    await queryRunner.createForeignKey(
      'project_management_reviews',
      new TableForeignKey({
        name: 'fk_pmr_project',
        columnNames: ['project_id'],
        referencedTableName: 'projects',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    await queryRunner.createForeignKey(
      'project_management_reviews',
      new TableForeignKey({
        name: 'fk_pmr_submitted_by',
        columnNames: ['submitted_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'project_management_reviews',
      new TableForeignKey({
        name: 'fk_pmr_decided_by',
        columnNames: ['decided_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'project_management_reviews',
      new TableForeignKey({
        name: 'fk_pmr_created_by',
        columnNames: ['created_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'project_management_reviews',
      new TableForeignKey({
        name: 'fk_pmr_updated_by',
        columnNames: ['updated_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    await queryRunner.createForeignKey(
      'project_management_reviews',
      new TableForeignKey({
        name: 'fk_pmr_deleted_by',
        columnNames: ['deleted_by'],
        referencedTableName: 'users',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop foreign keys and table for project_management_reviews
    const pmrTable = await queryRunner.getTable('project_management_reviews');
    if (pmrTable) {
      const fks = pmrTable.foreignKeys;
      for (const fk of fks) {
        await queryRunner.dropForeignKey('project_management_reviews', fk);
      }
      await queryRunner.dropTable('project_management_reviews', true);
    }

    // 2. Drop foreign keys and table for project_initial_conditions
    const picTable = await queryRunner.getTable('project_initial_conditions');
    if (picTable) {
      const fks = picTable.foreignKeys;
      for (const fk of fks) {
        await queryRunner.dropForeignKey('project_initial_conditions', fk);
      }
      await queryRunner.dropTable('project_initial_conditions', true);
    }
  }
}
