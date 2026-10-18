import { MigrationInterface, QueryRunner } from "typeorm";

export class SupportMultipleServiceOrdersPerPo1791500000000 implements MigrationInterface {
  name = "SupportMultipleServiceOrdersPerPo1791500000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Audit and drop any singleton unique index on purchase_order_id if present
    const tableIndexes: any[] = await queryRunner.query(`
      SHOW INDEX FROM \`service_orders\`
    `);

    const uniquePoIndexes = tableIndexes.filter(
      (idx: any) =>
        idx.Column_name === "purchase_order_id" &&
        idx.Non_unique === 0 &&
        idx.Key_name !== "PRIMARY",
    );

    for (const uIdx of uniquePoIndexes) {
      await queryRunner.query(
        `ALTER TABLE \`service_orders\` DROP INDEX \`${uIdx.Key_name}\`;`,
      );
    }

    // 2. Add index on document_type if not present
    const hasDocTypeIndex = tableIndexes.some(
      (idx: any) => idx.Key_name === "idx_service_orders_document_type",
    );
    if (!hasDocTypeIndex) {
      await queryRunner.query(`
        ALTER TABLE \`service_orders\`
        ADD KEY \`idx_service_orders_document_type\` (\`document_type\`);
      `);
    }

    // 3. Add compound index on (purchase_order_id, status) if not present
    const hasPoStatusIndex = tableIndexes.some(
      (idx: any) => idx.Key_name === "idx_service_orders_po_status",
    );
    if (!hasPoStatusIndex) {
      await queryRunner.query(`
        ALTER TABLE \`service_orders\`
        ADD KEY \`idx_service_orders_po_status\` (\`purchase_order_id\`, \`status\`);
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const tableIndexes: any[] = await queryRunner.query(`
      SHOW INDEX FROM \`service_orders\`
    `);

    const hasPoStatusIndex = tableIndexes.some(
      (idx: any) => idx.Key_name === "idx_service_orders_po_status",
    );
    if (hasPoStatusIndex) {
      await queryRunner.query(`
        ALTER TABLE \`service_orders\`
        DROP KEY \`idx_service_orders_po_status\`;
      `);
    }

    const hasDocTypeIndex = tableIndexes.some(
      (idx: any) => idx.Key_name === "idx_service_orders_document_type",
    );
    if (hasDocTypeIndex) {
      await queryRunner.query(`
        ALTER TABLE \`service_orders\`
        DROP KEY \`idx_service_orders_document_type\`;
      `);
    }
  }
}
