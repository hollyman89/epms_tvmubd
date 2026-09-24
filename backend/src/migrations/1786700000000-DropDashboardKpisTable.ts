import { MigrationInterface, QueryRunner } from "typeorm";

export class DropDashboardKpisTable1786700000000 implements MigrationInterface {
    name = 'DropDashboardKpisTable1786700000000';

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`DROP TABLE IF EXISTS \`dashboard_kpis\``);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`
            CREATE TABLE \`dashboard_kpis\` (
              \`id\` bigint unsigned NOT NULL AUTO_INCREMENT,
              \`kpi_key\` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
              \`kpi_value\` decimal(19,2) NOT NULL DEFAULT '0.00',
              \`metadata\` json DEFAULT NULL,
              \`created_at\` datetime DEFAULT CURRENT_TIMESTAMP,
              \`updated_at\` datetime DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
              PRIMARY KEY (\`id\`),
              UNIQUE KEY \`kpi_key\` (\`kpi_key\`)
            ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
        `);
    }
}
