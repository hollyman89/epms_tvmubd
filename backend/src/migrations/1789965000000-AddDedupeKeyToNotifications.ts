import { MigrationInterface, QueryRunner, TableColumn, TableIndex } from 'typeorm';

export class AddDedupeKeyToNotifications1789965000000 implements MigrationInterface {
  name = 'AddDedupeKeyToNotifications1789965000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add dedupe_key column
    const hasColumn = await queryRunner.hasColumn('notifications', 'dedupe_key');
    if (!hasColumn) {
      await queryRunner.addColumn(
        'notifications',
        new TableColumn({
          name: 'dedupe_key',
          type: 'varchar',
          length: '191',
          isNullable: true,
        }),
      );
    }

    // 2. Add unique index for user_id + dedupe_key
    await queryRunner.createIndex(
      'notifications',
      new TableIndex({
        name: 'idx_notif_user_dedupe',
        columnNames: ['user_id', 'dedupe_key'],
        isUnique: true,
      }),
    );
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.dropIndex('notifications', 'idx_notif_user_dedupe');
    await queryRunner.dropColumn('notifications', 'dedupe_key');
  }
}
