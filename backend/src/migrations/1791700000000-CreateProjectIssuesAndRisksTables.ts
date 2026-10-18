import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateProjectIssuesAndRisksTables1791700000000 implements MigrationInterface {
  name = "CreateProjectIssuesAndRisksTables1791700000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create project_risks table first (so project_issues can reference source_risk_id)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`project_risks\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`project_id\` BIGINT UNSIGNED NOT NULL,
        \`task_id\` BIGINT UNSIGNED NULL,
        \`risk_number\` VARCHAR(100) NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`description\` TEXT NOT NULL,
        \`category\` VARCHAR(50) NOT NULL,
        \`probability\` TINYINT UNSIGNED NULL,
        \`impact\` TINYINT UNSIGNED NULL,
        \`risk_score\` TINYINT UNSIGNED NULL,
        \`risk_level\` VARCHAR(20) NULL,
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'IDENTIFIED',
        \`owner_id\` BIGINT UNSIGNED NOT NULL,
        \`identified_by_id\` BIGINT UNSIGNED NOT NULL,
        \`identified_at\` DATETIME NOT NULL,
        \`mitigation_plan\` TEXT NULL,
        \`contingency_plan\` TEXT NULL,
        \`target_date\` DATE NULL,
        \`review_date\` DATE NULL,
        \`closed_by_id\` BIGINT UNSIGNED NULL,
        \`closed_at\` DATETIME NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`version\` INT NOT NULL DEFAULT 1,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_project_risks_risk_number\` (\`risk_number\`),
        KEY \`idx_project_risks_project_status\` (\`project_id\`, \`status\`),
        KEY \`idx_project_risks_project_level\` (\`project_id\`, \`risk_level\`),
        KEY \`idx_project_risks_review_date\` (\`review_date\`),
        CONSTRAINT \`fk_project_risks_project\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_project_risks_task\` FOREIGN KEY (\`task_id\`) REFERENCES \`tasks\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_project_risks_owner\` FOREIGN KEY (\`owner_id\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_project_risks_identified_by\` FOREIGN KEY (\`identified_by_id\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_project_risks_closed_by\` FOREIGN KEY (\`closed_by_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Create project_issues table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`project_issues\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`project_id\` BIGINT UNSIGNED NOT NULL,
        \`task_id\` BIGINT UNSIGNED NULL,
        \`issue_number\` VARCHAR(100) NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`description\` TEXT NOT NULL,
        \`category\` VARCHAR(50) NOT NULL,
        \`severity\` VARCHAR(20) NOT NULL,
        \`priority\` VARCHAR(20) NOT NULL,
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'OPEN',
        \`owner_id\` BIGINT UNSIGNED NOT NULL,
        \`reported_by_id\` BIGINT UNSIGNED NOT NULL,
        \`reported_at\` DATETIME NOT NULL,
        \`due_date\` DATE NULL,
        \`resolution\` TEXT NULL,
        \`resolved_by_id\` BIGINT UNSIGNED NULL,
        \`resolved_at\` DATETIME NULL,
        \`closed_by_id\` BIGINT UNSIGNED NULL,
        \`closed_at\` DATETIME NULL,
        \`source_risk_id\` BIGINT UNSIGNED NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`version\` INT NOT NULL DEFAULT 1,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_project_issues_issue_number\` (\`issue_number\`),
        UNIQUE KEY \`uq_project_issues_source_risk\` (\`source_risk_id\`),
        KEY \`idx_project_issues_project_status\` (\`project_id\`, \`status\`),
        KEY \`idx_project_issues_project_owner\` (\`project_id\`, \`owner_id\`),
        KEY \`idx_project_issues_due_date\` (\`due_date\`),
        CONSTRAINT \`fk_project_issues_project\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_project_issues_task\` FOREIGN KEY (\`task_id\`) REFERENCES \`tasks\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_project_issues_owner\` FOREIGN KEY (\`owner_id\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_project_issues_reported_by\` FOREIGN KEY (\`reported_by_id\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_project_issues_resolved_by\` FOREIGN KEY (\`resolved_by_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_project_issues_closed_by\` FOREIGN KEY (\`closed_by_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_project_issues_source_risk\` FOREIGN KEY (\`source_risk_id\`) REFERENCES \`project_risks\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`project_issues\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`project_risks\`;`);
  }
}
