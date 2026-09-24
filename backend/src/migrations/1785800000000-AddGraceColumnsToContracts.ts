import { MigrationInterface, QueryRunner, TableColumn, TableForeignKey } from "typeorm";

export class AddGraceColumnsToContracts1785800000000 implements MigrationInterface {
    name = 'AddGraceColumnsToContracts1785800000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.addColumn('contracts', new TableColumn({
            name: 'grace_deadline',
            type: 'datetime',
            isNullable: true
        }));

        await queryRunner.addColumn('contracts', new TableColumn({
            name: 'grace_extension_count',
            type: 'int',
            default: 0,
            isNullable: false
        }));

        await queryRunner.addColumn('contracts', new TableColumn({
            name: 'grace_extended_by',
            type: 'bigint',
            unsigned: true,
            isNullable: true
        }));

        await queryRunner.addColumn('contracts', new TableColumn({
            name: 'grace_extended_at',
            type: 'datetime',
            isNullable: true
        }));

        await queryRunner.createForeignKey('contracts', new TableForeignKey({
            name: 'FK_contracts_grace_extended_by',
            columnNames: ['grace_extended_by'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'SET NULL'
        }));
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        const table = await queryRunner.getTable('contracts');
        if (table) {
            const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('grace_extended_by') !== -1);
            if (foreignKey) {
                await queryRunner.dropForeignKey('contracts', foreignKey);
            }
        }

        await queryRunner.dropColumn('contracts', 'grace_extended_at');
        await queryRunner.dropColumn('contracts', 'grace_extended_by');
        await queryRunner.dropColumn('contracts', 'grace_extension_count');
        await queryRunner.dropColumn('contracts', 'grace_deadline');
    }
}
