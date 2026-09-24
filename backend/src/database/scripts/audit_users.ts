import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
dotenv.config();

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: parseInt(process.env.DATABASE_PORT || '3306'),
  username: process.env.DATABASE_USER || 'epms_app_user',
  password: process.env.DATABASE_PASSWORD || 'Epms_App_Us3r_2026!',
  database: process.env.DATABASE_NAME || 'epms_tvmubd_db',
});

async function inspect() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  try {
    const roles = await queryRunner.query('SELECT id, name FROM roles ORDER BY id ASC');
    console.log('=== ROLES IN DB ===');
    console.table(roles);

    const users = await queryRunner.query(`
      SELECT 
        u.id, 
        u.email, 
        u.full_name, 
        u.is_active, 
        u.created_at, 
        u.updated_at,
        GROUP_CONCAT(r.name SEPARATOR ', ') AS roles,
        GROUP_CONCAT(r.id SEPARATOR ', ') AS role_ids
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.deleted_at IS NULL
      GROUP BY u.id
      ORDER BY u.id ASC
    `);
    console.log('=== USERS IN DB ===');
    console.table(users);
  } catch (err) {
    console.error('Inspection error:', err);
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

inspect();
