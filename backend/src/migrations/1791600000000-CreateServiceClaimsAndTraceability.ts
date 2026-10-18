import { MigrationInterface, QueryRunner } from "typeorm";

export class CreateServiceClaimsAndTraceability1791600000000 implements MigrationInterface {
  name = "CreateServiceClaimsAndTraceability1791600000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create canonical service_claims table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`service_claims\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`claim_number\` VARCHAR(100) NOT NULL,
        \`po_id\` BIGINT UNSIGNED NOT NULL,
        \`service_order_id\` BIGINT UNSIGNED NULL,
        \`project_id\` BIGINT UNSIGNED NOT NULL,
        \`vendor_id\` BIGINT UNSIGNED NOT NULL,
        \`claim_period_start\` DATE NULL,
        \`claim_period_end\` DATE NULL,
        \`status\` VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
        \`total_claim_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
        \`approved_claim_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
        \`acceptance_type\` VARCHAR(50) NULL,
        \`acceptance_reference\` VARCHAR(100) NULL,
        \`acceptance_date\` DATE NULL,
        \`notes\` TEXT NULL,
        \`created_by\` BIGINT UNSIGNED NOT NULL,
        \`submitted_by\` BIGINT UNSIGNED NULL,
        \`submitted_at\` DATETIME NULL,
        \`pm_verifier_id\` BIGINT UNSIGNED NULL,
        \`pm_verified_at\` DATETIME NULL,
        \`commercial_verifier_id\` BIGINT UNSIGNED NULL,
        \`commercial_verified_at\` DATETIME NULL,
        \`revision_notes\` TEXT NULL,
        \`rejection_reason\` TEXT NULL,
        \`cancelled_by\` BIGINT UNSIGNED NULL,
        \`cancelled_at\` DATETIME NULL,
        \`version\` INT NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` DATETIME NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_service_claims_number\` (\`claim_number\`),
        KEY \`idx_service_claims_po_id\` (\`po_id\`),
        KEY \`idx_service_claims_so_id\` (\`service_order_id\`),
        KEY \`idx_service_claims_project_id\` (\`project_id\`),
        KEY \`idx_service_claims_vendor_id\` (\`vendor_id\`),
        KEY \`idx_service_claims_status\` (\`status\`),
        CONSTRAINT \`fk_service_claims_po\` FOREIGN KEY (\`po_id\`) REFERENCES \`purchase_orders\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_service_claims_so\` FOREIGN KEY (\`service_order_id\`) REFERENCES \`service_orders\` (\`id\`) ON DELETE SET NULL,
        CONSTRAINT \`fk_service_claims_project\` FOREIGN KEY (\`project_id\`) REFERENCES \`projects\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_service_claims_vendor\` FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Create canonical service_claim_items table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`service_claim_items\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`service_claim_id\` BIGINT UNSIGNED NOT NULL,
        \`po_item_id\` BIGINT UNSIGNED NOT NULL,
        \`item_name_snapshot\` VARCHAR(255) NOT NULL,
        \`uom_snapshot\` VARCHAR(50) NOT NULL DEFAULT 'Unit',
        \`contract_quantity_snapshot\` DECIMAL(10, 2) NOT NULL,
        \`contract_unit_rate_snapshot\` DECIMAL(19, 2) NOT NULL,
        \`contract_value_snapshot\` DECIMAL(19, 2) NOT NULL,
        \`previous_approved_quantity\` DECIMAL(10, 2) NOT NULL DEFAULT 0.00,
        \`current_claim_quantity\` DECIMAL(10, 2) NOT NULL,
        \`cumulative_approved_quantity\` DECIMAL(10, 2) NOT NULL,
        \`remaining_quantity\` DECIMAL(10, 2) NOT NULL,
        \`previous_approved_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
        \`current_claim_amount\` DECIMAL(19, 2) NOT NULL,
        \`cumulative_approved_amount\` DECIMAL(19, 2) NOT NULL,
        \`remaining_contract_value\` DECIMAL(19, 2) NOT NULL,
        \`work_location\` VARCHAR(255) NULL,
        \`notes\` TEXT NULL,
        \`version\` INT NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_service_claim_items_claim_id\` (\`service_claim_id\`),
        KEY \`idx_service_claim_items_po_item_id\` (\`po_item_id\`),
        CONSTRAINT \`fk_service_claim_items_claim\` FOREIGN KEY (\`service_claim_id\`) REFERENCES \`service_claims\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_service_claim_items_po_item\` FOREIGN KEY (\`po_item_id\`) REFERENCES \`purchase_order_items\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Evolve invoices table with service_claim_id nullable FK
    const hasServiceClaimId = await queryRunner.hasColumn(
      "invoices",
      "service_claim_id",
    );
    if (!hasServiceClaimId) {
      await queryRunner.query(`
        ALTER TABLE \`invoices\`
        ADD COLUMN \`service_claim_id\` BIGINT UNSIGNED NULL AFTER \`payment_term_id\`,
        ADD KEY \`idx_invoices_service_claim_id\` (\`service_claim_id\`),
        ADD CONSTRAINT \`fk_invoices_service_claim\` FOREIGN KEY (\`service_claim_id\`) REFERENCES \`service_claims\` (\`id\`) ON DELETE RESTRICT;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop foreign key and column from invoices
    const hasServiceClaimId = await queryRunner.hasColumn(
      "invoices",
      "service_claim_id",
    );
    if (hasServiceClaimId) {
      await queryRunner.query(`
        ALTER TABLE \`invoices\`
        DROP FOREIGN KEY \`fk_invoices_service_claim\`,
        DROP KEY \`idx_invoices_service_claim_id\`,
        DROP COLUMN \`service_claim_id\`;
      `);
    }

    // 2. Drop service_claim_items table
    await queryRunner.query(`DROP TABLE IF EXISTS \`service_claim_items\`;`);

    // 3. Drop service_claims table
    await queryRunner.query(`DROP TABLE IF EXISTS \`service_claims\`;`);
  }
}
