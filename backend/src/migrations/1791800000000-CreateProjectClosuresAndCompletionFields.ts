import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
} from "typeorm";

export class CreateProjectClosuresAndCompletionFields1791800000000 implements MigrationInterface {
  name = "CreateProjectClosuresAndCompletionFields1791800000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Alter projects: add actual_finish_at, closed_at, closed_by
    const projectTable = await queryRunner.getTable("projects");
    if (projectTable) {
      if (!projectTable.findColumnByName("actual_finish_at")) {
        await queryRunner.addColumn(
          "projects",
          new TableColumn({
            name: "actual_finish_at",
            type: "datetime",
            isNullable: true,
          }),
        );
      }

      if (!projectTable.findColumnByName("closed_at")) {
        await queryRunner.addColumn(
          "projects",
          new TableColumn({
            name: "closed_at",
            type: "datetime",
            isNullable: true,
          }),
        );
      }

      if (!projectTable.findColumnByName("closed_by")) {
        await queryRunner.addColumn(
          "projects",
          new TableColumn({
            name: "closed_by",
            type: "bigint",
            unsigned: true,
            isNullable: true,
          }),
        );
      }

      const refreshedProjectTable = await queryRunner.getTable("projects");
      const hasClosedByFk = refreshedProjectTable?.foreignKeys.some(
        (fk) =>
          fk.columnNames.includes("closed_by") ||
          fk.name === "fk_projects_closed_by",
      );
      if (!hasClosedByFk) {
        await queryRunner.createForeignKey(
          "projects",
          new TableForeignKey({
            name: "fk_projects_closed_by",
            columnNames: ["closed_by"],
            referencedTableName: "users",
            referencedColumnNames: ["id"],
            onDelete: "SET NULL",
          }),
        );
      }
    }

    // 2. Alter documents: add category VARCHAR(50) NOT NULL DEFAULT 'OTHER'
    const docTable = await queryRunner.getTable("documents");
    if (docTable && !docTable.findColumnByName("category")) {
      await queryRunner.addColumn(
        "documents",
        new TableColumn({
          name: "category",
          type: "varchar",
          length: "50",
          isNullable: false,
          default: "'OTHER'",
        }),
      );
    }

    // 3. Create project_closures table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`project_closures\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`project_id\` BIGINT UNSIGNED NOT NULL,
        \`cycle_number\` INT UNSIGNED NOT NULL,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'PENDING_HOO_REVIEW',
        \`submitted_by\` BIGINT UNSIGNED NOT NULL,
        \`submitted_at\` DATETIME NOT NULL,
        \`submission_notes\` TEXT NULL,
        \`readiness_snapshot\` JSON NOT NULL,
        \`acceptance_document_id\` BIGINT UNSIGNED NOT NULL,
        \`final_report_document_id\` BIGINT UNSIGNED NOT NULL,
        \`hoo_reviewer_id\` BIGINT UNSIGNED NULL,
        \`hoo_reviewed_at\` DATETIME NULL,
        \`hoo_notes\` TEXT NULL,
        \`director_approver_id\` BIGINT UNSIGNED NULL,
        \`director_approved_at\` DATETIME NULL,
        \`director_notes\` TEXT NULL,
        \`return_actor_id\` BIGINT UNSIGNED NULL,
        \`return_role\` VARCHAR(50) NULL,
        \`return_timestamp\` DATETIME NULL,
        \`return_reason\` TEXT NULL,
        \`version\` INT UNSIGNED NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_project_closures_project_cycle\` (\`project_id\`, \`cycle_number\`),
        KEY \`idx_project_closures_project_id\` (\`project_id\`),
        KEY \`idx_project_closures_project_status\` (\`project_id\`, \`status\`),
        KEY \`idx_project_closures_status\` (\`status\`),
        CONSTRAINT \`fk_project_closures_project\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_project_closures_submitted_by\` FOREIGN KEY (\`submitted_by\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_project_closures_acceptance_doc\` FOREIGN KEY (\`acceptance_document_id\`) REFERENCES \`documents\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_project_closures_final_report_doc\` FOREIGN KEY (\`final_report_document_id\`) REFERENCES \`documents\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_project_closures_hoo_reviewer\` FOREIGN KEY (\`hoo_reviewer_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_project_closures_director_approver\` FOREIGN KEY (\`director_approver_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_project_closures_return_actor\` FOREIGN KEY (\`return_actor_id\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop project_closures table
    await queryRunner.query(`DROP TABLE IF EXISTS \`project_closures\`;`);

    // 2. Drop category column from documents
    const docTable = await queryRunner.getTable("documents");
    if (docTable && docTable.findColumnByName("category")) {
      await queryRunner.dropColumn("documents", "category");
    }

    // 3. Drop columns and foreign key from projects
    const projectTable = await queryRunner.getTable("projects");
    if (projectTable) {
      const closedByFk = projectTable.foreignKeys.find(
        (fk) =>
          fk.name === "fk_projects_closed_by" ||
          fk.columnNames.includes("closed_by"),
      );
      if (closedByFk) {
        await queryRunner.dropForeignKey("projects", closedByFk);
      }

      if (projectTable.findColumnByName("closed_by")) {
        await queryRunner.dropColumn("projects", "closed_by");
      }

      if (projectTable.findColumnByName("closed_at")) {
        await queryRunner.dropColumn("projects", "closed_at");
      }

      if (projectTable.findColumnByName("actual_finish_at")) {
        await queryRunner.dropColumn("projects", "actual_finish_at");
      }
    }
  }
}
