import { MigrationInterface, QueryRunner } from "typeorm";

export class AddProcurementOrderTypeAndServiceOrders1791400000000 implements MigrationInterface {
  name = "AddProcurementOrderTypeAndServiceOrders1791400000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Evolve purchase_orders table with order_type
    const hasOrderType = await queryRunner.hasColumn(
      "purchase_orders",
      "order_type",
    );
    if (!hasOrderType) {
      await queryRunner.query(`
        ALTER TABLE \`purchase_orders\`
        ADD COLUMN \`order_type\` VARCHAR(30) NOT NULL DEFAULT 'MATERIAL' AFTER \`po_number\`,
        ADD KEY \`idx_purchase_orders_order_type\` (\`order_type\`);
      `);
    }

    // 2. Authoritative Backfill of existing POs per Approved Policy (Option B with Legacy Discriminator)
    // MATERIAL: IDs 1, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18
    await queryRunner.query(`
      UPDATE \`purchase_orders\`
      SET \`order_type\` = 'MATERIAL'
      WHERE \`id\` IN (1, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 17, 18);
    `);

    // SERVICE: ID 2
    await queryRunner.query(`
      UPDATE \`purchase_orders\`
      SET \`order_type\` = 'SERVICE'
      WHERE \`id\` = 2;
    `);

    // LEGACY_MIXED: IDs 3, 4, 16
    await queryRunner.query(`
      UPDATE \`purchase_orders\`
      SET \`order_type\` = 'LEGACY_MIXED'
      WHERE \`id\` IN (3, 4, 16);
    `);

    // 3. Evolve purchase_order_items table with uom
    const hasUom = await queryRunner.hasColumn("purchase_order_items", "uom");
    if (!hasUom) {
      await queryRunner.query(`
        ALTER TABLE \`purchase_order_items\`
        ADD COLUMN \`uom\` VARCHAR(50) NULL AFTER \`quantity\`;
      `);

      // Backfill uom from linked cost_items
      await queryRunner.query(`
        UPDATE \`purchase_order_items\` poi
        JOIN \`cost_items\` ci ON ci.id = poi.cost_item_id
        SET poi.uom = ci.uom
        WHERE poi.uom IS NULL AND ci.uom IS NOT NULL;
      `);

      // Backfill uom from linked purchase_request_items if cost_item uom is still null
      await queryRunner.query(`
        UPDATE \`purchase_order_items\` poi
        JOIN \`purchase_request_items\` pri ON pri.id = poi.pr_item_id
        SET poi.uom = pri.uom
        WHERE poi.uom IS NULL AND pri.uom IS NOT NULL;
      `);

      // Default any remaining unmapped uom to 'Unit'
      await queryRunner.query(`
        UPDATE \`purchase_order_items\`
        SET \`uom\` = 'Unit'
        WHERE \`uom\` IS NULL;
      `);
    }

    // 4. Create canonical service_orders table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`service_orders\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`service_order_number\` VARCHAR(100) NOT NULL,
        \`document_type\` VARCHAR(30) NOT NULL,
        \`purchase_order_id\` BIGINT UNSIGNED NOT NULL,
        \`project_id\` BIGINT UNSIGNED NOT NULL,
        \`vendor_id\` BIGINT UNSIGNED NOT NULL,
        \`scope_of_work\` TEXT NOT NULL,
        \`work_location\` VARCHAR(255) NULL,
        \`start_date\` DATE NULL,
        \`end_date\` DATE NULL,
        \`notes\` TEXT NULL,
        \`status\` VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
        \`issued_at\` DATETIME NULL,
        \`issued_by\` BIGINT UNSIGNED NULL,
        \`created_by\` BIGINT UNSIGNED NULL,
        \`updated_by\` BIGINT UNSIGNED NULL,
        \`deleted_by\` BIGINT UNSIGNED NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` DATETIME NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_service_orders_number\` (\`service_order_number\`),
        KEY \`idx_service_orders_po_id\` (\`purchase_order_id\`),
        KEY \`idx_service_orders_project_id\` (\`project_id\`),
        KEY \`idx_service_orders_vendor_id\` (\`vendor_id\`),
        KEY \`idx_service_orders_status\` (\`status\`),
        CONSTRAINT \`fk_service_orders_po\` FOREIGN KEY (\`purchase_order_id\`) REFERENCES \`purchase_orders\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_service_orders_project\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_service_orders_vendor\` FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop service_orders table
    await queryRunner.query(`DROP TABLE IF EXISTS \`service_orders\`;`);

    // 2. Drop uom column from purchase_order_items
    const hasUom = await queryRunner.hasColumn("purchase_order_items", "uom");
    if (hasUom) {
      await queryRunner.query(`
        ALTER TABLE \`purchase_order_items\`
        DROP COLUMN \`uom\`;
      `);
    }

    // 3. Drop order_type column from purchase_orders
    const hasOrderType = await queryRunner.hasColumn(
      "purchase_orders",
      "order_type",
    );
    if (hasOrderType) {
      await queryRunner.query(`
        ALTER TABLE \`purchase_orders\`
        DROP INDEX \`idx_purchase_orders_order_type\`,
        DROP COLUMN \`order_type\`;
      `);
    }
  }
}
