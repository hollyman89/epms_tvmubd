import { MigrationInterface, QueryRunner, Table, TableColumn, TableForeignKey } from "typeorm";

export class EvolveContractsModule1721182000000 implements MigrationInterface {
    name = 'EvolveContractsModule1721182000000'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // 1. Tambahkan project_manager_id dan ops_team_activated_at ke contracts
        await queryRunner.addColumn('contracts', new TableColumn({
            name: 'project_manager_id',
            type: 'bigint',
            unsigned: true,
            isNullable: true
        }));

        await queryRunner.addColumn('contracts', new TableColumn({
            name: 'ops_team_activated_at',
            type: 'datetime',
            isNullable: true
        }));

        // Tambahkan Foreign Key untuk project_manager_id
        await queryRunner.createForeignKey('contracts', new TableForeignKey({
            columnNames: ['project_manager_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'SET NULL'
        }));

        // 2. Buat tabel contract_amendments
        await queryRunner.createTable(new Table({
            name: 'contract_amendments',
            columns: [
                {
                    name: 'id',
                    type: 'bigint',
                    unsigned: true,
                    isPrimary: true,
                    isGenerated: true,
                    generationStrategy: 'increment'
                },
                {
                    name: 'contract_id',
                    type: 'bigint',
                    unsigned: true
                },
                {
                    name: 'version_number',
                    type: 'int',
                    default: 1
                },
                {
                    name: 'old_value',
                    type: 'decimal',
                    precision: 19,
                    scale: 2,
                    isNullable: true
                },
                {
                    name: 'new_value',
                    type: 'decimal',
                    precision: 19,
                    scale: 2,
                    isNullable: true
                },
                {
                    name: 'reason',
                    type: 'text'
                },
                {
                    name: 'approved_by',
                    type: 'bigint',
                    unsigned: true,
                    isNullable: true
                },
                {
                    name: 'created_at',
                    type: 'datetime',
                    default: 'CURRENT_TIMESTAMP'
                },
                {
                    name: 'updated_at',
                    type: 'datetime',
                    default: 'CURRENT_TIMESTAMP',
                    onUpdate: 'CURRENT_TIMESTAMP'
                }
            ],
            foreignKeys: [
                {
                    columnNames: ['contract_id'],
                    referencedColumnNames: ['id'],
                    referencedTableName: 'contracts',
                    onDelete: 'CASCADE'
                },
                {
                    columnNames: ['approved_by'],
                    referencedColumnNames: ['id'],
                    referencedTableName: 'users',
                    onDelete: 'SET NULL'
                }
            ],
            indices: [
                {
                    columnNames: ['contract_id', 'created_at']
                }
            ]
        }), true);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Drop tabel contract_amendments
        await queryRunner.dropTable('contract_amendments');

        // Hapus FK dari contracts
        const table = await queryRunner.getTable('contracts');
        if (table) {
            const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('project_manager_id') !== -1);
            if (foreignKey) {
                await queryRunner.dropForeignKey('contracts', foreignKey);
            }
        }

        // Hapus kolom ops_team_activated_at
        await queryRunner.dropColumn('contracts', 'ops_team_activated_at');
        
        // Hapus kolom project_manager_id
        await queryRunner.dropColumn('contracts', 'project_manager_id');
    }
}
