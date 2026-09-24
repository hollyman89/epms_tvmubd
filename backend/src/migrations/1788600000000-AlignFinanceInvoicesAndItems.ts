import { MigrationInterface, QueryRunner } from 'typeorm';

export class AlignFinanceInvoicesAndItems1788600000000 implements MigrationInterface {
  name = 'AlignFinanceInvoicesAndItems1788600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Align invoices table columns if not exists
    const hasPaymentTermId = await queryRunner.hasColumn('invoices', 'payment_term_id');
    if (!hasPaymentTermId) {
      await queryRunner.query(`
        ALTER TABLE \`invoices\`
        ADD COLUMN \`payment_term_id\` BIGINT UNSIGNED NULL AFTER \`po_id\`
      `);
    }

    const hasInvoiceDate = await queryRunner.hasColumn('invoices', 'invoice_date');
    if (!hasInvoiceDate) {
      await queryRunner.query(`
        ALTER TABLE \`invoices\`
        ADD COLUMN \`invoice_date\` DATETIME NULL AFTER \`invoice_number\`
      `);
    }

    const hasMatchStatus = await queryRunner.hasColumn('invoices', 'match_status');
    if (!hasMatchStatus) {
      await queryRunner.query(`
        ALTER TABLE \`invoices\`
        ADD COLUMN \`match_status\` VARCHAR(50) NOT NULL DEFAULT 'PENDING' AFTER \`total_amount\`
      `);
    }

    const hasPaymentStatus = await queryRunner.hasColumn('invoices', 'payment_status');
    if (!hasPaymentStatus) {
      await queryRunner.query(`
        ALTER TABLE \`invoices\`
        ADD COLUMN \`payment_status\` VARCHAR(50) NOT NULL DEFAULT 'UNPAID' AFTER \`match_status\`
      `);
    }

    // Add Foreign Key and Index for payment_term_id on invoices
    const existingFk = await queryRunner.query(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'invoices' 
        AND CONSTRAINT_NAME = 'fk_invoices_payment_term'
    `);
    if (!existingFk || existingFk.length === 0) {
      // Add index first if not exists
      const existingIdx = await queryRunner.query(`
        SHOW INDEX FROM \`invoices\` WHERE Key_name = 'idx_invoices_payment_term_id'
      `);
      if (!existingIdx || existingIdx.length === 0) {
        await queryRunner.query(`
          ALTER TABLE \`invoices\`
          ADD INDEX \`idx_invoices_payment_term_id\` (\`payment_term_id\`)
        `);
      }

      await queryRunner.query(`
        ALTER TABLE \`invoices\`
        ADD CONSTRAINT \`fk_invoices_payment_term\`
        FOREIGN KEY (\`payment_term_id\`) REFERENCES \`po_payment_terms\` (\`id\`)
        ON DELETE RESTRICT
      `);
    }

    // 2. Create invoice_items table if not exists
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`invoice_items\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`invoice_id\` BIGINT UNSIGNED NOT NULL,
        \`po_item_id\` BIGINT UNSIGNED NULL,
        \`item_name\` VARCHAR(255) NULL,
        \`quantity\` DECIMAL(10, 2) NOT NULL DEFAULT 1.00,
        \`unit_price\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
        \`total_price\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
        \`created_by\` BIGINT UNSIGNED NULL,
        \`updated_by\` BIGINT UNSIGNED NULL,
        \`deleted_by\` BIGINT UNSIGNED NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` DATETIME NULL,
        \`version\` INT NOT NULL DEFAULT 1,
        PRIMARY KEY (\`id\`),
        KEY \`idx_invoice_items_invoice_id\` (\`invoice_id\`),
        KEY \`idx_invoice_items_po_item_id\` (\`po_item_id\`),
        KEY \`idx_invoice_items_deleted_at\` (\`deleted_at\`),
        CONSTRAINT \`fk_invoice_items_invoice\` FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoices\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_invoice_items_po_item\` FOREIGN KEY (\`po_item_id\`) REFERENCES \`purchase_order_items\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop invoice_items table
    await queryRunner.query(`DROP TABLE IF EXISTS \`invoice_items\`;`);

    // 2. Drop fk and index on invoices
    const existingFk = await queryRunner.query(`
      SELECT CONSTRAINT_NAME 
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE 
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'invoices' 
        AND CONSTRAINT_NAME = 'fk_invoices_payment_term'
    `);
    if (Array.isArray(existingFk) && existingFk.length > 0) {
      await queryRunner.query(`ALTER TABLE \`invoices\` DROP FOREIGN KEY \`fk_invoices_payment_term\`;`);
    }

    const existingIdx = await queryRunner.query(`
      SHOW INDEX FROM \`invoices\` WHERE Key_name = 'idx_invoices_payment_term_id'
    `);
    if (Array.isArray(existingIdx) && existingIdx.length > 0) {
      await queryRunner.query(`ALTER TABLE \`invoices\` DROP INDEX \`idx_invoices_payment_term_id\`;`);
    }

    // 3. Drop columns from invoices if they exist
    const hasPaymentTermId = await queryRunner.hasColumn('invoices', 'payment_term_id');
    if (hasPaymentTermId) {
      await queryRunner.query(`ALTER TABLE \`invoices\` DROP COLUMN \`payment_term_id\`;`);
    }

    const hasPaymentStatus = await queryRunner.hasColumn('invoices', 'payment_status');
    if (hasPaymentStatus) {
      await queryRunner.query(`ALTER TABLE \`invoices\` DROP COLUMN \`payment_status\`;`);
    }

    const hasMatchStatus = await queryRunner.hasColumn('invoices', 'match_status');
    if (hasMatchStatus) {
      await queryRunner.query(`ALTER TABLE \`invoices\` DROP COLUMN \`match_status\`;`);
    }

    const hasInvoiceDate = await queryRunner.hasColumn('invoices', 'invoice_date');
    if (hasInvoiceDate) {
      await queryRunner.query(`ALTER TABLE \`invoices\` DROP COLUMN \`invoice_date\`;`);
    }
  }
}
