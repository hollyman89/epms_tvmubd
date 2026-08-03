"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddOptimisticLockVersionColumns1721500000000 = void 0;
class AddOptimisticLockVersionColumns1721500000000 {
    constructor() {
        this.name = 'AddOptimisticLockVersionColumns1721500000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE \`tenders\` ADD COLUMN IF NOT EXISTS \`version\` INT NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE \`purchase_requests\` ADD COLUMN IF NOT EXISTS \`version\` INT NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE \`purchase_orders\` ADD COLUMN IF NOT EXISTS \`version\` INT NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE \`project_wbs\` ADD COLUMN IF NOT EXISTS \`version\` INT NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE \`contracts\` ADD COLUMN IF NOT EXISTS \`version\` INT NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE \`payments\` ADD COLUMN IF NOT EXISTS \`version\` INT NOT NULL DEFAULT 1`);
        await queryRunner.query(`ALTER TABLE \`goods_receipts\` ADD COLUMN IF NOT EXISTS \`version\` INT NOT NULL DEFAULT 1`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE \`goods_receipts\` DROP COLUMN \`version\``);
        await queryRunner.query(`ALTER TABLE \`payments\` DROP COLUMN \`version\``);
        await queryRunner.query(`ALTER TABLE \`contracts\` DROP COLUMN \`version\``);
        await queryRunner.query(`ALTER TABLE \`project_wbs\` DROP COLUMN \`version\``);
        await queryRunner.query(`ALTER TABLE \`purchase_orders\` DROP COLUMN \`version\``);
        await queryRunner.query(`ALTER TABLE \`purchase_requests\` DROP COLUMN \`version\``);
        await queryRunner.query(`ALTER TABLE \`tenders\` DROP COLUMN \`version\``);
    }
}
exports.AddOptimisticLockVersionColumns1721500000000 = AddOptimisticLockVersionColumns1721500000000;
//# sourceMappingURL=1721500000000-AddOptimisticLockVersionColumns.js.map