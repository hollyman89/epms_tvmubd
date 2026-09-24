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

  const tables = ['projects', 'workflow_definitions'];

  for (const t of tables) {
    console.log(`\n================== TABLE: ${t} ==================`);
    const cols = await queryRunner.query(`
      SELECT 
        COLUMN_NAME, 
        ORDINAL_POSITION, 
        COLUMN_DEFAULT, 
        IS_NULLABLE, 
        DATA_TYPE, 
        COLUMN_TYPE, 
        COLUMN_KEY, 
        EXTRA
      FROM INFORMATION_SCHEMA.COLUMNS
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?
      ORDER BY ORDINAL_POSITION ASC
    `, [t]);
    console.table(cols);

    const fks = await queryRunner.query(`
      SELECT 
        COLUMN_NAME, 
        CONSTRAINT_NAME, 
        REFERENCED_TABLE_NAME, 
        REFERENCED_COLUMN_NAME
      FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
      WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ? AND REFERENCED_TABLE_NAME IS NOT NULL
    `, [t]);
    if (fks.length > 0) {
      console.log(`Foreign keys for ${t}:`);
      console.table(fks);
    } else {
      console.log(`No foreign keys for ${t}`);
    }
  }

  await queryRunner.release();
  await AppDataSource.destroy();
}

inspect().catch(err => {
  console.error(err);
  process.exit(1);
});
