import { MigrationInterface, QueryRunner } from "typeorm";

export class CreatePaymentRequestsTable1791100000000 implements MigrationInterface {
  name = "CreatePaymentRequestsTable1791100000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create payment_requests table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`payment_requests\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`request_number\` VARCHAR(100) NOT NULL,
        \`invoice_id\` BIGINT UNSIGNED NOT NULL,
        \`payment_term_id\` BIGINT UNSIGNED NULL,
        \`requested_amount\` DECIMAL(19, 2) NOT NULL,
        \`approved_amount\` DECIMAL(19, 2) NULL,
        \`status\` ENUM('PENDING_DIRECTOR_APPROVAL', 'NEEDS_REVISION', 'APPROVED_FOR_PAYMENT', 'REJECTED', 'PAID') NOT NULL DEFAULT 'PENDING_DIRECTOR_APPROVAL',
        \`requested_by\` BIGINT UNSIGNED NOT NULL,
        \`submitted_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`returned_at\` DATETIME NULL,
        \`revision_notes\` TEXT NULL,
        \`approved_by\` BIGINT UNSIGNED NULL,
        \`approved_at\` DATETIME NULL,
        \`rejection_reason\` TEXT NULL,
        \`notes\` TEXT NULL,
        \`approval_snapshot\` JSON NULL,
        \`version\` INT NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` DATETIME NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uq_payment_requests_request_number\` (\`request_number\`),
        KEY \`idx_payment_requests_invoice_id\` (\`invoice_id\`),
        KEY \`idx_payment_requests_payment_term_id\` (\`payment_term_id\`),
        KEY \`idx_payment_requests_status\` (\`status\`),
        KEY \`idx_payment_requests_requested_by\` (\`requested_by\`),
        KEY \`idx_payment_requests_approved_by\` (\`approved_by\`),
        CONSTRAINT \`fk_payment_requests_invoice\` FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoices\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_payment_requests_term\` FOREIGN KEY (\`payment_term_id\`) REFERENCES \`po_payment_terms\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_payment_requests_requester\` FOREIGN KEY (\`requested_by\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT,
        CONSTRAINT \`fk_payment_requests_approver\` FOREIGN KEY (\`approved_by\`) REFERENCES \`users\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Add payment_request_id to payments table
    const hasPaymentRequestId = await queryRunner.hasColumn(
      "payments",
      "payment_request_id",
    );
    if (!hasPaymentRequestId) {
      await queryRunner.query(`
        ALTER TABLE \`payments\`
        ADD COLUMN \`payment_request_id\` BIGINT UNSIGNED NULL AFTER \`invoice_id\`,
        ADD KEY \`idx_payments_payment_request_id\` (\`payment_request_id\`),
        ADD CONSTRAINT \`fk_payments_payment_request\` FOREIGN KEY (\`payment_request_id\`) REFERENCES \`payment_requests\` (\`id\`) ON DELETE RESTRICT;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasPaymentRequestId = await queryRunner.hasColumn(
      "payments",
      "payment_request_id",
    );
    if (hasPaymentRequestId) {
      await queryRunner.query(`
        ALTER TABLE \`payments\`
        DROP FOREIGN KEY \`fk_payments_payment_request\`,
        DROP INDEX \`idx_payments_payment_request_id\`,
        DROP COLUMN \`payment_request_id\`;
      `);
    }

    await queryRunner.query(`DROP TABLE IF EXISTS \`payment_requests\`;`);
  }
}
