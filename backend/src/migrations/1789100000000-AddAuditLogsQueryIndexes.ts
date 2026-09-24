import { MigrationInterface, QueryRunner, TableIndex } from 'typeorm';

export class AddAuditLogsQueryIndexes1789100000000 implements MigrationInterface {
  name = 'AddAuditLogsQueryIndexes1789100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Index for deterministic sorting, pagination, and date range filtering
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'idx_audit_logs_created_at_id',
        columnNames: ['created_at', 'id'],
      }),
    );

    // 2. Index for actor filtering
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'idx_audit_logs_created_by',
        columnNames: ['created_by'],
      }),
    );

    // 3. Index for action filtering
    await queryRunner.createIndex(
      'audit_logs',
      new TableIndex({
        name: 'idx_audit_logs_action',
        columnNames: ['action'],
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('audit_logs', 'idx_audit_logs_action');
    await queryRunner.dropIndex('audit_logs', 'idx_audit_logs_created_by');
    await queryRunner.dropIndex('audit_logs', 'idx_audit_logs_created_at_id');
  }
}
