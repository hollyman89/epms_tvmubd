import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePushSubscriptionsTable1793100000000 implements MigrationInterface {
  name = 'CreatePushSubscriptionsTable1793100000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`push_subscriptions\` (
        \`id\` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`user_id\` BIGINT UNSIGNED NOT NULL,
        \`endpoint\` TEXT NOT NULL,
        \`endpoint_hash\` CHAR(64) NOT NULL,
        \`p256dh\` VARCHAR(255) NOT NULL,
        \`auth\` VARCHAR(255) NOT NULL,
        \`user_agent\` VARCHAR(500) NULL,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`failure_reason\` VARCHAR(100) NULL,
        \`last_used_at\` DATETIME NULL,
        \`unsubscribed_at\` DATETIME NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        CONSTRAINT \`fk_push_sub_user\` FOREIGN KEY (\`user_id\`) REFERENCES \`users\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`uk_push_sub_endpoint_hash\` UNIQUE (\`endpoint_hash\`),
        INDEX \`idx_push_sub_user_active\` (\`user_id\`, \`is_active\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`push_subscriptions\`;`);
  }
}

