import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddRevisionStatusToTenders1785700000000 implements MigrationInterface {
  name = 'AddRevisionStatusToTenders1785700000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`tenders\` 
      ADD COLUMN \`revision_status\` ENUM('NOT_REQUIRED', 'REQUIRED', 'COMPLETED') NOT NULL DEFAULT 'NOT_REQUIRED'
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`tenders\` 
      DROP COLUMN \`revision_status\`
    `);
  }
}
