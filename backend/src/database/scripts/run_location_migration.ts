import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { AddProjectLocationColumns1787800000000 } from '../../migrations/1787800000000-AddProjectLocationColumns';

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
    console.log('Executing AddProjectLocationColumns1787800000000 UP...');
    const migration = new AddProjectLocationColumns1787800000000();
    await migration.up(queryRunner);
    console.log('Migration UP executed successfully.');

    // Audit and display updated project records
    const projects = await queryRunner.query('SELECT id, code, name, site_name, city, province, address, postal_code, latitude, longitude FROM projects');
    console.log('Current Projects Table Location State:');
    console.table(projects);
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
    console.log('Done.');
    process.exit(0);
  })
  .catch((err) => {
    console.error('Fatal error:', err);
    process.exit(1);
  });
