import { MigrationInterface, QueryRunner } from "typeorm";
export declare class AddRefreshTokenToUsers1721387600000 implements MigrationInterface {
    up(queryRunner: QueryRunner): Promise<void>;
    down(queryRunner: QueryRunner): Promise<void>;
}
