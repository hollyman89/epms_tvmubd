import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { AddAuditLogsQueryIndexes1789100000000 } from '../../migrations/1789100000000-AddAuditLogsQueryIndexes';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: parseInt(process.env.DATABASE_PORT || '3306'),
  username: process.env.DATABASE_USER || 'epms_app_user',
  password: process.env.DATABASE_PASSWORD || 'Epms_App_Us3r_2026!',
  database: process.env.DATABASE_NAME || 'epms_tvmubd_db',
});

async function run() {
  console.log('Connecting to database...');
  await AppDataSource.initialize();
  console.log('Database connected.');

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    console.log('========================================');
    console.log('1. PRE-CHECK INVARIANTS');
    console.log('========================================');
    const [preAuditCount] = await queryRunner.query('SELECT COUNT(*) as count FROM audit_logs');
    const [preVendorCount] = await queryRunner.query('SELECT COUNT(*) as count FROM vendors WHERE deleted_at IS NULL');
    console.log(`Pre-migration audit_logs count: ${preAuditCount.count}`);
    console.log(`Pre-migration active vendors count: ${preVendorCount.count}`);

    if (Number(preAuditCount.count) !== 11) {
      throw new Error(`PRE-CHECK FAILED: Expected 11 audit_logs, found ${preAuditCount.count}`);
    }
    if (Number(preVendorCount.count) !== 5) {
      throw new Error(`PRE-CHECK FAILED: Expected 5 active vendors, found ${preVendorCount.count}`);
    }

    console.log('\n========================================');
    console.log('2. EXECUTING MIGRATION UP');
    console.log('========================================');
    const migration = new AddAuditLogsQueryIndexes1789100000000();
    await migration.up(queryRunner);
    console.log('Migration UP executed successfully.');

    console.log('\n========================================');
    console.log('3. RECORDING IN MIGRATION LEDGER');
    console.log('========================================');
    const checkLedger = await queryRunner.query(
      'SELECT COUNT(*) as cnt FROM migrations WHERE timestamp = 1789100000000 AND name = "AddAuditLogsQueryIndexes1789100000000"'
    );
    if (Number(checkLedger[0]?.cnt || 0) === 0) {
      await queryRunner.query(
        'INSERT INTO migrations (timestamp, name) VALUES (1789100000000, "AddAuditLogsQueryIndexes1789100000000")'
      );
      console.log('Migration ledger record inserted.');
    } else {
      console.log('Migration already recorded in ledger.');
    }

    console.log('\n========================================');
    console.log('4. POST-CHECK INDEXES & INVARIANTS');
    console.log('========================================');
    const rawIndexes = await queryRunner.query('SHOW INDEX FROM audit_logs');
    console.log('Current Indexes on audit_logs:');
    console.table(
      rawIndexes.map((i: any) => ({
        Key_name: i.Key_name,
        Column_name: i.Column_name,
        Seq_in_index: i.Seq_in_index,
        Non_unique: i.Non_unique,
      }))
    );

    // Verify all 3 approved indexes exist
    const indexNames = new Set(rawIndexes.map((i: any) => i.Key_name));
    const requiredIndexes = ['idx_audit_logs_created_at_id', 'idx_audit_logs_created_by', 'idx_audit_logs_action'];
    for (const reqIdx of requiredIndexes) {
      if (!indexNames.has(reqIdx)) {
        throw new Error(`POST-CHECK FAILED: Required index ${reqIdx} not found!`);
      }
    }
    console.log('All 3 approved indexes verified.');

    // Verify invariant row counts (zero mutations)
    const [postAuditCount] = await queryRunner.query('SELECT COUNT(*) as count FROM audit_logs');
    const [postVendorCount] = await queryRunner.query('SELECT COUNT(*) as count FROM vendors WHERE deleted_at IS NULL');
    console.log(`Post-migration audit_logs count: ${postAuditCount.count}`);
    console.log(`Post-migration active vendors count: ${postVendorCount.count}`);

    if (Number(postAuditCount.count) !== 11) {
      throw new Error(`INVARIANT VIOLATION: audit_logs count changed from 11 to ${postAuditCount.count}`);
    }
    if (Number(postVendorCount.count) !== 5) {
      throw new Error(`INVARIANT VIOLATION: active vendors count changed from 5 to ${postVendorCount.count}`);
    }

    console.log('\nALL DATABASE INVARIANTS PRESERVED.');
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
    console.log('Database connection closed.');
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
