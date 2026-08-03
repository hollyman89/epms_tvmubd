import { MigrationInterface, QueryRunner } from "typeorm";
export declare class UpdateTenderStatusEnum1721180000000 implements MigrationInterface {
    name: string;
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
