import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRfqNotesAndGoodsReceiptDeliveryNote1793200000000 implements MigrationInterface {
  name = 'AddRfqNotesAndGoodsReceiptDeliveryNote1793200000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add notes column to rfqs table if not exists
    const hasRfqNotes = await queryRunner.hasColumn('rfqs', 'notes');
    if (!hasRfqNotes) {
      await queryRunner.query(`
        ALTER TABLE \`rfqs\`
        ADD COLUMN \`notes\` TEXT NULL AFTER \`closing_date\`
      `);
    }

    // 2. Add delivery_note_number column to goods_receipts table if not exists
    const hasGrDeliveryNote = await queryRunner.hasColumn('goods_receipts', 'delivery_note_number');
    if (!hasGrDeliveryNote) {
      await queryRunner.query(`
        ALTER TABLE \`goods_receipts\`
        ADD COLUMN \`delivery_note_number\` VARCHAR(100) NULL AFTER \`remarks\`
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop delivery_note_number column from goods_receipts if exists
    const hasGrDeliveryNote = await queryRunner.hasColumn('goods_receipts', 'delivery_note_number');
    if (hasGrDeliveryNote) {
      await queryRunner.query(`
        ALTER TABLE \`goods_receipts\`
        DROP COLUMN \`delivery_note_number\`
      `);
    }

    // 2. Drop notes column from rfqs if exists
    const hasRfqNotes = await queryRunner.hasColumn('rfqs', 'notes');
    if (hasRfqNotes) {
      await queryRunner.query(`
        ALTER TABLE \`rfqs\`
        DROP COLUMN \`notes\`
      `);
    }
  }
}

