import { MigrationInterface, QueryRunner, TableColumn } from 'typeorm';

export class AddWbsPlanningColumns1787900000000 implements MigrationInterface {
  name = 'AddWbsPlanningColumns1787900000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('work_breakdown_structures');
    if (table) {
      if (!table.findColumnByName('weight_percentage')) {
        await queryRunner.addColumn(
          'work_breakdown_structures',
          new TableColumn({
            name: 'weight_percentage',
            type: 'decimal',
            precision: 5,
            scale: 2,
            default: '0.00',
            isNullable: false,
          }),
        );
      }

      if (!table.findColumnByName('description')) {
        await queryRunner.addColumn(
          'work_breakdown_structures',
          new TableColumn({
            name: 'description',
            type: 'text',
            isNullable: true,
          }),
        );
      }
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const table = await queryRunner.getTable('work_breakdown_structures');
    if (table) {
      if (table.findColumnByName('description')) {
        await queryRunner.dropColumn('work_breakdown_structures', 'description');
      }
      if (table.findColumnByName('weight_percentage')) {
        await queryRunner.dropColumn('work_breakdown_structures', 'weight_percentage');
      }
    }
  }
}
