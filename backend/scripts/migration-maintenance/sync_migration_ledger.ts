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

async function syncLedger() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  console.log('========================================');
  console.log('1. PRE-CHECK');
  console.log('========================================');
  const preMigrations = await queryRunner.query('SELECT * FROM migrations ORDER BY id ASC');
  console.log('Current migrations table:');
  console.table(preMigrations);

  const preCountRes = await queryRunner.query(
    'SELECT COUNT(*) as cnt FROM migrations WHERE timestamp = 1787800000000 AND name = "AddProjectLocationColumns1787800000000"'
  );
  const preCount = Number(preCountRes[0]?.cnt || 0);
  console.log(`Pre-check matching count: ${preCount}`);

  if (preCount > 0) {
    console.error('Migration record already exists in migrations table. Aborting.');
    await queryRunner.release();
    await AppDataSource.destroy();
    process.exit(1);
  }

  console.log('\n========================================');
  console.log('2. VERIFY SCHEMA BEFORE WRITE');
  console.log('========================================');
  const cols = await queryRunner.query(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'projects' 
      AND COLUMN_NAME IN ('site_name', 'address', 'city', 'province', 'postal_code', 'latitude', 'longitude')
    ORDER BY ORDINAL_POSITION
  `);
  console.table(cols);

  const requiredCols = ['site_name', 'address', 'city', 'province', 'postal_code', 'latitude', 'longitude'];
  const foundColNames = cols.map((c: any) => c.COLUMN_NAME);
  const missingCols = requiredCols.filter(col => !foundColNames.includes(col));

  if (missingCols.length > 0) {
    console.error(`Missing expected columns on projects table: ${missingCols.join(', ')}. Aborting.`);
    await queryRunner.release();
    await AppDataSource.destroy();
    process.exit(1);
  }
  console.log('All 7 location columns are verified present on projects table.');

  console.log('\n========================================');
  console.log('3. METADATA-ONLY WRITE');
  console.log('========================================');
  const insertSql = 'INSERT INTO migrations (timestamp, name) VALUES (1787800000000, "AddProjectLocationColumns1787800000000")';
  console.log(`Executing: ${insertSql}`);
  await queryRunner.query(insertSql);
  console.log('Metadata insert executed.');

  console.log('\n========================================');
  console.log('4. POST-CHECK');
  console.log('========================================');
  const postMigrations = await queryRunner.query('SELECT * FROM migrations ORDER BY id ASC');
  console.log('Updated migrations table:');
  console.table(postMigrations);

  console.log('\n========================================');
  console.log('5. DUPLICATE CHECK');
  console.log('========================================');
  const postCountRes = await queryRunner.query(
    'SELECT COUNT(*) as cnt FROM migrations WHERE timestamp = 1787800000000 AND name = "AddProjectLocationColumns1787800000000"'
  );
  const postCount = Number(postCountRes[0]?.cnt || 0);
  console.log(`Post-check matching count: ${postCount}`);

  if (postCount !== 1) {
    console.error(`Expected exactly 1 record, found ${postCount}!`);
    await queryRunner.release();
    await AppDataSource.destroy();
    process.exit(1);
  }
  console.log('Exactly 1 matching record verified in migrations table.');

  console.log('\n========================================');
  console.log('6. SCHEMA INTEGRITY RECHECK');
  console.log('========================================');
  const postCols = await queryRunner.query(`
    SELECT COLUMN_NAME, DATA_TYPE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'projects' 
      AND COLUMN_NAME IN ('site_name', 'address', 'city', 'province', 'postal_code', 'latitude', 'longitude')
    ORDER BY ORDINAL_POSITION
  `);
  console.log(`Verified column count: ${postCols.length}/7`);
  console.table(postCols);

  console.log('\n========================================');
  console.log('7. BUSINESS DATA INTEGRITY');
  console.log('========================================');
  const p1 = await queryRunner.query('SELECT id, code, name, site_name, city, province, address, postal_code, latitude, longitude, status FROM projects WHERE id = 1');
  console.log('Project #1 state:');
  console.table(p1);

  await queryRunner.release();
  await AppDataSource.destroy();
  console.log('\nLedger sync completed successfully.');
}

syncLedger().catch((err) => {
  console.error('Fatal error during ledger sync:', err);
  process.exit(1);
});
