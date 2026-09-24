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

async function traceDetails() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();

  console.log('--- SECTION 1: ALL PROJECTS ---');
  const projects = await queryRunner.query('SELECT id, code, name, site_name, city, province, address, postal_code, latitude, longitude, status, manager_id FROM projects');
  console.log(JSON.stringify(projects, null, 2));

  console.log('\n--- SECTION 2: PROJECT #1 TRACE ---');
  const p1 = await queryRunner.query(`
    SELECT 
      p.id AS project_id,
      p.code AS project_code,
      p.name AS project_name,
      p.site_name,
      p.city AS project_city,
      p.province AS project_province,
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
  console.log(JSON.stringify(p1, null, 2));

  console.log('\n--- SECTION 3: RUMAH NET FKI KARAWANG TRACE ---');
  const karawangTrace = await queryRunner.query(`
    SELECT 
      t.id AS tender_id,
      t.title AS tender_title,
      t.project_location AS tender_location,
      t.status AS tender_status,
      t.stage AS tender_stage,
      cust.id AS customer_id,
      cust.name AS customer_name,
      cust.city AS customer_city,
      pr.id AS proposal_id,
      pr.proposal_number,
      pr.status AS proposal_status,
      c.id AS contract_id,
      c.contract_number,
      c.status AS contract_status,
      c.legal_status AS contract_legal_status,
      p.id AS project_id,
      p.code AS project_code,
      p.name AS project_name,
      p.status AS project_status
    FROM tenders t
    LEFT JOIN customers cust ON cust.id = t.customer_id
    LEFT JOIN proposals pr ON pr.tender_id = t.id
    LEFT JOIN contracts c ON c.proposal_id = pr.id
    LEFT JOIN projects p ON p.code = c.contract_number
    WHERE t.title LIKE '%Karawang%' OR t.title LIKE '%Rumah Net%' OR t.project_location LIKE '%Karawang%'
  `);
  console.log(JSON.stringify(karawangTrace, null, 2));

  console.log('\n--- SECTION 4: ALL CONTRACTS AND LINKED STATUS ---');
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
      p.id AS project_id,
      p.code AS project_code,
      p.name AS project_name
    FROM contracts c
    LEFT JOIN proposals pr ON pr.id = c.proposal_id
    LEFT JOIN tenders t ON t.id = pr.tender_id
    LEFT JOIN customers cust ON cust.id = c.customer_id
    LEFT JOIN projects p ON p.code = c.contract_number
    ORDER BY c.id ASC
  `);
  console.log(JSON.stringify(allContracts, null, 2));

  await queryRunner.release();
  await AppDataSource.destroy();
}

traceDetails().catch(console.error);
