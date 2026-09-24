import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProjectBaselinesAndItems1789200000000
  implements MigrationInterface
{
  name = 'CreateProjectBaselinesAndItems1789200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`project_baselines\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`project_id\` BIGINT UNSIGNED NOT NULL,
        \`version_number\` INT UNSIGNED NOT NULL,
        \`status\` ENUM('DRAFT', 'ACTIVE', 'SUPERSEDED') NOT NULL DEFAULT 'DRAFT',
        \`active_project_id\` BIGINT UNSIGNED GENERATED ALWAYS AS (IF(\`status\` = 'ACTIVE', \`project_id\`, NULL)) VIRTUAL,
        \`total_weight_percentage\` DECIMAL(5, 2) NOT NULL DEFAULT '100.00',
        \`description\` TEXT NULL,
        \`created_by\` BIGINT UNSIGNED NULL,
        \`activated_by\` BIGINT UNSIGNED NULL,
        \`activated_at\` DATETIME NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_project_baseline_version\` (\`project_id\`, \`version_number\`),
        UNIQUE KEY \`uq_project_active_baseline\` (\`active_project_id\`),
        CONSTRAINT \`fk_baselines_project\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_baselines_created_by\` FOREIGN KEY (\`created_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_baselines_activated_by\` FOREIGN KEY (\`activated_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`project_baseline_wbs_items\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`baseline_id\` BIGINT UNSIGNED NOT NULL,
        \`wbs_id\` BIGINT UNSIGNED NOT NULL,
        \`parent_wbs_id\` BIGINT UNSIGNED NULL,
        \`code\` VARCHAR(50) NOT NULL,
        \`name\` VARCHAR(255) NOT NULL,
        \`level\` INT NOT NULL,
        \`weight_percentage\` DECIMAL(5, 2) NOT NULL,
        \`is_leaf\` TINYINT(1) NOT NULL,
        \`task_id\` BIGINT UNSIGNED NULL,
        \`task_name_snapshot\` VARCHAR(255) NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_baseline_wbs\` (\`baseline_id\`, \`wbs_id\`),
        KEY \`idx_baseline_wbs_task\` (\`baseline_id\`, \`task_id\`),
        CONSTRAINT \`fk_baseline_items_header\` FOREIGN KEY (\`baseline_id\`) REFERENCES \`project_baselines\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`project_baseline_wbs_items\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`project_baselines\`;`);
  }
}
