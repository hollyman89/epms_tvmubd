"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AddRefreshTokenToUsers1721387600000 = void 0;
class AddRefreshTokenToUsers1721387600000 {
    async up(queryRunner) {
        await queryRunner.query(`ALTER TABLE \`users\` ADD \`refresh_token\` varchar(255) NULL`);
    }
    async down(queryRunner) {
        await queryRunner.query(`ALTER TABLE \`users\` DROP COLUMN \`refresh_token\``);
    }
}
exports.AddRefreshTokenToUsers1721387600000 = AddRefreshTokenToUsers1721387600000;
//# sourceMappingURL=1721387600000-AddRefreshTokenToUsers.js.map