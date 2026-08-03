import { MigrationInterface, QueryRunner } from "typeorm";

export class CleanupOrphanedContracts1785500000000 implements MigrationInterface {

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Clean up orphaned Contracts where parent Tender or Proposal is soft-deleted
        await queryRunner.query(`
            UPDATE contracts c
            LEFT JOIN proposals p ON c.proposal_id = p.id
            LEFT JOIN tenders t ON (c.tender_id = t.id OR p.tender_id = t.id)
            SET c.deleted_at = NOW()
            WHERE c.deleted_at IS NULL 
              AND (t.deleted_at IS NOT NULL OR p.deleted_at IS NOT NULL);
        `);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Migration ini bersifat data-cleaning, down migration tidak disarankan untuk 
        // meng-undelete data yang yatim secara buta karena bisa saja dihapus secara sah 
        // setelah script ini jalan. Namun untuk kelengkapan interface TypeORM:
    }

}
