import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateCompanyBankAccountsAndEnhancePayments1795000000000 implements MigrationInterface {
  name = 'CreateCompanyBankAccountsAndEnhancePayments1795000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Create company_bank_accounts master table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`company_bank_accounts\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`company_code\` VARCHAR(10) NOT NULL COMMENT 'Legal entity ownership: UBD or TVM',
        \`bank_name\` VARCHAR(100) NOT NULL,
        \`bank_code\` VARCHAR(30) NULL DEFAULT NULL,
        \`account_number\` VARCHAR(50) NOT NULL,
        \`account_holder_name\` VARCHAR(200) NOT NULL,
        \`account_type\` VARCHAR(30) NOT NULL DEFAULT 'GIRO',
        \`account_purpose\` VARCHAR(40) NOT NULL DEFAULT 'OPERATIONAL',
        \`currency\` VARCHAR(3) NOT NULL DEFAULT 'IDR',
        \`status\` VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
        \`is_default\` TINYINT(1) NOT NULL DEFAULT 0,
        \`effective_date\` DATE NOT NULL,
        \`expiry_date\` DATE NULL DEFAULT NULL,
        \`pic_name\` VARCHAR(150) NULL DEFAULT NULL,
        \`notes\` TEXT NULL DEFAULT NULL,
        \`last_change_reason\` TEXT NULL DEFAULT NULL,
        \`version\` INT NOT NULL DEFAULT 1,
        \`created_by\` BIGINT UNSIGNED NULL DEFAULT NULL,
        \`updated_by\` BIGINT UNSIGNED NULL DEFAULT NULL,
        \`deleted_by\` BIGINT UNSIGNED NULL DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` DATETIME NULL DEFAULT NULL,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_cba_company_bank_account\` (\`company_code\`, \`bank_name\`, \`account_number\`),
        INDEX \`idx_cba_entity_status_default\` (\`company_code\`, \`status\`, \`is_default\`),
        INDEX \`idx_cba_created_by\` (\`created_by\`),
        INDEX \`idx_cba_updated_by\` (\`updated_by\`),
        CONSTRAINT \`chk_cba_company_code\` CHECK (\`company_code\` IN ('UBD', 'TVM')),
        CONSTRAINT \`chk_cba_status\` CHECK (\`status\` IN ('ACTIVE', 'INACTIVE', 'BLOCKED')),
        CONSTRAINT \`chk_cba_account_type\` CHECK (\`account_type\` IN ('GIRO', 'CHECKING', 'SAVINGS', 'ESCROW', 'OTHER')),
        CONSTRAINT \`chk_cba_account_purpose\` CHECK (\`account_purpose\` IN ('OPERATIONAL', 'PROJECT', 'VENDOR_PAYMENT', 'TAX_REMITTANCE', 'OTHER'))
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 2. Add source account snapshot and metadata columns to payments table
    const paymentColumns = [
      { name: 'company_bank_account_id', type: 'BIGINT UNSIGNED NULL DEFAULT NULL' },
      { name: 'payment_method', type: 'VARCHAR(50) NULL DEFAULT NULL' },
      { name: 'reference_number', type: 'VARCHAR(100) NULL DEFAULT NULL' },
      { name: 'notes', type: 'TEXT NULL DEFAULT NULL' },
      { name: 'source_account_snapshot', type: 'JSON NULL DEFAULT NULL' },
    ];

    for (const col of paymentColumns) {
      const hasCol = await queryRunner.hasColumn('payments', col.name);
      if (!hasCol) {
        await queryRunner.query(`
          ALTER TABLE \`payments\`
          ADD COLUMN \`${col.name}\` ${col.type}
        `);
      }
    }

    // 3. Add index and foreign key on payments(company_bank_account_id)
    await queryRunner.query(`
      ALTER TABLE \`payments\`
      ADD INDEX \`idx_payments_company_bank_account_id\` (\`company_bank_account_id\`)
    `);

    await queryRunner.query(`
      ALTER TABLE \`payments\`
      ADD CONSTRAINT \`fk_payments_company_bank_account\`
      FOREIGN KEY (\`company_bank_account_id\`)
      REFERENCES \`company_bank_accounts\` (\`id\`)
      ON DELETE RESTRICT
      ON UPDATE RESTRICT
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop foreign key and index from payments
    try {
      await queryRunner.query(`
        ALTER TABLE \`payments\`
        DROP FOREIGN KEY \`fk_payments_company_bank_account\`
      `);
    } catch {
      // Ignore if foreign key was already dropped
    }

    try {
      await queryRunner.query(`
        ALTER TABLE \`payments\`
        DROP INDEX \`idx_payments_company_bank_account_id\`
      `);
    } catch {
      // Ignore if index was already dropped
    }

    // 2. Drop columns from payments
    const columnsToDrop = [
      'source_account_snapshot',
      'notes',
      'reference_number',
      'payment_method',
      'company_bank_account_id',
    ];

    for (const col of columnsToDrop) {
      const hasCol = await queryRunner.hasColumn('payments', col);
      if (hasCol) {
        await queryRunner.query(`
          ALTER TABLE \`payments\`
          DROP COLUMN \`${col}\`
        `);
      }
    }

    // 3. Drop company_bank_accounts table
    await queryRunner.query(`
      DROP TABLE IF EXISTS \`company_bank_accounts\`
    `);
  }
}
