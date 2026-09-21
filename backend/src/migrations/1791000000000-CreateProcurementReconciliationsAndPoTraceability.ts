import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateProcurementReconciliationsAndPoTraceability1791000000000
  implements MigrationInterface
{
  name = 'CreateProcurementReconciliationsAndPoTraceability1791000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Evolve purchase_order_items table with pr_item_id and cost_item_id
    const hasPrItemId = await queryRunner.hasColumn('purchase_order_items', 'pr_item_id');
    if (!hasPrItemId) {
      await queryRunner.query(`
        ALTER TABLE \`purchase_order_items\`
        ADD COLUMN \`pr_item_id\` BIGINT UNSIGNED NULL AFTER \`purchase_order_id\`,
        ADD KEY \`idx_purchase_order_items_pr_item_id\` (\`pr_item_id\`),
        ADD CONSTRAINT \`fk_purchase_order_items_pr_item\` FOREIGN KEY (\`pr_item_id\`) REFERENCES \`purchase_request_items\` (\`id\`) ON DELETE RESTRICT;
      `);
    }

    const hasCostItemId = await queryRunner.hasColumn('purchase_order_items', 'cost_item_id');
    if (!hasCostItemId) {
      await queryRunner.query(`
        ALTER TABLE \`purchase_order_items\`
        ADD COLUMN \`cost_item_id\` BIGINT UNSIGNED NULL AFTER \`pr_item_id\`,
        ADD KEY \`idx_purchase_order_items_cost_item_id\` (\`cost_item_id\`),
        ADD CONSTRAINT \`fk_purchase_order_items_cost_item\` FOREIGN KEY (\`cost_item_id\`) REFERENCES \`cost_items\` (\`id\`) ON DELETE RESTRICT;
      `);
    }

    // 2. Create procurement_reconciliations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`procurement_reconciliations\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`project_id\` BIGINT UNSIGNED NOT NULL,
        \`pr_id\` BIGINT UNSIGNED NOT NULL,
        \`pr_item_id\` BIGINT UNSIGNED NOT NULL,
        \`po_id\` BIGINT UNSIGNED NULL,
        \`po_item_id\` BIGINT UNSIGNED NULL,
        \`origin\` VARCHAR(30) NOT NULL,
        \`target_cost_item_id\` BIGINT UNSIGNED NULL,
        \`target_wbs_id\` BIGINT UNSIGNED NULL,
        \`mapped_quantity\` DECIMAL(12, 4) NOT NULL DEFAULT '0.0000',
        \`mapped_amount\` DECIMAL(19, 2) NOT NULL DEFAULT '0.00',
        \`status\` VARCHAR(30) NOT NULL DEFAULT 'PENDING',
        \`match_type\` VARCHAR(50) NOT NULL,
        \`notes\` TEXT NULL,
        \`reconciled_by\` BIGINT UNSIGNED NULL,
        \`reconciled_at\` DATETIME NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_procurement_reconciliations_pr_item_id\` (\`pr_item_id\`),
        KEY \`idx_procurement_reconciliations_project_id\` (\`project_id\`),
        KEY \`idx_procurement_reconciliations_pr_id\` (\`pr_id\`),
        KEY \`idx_procurement_reconciliations_status\` (\`status\`),
        KEY \`idx_procurement_reconciliations_origin\` (\`origin\`),
        KEY \`idx_procurement_reconciliations_target_cost_item_id\` (\`target_cost_item_id\`),
        CONSTRAINT \`fk_reconciliations_project\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_reconciliations_pr\` FOREIGN KEY (\`pr_id\`) REFERENCES \`purchase_requests\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_reconciliations_pr_item\` FOREIGN KEY (\`pr_item_id\`) REFERENCES \`purchase_request_items\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_reconciliations_po\` FOREIGN KEY (\`po_id\`) REFERENCES \`purchase_orders\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_reconciliations_po_item\` FOREIGN KEY (\`po_item_id\`) REFERENCES \`purchase_order_items\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_reconciliations_cost_item\` FOREIGN KEY (\`target_cost_item_id\`) REFERENCES \`cost_items\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_reconciliations_wbs\` FOREIGN KEY (\`target_wbs_id\`) REFERENCES \`work_breakdown_structures\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_reconciliations_reconciled_by\` FOREIGN KEY (\`reconciled_by\`) REFERENCES \`users\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop procurement_reconciliations table
    await queryRunner.query(`DROP TABLE IF EXISTS \`procurement_reconciliations\`;`);

    // 2. Drop constraints and columns from purchase_order_items
    const hasCostItemId = await queryRunner.hasColumn('purchase_order_items', 'cost_item_id');
    if (hasCostItemId) {
      await queryRunner.query(`
        ALTER TABLE \`purchase_order_items\`
        DROP FOREIGN KEY \`fk_purchase_order_items_cost_item\`,
        DROP INDEX \`idx_purchase_order_items_cost_item_id\`,
        DROP COLUMN \`cost_item_id\`;
      `);
    }

    const hasPrItemId = await queryRunner.hasColumn('purchase_order_items', 'pr_item_id');
    if (hasPrItemId) {
      await queryRunner.query(`
        ALTER TABLE \`purchase_order_items\`
        DROP FOREIGN KEY \`fk_purchase_order_items_pr_item\`,
        DROP INDEX \`idx_purchase_order_items_pr_item_id\`,
        DROP COLUMN \`pr_item_id\`;
      `);
    }
  }
}
