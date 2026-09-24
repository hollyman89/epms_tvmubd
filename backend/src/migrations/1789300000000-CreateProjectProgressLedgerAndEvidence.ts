import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectProgressLedgerAndEvidence1789300000000
  implements MigrationInterface
{
  name = 'CreateProjectProgressLedgerAndEvidence1789300000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`project_progress_logs\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`project_id\` BIGINT UNSIGNED NOT NULL,
        \`task_id\` BIGINT UNSIGNED NOT NULL,
        \`wbs_id\` BIGINT UNSIGNED NOT NULL,
        \`baseline_id\` BIGINT UNSIGNED NOT NULL,
        \`previous_progress\` DECIMAL(5, 2) NOT NULL,
        \`reported_progress\` DECIMAL(5, 2) NOT NULL,
        \`progress_delta\` DECIMAL(5, 2) NOT NULL,
        \`effective_date\` DATE NOT NULL,
        \`event_type\` VARCHAR(50) NOT NULL,
        \`status\` ENUM('PENDING_VERIFICATION', 'OFFICIAL', 'REJECTED') NOT NULL DEFAULT 'PENDING_VERIFICATION',
        \`reason\` TEXT NULL,
        \`submitted_by\` BIGINT UNSIGNED NOT NULL,
        \`verified_by\` BIGINT UNSIGNED NULL,
        \`verified_at\` DATETIME NULL,
        \`rejection_reason\` TEXT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_progress_logs_query\` (\`task_id\`, \`status\`, \`effective_date\`, \`created_at\`, \`id\`),
        KEY \`idx_progress_logs_project\` (\`project_id\`, \`status\`),
        KEY \`idx_progress_logs_baseline\` (\`baseline_id\`),
        CONSTRAINT \`fk_progress_logs_project\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_progress_logs_task\` FOREIGN KEY (\`task_id\`) REFERENCES \`tasks\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_progress_logs_wbs\` FOREIGN KEY (\`wbs_id\`) REFERENCES \`work_breakdown_structures\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_progress_logs_baseline\` FOREIGN KEY (\`baseline_id\`) REFERENCES \`project_baselines\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_progress_logs_submitted_by\` FOREIGN KEY (\`submitted_by\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_progress_logs_verified_by\` FOREIGN KEY (\`verified_by\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`project_progress_evidence\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`progress_log_id\` BIGINT UNSIGNED NOT NULL,
        \`document_id\` BIGINT UNSIGNED NOT NULL,
        \`created_by\` BIGINT UNSIGNED NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_progress_log_document\` (\`progress_log_id\`, \`document_id\`),
        KEY \`idx_progress_evidence_document\` (\`document_id\`),
        CONSTRAINT \`fk_evidence_progress_log\` FOREIGN KEY (\`progress_log_id\`) REFERENCES \`project_progress_logs\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_evidence_document\` FOREIGN KEY (\`document_id\`) REFERENCES \`documents\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_evidence_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`project_progress_evidence\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`project_progress_logs\`;`);
  }
}
