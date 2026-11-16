import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateTaxManagementTables1794000000000 implements MigrationInterface {
  name = 'CreateTaxManagementTables1794000000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add company_code to core direct anchor entities (DEC-TAX-07)
    const tablesToPartition = [
      'projects',
      'tenders',
      'purchase_orders',
      'invoices',
      'payment_requests',
      'payments',
    ];

    for (const table of tablesToPartition) {
      const hasCompanyCode = await queryRunner.hasColumn(table, 'company_code');
      if (!hasCompanyCode) {
        await queryRunner.query(`
          ALTER TABLE \`${table}\`
          ADD COLUMN \`company_code\` VARCHAR(10) NULL COMMENT 'Entity ownership: UBD or TVM (DEC-TAX-07)'
        `);
        await queryRunner.query(`
          ALTER TABLE \`${table}\`
          ADD INDEX \`idx_${table}_company_code\` (\`company_code\`)
        `);
      }
    }

    // 2. Table 1: legal_entity_tax_profiles
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`legal_entity_tax_profiles\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`company_code\` VARCHAR(10) NOT NULL COMMENT 'Entity code: UBD or TVM (DEC-TAX-07)',
        \`legal_entity_name\` VARCHAR(255) NOT NULL,
        \`npwp_16\` VARCHAR(16) NOT NULL COMMENT '16-digit Format Baru NPWP',
        \`nitku\` VARCHAR(22) NOT NULL DEFAULT '000000' COMMENT 'Nomor Identitas Tempat Kegiatan Usaha',
        \`kpp_pratama_name\` VARCHAR(100) NOT NULL,
        \`pkp_status\` ENUM('UNVERIFIED', 'PKP', 'NON_PKP') NOT NULL DEFAULT 'UNVERIFIED' COMMENT 'DEC-TAX-01 status: UNVERIFIED default',
        \`sppkp_number\` VARCHAR(100) NULL DEFAULT NULL,
        \`sppkp_date\` DATE NULL DEFAULT NULL,
        \`is_wapu\` TINYINT(1) NOT NULL DEFAULT 0 COMMENT 'DEC-TAX-02: default non-WAPU',
        \`wapu_decree_number\` VARCHAR(100) NULL DEFAULT NULL,
        \`default_tax_currency\` VARCHAR(3) NOT NULL DEFAULT 'IDR',
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 1,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_letp_company_code\` (\`company_code\`),
        UNIQUE KEY \`uk_letp_npwp16\` (\`npwp_16\`),
        CONSTRAINT \`chk_letp_company_code\` CHECK (\`company_code\` IN ('UBD', 'TVM')),
        CONSTRAINT \`chk_letp_npwp16_format\` CHECK (\`npwp_16\` REGEXP '^[0-9]{16}$'),
        CONSTRAINT \`chk_letp_pkp_fields\` CHECK (
          (\`pkp_status\` = 'PKP' AND \`sppkp_number\` IS NOT NULL AND \`sppkp_date\` IS NOT NULL) OR
          (\`pkp_status\` = 'NON_PKP' AND \`sppkp_number\` IS NULL) OR
          (\`pkp_status\` = 'UNVERIFIED')
        ),
        CONSTRAINT \`chk_letp_wapu_decree\` CHECK (
          (\`is_wapu\` = 1 AND \`wapu_decree_number\` IS NOT NULL) OR
          (\`is_wapu\` = 0)
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 3. Table 2: vendor_tax_profiles
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`vendor_tax_profiles\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`vendor_id\` BIGINT UNSIGNED NOT NULL COMMENT 'FK to existing vendors.id (1:1 extension)',
        \`npwp_16\` VARCHAR(16) NOT NULL,
        \`nitku\` VARCHAR(22) NOT NULL DEFAULT '000000',
        \`pkp_status\` ENUM('UNVERIFIED', 'PKP', 'NON_PKP') NOT NULL DEFAULT 'UNVERIFIED' COMMENT 'Fail-closed default',
        \`sppkp_number\` VARCHAR(100) NULL DEFAULT NULL,
        \`sppkp_date\` DATE NULL DEFAULT NULL,
        \`tax_residence\` ENUM('DOMESTIC', 'FOREIGN') NOT NULL DEFAULT 'DOMESTIC',
        \`tax_id_country\` VARCHAR(3) NOT NULL DEFAULT 'IDN',
        \`has_skb_pph23\` TINYINT(1) NOT NULL DEFAULT 0,
        \`skb_pph23_number\` VARCHAR(100) NULL DEFAULT NULL,
        \`skb_pph23_expiry\` DATE NULL DEFAULT NULL,
        \`has_suket_pp55\` TINYINT(1) NOT NULL DEFAULT 0,
        \`suket_pp55_number\` VARCHAR(100) NULL DEFAULT NULL,
        \`suket_pp55_expiry\` DATE NULL DEFAULT NULL,
        \`is_construction_service\` TINYINT(1) NOT NULL DEFAULT 0,
        \`construction_qualification\` ENUM('NONE', 'KECIL', 'MENENGAH_BESAR', 'TIDAK_TERKUALIFIKASI') NOT NULL DEFAULT 'NONE',
        \`sbu_certificate_number\` VARCHAR(100) NULL DEFAULT NULL,
        \`sbu_expiry_date\` DATE NULL DEFAULT NULL,
        \`is_verified\` TINYINT(1) NOT NULL DEFAULT 0,
        \`verified_by\` BIGINT UNSIGNED NULL DEFAULT NULL,
        \`verified_at\` DATETIME NULL DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_vtp_vendor_id\` (\`vendor_id\`),
        INDEX \`idx_vtp_npwp16\` (\`npwp_16\`),
        CONSTRAINT \`fk_vtp_vendor_id\` FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT \`chk_vtp_npwp16_format\` CHECK (\`npwp_16\` REGEXP '^[0-9]{16}$'),
        CONSTRAINT \`chk_vtp_skb_validity\` CHECK (
          (\`has_skb_pph23\` = 1 AND \`skb_pph23_number\` IS NOT NULL AND \`skb_pph23_expiry\` IS NOT NULL) OR
          (\`has_skb_pph23\` = 0)
        ),
        CONSTRAINT \`chk_vtp_suket_validity\` CHECK (
          (\`has_suket_pp55\` = 1 AND \`suket_pp55_number\` IS NOT NULL AND \`suket_pp55_expiry\` IS NOT NULL) OR
          (\`has_suket_pp55\` = 0)
        ),
        CONSTRAINT \`chk_vtp_sbu_qualification\` CHECK (
          (\`is_construction_service\` = 1 AND \`construction_qualification\` != 'NONE') OR
          (\`is_construction_service\` = 0 AND \`construction_qualification\` = 'NONE')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 4. Table 3: tax_regime_rules
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`tax_regime_rules\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`regime_code\` VARCHAR(50) NOT NULL COMMENT 'Canonical code: PPN_11, PPN_12, PPH_23_SERVICE, PPH_FINAL_KONSTRUKSI',
        \`tax_category\` ENUM('PPN', 'PPH') NOT NULL,
        \`article_reference\` VARCHAR(100) NOT NULL,
        \`statutory_rate\` DECIMAL(7, 4) NOT NULL COMMENT '0.1100, 0.1200, 0.0200, 0.0175, 0.0265, 0.0400',
        \`effective_rate_multiplier\` DECIMAL(5, 4) NOT NULL DEFAULT 1.0000 COMMENT 'DPP Nilai Lain multiplier',
        \`governing_regulation\` VARCHAR(255) NOT NULL,
        \`effective_from\` DATE NOT NULL,
        \`effective_to\` DATE NULL DEFAULT NULL,
        \`version\` INT NOT NULL DEFAULT 1,
        \`is_active\` TINYINT(1) NOT NULL DEFAULT 0,
        \`verification_status\` ENUM('NOT_VERIFIED', 'VERIFIED') NOT NULL DEFAULT 'NOT_VERIFIED',
        \`verified_by\` BIGINT UNSIGNED NULL DEFAULT NULL,
        \`verified_at\` DATETIME NULL DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_trr_regime_version\` (\`regime_code\`, \`version\`),
        UNIQUE KEY \`uk_trr_id_category\` (\`id\`, \`tax_category\`),
        INDEX \`idx_trr_active_window\` (\`is_active\`, \`effective_from\`, \`effective_to\`),
        CONSTRAINT \`chk_trr_statutory_rate\` CHECK (\`statutory_rate\` >= 0.0000 AND \`statutory_rate\` <= 1.0000),
        CONSTRAINT \`chk_trr_multiplier\` CHECK (\`effective_rate_multiplier\` > 0.0000 AND \`effective_rate_multiplier\` <= 1.0000),
        CONSTRAINT \`chk_trr_date_range\` CHECK (\`effective_to\` IS NULL OR \`effective_to\` >= \`effective_from\`),
        CONSTRAINT \`chk_trr_verification\` CHECK (
          (\`verification_status\` = 'VERIFIED' AND \`verified_by\` IS NOT NULL AND \`verified_at\` IS NOT NULL) OR
          (\`verification_status\` = 'NOT_VERIFIED' AND \`is_active\` = 0)
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 5. Table 4: invoice_tax_details
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`invoice_tax_details\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`invoice_id\` BIGINT UNSIGNED NOT NULL COMMENT '1:1 FK to existing invoices.id',
        \`company_code\` VARCHAR(10) NOT NULL COMMENT 'Entity ownership: UBD or TVM (DEC-TAX-07)',
        \`tax_regime_ppn_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
        \`primary_pph_regime_id\` BIGINT UNSIGNED NULL DEFAULT NULL,
        \`dpp_commercial\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
        \`ppn_rate\` DECIMAL(7, 4) NOT NULL DEFAULT 0.0000,
        \`ppn_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
        \`gross_commercial_liability\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00 COMMENT 'L_comm = DPP + PPN_Masukan',
        \`pph_withholding_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00 COMMENT 'W_tax',
        \`wapu_ppn_withheld_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00 COMMENT 'W_wapu_ppn',
        \`prior_deductions_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00 COMMENT 'P_ded',
        \`net_vendor_cash_payable\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00 COMMENT 'D_cash = L_comm - W_tax - W_wapu_ppn - P_ded',
        \`statutory_tax_liability\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00 COMMENT 'L_tax_stat = W_tax + W_wapu_ppn',
        \`calculation_engine_version\` VARCHAR(50) NOT NULL DEFAULT 'EPMS-TAX-2B-1.3.2',
        \`tax_rule_snapshot\` JSON NOT NULL COMMENT 'Immutable snapshot of applied rates, rules, and timestamps',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_itd_invoice_id\` (\`invoice_id\`),
        INDEX \`idx_itd_company_code\` (\`company_code\`),
        CONSTRAINT \`fk_itd_invoice_id\` FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoices\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`fk_itd_ppn_rule\` FOREIGN KEY (\`tax_regime_ppn_id\`) REFERENCES \`tax_regime_rules\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT \`fk_itd_pph_rule\` FOREIGN KEY (\`primary_pph_regime_id\`) REFERENCES \`tax_regime_rules\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT \`chk_itd_company_code\` CHECK (\`company_code\` IN ('UBD', 'TVM')),
        CONSTRAINT \`chk_itd_monetary_non_negative\` CHECK (
          \`dpp_commercial\` >= 0.00 AND \`ppn_amount\` >= 0.00 AND
          \`gross_commercial_liability\` >= 0.00 AND \`pph_withholding_amount\` >= 0.00 AND
          \`wapu_ppn_withheld_amount\` >= 0.00 AND \`prior_deductions_amount\` >= 0.00 AND
          \`net_vendor_cash_payable\` >= 0.00 AND \`statutory_tax_liability\` >= 0.00
        ),
        CONSTRAINT \`chk_itd_settlement_invariants\` CHECK (
          \`gross_commercial_liability\` = \`dpp_commercial\` + \`ppn_amount\` AND
          \`net_vendor_cash_payable\` = \`gross_commercial_liability\` - \`pph_withholding_amount\` - \`wapu_ppn_withheld_amount\` - \`prior_deductions_amount\` AND
          \`statutory_tax_liability\` = \`pph_withholding_amount\` + \`wapu_ppn_withheld_amount\`
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 6. Table 5: invoice_item_tax_details
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`invoice_item_tax_details\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`invoice_item_id\` BIGINT UNSIGNED NOT NULL COMMENT '1:1 FK to existing invoice_items.id',
        \`item_tax_category\` ENUM('TAXABLE_GOODS', 'TAXABLE_SERVICES', 'NON_TAXABLE', 'EXEMPT') NOT NULL,
        \`pph_tax_regime_rule_id\` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'FK to tax_regime_rules.id for line PPh rule (null if non-withholding)',
        \`pph_tax_category\` ENUM('PPN', 'PPH') NULL DEFAULT NULL COMMENT 'Category guard: strictly PPH when rule attached; null for non-withholding',
        \`line_pph_regime_code\` VARCHAR(50) NULL DEFAULT NULL COMMENT 'Canonical PPh regime code',
        \`line_pph_rule_version\` INT NULL DEFAULT NULL COMMENT 'Exact applied version from tax_regime_rules.version',
        \`non_withholding_reason\` ENUM('MATERIAL_SUPPLY', 'SKB_EXEMPT', 'PP55_FINAL_05', 'NON_TAXABLE_OBJECT', 'BELOW_THRESHOLD') NULL DEFAULT NULL,
        \`line_dpp\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
        \`line_ppn_rate\` DECIMAL(7, 4) NOT NULL DEFAULT 0.0000,
        \`line_ppn_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
        \`line_pph_rate\` DECIMAL(7, 4) NOT NULL DEFAULT 0.0000,
        \`line_pph_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
        \`line_tax_rule_snapshot\` JSON NOT NULL COMMENT 'Immutable audit snapshot',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_iitd_invoice_item_id\` (\`invoice_item_id\`),
        UNIQUE KEY \`uk_iitd_item_rule_category\` (\`invoice_item_id\`, \`pph_tax_regime_rule_id\`, \`pph_tax_category\`),
        INDEX \`idx_iitd_pph_rule\` (\`pph_tax_regime_rule_id\`),
        INDEX \`idx_iitd_pph_regime\` (\`line_pph_regime_code\`),
        CONSTRAINT \`fk_iitd_invoice_item_id\` FOREIGN KEY (\`invoice_item_id\`) REFERENCES \`invoice_items\` (\`id\`) ON DELETE CASCADE ON UPDATE CASCADE,
        CONSTRAINT \`fk_iitd_pph_rule_category\` FOREIGN KEY (\`pph_tax_regime_rule_id\`, \`pph_tax_category\`) REFERENCES \`tax_regime_rules\` (\`id\`, \`tax_category\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`chk_iitd_positive_monetary\` CHECK (
          \`line_dpp\` >= 0.00 AND \`line_ppn_amount\` >= 0.00 AND \`line_pph_amount\` >= 0.00
        ),
        CONSTRAINT \`chk_iitd_pph_category_guard\` CHECK (
          (\`pph_tax_regime_rule_id\` IS NULL AND \`pph_tax_category\` IS NULL AND \`line_pph_rate\` = 0.0000 AND \`line_pph_amount\` = 0.00 AND \`non_withholding_reason\` IS NOT NULL) OR
          (\`pph_tax_regime_rule_id\` IS NOT NULL AND \`pph_tax_category\` = 'PPH' AND \`line_pph_regime_code\` IS NOT NULL AND \`line_pph_rule_version\` IS NOT NULL AND \`non_withholding_reason\` IS NULL)
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 7. Table 6: ppn_masukan_records
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`ppn_masukan_records\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`invoice_id\` BIGINT UNSIGNED NOT NULL COMMENT 'FK to existing invoices.id',
        \`company_code\` VARCHAR(10) NOT NULL COMMENT 'Entity ownership: UBD or TVM (DEC-TAX-07)',
        \`vendor_tax_id\` VARCHAR(16) NOT NULL COMMENT 'Vendor 16-digit NPWP/NIK',
        \`faktur_pajak_number\` VARCHAR(20) NOT NULL COMMENT '16-digit Nomor Seri Faktur Pajak (NSFP)',
        \`faktur_pajak_date\` DATE NOT NULL,
        \`transaction_code\` VARCHAR(2) NOT NULL COMMENT '2-digit e-Faktur transaction code (01 standard, 02 WAPU, 07/08 exempt)',
        \`replacement_code\` VARCHAR(1) NOT NULL DEFAULT '0' COMMENT '0 normal, 1 replacement',
        \`dpp_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
        \`ppn_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
        \`creditability_status\` ENUM('UNVERIFIED', 'CREDITABLE', 'NON_CREDITABLE', 'EXEMPT') NOT NULL DEFAULT 'UNVERIFIED',
        \`creditability_verified_by\` BIGINT UNSIGNED NULL DEFAULT NULL,
        \`creditability_verified_at\` DATETIME NULL DEFAULT NULL,
        \`creditability_decision_basis\` VARCHAR(150) NULL DEFAULT NULL,
        \`reporting_period_month\` TINYINT UNSIGNED NOT NULL,
        \`reporting_period_year\` SMALLINT UNSIGNED NOT NULL,
        \`spt_masa_status\` ENUM('UNREPORTED', 'INCLUDED_IN_SPT', 'AUDITED') NOT NULL DEFAULT 'UNREPORTED',
        \`validation_status\` ENUM('VALID', 'INVALID_NSFP', 'AMOUNT_MISMATCH', 'VENDOR_MISMATCH') NOT NULL DEFAULT 'VALID',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_pmr_nsfp_replacement\` (\`faktur_pajak_number\`, \`replacement_code\`),
        INDEX \`idx_pmr_invoice\` (\`invoice_id\`),
        INDEX \`idx_pmr_company_period\` (\`company_code\`, \`reporting_period_year\`, \`reporting_period_month\`, \`creditability_status\`),
        CONSTRAINT \`fk_pmr_invoice_id\` FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoices\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT \`chk_pmr_company_code\` CHECK (\`company_code\` IN ('UBD', 'TVM')),
        CONSTRAINT \`chk_pmr_nsfp_pattern\` CHECK (\`faktur_pajak_number\` REGEXP '^[0-9]{16}$'),
        CONSTRAINT \`chk_pmr_period_month\` CHECK (\`reporting_period_month\` BETWEEN 1 AND 12),
        CONSTRAINT \`chk_pmr_positive_monetary\` CHECK (\`dpp_amount\` >= 0.00 AND \`ppn_amount\` >= 0.00)
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 8. Table 7: statutory_tax_liabilities (needed before pph_withholding_records)
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`statutory_tax_liabilities\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`company_code\` VARCHAR(10) NOT NULL COMMENT 'Entity ownership: UBD or TVM (DEC-TAX-07)',
        \`tax_period_month\` TINYINT UNSIGNED NOT NULL COMMENT 'Month (1-12)',
        \`tax_period_year\` SMALLINT UNSIGNED NOT NULL COMMENT 'Year (e.g. 2026)',
        \`tax_regime\` VARCHAR(30) NOT NULL COMMENT 'Regime code, e.g. PPH_23_SERVICE, PPH_FINAL_KONSTRUKSI, PPN_WAPU',
        \`total_withheld_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00 COMMENT 'Cumulative statutory obligations accrued',
        \`total_remitted_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00 COMMENT 'Cumulative remittances to Kas Negara',
        \`outstanding_balance\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00 COMMENT 'Remaining sovereign debt owed to state',
        \`status\` ENUM('OPEN', 'PARTIALLY_SETTLED', 'DISCHARGED') NOT NULL DEFAULT 'OPEN',
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_stl_company_period_regime\` (\`company_code\`, \`tax_period_year\`, \`tax_period_month\`, \`tax_regime\`),
        UNIQUE KEY \`uk_stl_id_dimensions\` (\`id\`, \`company_code\`, \`tax_period_year\`, \`tax_period_month\`, \`tax_regime\`),
        CONSTRAINT \`chk_stl_company_code\` CHECK (\`company_code\` IN ('UBD', 'TVM')),
        CONSTRAINT \`chk_stl_period_month\` CHECK (\`tax_period_month\` BETWEEN 1 AND 12),
        CONSTRAINT \`chk_stl_monetary_balances\` CHECK (
          \`total_withheld_amount\` >= 0.00 AND \`total_remitted_amount\` >= 0.00 AND
          \`outstanding_balance\` >= 0.00 AND
          \`outstanding_balance\` = \`total_withheld_amount\` - \`total_remitted_amount\`
        ),
        CONSTRAINT \`chk_stl_status_invariants\` CHECK (
          (\`status\` = 'OPEN' AND \`total_remitted_amount\` = 0.00 AND \`outstanding_balance\` = \`total_withheld_amount\`) OR
          (\`status\` = 'PARTIALLY_SETTLED' AND \`total_remitted_amount\` > 0.00 AND \`outstanding_balance\` > 0.00) OR
          (\`status\` = 'DISCHARGED' AND \`outstanding_balance\` = 0.00 AND \`total_withheld_amount\` > 0.00) OR
          (\`status\` = 'OPEN' AND \`total_withheld_amount\` = 0.00 AND \`total_remitted_amount\` = 0.00 AND \`outstanding_balance\` = 0.00)
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 9. Table 8: pph_withholding_records
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`pph_withholding_records\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`invoice_id\` BIGINT UNSIGNED NOT NULL COMMENT 'FK to existing invoices.id (1:N support)',
        \`invoice_item_id\` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'Optional FK to specific invoice_items.id for line withholding',
        \`tax_regime_rule_id\` BIGINT UNSIGNED NOT NULL COMMENT 'FK to authoritative tax_regime_rules.id',
        \`pph_tax_category\` ENUM('PPN', 'PPH') NOT NULL DEFAULT 'PPH' COMMENT 'Category guard: strictly PPH',
        \`payment_term_id\` BIGINT UNSIGNED NULL DEFAULT NULL COMMENT 'FK to existing po_payment_terms.id',
        \`company_code\` VARCHAR(10) NOT NULL COMMENT 'Entity ownership: UBD or TVM (DEC-TAX-07)',
        \`vendor_id\` BIGINT UNSIGNED NOT NULL COMMENT 'FK to existing vendors.id',
        \`pph_regime\` VARCHAR(30) NOT NULL COMMENT 'Regime code matching line_pph_regime_code',
        \`tax_period_month\` TINYINT UNSIGNED NOT NULL COMMENT 'Month (1-12) derived from trigger date',
        \`tax_period_year\` SMALLINT UNSIGNED NOT NULL COMMENT 'Year (e.g. 2026) derived from trigger date',
        \`statutory_tax_liability_id\` BIGINT UNSIGNED NOT NULL COMMENT 'FK to statutory_tax_liabilities.id',
        \`taxable_base\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00 COMMENT 'DPP for withholding',
        \`withholding_rate\` DECIMAL(7, 4) NOT NULL DEFAULT 0.0000,
        \`withheld_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00 COMMENT 'Statutory withholding amount (W_tax)',
        \`total_remitted_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00 COMMENT 'Cumulative valid confirmed remittance',
        \`outstanding_withheld_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00 COMMENT 'Remaining unremitted statutory obligation',
        \`statutory_trigger_type\` ENUM('PAYMENT', 'DUE_DATE', 'END_OF_MONTH') NOT NULL,
        \`statutory_trigger_date\` DATE NOT NULL,
        \`recognition_status\` ENUM('RECOGNIZED_UNREMITTED', 'PARTIALLY_REMITTED', 'FULLY_REMITTED', 'CANCELLED') NOT NULL DEFAULT 'RECOGNIZED_UNREMITTED',
        \`bukti_potong_number\` VARCHAR(50) NULL DEFAULT NULL,
        \`bukti_potong_date\` DATE NULL DEFAULT NULL,
        \`cancellation_reason\` VARCHAR(255) NULL DEFAULT NULL,
        \`cancelled_by\` BIGINT UNSIGNED NULL DEFAULT NULL,
        \`cancelled_at\` DATETIME NULL DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_pwr_id_dim_liability\` (\`id\`, \`company_code\`, \`tax_period_year\`, \`tax_period_month\`, \`pph_regime\`, \`statutory_tax_liability_id\`),
        INDEX \`idx_pwr_invoice\` (\`invoice_id\`),
        INDEX \`idx_pwr_item\` (\`invoice_item_id\`),
        INDEX \`idx_pwr_rule\` (\`tax_regime_rule_id\`),
        INDEX \`idx_pwr_liability\` (\`statutory_tax_liability_id\`),
        INDEX \`idx_pwr_company_regime_status\` (\`company_code\`, \`pph_regime\`, \`recognition_status\`),
        INDEX \`idx_pwr_vendor\` (\`vendor_id\`),
        CONSTRAINT \`fk_pwr_invoice_id\` FOREIGN KEY (\`invoice_id\`) REFERENCES \`invoices\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT \`fk_pwr_item_tax_determination\` FOREIGN KEY (\`invoice_item_id\`, \`tax_regime_rule_id\`, \`pph_tax_category\`)
          REFERENCES \`invoice_item_tax_details\` (\`invoice_item_id\`, \`pph_tax_regime_rule_id\`, \`pph_tax_category\`)
          ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`fk_pwr_regime_rule_category\` FOREIGN KEY (\`tax_regime_rule_id\`, \`pph_tax_category\`)
          REFERENCES \`tax_regime_rules\` (\`id\`, \`tax_category\`)
          ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`fk_pwr_term_id\` FOREIGN KEY (\`payment_term_id\`) REFERENCES \`po_payment_terms\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT \`fk_pwr_vendor_id\` FOREIGN KEY (\`vendor_id\`) REFERENCES \`vendors\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT \`fk_pwr_statutory_liability\` FOREIGN KEY (\`statutory_tax_liability_id\`) REFERENCES \`statutory_tax_liabilities\` (\`id\`) ON DELETE RESTRICT ON UPDATE CASCADE,
        CONSTRAINT \`fk_pwr_liability_dimensions\` FOREIGN KEY (\`company_code\`, \`tax_period_year\`, \`tax_period_month\`, \`pph_regime\`) REFERENCES \`statutory_tax_liabilities\` (\`company_code\`, \`tax_period_year\`, \`tax_period_month\`, \`tax_regime\`) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`chk_pwr_company_code\` CHECK (\`company_code\` IN ('UBD', 'TVM')),
        CONSTRAINT \`chk_pwr_tax_category\` CHECK (\`pph_tax_category\` = 'PPH'),
        CONSTRAINT \`chk_pwr_period_month\` CHECK (\`tax_period_month\` BETWEEN 1 AND 12),
        CONSTRAINT \`chk_pwr_positive_monetary\` CHECK (\`taxable_base\` >= 0.00 AND \`withheld_amount\` >= 0.00),
        CONSTRAINT \`chk_pwr_rate_bounds\` CHECK (\`withholding_rate\` >= 0.0000 AND \`withholding_rate\` <= 1.0000),
        CONSTRAINT \`chk_pwr_outstanding_math\` CHECK (
          (\`recognition_status\` != 'CANCELLED' AND \`outstanding_withheld_amount\` = \`withheld_amount\` - \`total_remitted_amount\`) OR
          (\`recognition_status\` = 'CANCELLED' AND \`outstanding_withheld_amount\` = 0.00)
        ),
        CONSTRAINT \`chk_pwr_remitted_bounds\` CHECK (\`total_remitted_amount\` >= 0.00 AND \`total_remitted_amount\` <= \`withheld_amount\`),
        CONSTRAINT \`chk_pwr_recognition_status_rules\` CHECK (
          (\`recognition_status\` = 'RECOGNIZED_UNREMITTED' AND \`total_remitted_amount\` = 0.00 AND \`outstanding_withheld_amount\` = \`withheld_amount\` AND \`withheld_amount\` > 0.00 AND \`cancellation_reason\` IS NULL) OR
          (\`recognition_status\` = 'PARTIALLY_REMITTED' AND \`total_remitted_amount\` > 0.00 AND \`total_remitted_amount\` < \`withheld_amount\` AND \`outstanding_withheld_amount\` > 0.00 AND \`cancellation_reason\` IS NULL) OR
          (\`recognition_status\` = 'FULLY_REMITTED' AND \`total_remitted_amount\` = \`withheld_amount\` AND \`outstanding_withheld_amount\` = 0.00 AND \`cancellation_reason\` IS NULL) OR
          (\`recognition_status\` = 'CANCELLED' AND \`total_remitted_amount\` = 0.00 AND \`outstanding_withheld_amount\` = 0.00 AND \`withheld_amount\` > 0.00 AND \`cancellation_reason\` IS NOT NULL AND \`cancelled_by\` IS NOT NULL AND \`cancelled_at\` IS NOT NULL)
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 10. Table 9: tax_remittance_records
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`tax_remittance_records\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`remittance_number\` VARCHAR(100) NOT NULL COMMENT 'Internal remittance voucher number',
        \`company_code\` VARCHAR(10) NOT NULL COMMENT 'Entity remitting: UBD or TVM (DEC-TAX-07)',
        \`tax_period_month\` TINYINT UNSIGNED NOT NULL,
        \`tax_period_year\` SMALLINT UNSIGNED NOT NULL,
        \`tax_regime\` VARCHAR(30) NOT NULL,
        \`djp_billing_code\` VARCHAR(30) NOT NULL COMMENT '15-digit Kode Billing DJP',
        \`djp_billing_expired_at\` DATETIME NULL DEFAULT NULL,
        \`ntpn\` VARCHAR(30) NULL DEFAULT NULL COMMENT '16-character NTPN; NULL while in DRAFT_BILLING',
        \`remittance_date\` DATETIME NULL DEFAULT NULL,
        \`remitted_amount\` DECIMAL(19, 2) NOT NULL COMMENT 'Exact cash amount transferred (S_tax)',
        \`allocated_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
        \`unallocated_amount\` DECIMAL(19, 2) NOT NULL DEFAULT 0.00,
        \`bank_reference_number\` VARCHAR(100) NULL DEFAULT NULL,
        \`bank_account_number\` VARCHAR(50) NOT NULL,
        \`remittance_status\` ENUM('DRAFT_BILLING', 'SETTLED_NTPN', 'REVERSED') NOT NULL DEFAULT 'DRAFT_BILLING',
        \`executed_by\` BIGINT UNSIGNED NULL DEFAULT NULL,
        \`reversal_reason\` VARCHAR(255) NULL DEFAULT NULL,
        \`reversed_by\` BIGINT UNSIGNED NULL DEFAULT NULL,
        \`reversed_at\` DATETIME NULL DEFAULT NULL,
        \`created_by\` BIGINT UNSIGNED NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_trr_remittance_number\` (\`remittance_number\`),
        UNIQUE KEY \`uk_trr_ntpn\` (\`ntpn\`),
        UNIQUE KEY \`uk_trr_id_dimensions\` (\`id\`, \`company_code\`, \`tax_period_year\`, \`tax_period_month\`, \`tax_regime\`),
        INDEX \`idx_trr_company_period\` (\`company_code\`, \`tax_period_year\`, \`tax_period_month\`, \`tax_regime\`),
        CONSTRAINT \`chk_trr_company_code\` CHECK (\`company_code\` IN ('UBD', 'TVM')),
        CONSTRAINT \`chk_trr_period_month\` CHECK (\`tax_period_month\` BETWEEN 1 AND 12),
        CONSTRAINT \`chk_trr_positive_amount\` CHECK (\`remitted_amount\` > 0.00),
        CONSTRAINT \`chk_trr_allocation_balances\` CHECK (
          \`allocated_amount\` >= 0.00 AND \`allocated_amount\` <= \`remitted_amount\` AND
          \`unallocated_amount\` = \`remitted_amount\` - \`allocated_amount\`
        ),
        CONSTRAINT \`chk_trr_status_dependent_fields\` CHECK (
          (\`remittance_status\` = 'DRAFT_BILLING' AND \`ntpn\` IS NULL AND \`remittance_date\` IS NULL AND \`allocated_amount\` = 0.00 AND \`reversal_reason\` IS NULL) OR
          (\`remittance_status\` = 'SETTLED_NTPN' AND \`ntpn\` IS NOT NULL AND \`remittance_date\` IS NOT NULL AND \`bank_reference_number\` IS NOT NULL AND \`executed_by\` IS NOT NULL AND \`remitted_amount\` > 0.00 AND \`reversal_reason\` IS NULL) OR
          (\`remittance_status\` = 'REVERSED' AND \`allocated_amount\` = 0.00 AND \`unallocated_amount\` = \`remitted_amount\` AND \`reversal_reason\` IS NOT NULL AND \`reversed_by\` IS NOT NULL AND \`reversed_at\` IS NOT NULL)
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 11. Table 10: tax_remittance_allocations
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`tax_remittance_allocations\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`remittance_record_id\` BIGINT UNSIGNED NOT NULL,
        \`withholding_record_id\` BIGINT UNSIGNED NOT NULL,
        \`statutory_liability_id\` BIGINT UNSIGNED NOT NULL,
        \`company_code\` VARCHAR(10) NOT NULL COMMENT 'Entity ownership: UBD or TVM (DEC-TAX-07)',
        \`tax_period_month\` TINYINT UNSIGNED NOT NULL,
        \`tax_period_year\` SMALLINT UNSIGNED NOT NULL,
        \`tax_regime\` VARCHAR(30) NOT NULL,
        \`allocated_amount\` DECIMAL(19, 2) NOT NULL COMMENT 'Amount allocated towards withholding record',
        \`allocation_status\` ENUM('ALLOCATED', 'REVERSED') NOT NULL DEFAULT 'ALLOCATED',
        \`active_allocation_token\` VARCHAR(100) GENERATED ALWAYS AS (
          CASE WHEN \`allocation_status\` = 'ALLOCATED' THEN CONCAT(\`remittance_record_id\`, '-', \`withholding_record_id\`) ELSE NULL END
        ) VIRTUAL COMMENT 'Enforces 1 active allocation per (remittance, withholding) while allowing historical reversals',
        \`allocated_by\` BIGINT UNSIGNED NOT NULL,
        \`reversal_reason\` VARCHAR(255) NULL DEFAULT NULL,
        \`reversed_by\` BIGINT UNSIGNED NULL DEFAULT NULL,
        \`reversed_at\` DATETIME NULL DEFAULT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_tra_active_allocation\` (\`active_allocation_token\`),
        INDEX \`idx_tra_company_period\` (\`company_code\`, \`tax_period_year\`, \`tax_period_month\`, \`tax_regime\`),
        INDEX \`idx_tra_remittance\` (\`remittance_record_id\`),
        INDEX \`idx_tra_withholding\` (\`withholding_record_id\`),
        INDEX \`idx_tra_liability\` (\`statutory_liability_id\`),
        CONSTRAINT \`fk_tra_remittance_dimensions\` FOREIGN KEY (
          \`remittance_record_id\`, \`company_code\`, \`tax_period_year\`, \`tax_period_month\`, \`tax_regime\`
        ) REFERENCES \`tax_remittance_records\` (
          \`id\`, \`company_code\`, \`tax_period_year\`, \`tax_period_month\`, \`tax_regime\`
        ) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`fk_tra_statutory_dimensions\` FOREIGN KEY (
          \`statutory_liability_id\`, \`company_code\`, \`tax_period_year\`, \`tax_period_month\`, \`tax_regime\`
        ) REFERENCES \`statutory_tax_liabilities\` (
          \`id\`, \`company_code\`, \`tax_period_year\`, \`tax_period_month\`, \`tax_regime\`
        ) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`fk_tra_withholding_dimensions\` FOREIGN KEY (
          \`withholding_record_id\`, \`company_code\`, \`tax_period_year\`, \`tax_period_month\`, \`tax_regime\`, \`statutory_liability_id\`
        ) REFERENCES \`pph_withholding_records\` (
          \`id\`, \`company_code\`, \`tax_period_year\`, \`tax_period_month\`, \`pph_regime\`, \`statutory_tax_liability_id\`
        ) ON DELETE RESTRICT ON UPDATE RESTRICT,
        CONSTRAINT \`chk_tra_company_code\` CHECK (\`company_code\` IN ('UBD', 'TVM')),
        CONSTRAINT \`chk_tra_period_month\` CHECK (\`tax_period_month\` BETWEEN 1 AND 12),
        CONSTRAINT \`chk_tra_positive_amount\` CHECK (\`allocated_amount\` > 0.00),
        CONSTRAINT \`chk_tra_reversal_fields\` CHECK (
          (\`allocation_status\` = 'ALLOCATED' AND \`reversal_reason\` IS NULL AND \`reversed_by\` IS NULL AND \`reversed_at\` IS NULL) OR
          (\`allocation_status\` = 'REVERSED' AND \`reversal_reason\` IS NOT NULL AND \`reversed_by\` IS NOT NULL AND \`reversed_at\` IS NOT NULL)
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);

    // 12. Table 11: tax_supporting_documents
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`tax_supporting_documents\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`target_type\` ENUM('VENDOR', 'INVOICE', 'REMITTANCE') NOT NULL,
        \`target_id\` BIGINT UNSIGNED NOT NULL,
        \`document_category\` ENUM('E_FAKTUR_PDF', 'BUKTI_POTONG_PDF', 'SKB_PPH23', 'SUKET_PP55', 'LPJK_SBU', 'NTPN_E_BILLING_RECEIPT', 'OTHER_TAX_DOC') NOT NULL,
        \`file_name\` VARCHAR(255) NOT NULL,
        \`file_path\` VARCHAR(500) NOT NULL,
        \`file_size_bytes\` BIGINT UNSIGNED NOT NULL,
        \`mime_type\` VARCHAR(100) NOT NULL,
        \`document_hash\` VARCHAR(64) NOT NULL,
        \`valid_from\` DATE NULL DEFAULT NULL,
        \`valid_to\` DATE NULL DEFAULT NULL,
        \`verification_status\` ENUM('UNVERIFIED', 'VERIFIED', 'REJECTED') NOT NULL DEFAULT 'UNVERIFIED',
        \`verified_by\` BIGINT UNSIGNED NULL DEFAULT NULL,
        \`verified_at\` DATETIME NULL DEFAULT NULL,
        \`rejection_reason\` VARCHAR(255) NULL DEFAULT NULL,
        \`uploaded_by\` BIGINT UNSIGNED NOT NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        PRIMARY KEY (\`id\`),
        UNIQUE KEY \`uk_tsd_document_hash\` (\`document_hash\`),
        INDEX \`idx_tsd_target\` (\`target_type\`, \`target_id\`, \`document_category\`),
        CONSTRAINT \`chk_tsd_verification_status\` CHECK (
          (\`verification_status\` = 'VERIFIED' AND \`verified_by\` IS NOT NULL AND \`verified_at\` IS NOT NULL) OR
          (\`verification_status\` = 'REJECTED' AND \`rejection_reason\` IS NOT NULL) OR
          (\`verification_status\` = 'UNVERIFIED')
        )
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // Drop tables in reverse order of foreign key dependencies
    await queryRunner.query(`DROP TABLE IF EXISTS \`tax_supporting_documents\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`tax_remittance_allocations\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`tax_remittance_records\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`pph_withholding_records\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`statutory_tax_liabilities\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`ppn_masukan_records\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`invoice_item_tax_details\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`invoice_tax_details\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`tax_regime_rules\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`vendor_tax_profiles\``);
    await queryRunner.query(`DROP TABLE IF EXISTS \`legal_entity_tax_profiles\``);

    const tablesToClean = [
      'payments',
      'payment_requests',
      'invoices',
      'purchase_orders',
      'tenders',
      'projects',
    ];

    for (const table of tablesToClean) {
      const hasCompanyCode = await queryRunner.hasColumn(table, 'company_code');
      if (hasCompanyCode) {
        await queryRunner.query(`
          ALTER TABLE \`${table}\`
          DROP COLUMN \`company_code\`
        `);
      }
    }
  }
}
