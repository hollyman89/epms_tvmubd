"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CleanupOrphanedContracts1785500000000 = void 0;
class CleanupOrphanedContracts1785500000000 {
    async up(queryRunner) {
        await queryRunner.query(`
            UPDATE contracts c
            LEFT JOIN proposals p ON c.proposal_id = p.id
            LEFT JOIN tenders t ON (c.tender_id = t.id OR p.tender_id = t.id)
            SET c.deleted_at = NOW()
            WHERE c.deleted_at IS NULL 
              AND (t.deleted_at IS NOT NULL OR p.deleted_at IS NOT NULL);
        `);
    }
    async down(queryRunner) {
    }
}
exports.CleanupOrphanedContracts1785500000000 = CleanupOrphanedContracts1785500000000;
//# sourceMappingURL=1785500000000-CleanupOrphanedContracts.js.map