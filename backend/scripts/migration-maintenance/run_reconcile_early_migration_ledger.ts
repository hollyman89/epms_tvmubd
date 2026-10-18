import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: parseInt(process.env.DATABASE_PORT || '3306'),
  username: process.env.DATABASE_USER || 'epms_app_user',
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME || 'epms_tvmubd_db',
});

const EARLY_MIGRATIONS = [
  { timestamp: 1721180000000, name: 'UpdateTenderStatusEnum1721180000000' },
  { timestamp: 1721182000000, name: 'EvolveContractsModule1721182000000' },
  { timestamp: 1721387600000, name: 'AddRefreshTokenToUsers1721387600000' },
  { timestamp: 1721500000000, name: 'AddOptimisticLockVersionColumns1721500000000' },
  { timestamp: 1785484532784, name: 'AddRevisionRequestedEnum1785484532784' },
  { timestamp: 1785500000000, name: 'CleanupOrphanedContracts1785500000000' },
  { timestamp: 1785600000000, name: 'AddGoNoGoGateToTenders1785600000000' },
  { timestamp: 1785700000000, name: 'AddRevisionStatusToTenders1785700000000' },
  { timestamp: 1785800000000, name: 'AddGraceColumnsToContracts1785800000000' },
  { timestamp: 1786632000000, name: 'ChangeRefreshTokenToText1786632000000' },
];

const INVARIANT_TABLES = [
  'users',
  'roles',
  'user_roles',
  'customers',
  'vendors',
  'tenders',
  'proposals',
  'contracts',
  'contract_amendments',
  'projects',
  'tasks',
  'project_cost_estimates',
  'purchase_requests',
  'purchase_request_items',
  'rfqs',
  'vendor_comparisons',
  'quotations',
  'purchase_orders',
  'po_payment_terms',
  'invoices',
  'invoice_items',
  'payments',
  'goods_receipts',
  'goods_receipt_items',
  'workflow_definitions',
  'workflow_versions',
  'workflow_instances',
  'workflow_tasks',
  'audit_logs',
];

async function reconcileEarlyMigrationLedger() {
  console.log('Connecting to database...');
  await AppDataSource.initialize();
  console.log('Database connected.');

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    console.log('\n========================================');
    console.log('1. PRE-CHECK INVARIANTS & BASELINE');
    console.log('========================================');

    // Business tables pre-counts
    const preCounts: Record<string, number> = {};
    for (const table of INVARIANT_TABLES) {
      const [res] = await queryRunner.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
      preCounts[table] = Number(res.cnt);
    }
    console.log('Pre-migration business record counts:');
    console.table(preCounts);

    // Initial migrations count
    const [preMigrationsCountRes] = await queryRunner.query('SELECT COUNT(*) as cnt FROM migrations');
    const preMigrationsCount = Number(preMigrationsCountRes.cnt);
    console.log(`Current migrations table count: ${preMigrationsCount}`);

    console.log('\n========================================');
    console.log('2. ATOMIC METADATA-ONLY RECONCILIATION');
    console.log('========================================');

    await queryRunner.startTransaction();
    console.log('Transaction started.');

    let insertedCount = 0;
    let skippedCount = 0;

    for (const m of EARLY_MIGRATIONS) {
      const [existsRes] = await queryRunner.query(
        'SELECT COUNT(*) as cnt FROM migrations WHERE timestamp = ? AND name = ?',
        [m.timestamp, m.name]
      );
      const exists = Number(existsRes.cnt) > 0;

      if (exists) {
        console.log(`[SKIP] Already present: ${m.timestamp} - ${m.name}`);
        skippedCount++;
      } else {
        await queryRunner.query(
          'INSERT INTO migrations (timestamp, name) VALUES (?, ?)',
          [m.timestamp, m.name]
        );
        console.log(`[INSERTED] Metadata-only: ${m.timestamp} - ${m.name}`);
        insertedCount++;
      }
    }

    await queryRunner.commitTransaction();
    console.log(`\nTransaction committed. Inserted: ${insertedCount}, Skipped: ${skippedCount}`);

    console.log('\n========================================');
    console.log('3. POST-CHECK & INTEGRITY VERIFICATION');
    console.log('========================================');

    const [postMigrationsCountRes] = await queryRunner.query('SELECT COUNT(*) as cnt FROM migrations');
    const postMigrationsCount = Number(postMigrationsCountRes.cnt);
    console.log(`Post-migration migrations table count: ${postMigrationsCount}`);

    if (postMigrationsCount !== 22) {
      throw new Error(`Integrity check failed: Expected 22 migrations, found ${postMigrationsCount}`);
    }

    // Verify each of the 10 early migrations has exactly 1 row
    for (const m of EARLY_MIGRATIONS) {
      const [cntRes] = await queryRunner.query(
        'SELECT COUNT(*) as cnt FROM migrations WHERE timestamp = ? AND name = ?',
        [m.timestamp, m.name]
      );
      const cnt = Number(cntRes.cnt);
      if (cnt !== 1) {
        throw new Error(`Integrity check failed: Migration ${m.name} count is ${cnt}, expected 1`);
      }
    }
    console.log('All 10 early migrations verified present with exact count = 1.');

    // Check duplicate timestamps/names
    const duplicates = await queryRunner.query(`
      SELECT timestamp, name, COUNT(*) as cnt
      FROM migrations
      GROUP BY timestamp, name
      HAVING cnt > 1
    `);
    if (duplicates.length > 0) {
      throw new Error(`Duplicate migrations detected: ${JSON.stringify(duplicates)}`);
    }
    console.log('Zero duplicates verified in migrations table.');

    // Check business record counts invariance
    const postCounts: Record<string, number> = {};
    for (const table of INVARIANT_TABLES) {
      const [res] = await queryRunner.query(`SELECT COUNT(*) as cnt FROM \`${table}\``);
      postCounts[table] = Number(res.cnt);
      if (postCounts[table] !== preCounts[table]) {
        throw new Error(`BUSINESS DATA MUTATION DETECTED on table ${table}: before=${preCounts[table]}, after=${postCounts[table]}`);
      }
    }
    console.log('All business data invariants verified 100% unchanged:');
    console.table(postCounts);

    console.log('\nMigration ledger baseline reconciliation completed successfully.');
  } catch (err) {
    if (queryRunner.isTransactionActive) {
      console.log('Rolling back transaction due to error...');
      await queryRunner.rollbackTransaction();
      console.log('Transaction rolled back.');
    }
    console.error('Reconciliation failed:', err);
    process.exit(1);
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

reconcileEarlyMigrationLedger().catch((err) => {
  console.error('Fatal error during execution:', err);
  process.exit(1);
});
