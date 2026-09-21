import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProcurementPackagesAndTraceability1790000000000 implements MigrationInterface {
  name = 'CreateProcurementPackagesAndTraceability1790000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create procurement_packages table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`procurement_packages\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`package_number\` VARCHAR(100) NOT NULL,
        \`project_id\` BIGINT UNSIGNED NOT NULL,
        \`title\` VARCHAR(255) NOT NULL,
        \`description\` TEXT NULL,
        \`required_date\` DATE NULL,
        \`total_estimated_amount\` DECIMAL(19, 2) NOT NULL DEFAULT '0.00',
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'DRAFT',
        \`requested_by\` BIGINT UNSIGNED NOT NULL,
        \`submitted_at\` DATETIME NULL,
        \`reviewed_by\` BIGINT UNSIGNED NULL,
        \`reviewed_at\` DATETIME NULL,
        \`rejection_notes\` TEXT NULL,
        \`version\` INT NOT NULL DEFAULT 1,
        \`created_by\` BIGINT UNSIGNED NULL,
        \`updated_by\` BIGINT UNSIGNED NULL,
        \`deleted_by\` BIGINT UNSIGNED NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` DATETIME NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_procurement_packages_package_number\` (\`package_number\`),
        KEY \`idx_procurement_packages_project_id\` (\`project_id\`),
        KEY \`idx_procurement_packages_status\` (\`status\`),
        KEY \`idx_procurement_packages_deleted_at\` (\`deleted_at\`),
        CONSTRAINT \`fk_procurement_packages_project\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_procurement_packages_requested_by\` FOREIGN KEY (\`requested_by\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_procurement_packages_reviewed_by\` FOREIGN KEY (\`reviewed_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Create procurement_package_items table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`procurement_package_items\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`package_id\` BIGINT UNSIGNED NOT NULL,
        \`cost_item_id\` BIGINT UNSIGNED NOT NULL,
        \`wbs_id\` BIGINT UNSIGNED NULL,
        \`item_name\` VARCHAR(255) NOT NULL,
        \`uom\` VARCHAR(50) NOT NULL DEFAULT 'Unit',
        \`baseline_qty\` DECIMAL(12, 4) NOT NULL DEFAULT '0.0000',
        \`requested_qty\` DECIMAL(12, 4) NOT NULL DEFAULT '0.0000',
        \`estimated_unit_price\` DECIMAL(19, 2) NOT NULL DEFAULT '0.00',
        \`estimated_total\` DECIMAL(19, 2) NOT NULL DEFAULT '0.00',
        \`required_date\` DATE NULL,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'PENDING',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` DATETIME NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_package_items_package_id\` (\`package_id\`),
        KEY \`idx_package_items_cost_item_id\` (\`cost_item_id\`),
        KEY \`idx_package_items_wbs_id\` (\`wbs_id\`),
        KEY \`idx_package_items_deleted_at\` (\`deleted_at\`),
        CONSTRAINT \`fk_package_items_package\` FOREIGN KEY (\`package_id\`) REFERENCES \`procurement_packages\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_package_items_cost_item\` FOREIGN KEY (\`cost_item_id\`) REFERENCES \`cost_items\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_package_items_wbs\` FOREIGN KEY (\`wbs_id\`) REFERENCES \`work_breakdown_structures\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Evolve purchase_requests table
    const hasPackageId = await queryRunner.hasColumn('purchase_requests', 'package_id');
    if (!hasPackageId) {
      await queryRunner.query(`
        ALTER TABLE \`purchase_requests\`
        ADD COLUMN \`package_id\` BIGINT UNSIGNED NULL AFTER \`project_id\`,
        ADD UNIQUE KEY \`uq_purchase_requests_package_id\` (\`package_id\`),
        ADD CONSTRAINT \`fk_purchase_requests_package\` FOREIGN KEY (\`package_id\`) REFERENCES \`procurement_packages\` (\`id\`) ON DELETE RESTRICT;
      `);
    }

    const hasOrigin = await queryRunner.hasColumn('purchase_requests', 'origin');
    if (!hasOrigin) {
      // Step 3a: Add origin as nullable
      await queryRunner.query(`
        ALTER TABLE \`purchase_requests\`
        ADD COLUMN \`origin\` VARCHAR(30) NULL AFTER \`status\`;
      `);

      // Step 3b: Backfill existing historical PRs to 'LEGACY'
      await queryRunner.query(`
        UPDATE \`purchase_requests\`
        SET \`origin\` = 'LEGACY'
        WHERE \`origin\` IS NULL;
      `);

      // Step 3c: Alter column to NOT NULL without DEFAULT value
      await queryRunner.query(`
        ALTER TABLE \`purchase_requests\`
        MODIFY COLUMN \`origin\` VARCHAR(30) NOT NULL;
      `);
    }

    // 4. Evolve purchase_request_items table
    const hasPackageItemId = await queryRunner.hasColumn('purchase_request_items', 'package_item_id');
    if (!hasPackageItemId) {
      await queryRunner.query(`
        ALTER TABLE \`purchase_request_items\`
        ADD COLUMN \`package_item_id\` BIGINT UNSIGNED NULL AFTER \`pr_id\`,
        ADD COLUMN \`cost_item_id\` BIGINT UNSIGNED NULL AFTER \`package_item_id\`,
        ADD COLUMN \`wbs_id\` BIGINT UNSIGNED NULL AFTER \`cost_item_id\`,
        ADD KEY \`idx_pr_items_package_item_id\` (\`package_item_id\`),
        ADD KEY \`idx_pr_items_cost_item_id\` (\`cost_item_id\`),
        ADD KEY \`idx_pr_items_wbs_id\` (\`wbs_id\`),
        ADD CONSTRAINT \`fk_pr_items_package_item\` FOREIGN KEY (\`package_item_id\`) REFERENCES \`procurement_package_items\` (\`id\`) ON DELETE SET NULL,
        ADD CONSTRAINT \`fk_pr_items_cost_item\` FOREIGN KEY (\`cost_item_id\`) REFERENCES \`cost_items\` (\`id\`) ON DELETE SET NULL,
        ADD CONSTRAINT \`fk_pr_items_wbs\` FOREIGN KEY (\`wbs_id\`) REFERENCES \`work_breakdown_structures\` (\`id\`) ON DELETE SET NULL;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop constraints and columns from purchase_request_items
    const hasPackageItemId = await queryRunner.hasColumn('purchase_request_items', 'package_item_id');
    if (hasPackageItemId) {
      await queryRunner.query(`
        ALTER TABLE \`purchase_request_items\`
        DROP FOREIGN KEY \`fk_pr_items_package_item\`,
        DROP FOREIGN KEY \`fk_pr_items_cost_item\`,
        DROP FOREIGN KEY \`fk_pr_items_wbs\`,
        DROP COLUMN \`wbs_id\`,
        DROP COLUMN \`cost_item_id\`,
        DROP COLUMN \`package_item_id\`;
      `);
    }

    // 2. Drop constraints and columns from purchase_requests
    const hasOrigin = await queryRunner.hasColumn('purchase_requests', 'origin');
    if (hasOrigin) {
      await queryRunner.query(`
        ALTER TABLE \`purchase_requests\`
        DROP COLUMN \`origin\`;
      `);
    }

    const hasPackageId = await queryRunner.hasColumn('purchase_requests', 'package_id');
    if (hasPackageId) {
      await queryRunner.query(`
        ALTER TABLE \`purchase_requests\`
        DROP FOREIGN KEY \`fk_purchase_requests_package\`,
        DROP INDEX \`uq_purchase_requests_package_id\`,
        DROP COLUMN \`package_id\`;
      `);
    }

    // 3. Drop tables
    await queryRunner.query(`DROP TABLE IF EXISTS \`procurement_package_items\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`procurement_packages\`;`);
  }
}
