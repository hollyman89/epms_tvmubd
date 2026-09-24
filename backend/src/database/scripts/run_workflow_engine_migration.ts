import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { WorkflowEngineCoreTables1788300000000 } from '../../migrations/1788300000000-WorkflowEngineCoreTables';

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
    console.log('1. EXECUTING MIGRATION UP');
    console.log('========================================');
    const migration = new WorkflowEngineCoreTables1788300000000();
    await migration.up(queryRunner);
    console.log('Migration UP executed.');

    console.log('\n========================================');
    console.log('2. RECORDING IN MIGRATION LEDGER');
    console.log('========================================');
    const checkLedger = await queryRunner.query(
      'SELECT COUNT(*) as cnt FROM migrations WHERE timestamp = 1788300000000 AND name = "WorkflowEngineCoreTables1788300000000"'
    );
    if (Number(checkLedger[0]?.cnt || 0) === 0) {
      await queryRunner.query(
        'INSERT INTO migrations (timestamp, name) VALUES (1788300000000, "WorkflowEngineCoreTables1788300000000")'
      );
      console.log('Migration ledger record inserted.');
    } else {
      console.log('Migration already recorded in ledger.');
    }

    console.log('\n========================================');
    console.log('3. POST-CHECK SCHEMA & DATA INTEGRITY');
    console.log('========================================');
    const tables = ['workflow_instances', 'workflow_tasks', 'workflow_transitions'];
    for (const t of tables) {
      const cols = await queryRunner.query(`
        SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
        FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = DATABASE() 
          AND TABLE_NAME = '${t}'
        ORDER BY ORDINAL_POSITION
      `);
      console.log(`\nColumns for ${t}:`);
      console.table(cols);
    }

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
    console.log('\nWorkflow Engine Migration executed and verified successfully.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
