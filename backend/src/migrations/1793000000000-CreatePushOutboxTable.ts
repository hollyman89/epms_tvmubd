import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePushOutboxTable1793000000000 implements MigrationInterface {
  name = 'CreatePushOutboxTable1793000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`push_outbox\` (
        \`id\` BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        \`notification_id\` BIGINT UNSIGNED NOT NULL,
        \`recipient_id\` BIGINT UNSIGNED NOT NULL,
        \`event_id\` VARCHAR(100) NOT NULL,
        \`purpose\` VARCHAR(100) NOT NULL,
        \`dedupe_key\` VARCHAR(191) NOT NULL,
        \`status\` ENUM(
          'PENDING',
          'CLAIMED',
          'ACCEPTED_BY_GATEWAY',
          'FAILED_RETRYABLE',
          'PERMANENT_FAILURE',
          'NO_SUBSCRIPTION'
        ) NOT NULL DEFAULT 'PENDING',
        \`claim_count\` INT UNSIGNED NOT NULL DEFAULT 0,
        \`attempts\` INT UNSIGNED NOT NULL DEFAULT 0,
        \`max_attempts\` INT UNSIGNED NOT NULL DEFAULT 3,
        \`next_retry_at\` DATETIME NULL,
        \`lease_token\` VARCHAR(64) NULL,
        \`lease_expires_at\` DATETIME NULL,
        \`payload_preview\` JSON NOT NULL,
        \`delivery_details\` JSON NULL,
        \`error_category\` ENUM(
          'NONE',
          'NETWORK_TIMEOUT',
          'CONNECTION_RESET',
          'GATEWAY_5XX',
          'RATE_LIMIT_429',
          'INVALID_SUBSCRIPTION_410',
          'SSRF_REJECTED',
          'VAPID_ERROR',
          'EXCEEDED_MAX_ATTEMPTS',
          'POISON_PILL_CLAIM_EXCEEDED',
          'UNKNOWN_ERROR'
        ) NOT NULL DEFAULT 'NONE',
        \`last_error_message\` VARCHAR(500) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`dispatched_at\` DATETIME NULL,
        CONSTRAINT \`fk_push_outbox_notification\` FOREIGN KEY (\`notification_id\`) REFERENCES \`notifications\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`uk_push_outbox_dedupe\` UNIQUE (\`dedupe_key\`),
        INDEX \`idx_push_outbox_claim\` (\`status\`, \`next_retry_at\`, \`lease_expires_at\`, \`id\`),
        INDEX \`idx_push_outbox_recipient\` (\`recipient_id\`, \`status\`),
        INDEX \`idx_push_outbox_purge\` (\`status\`, \`dispatched_at\`, \`created_at\`)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`push_outbox\`;`);
  }
}

