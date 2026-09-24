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

async function audit() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();

  console.log('=== 1. ALL PROJECTS IN DB ===');
  const allProjects = await queryRunner.query('SELECT * FROM projects');
  console.table(allProjects);

  console.log('\n=== 2. PROJECT #1 FULL RELATIONAL TRACE ===');
  const project1Trace = await queryRunner.query(`
    SELECT 
      p.id AS project_id,
      p.code AS project_code,
      p.name AS project_name,
      p.site_name,
      p.city AS project_city,
      p.province AS project_province,
      p.address AS project_address,
      p.status AS project_status,
      c.id AS contract_id,
      c.contract_number,
      c.status AS contract_status,
      c.legal_status,
      pr.id AS proposal_id,
      pr.proposal_number,
      t.id AS tender_id,
      t.title AS tender_title,
      t.project_location AS tender_location,
      t.status AS tender_status,
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
  console.table(project1Trace);

  console.log('\n=== 3. SEARCH ALL RECORDS FOR "Karawang" OR "Rumah Net" ===');
  const tendersKarawang = await queryRunner.query(`
    SELECT id, title, project_location, status, stage, customer_id, created_at 
    FROM tenders 
    WHERE title LIKE '%Karawang%' OR title LIKE '%Rumah Net%' OR project_location LIKE '%Karawang%'
  `);
  console.log('Tenders matching Karawang/Rumah Net:');
  console.table(tendersKarawang);

  const proposalsKarawang = await queryRunner.query(`
    SELECT pr.id, pr.proposal_number, pr.tender_id, pr.status, t.title, t.project_location
    FROM proposals pr
    JOIN tenders t ON t.id = pr.tender_id
    WHERE t.title LIKE '%Karawang%' OR t.title LIKE '%Rumah Net%' OR t.project_location LIKE '%Karawang%'
  `);
  console.log('Proposals matching Karawang/Rumah Net:');
  console.table(proposalsKarawang);

  const contractsKarawang = await queryRunner.query(`
    SELECT c.id, c.contract_number, c.proposal_id, c.status, c.legal_status, c.customer_id, cust.name as customer_name, t.title as tender_title, t.project_location
    FROM contracts c
    LEFT JOIN proposals pr ON pr.id = c.proposal_id
    LEFT JOIN tenders t ON t.id = pr.tender_id
    LEFT JOIN customers cust ON cust.id = c.customer_id
    WHERE t.title LIKE '%Karawang%' OR t.title LIKE '%Rumah Net%' OR t.project_location LIKE '%Karawang%' OR c.contract_number LIKE '%0002%'
  `);
  console.log('Contracts matching Karawang/Rumah Net:');
  console.table(contractsKarawang);

  console.log('\n=== 4. ALL CONTRACTS IN DB (AND THEIR LINKED PROJECTS) ===');
  const allContracts = await queryRunner.query(`
    SELECT 
      c.id AS contract_id,
      c.contract_number,
      c.status AS contract_status,
      c.legal_status,
      cust.name AS customer_name,
      t.id AS tender_id,
      t.title AS tender_title,
      t.project_location AS tender_location,
      p.id AS linked_project_id,
      p.status AS linked_project_status
    FROM contracts c
    LEFT JOIN proposals pr ON pr.id = c.proposal_id
    LEFT JOIN tenders t ON t.id = pr.tender_id
    LEFT JOIN customers cust ON cust.id = c.customer_id
    LEFT JOIN projects p ON p.code = c.contract_number
  `);
  console.table(allContracts);

  console.log('\n=== 5. SCHEMA OF PROJECTS TABLE ===');
  const columns = await queryRunner.query(`
    SELECT COLUMN_NAME, DATA_TYPE, CHARACTER_MAXIMUM_LENGTH, NUMERIC_PRECISION, NUMERIC_SCALE, IS_NULLABLE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'projects'
    ORDER BY ORDINAL_POSITION
  `);
  console.table(columns);

  console.log('\n=== 6. MIGRATIONS TABLE HISTORY ===');
  try {
    const migrations = await queryRunner.query('SELECT * FROM migrations ORDER BY timestamp DESC');
    console.table(migrations);
  } catch (e) {
    console.log('No migrations table or error querying migrations table:', e.message);
  }

  await queryRunner.release();
  await AppDataSource.destroy();
}

audit().catch(console.error);
