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

async function inspectSchema() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  try {
    const descPerm = await queryRunner.query('DESCRIBE permissions');
    console.log('=== DESCRIBE PERMISSIONS ===');
    console.table(descPerm);

    const descRolePerm = await queryRunner.query('DESCRIBE role_permissions');
    console.log('=== DESCRIBE ROLE_PERMISSIONS ===');
    console.table(descRolePerm);
  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

inspectSchema();
