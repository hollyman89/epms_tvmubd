import { MigrationInterface, QueryRunner } from 'typeorm';

export class CreateGoodsReceiptItemsAndAlignGoodsReceipts1788700000000 implements MigrationInterface {
  name = 'CreateGoodsReceiptItemsAndAlignGoodsReceipts1788700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Align goods_receipts columns (receipt_date to DATETIME, add remarks)
    await queryRunner.query(`
      ALTER TABLE \`goods_receipts\`
      MODIFY COLUMN \`receipt_date\` DATETIME NOT NULL
    `);

    const hasRemarks = await queryRunner.hasColumn('goods_receipts', 'remarks');
    if (!hasRemarks) {
      await queryRunner.query(`
        ALTER TABLE \`goods_receipts\`
        ADD COLUMN \`remarks\` TEXT NULL AFTER \`total_received_amount\`
      `);
    }

    // 2. Create goods_receipt_items table
    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS \`goods_receipt_items\` (
        \`id\` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
        \`gr_id\` BIGINT UNSIGNED NOT NULL,
        \`po_item_id\` BIGINT UNSIGNED NOT NULL,
        \`received_quantity\` DECIMAL(10, 2) NOT NULL DEFAULT '0.00',
        \`remarks\` TEXT NULL,
        \`created_by\` BIGINT UNSIGNED NULL,
        \`updated_by\` BIGINT UNSIGNED NULL,
        \`deleted_by\` BIGINT UNSIGNED NULL,
        \`created_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
        \`updated_at\` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
        \`deleted_at\` DATETIME NULL,
        PRIMARY KEY (\`id\`),
        KEY \`idx_goods_receipt_items_gr_id\` (\`gr_id\`),
        KEY \`idx_goods_receipt_items_po_item_id\` (\`po_item_id\`),
        KEY \`idx_goods_receipt_items_deleted_at\` (\`deleted_at\`),
        CONSTRAINT \`fk_goods_receipt_items_gr\` FOREIGN KEY (\`gr_id\`) REFERENCES \`goods_receipts\` (\`id\`) ON DELETE CASCADE,
        CONSTRAINT \`fk_goods_receipt_items_po_item\` FOREIGN KEY (\`po_item_id\`) REFERENCES \`purchase_order_items\` (\`id\`) ON DELETE RESTRICT
      ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop goods_receipt_items table
    await queryRunner.query(`DROP TABLE IF EXISTS \`goods_receipt_items\`;`);

    // 2. Drop remarks column from goods_receipts if exists
    const hasRemarks = await queryRunner.hasColumn('goods_receipts', 'remarks');
    if (hasRemarks) {
      await queryRunner.query(`
        ALTER TABLE \`goods_receipts\`
        DROP COLUMN \`remarks\`
      `);
    }

    // 3. Revert receipt_date back to DATE
    await queryRunner.query(`
      ALTER TABLE \`goods_receipts\`
      MODIFY COLUMN \`receipt_date\` DATE NOT NULL
    `);
  }
}
