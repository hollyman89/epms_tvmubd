import {
  MigrationInterface,
  QueryRunner,
  Table,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from 'typeorm';

export class WorkflowEngineCoreTables1788300000000 implements MigrationInterface {
  name = 'WorkflowEngineCoreTables1788300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Evolve workflow_instances table
    const instancesTable = await queryRunner.getTable('workflow_instances');
    if (instancesTable) {
      const colsToAdd: TableColumn[] = [];
      if (!instancesTable.findColumnByName('workflow_version_id')) {
        colsToAdd.push(
          new TableColumn({
            name: 'workflow_version_id',
            type: 'bigint',
            unsigned: true,
            isNullable: true, // nullable initially for migration safety, will be set on insert
          }),
        );
      }
      if (!instancesTable.findColumnByName('current_node_id')) {
        colsToAdd.push(
          new TableColumn({
            name: 'current_node_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          }),
        );
      }
      if (!instancesTable.findColumnByName('context')) {
        colsToAdd.push(
          new TableColumn({
            name: 'context',
            type: 'json',
            isNullable: true,
          }),
        );
      }
      if (!instancesTable.findColumnByName('completed_at')) {
        colsToAdd.push(
          new TableColumn({
            name: 'completed_at',
            type: 'datetime',
            isNullable: true,
          }),
        );
      }
      if (!instancesTable.findColumnByName('version')) {
        colsToAdd.push(
          new TableColumn({
            name: 'version',
            type: 'int',
            unsigned: true,
            default: 1,
            isNullable: false,
          }),
        );
      }

      if (colsToAdd.length > 0) {
        await queryRunner.addColumns('workflow_instances', colsToAdd);
      }

      // Add FK from workflow_instances to workflow_versions
      if (!instancesTable.foreignKeys.some(fk => fk.columnNames.includes('workflow_version_id'))) {
        await queryRunner.createForeignKey(
          'workflow_instances',
          new TableForeignKey({
            name: 'fk_wf_inst_version',
            columnNames: ['workflow_version_id'],
            referencedTableName: 'workflow_versions',
            referencedColumnNames: ['id'],
            onDelete: 'RESTRICT',
          }),
        );
      }

      // Add composite index for idempotency on entity + workflow
      await queryRunner.createIndex(
        'workflow_instances',
        new TableIndex({
          name: 'idx_wf_inst_entity_status',
          columnNames: ['entity_type', 'entity_id', 'status'],
        }),
      );
    }

    // 2. Evolve workflow_tasks table
    const tasksTable = await queryRunner.getTable('workflow_tasks');
    if (tasksTable) {
      const colsToAdd: TableColumn[] = [];
      if (!tasksTable.findColumnByName('node_id')) {
        colsToAdd.push(
          new TableColumn({
            name: 'node_id',
            type: 'varchar',
            length: '100',
            isNullable: true,
          }),
        );
      }
      if (!tasksTable.findColumnByName('action')) {
        colsToAdd.push(
          new TableColumn({
            name: 'action',
            type: 'varchar',
            length: '50',
            isNullable: true,
          }),
        );
      }
      if (!tasksTable.findColumnByName('decided_by')) {
        colsToAdd.push(
          new TableColumn({
            name: 'decided_by',
            type: 'bigint',
            unsigned: true,
            isNullable: true,
          }),
        );
      }
      if (!tasksTable.findColumnByName('decided_at')) {
        colsToAdd.push(
          new TableColumn({
            name: 'decided_at',
            type: 'datetime',
            isNullable: true,
          }),
        );
      }
      if (!tasksTable.findColumnByName('due_at')) {
        colsToAdd.push(
          new TableColumn({
            name: 'due_at',
            type: 'datetime',
            isNullable: true,
          }),
        );
      }
      if (!tasksTable.findColumnByName('version')) {
        colsToAdd.push(
          new TableColumn({
            name: 'version',
            type: 'int',
            unsigned: true,
            default: 1,
            isNullable: false,
          }),
        );
      }

      if (colsToAdd.length > 0) {
        await queryRunner.addColumns('workflow_tasks', colsToAdd);
      }

      // Add FK for decided_by
      if (!tasksTable.foreignKeys.some(fk => fk.columnNames.includes('decided_by'))) {
        await queryRunner.createForeignKey(
          'workflow_tasks',
          new TableForeignKey({
            name: 'fk_wf_task_decided_by',
            columnNames: ['decided_by'],
            referencedTableName: 'users',
            referencedColumnNames: ['id'],
            onDelete: 'SET NULL',
          }),
        );
      }

      // Add index for pending task lookups by role and user
      await queryRunner.createIndex(
        'workflow_tasks',
        new TableIndex({
          name: 'idx_wf_task_status_assignee',
          columnNames: ['status', 'assignee_role_id', 'assignee_user_id'],
        }),
      );
    }

    // 3. Create workflow_transitions table (Append-Only Audit)
    const transitionsTableExists = await queryRunner.hasTable('workflow_transitions');
    if (!transitionsTableExists) {
      await queryRunner.createTable(
        new Table({
          name: 'workflow_transitions',
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
              name: 'instance_id',
              type: 'bigint',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'task_id',
              type: 'bigint',
              unsigned: true,
              isNullable: true,
            },
            {
              name: 'from_node_id',
              type: 'varchar',
              length: '100',
              isNullable: false,
            },
            {
              name: 'to_node_id',
              type: 'varchar',
              length: '100',
              isNullable: false,
            },
            {
              name: 'action',
              type: 'varchar',
              length: '50',
              isNullable: false,
            },
            {
              name: 'actor_id',
              type: 'bigint',
              unsigned: true,
              isNullable: true,
            },
            {
              name: 'reason',
              type: 'text',
              isNullable: true,
            },
            {
              name: 'version_id',
              type: 'bigint',
              unsigned: true,
              isNullable: false,
            },
            {
              name: 'context_snapshot',
              type: 'json',
              isNullable: true,
            },
            {
              name: 'created_at',
              type: 'datetime',
              default: 'CURRENT_TIMESTAMP',
              isNullable: false,
            },
          ],
        }),
        true,
      );

      // Add FKs for workflow_transitions
      await queryRunner.createForeignKey(
        'workflow_transitions',
        new TableForeignKey({
          name: 'fk_wf_trans_instance',
          columnNames: ['instance_id'],
          referencedTableName: 'workflow_instances',
          referencedColumnNames: ['id'],
          onDelete: 'CASCADE',
        }),
      );

      await queryRunner.createForeignKey(
        'workflow_transitions',
        new TableForeignKey({
          name: 'fk_wf_trans_task',
          columnNames: ['task_id'],
          referencedTableName: 'workflow_tasks',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );

      await queryRunner.createForeignKey(
        'workflow_transitions',
        new TableForeignKey({
          name: 'fk_wf_trans_version',
          columnNames: ['version_id'],
          referencedTableName: 'workflow_versions',
          referencedColumnNames: ['id'],
          onDelete: 'RESTRICT',
        }),
      );

      await queryRunner.createForeignKey(
        'workflow_transitions',
        new TableForeignKey({
          name: 'fk_wf_trans_actor',
          columnNames: ['actor_id'],
          referencedTableName: 'users',
          referencedColumnNames: ['id'],
          onDelete: 'SET NULL',
        }),
      );

      await queryRunner.createIndex(
        'workflow_transitions',
        new TableIndex({
          name: 'idx_wf_trans_instance_created',
          columnNames: ['instance_id', 'created_at'],
        }),
      );
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const transitionsTable = await queryRunner.getTable('workflow_transitions');
    if (transitionsTable) {
      for (const fk of transitionsTable.foreignKeys) {
        await queryRunner.dropForeignKey('workflow_transitions', fk);
      }
      await queryRunner.dropTable('workflow_transitions', true);
    }
  }
}
