import { MigrationInterface, QueryRunner } from "typeorm";

export class AddOptimisticLockVersionColumns1721500000000 implements MigrationInterface {
    name = 'AddOptimisticLockVersionColumns1721500000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add version column to tenders if not exists
        await queryRunner.query(`ALTER TABLE \`tenders\` ADD COLUMN IF NOT EXISTS \`version\` INT NOT NULL DEFAULT 1`);
        
        // Add version column to purchase_requests if not exists
        await queryRunner.query(`ALTER TABLE \`purchase_requests\` ADD COLUMN IF NOT EXISTS \`version\` INT NOT NULL DEFAULT 1`);
        
        // Add version column to purchase_orders if not exists
        await queryRunner.query(`ALTER TABLE \`purchase_orders\` ADD COLUMN IF NOT EXISTS \`version\` INT NOT NULL DEFAULT 1`);
        
        // Add version column to project_wbs if not exists
        await queryRunner.query(`ALTER TABLE \`project_wbs\` ADD COLUMN IF NOT EXISTS \`version\` INT NOT NULL DEFAULT 1`);
        
        // Add version column to contracts if not exists
        await queryRunner.query(`ALTER TABLE \`contracts\` ADD COLUMN IF NOT EXISTS \`version\` INT NOT NULL DEFAULT 1`);
        
        // Add version column to payments if not exists
        await queryRunner.query(`ALTER TABLE \`payments\` ADD COLUMN IF NOT EXISTS \`version\` INT NOT NULL DEFAULT 1`);
        
        // Add version column to goods_receipts if not exists
        await queryRunner.query(`ALTER TABLE \`goods_receipts\` ADD COLUMN IF NOT EXISTS \`version\` INT NOT NULL DEFAULT 1`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Emergency Rollback: DROP version columns
        await queryRunner.query(`ALTER TABLE \`goods_receipts\` DROP COLUMN \`version\``);
        await queryRunner.query(`ALTER TABLE \`payments\` DROP COLUMN \`version\``);
        await queryRunner.query(`ALTER TABLE \`contracts\` DROP COLUMN \`version\``);
        await queryRunner.query(`ALTER TABLE \`project_wbs\` DROP COLUMN \`version\``);
        await queryRunner.query(`ALTER TABLE \`purchase_orders\` DROP COLUMN \`version\``);
        await queryRunner.query(`ALTER TABLE \`purchase_requests\` DROP COLUMN \`version\``);
        await queryRunner.query(`ALTER TABLE \`tenders\` DROP COLUMN \`version\``);
    }
}
