import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { AddWbsPlanningColumns1787900000000 } from '../../migrations/1787900000000-AddWbsPlanningColumns';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '3306'),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

async function run() {
  console.log('Connecting to database...');
  await AppDataSource.initialize();
  console.log('Database connected.');

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    console.log('========================================');
    console.log('1. PRE-CHECK EXISTING WBS SCHEMA & ROWS');
    console.log('========================================');
    const existingWbs = await queryRunner.query('SELECT * FROM work_breakdown_structures');
    console.log(`Current WBS row count: ${existingWbs.length}`);
    if (existingWbs.length > 0) {
      console.table(existingWbs);
    }

    const preLedgerCount = await queryRunner.query(
      'SELECT COUNT(*) as cnt FROM migrations WHERE timestamp = 1787900000000 AND name = "AddWbsPlanningColumns1787900000000"'
    );
    if (Number(preLedgerCount[0]?.cnt || 0) > 0) {
      console.log('Migration already in ledger.');
    }

    console.log('\n========================================');
    console.log('2. EXECUTING MIGRATION UP');
    console.log('========================================');
    const migration = new AddWbsPlanningColumns1787900000000();
    await migration.up(queryRunner);
    console.log('Migration UP executed.');

    console.log('\n========================================');
    console.log('3. RECORDING IN MIGRATION LEDGER');
    console.log('========================================');
    const checkLedger = await queryRunner.query(
      'SELECT COUNT(*) as cnt FROM migrations WHERE timestamp = 1787900000000 AND name = "AddWbsPlanningColumns1787900000000"'
    );
    if (Number(checkLedger[0]?.cnt || 0) === 0) {
      await queryRunner.query(
        'INSERT INTO migrations (timestamp, name) VALUES (1787900000000, "AddWbsPlanningColumns1787900000000")'
      );
      console.log('Migration ledger record inserted.');
    } else {
      console.log('Migration already recorded in ledger.');
    }

    console.log('\n========================================');
    console.log('4. POST-CHECK SCHEMA & DATA INTEGRITY');
    console.log('========================================');
    const cols = await queryRunner.query(`
      SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() 
        AND TABLE_NAME = 'work_breakdown_structures'
      ORDER BY ORDINAL_POSITION
    `);
    console.log('Updated columns for work_breakdown_structures:');
    console.table(cols);

    const postWbs = await queryRunner.query('SELECT * FROM work_breakdown_structures');
    console.log(`Post-migration WBS row count: ${postWbs.length}`);
    if (postWbs.length > 0) {
      console.table(postWbs);
    }

    const allMigrations = await queryRunner.query('SELECT * FROM migrations ORDER BY id ASC');
    console.log('Current migration ledger:');
    console.table(allMigrations);

  } catch (err) {
    console.error('Migration error:', err);
    process.exit(1);
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

run()
  .then(() => {
    console.log('\nWBS Migration execution & verification completed successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
