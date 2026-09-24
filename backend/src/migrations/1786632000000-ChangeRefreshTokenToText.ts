import { MigrationInterface, QueryRunner } from "typeorm";

export class ChangeRefreshTokenToText1786632000000 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` MODIFY COLUMN \`refresh_token\` TEXT NULL`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE \`users\` MODIFY COLUMN \`refresh_token\` VARCHAR(255) NULL`);
    }
}
