import {
  MigrationInterface,
  QueryRunner,
  TableColumn,
  TableForeignKey,
  TableIndex,
} from "typeorm";

export class AddServicePoScopeReconciliationFields1791900000000 implements MigrationInterface {
  name = "AddServicePoScopeReconciliationFields1791900000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const poTable = await queryRunner.getTable("purchase_orders");
    if (poTable) {
      if (!poTable.findColumnByName("service_scope_reconciled_at")) {
        await queryRunner.addColumn(
          "purchase_orders",
          new TableColumn({
            name: "service_scope_reconciled_at",
            type: "datetime",
            isNullable: true,
          }),
        );
      }

      if (!poTable.findColumnByName("service_scope_reconciled_by")) {
        await queryRunner.addColumn(
          "purchase_orders",
          new TableColumn({
            name: "service_scope_reconciled_by",
            type: "bigint",
            unsigned: true,
            isNullable: true,
          }),
        );
      }

      if (!poTable.findColumnByName("service_scope_released_amount")) {
        await queryRunner.addColumn(
          "purchase_orders",
          new TableColumn({
            name: "service_scope_released_amount",
            type: "decimal",
            precision: 19,
            scale: 2,
            isNullable: true,
          }),
        );
      }

      if (!poTable.findColumnByName("service_scope_reconciliation_reason")) {
        await queryRunner.addColumn(
          "purchase_orders",
          new TableColumn({
            name: "service_scope_reconciliation_reason",
            type: "text",
            isNullable: true,
          }),
        );
      }

      const refreshedPoTable = await queryRunner.getTable("purchase_orders");
      const hasReconciledByFk = refreshedPoTable?.foreignKeys.some(
        (fk) =>
          fk.columnNames.includes("service_scope_reconciled_by") ||
          fk.name === "fk_purchase_orders_service_scope_reconciled_by",
      );
      if (!hasReconciledByFk) {
        await queryRunner.createForeignKey(
          "purchase_orders",
          new TableForeignKey({
            name: "fk_purchase_orders_service_scope_reconciled_by",
            columnNames: ["service_scope_reconciled_by"],
            referencedTableName: "users",
            referencedColumnNames: ["id"],
            onDelete: "SET NULL",
          }),
        );
      }

      const hasIndex = refreshedPoTable?.indices.some(
        (idx) =>
          idx.columnNames.includes("service_scope_reconciled_at") ||
          idx.name === "idx_purchase_orders_service_scope_reconciled_at",
      );
      if (!hasIndex) {
        await queryRunner.createIndex(
          "purchase_orders",
          new TableIndex({
            name: "idx_purchase_orders_service_scope_reconciled_at",
            columnNames: ["service_scope_reconciled_at"],
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const poTable = await queryRunner.getTable("purchase_orders");
    if (poTable) {
      const fk = poTable.foreignKeys.find(
        (f) =>
          f.name === "fk_purchase_orders_service_scope_reconciled_by" ||
          f.columnNames.includes("service_scope_reconciled_by"),
      );
      if (fk) {
        await queryRunner.dropForeignKey("purchase_orders", fk);
      }

      const idx = poTable.indices.find(
        (i) =>
          i.name === "idx_purchase_orders_service_scope_reconciled_at" ||
          i.columnNames.includes("service_scope_reconciled_at"),
      );
      if (idx) {
        await queryRunner.dropIndex("purchase_orders", idx);
      }

      if (poTable.findColumnByName("service_scope_reconciliation_reason")) {
        await queryRunner.dropColumn(
          "purchase_orders",
          "service_scope_reconciliation_reason",
        );
      }
      if (poTable.findColumnByName("service_scope_released_amount")) {
        await queryRunner.dropColumn(
          "purchase_orders",
          "service_scope_released_amount",
        );
      }
      if (poTable.findColumnByName("service_scope_reconciled_by")) {
        await queryRunner.dropColumn(
          "purchase_orders",
          "service_scope_reconciled_by",
        );
      }
      if (poTable.findColumnByName("service_scope_reconciled_at")) {
        await queryRunner.dropColumn(
          "purchase_orders",
          "service_scope_reconciled_at",
        );
      }
    }
  }
}
