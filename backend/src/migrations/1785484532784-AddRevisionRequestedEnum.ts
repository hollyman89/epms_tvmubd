import { MigrationInterface, QueryRunner } from "typeorm";

export class AddRevisionRequestedEnum1785484532784 implements MigrationInterface {
    name = 'AddRevisionRequestedEnum1785484532784'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`contracts\` MODIFY \`legal_status\` enum ('DRAFT', 'ON_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED') NOT NULL DEFAULT 'DRAFT'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`contracts\` MODIFY \`legal_status\` enum ('DRAFT', 'ON_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT'`);
    }
}
