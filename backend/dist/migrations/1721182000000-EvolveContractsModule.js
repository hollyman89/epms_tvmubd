"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EvolveContractsModule1721182000000 = void 0;
const typeorm_1 = require("typeorm");
class EvolveContractsModule1721182000000 {
    constructor() {
        this.name = 'EvolveContractsModule1721182000000';
    }
    async up(queryRunner) {
        await queryRunner.addColumn('contracts', new typeorm_1.TableColumn({
            name: 'project_manager_id',
            type: 'bigint',
            unsigned: true,
            isNullable: true
        }));
        await queryRunner.addColumn('contracts', new typeorm_1.TableColumn({
            name: 'ops_team_activated_at',
            type: 'datetime',
            isNullable: true
        }));
        await queryRunner.createForeignKey('contracts', new typeorm_1.TableForeignKey({
            columnNames: ['project_manager_id'],
            referencedColumnNames: ['id'],
            referencedTableName: 'users',
            onDelete: 'SET NULL'
        }));
        await queryRunner.createTable(new typeorm_1.Table({
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
    async down(queryRunner) {
        await queryRunner.dropTable('contract_amendments');
        const table = await queryRunner.getTable('contracts');
        if (table) {
            const foreignKey = table.foreignKeys.find(fk => fk.columnNames.indexOf('project_manager_id') !== -1);
            if (foreignKey) {
                await queryRunner.dropForeignKey('contracts', foreignKey);
            }
        }
        await queryRunner.dropColumn('contracts', 'ops_team_activated_at');
        await queryRunner.dropColumn('contracts', 'project_manager_id');
    }
}
exports.EvolveContractsModule1721182000000 = EvolveContractsModule1721182000000;
//# sourceMappingURL=1721182000000-EvolveContractsModule.js.map