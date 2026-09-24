import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddProjectLocationColumns1787800000000 implements MigrationInterface {
  name = 'AddProjectLocationColumns1787800000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('projects');
    if (table) {
      if (!table.findColumnByName('site_name')) {
        await queryRunner.addColumn(
          'projects',
          new TableColumn({
            name: 'site_name',
            type: 'varchar',
            length: '200',
            isNullable: true,
          }),
        );
      }

      if (!table.findColumnByName('address')) {
        await queryRunner.addColumn(
          'projects',
          new TableColumn({
            name: 'address',
            type: 'text',
            isNullable: true,
          }),
        );
      }

      if (!table.findColumnByName('city')) {
        await queryRunner.addColumn(
          'projects',
          new TableColumn({
            name: 'city',
            type: 'varchar',
            length: '100',
            isNullable: true,
          }),
        );
      }

      if (!table.findColumnByName('province')) {
        await queryRunner.addColumn(
          'projects',
          new TableColumn({
            name: 'province',
            type: 'varchar',
            length: '100',
            isNullable: true,
          }),
        );
      }

      if (!table.findColumnByName('postal_code')) {
        await queryRunner.addColumn(
          'projects',
          new TableColumn({
            name: 'postal_code',
            type: 'varchar',
            length: '10',
            isNullable: true,
          }),
        );
      }

      if (!table.findColumnByName('latitude')) {
        await queryRunner.addColumn(
          'projects',
          new TableColumn({
            name: 'latitude',
            type: 'decimal',
            precision: 10,
            scale: 8,
            isNullable: true,
          }),
        );
      }

      if (!table.findColumnByName('longitude')) {
        await queryRunner.addColumn(
          'projects',
          new TableColumn({
            name: 'longitude',
            type: 'decimal',
            precision: 11,
            scale: 8,
            isNullable: true,
          }),
        );
      }
    }

    // Deterministic Backfill for existing projects having valid upstream tender locations
    await queryRunner.query(`
      UPDATE projects p
      INNER JOIN contracts c ON c.contract_number = p.code
      INNER JOIN proposals pr ON pr.id = c.proposal_id
      INNER JOIN tenders t ON t.id = pr.tender_id
      SET 
        p.city = t.project_location,
        p.site_name = CONCAT('Site ', p.name)
      WHERE t.project_location IS NOT NULL 
        AND t.project_location != '' 
        AND (p.city IS NULL OR p.city = '');
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('projects');
    if (table) {
      if (table.findColumnByName('longitude')) await queryRunner.dropColumn('projects', 'longitude');
      if (table.findColumnByName('latitude')) await queryRunner.dropColumn('projects', 'latitude');
      if (table.findColumnByName('postal_code')) await queryRunner.dropColumn('projects', 'postal_code');
      if (table.findColumnByName('province')) await queryRunner.dropColumn('projects', 'province');
      if (table.findColumnByName('city')) await queryRunner.dropColumn('projects', 'city');
      if (table.findColumnByName('address')) await queryRunner.dropColumn('projects', 'address');
      if (table.findColumnByName('site_name')) await queryRunner.dropColumn('projects', 'site_name');
    }
  }
}
