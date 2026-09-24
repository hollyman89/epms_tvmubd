import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreatePoPaymentTermsAndMetadata1788500000000 implements MigrationInterface {
  name = 'CreatePoPaymentTermsAndMetadata1788500000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add metadata columns (delivery_location, delivery_date, notes) to purchase_orders if not exists
    const hasDeliveryLocation = await queryRunner.hasColumn('purchase_orders', 'delivery_location');
    if (!hasDeliveryLocation) {
      await queryRunner.query(`
        ALTER TABLE \`purchase_orders\`
        ADD COLUMN \`delivery_location\` VARCHAR(255) NULL AFTER \`status\`,
        ADD COLUMN \`delivery_date\` DATETIME NULL AFTER \`delivery_location\`,
        ADD COLUMN \`notes\` TEXT NULL AFTER \`delivery_date\`
      `);
    }

    // 2. Create po_payment_terms table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`po_payment_terms\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`po_id\` BIGINT UNSIGNED NOT NULL,
        \`sequence\` INT NOT NULL,
        \`term_name\` VARCHAR(100) NOT NULL,
        \`term_type\` ENUM('DOWN_PAYMENT', 'PROGRESS', 'FINAL_DELIVERY', 'RETENTION') NOT NULL DEFAULT 'PROGRESS',
        \`percentage\` DECIMAL(5, 2) NOT NULL,
        \`amount\` DECIMAL(19, 2) NOT NULL,
        \`trigger_condition\` VARCHAR(255) NULL,
        \`is_retention\` BOOLEAN NOT NULL DEFAULT FALSE,
        \`retention_days\` INT NULL,
        \`status\` ENUM('PENDING', 'INVOICE_SUBMITTED', 'VERIFIED', 'PAID') NOT NULL DEFAULT 'PENDING',
        \`created_by\` BIGINT UNSIGNED NULL,
        \`updated_by\` BIGINT UNSIGNED NULL,
        \`deleted_by\` BIGINT UNSIGNED NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` DATETIME NULL,
        \`version\` INT NOT NULL DEFAULT 1,
        PRIMARY KEY (\`id\`),
        KEY \`idx_po_payment_terms_po_id\` (\`po_id\`),
        KEY \`idx_po_payment_terms_deleted_at\` (\`deleted_at\`),
        KEY \`idx_po_payment_terms_status\` (\`status\`),
        KEY \`idx_po_payment_terms_sequence\` (\`po_id\`, \`sequence\`),
        CONSTRAINT \`fk_po_payment_terms_po\` FOREIGN KEY (\`po_id\`) REFERENCES \`purchase_orders\` (\`id\`) ON DELETE CASCADE
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop po_payment_terms table
    await queryRunner.query(`DROP TABLE IF EXISTS \`po_payment_terms\`;`);

    // 2. Remove metadata columns from purchase_orders
    const hasNotes = await queryRunner.hasColumn('purchase_orders', 'notes');
    if (hasNotes) {
      await queryRunner.query(`ALTER TABLE \`purchase_orders\` DROP COLUMN \`notes\`;`);
    }

    const hasDeliveryDate = await queryRunner.hasColumn('purchase_orders', 'delivery_date');
    if (hasDeliveryDate) {
      await queryRunner.query(`ALTER TABLE \`purchase_orders\` DROP COLUMN \`delivery_date\`;`);
    }

    const hasDeliveryLocation = await queryRunner.hasColumn('purchase_orders', 'delivery_location');
    if (hasDeliveryLocation) {
      await queryRunner.query(`ALTER TABLE \`purchase_orders\` DROP COLUMN \`delivery_location\`;`);
    }
  }
}
