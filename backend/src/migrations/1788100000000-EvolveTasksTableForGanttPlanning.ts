import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class EvolveTasksTableForGanttPlanning1788100000000
  implements MigrationInterface
{
  name = 'EvolveTasksTableForGanttPlanning1788100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('tasks');
    if (!table) return;

    // 1. Add project_id column if not exists
    if (!table.findColumnByName('project_id')) {
      await queryRunner.addColumn(
        'tasks',
        new TableColumn({
          name: 'project_id',
          type: 'bigint',
          unsigned: true,
          isNullable: false,
        }),
      );

      // Add FK tasks -> projects
      await queryRunner.createForeignKey(
        'tasks',
        new TableForeignKey({
          name: 'fk_tasks_project',
          columnNames: ['project_id'],
          referencedTableName: 'projects',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
        }),
      );

      // Add index on project_id
      await queryRunner.createIndex(
        'tasks',
        new TableIndex({
          name: 'idx_tasks_project_id',
          columnNames: ['project_id'],
        }),
      );
    }

    // 2. Add is_milestone column
    if (!table.findColumnByName('is_milestone')) {
      await queryRunner.addColumn(
        'tasks',
        new TableColumn({
          name: 'is_milestone',
          type: 'tinyint',
          width: 1,
          default: 0,
          isNullable: false,
        }),
      );
    }

    // 3. Rename due_date to end_date if due_date exists
    const dueDateCol = table.findColumnByName('due_date');
    const endDateCol = table.findColumnByName('end_date');
    if (dueDateCol && !endDateCol) {
      await queryRunner.changeColumn(
        'tasks',
        dueDateCol,
        new TableColumn({
          name: 'end_date',
          type: 'date',
          isNullable: true,
        }),
      );
    } else if (!dueDateCol && !endDateCol) {
      await queryRunner.addColumn(
        'tasks',
        new TableColumn({
          name: 'end_date',
          type: 'date',
          isNullable: true,
        }),
      );
    }

    // 4. Add duration column
    if (!table.findColumnByName('duration')) {
      await queryRunner.addColumn(
        'tasks',
        new TableColumn({
          name: 'duration',
          type: 'int',
          unsigned: true,
          default: 0,
          isNullable: false,
        }),
      );
    }

    // 5. Add predecessor_task_id column and self-referencing FK
    if (!table.findColumnByName('predecessor_task_id')) {
      await queryRunner.addColumn(
        'tasks',
        new TableColumn({
          name: 'predecessor_task_id',
          type: 'bigint',
          unsigned: true,
          isNullable: true,
        }),
      );

      await queryRunner.createForeignKey(
        'tasks',
        new TableForeignKey({
          name: 'fk_tasks_predecessor',
          columnNames: ['predecessor_task_id'],
          referencedTableName: 'tasks',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );

      await queryRunner.createIndex(
        'tasks',
        new TableIndex({
          name: 'idx_tasks_predecessor_task_id',
          columnNames: ['predecessor_task_id'],
        }),
      );
    }

    // 6. Add dependency_type column
    if (!table.findColumnByName('dependency_type')) {
      await queryRunner.addColumn(
        'tasks',
        new TableColumn({
          name: 'dependency_type',
          type: 'varchar',
          length: '10',
          default: "'FS'",
          isNullable: false,
        }),
      );
    }

    // 7. Add progress column
    if (!table.findColumnByName('progress')) {
      await queryRunner.addColumn(
        'tasks',
        new TableColumn({
          name: 'progress',
          type: 'decimal',
          precision: 5,
          scale: 2,
          default: '0.00',
          isNullable: false,
        }),
      );
    }

    // 8. Update status column default to 'PLANNED'
    const statusCol = table.findColumnByName('status');
    if (statusCol) {
      await queryRunner.changeColumn(
        'tasks',
        statusCol,
        new TableColumn({
          name: 'status',
          type: 'varchar',
          length: '50',
          default: "'PLANNED'",
          isNullable: false,
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('tasks');
    if (!table) return;

    // 1. Revert status default to 'TODO'
    const statusCol = table.findColumnByName('status');
    if (statusCol) {
      await queryRunner.changeColumn(
        'tasks',
        statusCol,
        new TableColumn({
          name: 'status',
          type: 'varchar',
          length: '50',
          default: "'TODO'",
          isNullable: false,
        }),
      );
    }

    // 2. Drop progress
    if (table.findColumnByName('progress')) {
      await queryRunner.dropColumn('tasks', 'progress');
    }

    // 3. Drop dependency_type
    if (table.findColumnByName('dependency_type')) {
      await queryRunner.dropColumn('tasks', 'dependency_type');
    }

    // 4. Drop predecessor_task_id and FK
    const predFk = table.foreignKeys.find(
      (fk) => fk.name === 'fk_tasks_predecessor',
    );
    if (predFk) {
      await queryRunner.dropForeignKey('tasks', predFk);
    }
    const predIdx = table.indices.find(
      (idx) => idx.name === 'idx_tasks_predecessor_task_id',
    );
    if (predIdx) {
      await queryRunner.dropIndex('tasks', predIdx);
    }
    if (table.findColumnByName('predecessor_task_id')) {
      await queryRunner.dropColumn('tasks', 'predecessor_task_id');
    }

    // 5. Drop duration
    if (table.findColumnByName('duration')) {
      await queryRunner.dropColumn('tasks', 'duration');
    }

    // 6. Rename end_date back to due_date
    const endDateCol = table.findColumnByName('end_date');
    if (endDateCol) {
      await queryRunner.changeColumn(
        'tasks',
        endDateCol,
        new TableColumn({
          name: 'due_date',
          type: 'date',
          isNullable: true,
        }),
      );
    }

    // 7. Drop is_milestone
    if (table.findColumnByName('is_milestone')) {
      await queryRunner.dropColumn('tasks', 'is_milestone');
    }

    // 8. Drop project_id and FK
    const projectFk = table.foreignKeys.find(
      (fk) => fk.name === 'fk_tasks_project',
    );
    if (projectFk) {
      await queryRunner.dropForeignKey('tasks', projectFk);
    }
    const projectIdx = table.indices.find(
      (idx) => idx.name === 'idx_tasks_project_id',
    );
    if (projectIdx) {
      await queryRunner.dropIndex('tasks', projectIdx);
    }
    if (table.findColumnByName('project_id')) {
      await queryRunner.dropColumn('tasks', 'project_id');
    }
  }
}
