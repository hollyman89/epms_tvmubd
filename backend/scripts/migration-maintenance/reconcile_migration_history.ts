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

async function reconcile() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();

  console.log('=== 1. PROJECTS TABLE SCHEMA (7 LOCATION COLUMNS) ===');
  const cols = await queryRunner.query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() 
      AND TABLE_NAME = 'projects' 
      AND COLUMN_NAME IN ('site_name', 'address', 'city', 'province', 'postal_code', 'latitude', 'longitude')
    ORDER BY ORDINAL_POSITION
  `);
  console.table(cols);

  console.log('\n=== 2. TYPEORM MIGRATIONS TABLE (ALL ROWS) ===');
  const migrations = await queryRunner.query('SELECT * FROM migrations ORDER BY id ASC');
  console.table(migrations);

  console.log('\n=== 3. PROJECT #1 CURRENT STATE & UPSTREAM LINK ===');
  const p1 = await queryRunner.query(`
    SELECT 
      p.id AS project_id,
      p.code AS project_code,
      p.name AS project_name,
      p.site_name,
      p.city AS project_city,
      p.province AS project_province,
      p.address AS project_address,
      p.postal_code,
      p.latitude,
      p.longitude,
      c.id AS contract_id,
      c.contract_number,
      t.id AS tender_id,
      t.title AS tender_title,
      t.project_location AS tender_location,
      cust.id AS customer_id,
      cust.name AS customer_name,
      cust.city AS customer_city
    FROM projects p
    LEFT JOIN contracts c ON c.contract_number = p.code
    LEFT JOIN proposals pr ON pr.id = c.proposal_id
    LEFT JOIN tenders t ON t.id = pr.tender_id
    LEFT JOIN customers cust ON cust.id = t.customer_id
    WHERE p.id = 1
  `);
  console.table(p1);

  await queryRunner.release();
  await AppDataSource.destroy();
}

reconcile().catch(console.error);
