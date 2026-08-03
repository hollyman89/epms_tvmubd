"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const typeorm_1 = require("typeorm");
const bcrypt = require("bcrypt");
const dotenv = require("dotenv");
dotenv.config();
const AppDataSource = new typeorm_1.DataSource({
    type: 'mysql',
    host: process.env.DATABASE_HOST,
    port: parseInt(process.env.DATABASE_PORT || '3306'),
    username: process.env.DATABASE_USER,
    password: process.env.DATABASE_PASSWORD,
    database: process.env.DATABASE_NAME,
    synchronize: false,
});
async function runSeed() {
    await AppDataSource.initialize();
    console.log('Database connected for seeding.');
    const queryRunner = AppDataSource.createQueryRunner();
    await queryRunner.connect();
    try {
        await queryRunner.startTransaction();
        console.log('Seeding roles...');
        const roles = ['SUPER_ADMIN', 'DIRECTOR', 'MARKETING', 'LEGAL', 'HEAD_OF_OPERATIONS', 'PROJECT_MANAGER', 'PROCUREMENT', 'FINANCE'];
        for (const roleName of roles) {
            await queryRunner.query('INSERT IGNORE INTO roles (name) VALUES (?)', [roleName]);
        }
        console.log('Seeding users...');
        const hashedPwd = await bcrypt.hash('123456', 10);
        const usersData = [
            { email: 'admin@tvmubd.com', name: 'Super Admin', role: 'SUPER_ADMIN' },
            { email: 'director@tvmubd.com', name: 'Director', role: 'DIRECTOR' },
            { email: 'marketing@tvmubd.com', name: 'Marketing Staff', role: 'MARKETING' },
            { email: 'legal@tvmubd.com', name: 'Legal Staff', role: 'LEGAL' },
            { email: 'pm@tvmubd.com', name: 'Project Manager', role: 'PROJECT_MANAGER' },
            { email: 'procurement@tvmubd.com', name: 'Procurement Staff', role: 'PROCUREMENT' },
            { email: 'finance@tvmubd.com', name: 'Finance Staff', role: 'FINANCE' },
        ];
        for (const u of usersData) {
            const existingUser = await queryRunner.query('SELECT id FROM users WHERE email = ?', [u.email]);
            let userId = existingUser.length > 0 ? existingUser[0].id : null;
            if (!userId) {
                const result = await queryRunner.query('INSERT INTO users (email, password_hash, full_name, is_active) VALUES (?, ?, ?, ?)', [u.email, hashedPwd, u.name, true]);
                userId = result.insertId;
            }
            const roleRow = await queryRunner.query('SELECT id FROM roles WHERE name = ?', [u.role]);
            if (roleRow.length > 0) {
                await queryRunner.query('INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)', [userId, roleRow[0].id]);
            }
        }
        console.log('Seeding customers...');
        const customers = [
            { code: 'CUST-001', name: 'PT Telkom Indonesia', contact: 'telkom@example.com' },
            { code: 'CUST-002', name: 'PT Pertamina (Persero)', contact: 'pertamina@example.com' },
            { code: 'CUST-003', name: 'PT Bank Mandiri (Persero) Tbk', contact: 'mandiri@example.com' },
        ];
        for (const c of customers) {
            const exist = await queryRunner.query('SELECT id FROM customers WHERE code = ?', [c.code]);
            if (exist.length === 0) {
                await queryRunner.query('INSERT IGNORE INTO customers (code, name, email) VALUES (?, ?, ?)', [c.code, c.name, c.contact]);
            }
        }
        console.log('Seeding vendors...');
        const vendors = [
            { code: 'VND-001', name: 'PT IT Solusi Bersama', vendor_type: 'Hardware' },
            { code: 'VND-002', name: 'PT Maju Infrastruktur', vendor_type: 'Construction' },
            { code: 'VND-003', name: 'PT Cyber Security', vendor_type: 'Software' },
            { code: 'VND-004', name: 'PT Suplai Makmur', vendor_type: 'General' },
            { code: 'VND-005', name: 'CV Logistik Terpadu', vendor_type: 'Logistics' },
        ];
        for (const v of vendors) {
            const exist = await queryRunner.query('SELECT id FROM vendors WHERE code = ?', [v.code]);
            if (exist.length === 0) {
                await queryRunner.query('INSERT INTO vendors (code, name, vendor_type) VALUES (?, ?, ?)', [v.code, v.name, v.vendor_type]);
            }
        }
        await queryRunner.commitTransaction();
        console.log('✅ Master data seeding completed successfully!');
    }
    catch (error) {
        await queryRunner.rollbackTransaction();
        console.error('❌ Seeding failed, rolling back:', error);
    }
    finally {
        await queryRunner.release();
        await AppDataSource.destroy();
    }
}
runSeed();
//# sourceMappingURL=master-data.seed.js.map