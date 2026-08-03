import { MigrationInterface, QueryRunner } from "typeorm";
export declare class CleanupOrphanedContracts1785500000000 implements MigrationInterface {
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
