import { MigrationInterface, QueryRunner } from "typeorm";

export class UpdateTenderStatusEnum1721180000000 implements MigrationInterface {
    name = 'UpdateTenderStatusEnum1721180000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE tenders MODIFY COLUMN status ENUM('NEW','IN_PROGRESS','NEGOTIATION','PENDING_APPROVAL','WON','LOST') DEFAULT 'NEW'`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE tenders MODIFY COLUMN status ENUM('NEW','IN_PROGRESS','WON','LOST') DEFAULT 'NEW'`);
    }
}
