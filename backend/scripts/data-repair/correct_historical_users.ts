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

async function runCorrection() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();
  
  try {
    await queryRunner.startTransaction();

    console.log('=== BEFORE CORRECTION SNAPSHOT ===');
    const beforeUsers = await queryRunner.query(`
      SELECT u.id, u.email, u.full_name, GROUP_CONCAT(r.name) as current_roles, GROUP_CONCAT(r.id) as role_ids
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id IN (5, 41) OR u.email = 'hops@epms.com'
      GROUP BY u.id
    `);
    console.table(beforeUsers);

    // 1. Correct User 5 (manager@epms.com) -> MANAGER (Role ID 5)
    const managerRole = await queryRunner.query("SELECT id FROM roles WHERE name = 'MANAGER'");
    if (managerRole.length > 0) {
      await queryRunner.query("UPDATE user_roles SET role_id = ? WHERE user_id = 5", [managerRole[0].id]);
      console.log(`Corrected User #5 (manager@epms.com) to Role MANAGER (ID ${managerRole[0].id})`);
    }

    // 2. Correct User 41 (purchasing@epms.com) -> PROCUREMENT (Role ID 42)
    const procRole = await queryRunner.query("SELECT id FROM roles WHERE name = 'PROCUREMENT'");
    if (procRole.length > 0) {
      await queryRunner.query("UPDATE user_roles SET role_id = ? WHERE user_id = 41", [procRole[0].id]);
      console.log(`Corrected User #41 (purchasing@epms.com) to Role PROCUREMENT (ID ${procRole[0].id})`);
    }

    // 3. Ensure User hops@epms.com has HEAD_OF_OPERATIONS (Role ID 40)
    const hopsRole = await queryRunner.query("SELECT id FROM roles WHERE name = 'HEAD_OF_OPERATIONS'");
    const hopsUser = await queryRunner.query("SELECT id FROM users WHERE email = 'hops@epms.com'");
    if (hopsRole.length > 0 && hopsUser.length > 0) {
      const hopsUserId = hopsUser[0].id;
      const hopsRoleId = hopsRole[0].id;
      await queryRunner.query("INSERT IGNORE INTO user_roles (user_id, role_id) VALUES (?, ?)", [hopsUserId, hopsRoleId]);
      console.log(`Ensured User #${hopsUserId} (hops@epms.com) has Role HEAD_OF_OPERATIONS (ID ${hopsRoleId})`);
    }

    await queryRunner.commitTransaction();

    console.log('=== AFTER CORRECTION SNAPSHOT ===');
    const afterUsers = await queryRunner.query(`
      SELECT u.id, u.email, u.full_name, GROUP_CONCAT(r.name) as current_roles, GROUP_CONCAT(r.id) as role_ids
      FROM users u
      LEFT JOIN user_roles ur ON u.id = ur.user_id
      LEFT JOIN roles r ON ur.role_id = r.id
      WHERE u.id IN (5, 41) OR u.email = 'hops@epms.com'
      GROUP BY u.id
    `);
    console.table(afterUsers);

  } catch (error) {
    await queryRunner.rollbackTransaction();
    console.error('Correction failed:', error);
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

runCorrection();
