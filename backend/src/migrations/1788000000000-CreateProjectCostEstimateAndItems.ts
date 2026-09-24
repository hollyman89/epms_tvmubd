import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class CreateProjectCostEstimateAndItems1788000000000
  implements MigrationInterface
{
  name = 'CreateProjectCostEstimateAndItems1788000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create project_cost_estimates table
    await queryRunner.createTable(
      new Table({
        name: 'project_cost_estimates',
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
            default: "'DRAFT'",
            isNullable: false,
          },
          {
            name: 'version',
            type: 'int',
            default: 1,
            isNullable: false,
          },
          {
            name: 'pm_notes',
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

    // Add Foreign Key for project_cost_estimates -> projects
    await queryRunner.createForeignKey(
      'project_cost_estimates',
      new TableForeignKey({
        name: 'fk_cost_estimates_project',
        columnNames: ['project_id'],
        referencedTableName: 'projects',
        referencedColumnNames: ['id'],
        onDelete: 'RESTRICT',
      }),
    );

    // Add Indexes for project_cost_estimates
    await queryRunner.createIndices('project_cost_estimates', [
      new TableIndex({
        name: 'idx_cost_estimates_project_id',
        columnNames: ['project_id'],
      }),
      new TableIndex({
        name: 'idx_cost_estimates_deleted_at',
        columnNames: ['deleted_at'],
      }),
    ]);

    // 2. Create cost_items table
    await queryRunner.createTable(
      new Table({
        name: 'cost_items',
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
            name: 'estimate_id',
            type: 'bigint',
            unsigned: true,
            isNullable: false,
          },
          {
            name: 'category_key',
            type: 'varchar',
            length: '50',
            isNullable: false,
          },
          {
            name: 'entry_mode',
            type: 'varchar',
            length: '20',
            default: "'ITEMIZED'",
            isNullable: false,
          },
          {
            name: 'item_name',
            type: 'varchar',
            length: '255',
            isNullable: false,
          },
          {
            name: 'description',
            type: 'text',
            isNullable: true,
          },
          {
            name: 'quantity',
            type: 'decimal',
            precision: 12,
            scale: 4,
            default: '1.0000',
            isNullable: false,
          },
          {
            name: 'uom',
            type: 'varchar',
            length: '50',
            default: "'Unit'",
            isNullable: false,
          },
          {
            name: 'rate_type',
            type: 'varchar',
            length: '50',
            default: "'UNIT_RATE'",
            isNullable: true,
          },
          {
            name: 'unit_price',
            type: 'decimal',
            precision: 19,
            scale: 2,
            default: '0.00',
            isNullable: false,
          },
          {
            name: 'subtotal',
            type: 'decimal',
            precision: 19,
            scale: 2,
            default: '0.00',
            isNullable: false,
          },
          {
            name: 'resource_type',
            type: 'varchar',
            length: '50',
            isNullable: true,
          },
          {
            name: 'cost_source',
            type: 'varchar',
            length: '50',
            default: "'PM_ESTIMATE'",
            isNullable: true,
          },
          {
            name: 'assignment_scope',
            type: 'varchar',
            length: '50',
            default: "'UNASSIGNED'",
            isNullable: false,
          },
          {
            name: 'wbs_id',
            type: 'bigint',
            unsigned: true,
            isNullable: true,
          },
          {
            name: 'notes',
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

    // Add Foreign Keys for cost_items
    await queryRunner.createForeignKey(
      'cost_items',
      new TableForeignKey({
        name: 'fk_cost_items_estimate',
        columnNames: ['estimate_id'],
        referencedTableName: 'project_cost_estimates',
        referencedColumnNames: ['id'],
        onDelete: 'CASCADE',
      }),
    );

    await queryRunner.createForeignKey(
      'cost_items',
      new TableForeignKey({
        name: 'fk_cost_items_wbs',
        columnNames: ['wbs_id'],
        referencedTableName: 'work_breakdown_structures',
        referencedColumnNames: ['id'],
        onDelete: 'SET NULL',
      }),
    );

    // Add Indexes for cost_items
    await queryRunner.createIndices('cost_items', [
      new TableIndex({
        name: 'idx_cost_items_estimate_id',
        columnNames: ['estimate_id'],
      }),
      new TableIndex({
        name: 'idx_cost_items_wbs_id',
        columnNames: ['wbs_id'],
      }),
      new TableIndex({
        name: 'idx_cost_items_category_key',
        columnNames: ['category_key'],
      }),
      new TableIndex({
        name: 'idx_cost_items_deleted_at',
        columnNames: ['deleted_at'],
      }),
    ]);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop cost_items table and its foreign keys
    await queryRunner.dropTable('cost_items', true, true, true);

    // Drop project_cost_estimates table and its foreign keys
    await queryRunner.dropTable('project_cost_estimates', true, true, true);
  }
}
