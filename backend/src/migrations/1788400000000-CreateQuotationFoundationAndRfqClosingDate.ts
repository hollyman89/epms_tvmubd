import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateQuotationFoundationAndRfqClosingDate1788400000000 implements MigrationInterface {
  name = 'CreateQuotationFoundationAndRfqClosingDate1788400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add closing_date column to rfqs table if not exists
    const hasClosingDate = await queryRunner.hasColumn('rfqs', 'closing_date');
    if (!hasClosingDate) {
      await queryRunner.query(`
        ALTER TABLE \`rfqs\`
        ADD COLUMN \`closing_date\` DATETIME NULL AFTER \`status\`
      `);
    }

    // 2. Create quotations table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`quotations\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`rfq_id\` BIGINT UNSIGNED NOT NULL,
        \`vendor_id\` BIGINT UNSIGNED NOT NULL,
        \`quotation_number\` VARCHAR(100) NOT NULL,
        \`vendor_ref\` VARCHAR(100) NULL,
        \`quotation_date\` DATETIME NOT NULL,
        \`valid_until\` DATETIME NULL,
        \`lead_time_days\` INT NOT NULL DEFAULT 14,
        \`total_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
        \`status\` VARCHAR(50) NOT NULL DEFAULT 'SUBMITTED',
        \`notes\` TEXT NULL,
        \`created_by\` BIGINT UNSIGNED NULL,
        \`updated_by\` BIGINT UNSIGNED NULL,
        \`deleted_by\` BIGINT UNSIGNED NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` DATETIME NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_quotations_quotation_number\` (\`quotation_number\`),
        KEY \`idx_quotations_rfq_id\` (\`rfq_id\`),
        KEY \`idx_quotations_vendor_id\` (\`vendor_id\`),
        KEY \`idx_quotations_status\` (\`status\`),
        KEY \`idx_quotations_deleted_at\` (\`deleted_at\`),
        CONSTRAINT \`fk_quotations_rfq\` FOREIGN KEY (\`rfq_id\`) REFERENCES \`rfqs\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_quotations_vendor\` FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Create quotation_items table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`quotation_items\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`quotation_id\` BIGINT UNSIGNED NOT NULL,
        \`pr_item_id\` BIGINT UNSIGNED NULL,
        \`item_name\` VARCHAR(255) NOT NULL,
        \`quantity\` DECIMAL(10, 2) NOT NULL,
        \`uom\` VARCHAR(50) NOT NULL DEFAULT 'PCS',
        \`unit_price\` DECIMAL(19, 2) NOT NULL,
        \`total_amount\` DECIMAL(19, 2) NOT NULL,
        \`remarks\` TEXT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        KEY \`idx_quotation_items_quotation_id\` (\`quotation_id\`),
        KEY \`idx_quotation_items_pr_item_id\` (\`pr_item_id\`),
        CONSTRAINT \`fk_quotation_items_quotation\` FOREIGN KEY (\`quotation_id\`) REFERENCES \`quotations\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_quotation_items_pr_item\` FOREIGN KEY (\`pr_item_id\`) REFERENCES \`purchase_request_items\` (\`id\`) ON DELETE SET NULL
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE IF EXISTS \`quotation_items\`;`);
    await queryRunner.query(`DROP TABLE IF EXISTS \`quotations\`;`);
    const hasClosingDate = await queryRunner.hasColumn('rfqs', 'closing_date');
    if (hasClosingDate) {
      await queryRunner.query(`ALTER TABLE \`rfqs\` DROP COLUMN \`closing_date\`;`);
    }
  }
}
