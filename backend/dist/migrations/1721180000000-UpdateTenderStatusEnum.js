"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.UpdateTenderStatusEnum1721180000000 = void 0;
class UpdateTenderStatusEnum1721180000000 {
    constructor() {
        this.name = 'UpdateTenderStatusEnum1721180000000';
    }
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE tenders MODIFY COLUMN status ENUM('NEW','IN_PROGRESS','NEGOTIATION','PENDING_APPROVAL','WON','LOST') DEFAULT 'NEW'`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE tenders MODIFY COLUMN status ENUM('NEW','IN_PROGRESS','WON','LOST') DEFAULT 'NEW'`);
    }
}
exports.UpdateTenderStatusEnum1721180000000 = UpdateTenderStatusEnum1721180000000;
//# sourceMappingURL=1721180000000-UpdateTenderStatusEnum.js.map