import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { AlignFinanceInvoicesAndItems1788600000000 } from '../../migrations/1788600000000-AlignFinanceInvoicesAndItems';

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
    console.log('1. EXECUTING MIGRATION UP');
    console.log('========================================');
    const migration = new AlignFinanceInvoicesAndItems1788600000000();
    await migration.up(queryRunner);
    console.log('Migration UP executed.');

    console.log('\n========================================');
    console.log('2. RECORDING IN MIGRATION LEDGER');
    console.log('========================================');
    const checkLedger = await queryRunner.query(
      'SELECT COUNT(*) as cnt FROM migrations WHERE timestamp = 1788600000000 AND name = "AlignFinanceInvoicesAndItems1788600000000"'
    );
    if (Number(checkLedger[0]?.cnt || 0) === 0) {
      await queryRunner.query(
        'INSERT INTO migrations (timestamp, name) VALUES (1788600000000, "AlignFinanceInvoicesAndItems1788600000000")'
      );
      console.log('Migration ledger record inserted.');
    } else {
      console.log('Migration already recorded in ledger.');
    }

    console.log('\n========================================');
    console.log('3. POST-CHECK SCHEMA & DATA INTEGRITY');
    console.log('========================================');
    const tables = ['invoices', 'invoice_items', 'po_payment_terms'];
    for (const t of tables) {
      const cols = await queryRunner.query(`
        SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = '${t}'
        ORDER BY ORDINAL_POSITION
      `);
      console.log(`\nColumns for ${t}:`);
      console.table(cols);
    }

    console.log('\nForeign keys for invoices and invoice_items:');
    const fks = await queryRunner.query(`
      SELECT TABLE_NAME, CONSTRAINT_NAME, COLUMN_NAME, REFERENCED_TABLE_NAME, REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE()
        AND TABLE_NAME IN ('invoices', 'invoice_items')
        AND REFERENCED_TABLE_NAME IS NOT NULL
    `);
    console.table(fks);

    // Verify invariants (zero mutations)
    const [poCount] = await queryRunner.query('SELECT COUNT(*) as cnt FROM purchase_orders');
    const [poItemCount] = await queryRunner.query('SELECT COUNT(*) as cnt FROM purchase_order_items');
    const [poTermCount] = await queryRunner.query('SELECT COUNT(*) as cnt FROM po_payment_terms');
    const [invCount] = await queryRunner.query('SELECT COUNT(*) as cnt FROM invoices');
    const [invItemCount] = await queryRunner.query('SELECT COUNT(*) as cnt FROM invoice_items');
    const [payCount] = await queryRunner.query('SELECT COUNT(*) as cnt FROM payments');
    console.log('\nInvariant Counts:');
    console.log(`purchase_orders: ${poCount.cnt}`);
    console.log(`purchase_order_items: ${poItemCount.cnt}`);
    console.log(`po_payment_terms: ${poTermCount.cnt}`);
    console.log(`invoices: ${invCount.cnt}`);
    console.log(`invoice_items: ${invItemCount.cnt}`);
    console.log(`payments: ${payCount.cnt}`);

  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
    console.log('\nDatabase connection closed.');
  }
}

run().catch((err) => {
  console.error('Fatal error:', err);
  process.exit(1);
});
