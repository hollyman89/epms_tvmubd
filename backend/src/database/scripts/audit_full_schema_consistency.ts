import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '3306'),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
});

async function runFullAudit() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();

  // 1. All Tables
  const tables = await queryRunner.query(`
    SELECT TABLE_NAME, TABLE_ROWS 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME ASC
  `);

  // 2. All Columns
  const columns = await queryRunner.query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA
    FROM INFORMATION_SCHEMA.COLUMNS 
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME ASC, ORDINAL_POSITION ASC
  `);

  // 3. All Foreign Keys
  const foreignKeys = await queryRunner.query(`
    SELECT 
      TABLE_NAME, 
      COLUMN_NAME, 
      CONSTRAINT_NAME, 
      REFERENCED_TABLE_NAME, 
      REFERENCED_COLUMN_NAME
    FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
    WHERE TABLE_SCHEMA = DATABASE() 
      AND REFERENCED_TABLE_NAME IS NOT NULL
    ORDER BY TABLE_NAME ASC, COLUMN_NAME ASC
  `);

  // 4. All Indexes
  const indexes = await queryRunner.query(`
    SELECT 
      TABLE_NAME, 
      INDEX_NAME, 
      NON_UNIQUE, 
      COLUMN_NAME, 
      SEQ_IN_INDEX
    FROM INFORMATION_SCHEMA.STATISTICS
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME ASC, INDEX_NAME ASC, SEQ_IN_INDEX ASC
  `);

  // 5. Migration Ledger
  let migrationLedger: any[] = [];
  try {
    migrationLedger = await queryRunner.query('SELECT * FROM migrations ORDER BY id ASC');
  } catch (e) {
    migrationLedger = [{ error: e.message }];
  }

  console.log(JSON.stringify({
    tables,
    columns,
    foreignKeys,
    indexes,
    migrationLedger,
  }, null, 2));

  await queryRunner.release();
  await AppDataSource.destroy();
}

runFullAudit().catch(console.error);
