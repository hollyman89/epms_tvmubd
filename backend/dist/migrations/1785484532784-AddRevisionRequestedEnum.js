"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRevisionRequestedEnum1785484532784 = void 0;
class AddRevisionRequestedEnum1785484532784 {
    constructor() {
        this.name = 'AddRevisionRequestedEnum1785484532784';
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE \`contracts\` MODIFY \`legal_status\` enum ('DRAFT', 'ON_REVIEW', 'APPROVED', 'REJECTED', 'REVISION_REQUESTED') NOT NULL DEFAULT 'DRAFT'`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE \`contracts\` MODIFY \`legal_status\` enum ('DRAFT', 'ON_REVIEW', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'DRAFT'`);
    }
}
exports.AddRevisionRequestedEnum1785484532784 = AddRevisionRequestedEnum1785484532784;
//# sourceMappingURL=1785484532784-AddRevisionRequestedEnum.js.map