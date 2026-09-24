import { MigrationInterface, QueryRunner } from 'typeorm';

export class AddGoNoGoGateToTenders1785600000000 implements MigrationInterface {
  name = 'AddGoNoGoGateToTenders1785600000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`tenders\` 
      ADD COLUMN \`go_nogo_status\` ENUM('PENDING', 'GO', 'NO_GO') NOT NULL DEFAULT 'PENDING',
      ADD COLUMN \`go_nogo_notes\` TEXT NULL,
      ADD COLUMN \`go_nogo_by\` BIGINT UNSIGNED NULL,
      ADD COLUMN \`go_nogo_at\` DATETIME NULL
    `);
    await queryRunner.query(`UPDATE \`tenders\` SET \`go_nogo_status\` = 'PENDING' WHERE \`go_nogo_status\` IS NULL`);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      ALTER TABLE \`tenders\` 
      DROP COLUMN \`go_nogo_at\`,
      DROP COLUMN \`go_nogo_by\`,
      DROP COLUMN \`go_nogo_notes\`,
      DROP COLUMN \`go_nogo_status\`
    `);
  }
}
