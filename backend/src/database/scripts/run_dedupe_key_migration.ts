import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import { AddDedupeKeyToNotifications1789965000000 } from '../../migrations/1789965000000-AddDedupeKeyToNotifications';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: parseInt(process.env.DATABASE_PORT || '3306'),
  username: process.env.DATABASE_USER || 'epms_app_user',
  password: process.env.DATABASE_PASSWORD || 'Epms_App_Us3r_2026!',
  database: process.env.DATABASE_NAME || 'epms_tvmubd_db',
});

async function run() {
  console.log('Connecting to database...');
  await AppDataSource.initialize();
  console.log('Database connected.');

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    console.log('Executing migration UP: AddDedupeKeyToNotifications1789965000000...');
    const migration = new AddDedupeKeyToNotifications1789965000000();
    await migration.up(queryRunner);
    console.log('Migration UP executed successfully.');

    const checkLedger = await queryRunner.query(
      'SELECT COUNT(*) as cnt FROM migrations WHERE timestamp = 1789965000000 AND name = "AddDedupeKeyToNotifications1789965000000"'
    );
    if (Number(checkLedger[0]?.cnt || 0) === 0) {
      await queryRunner.query(
        'INSERT INTO migrations (timestamp, name) VALUES (1789965000000, "AddDedupeKeyToNotifications1789965000000")'
      );
      console.log('Migration ledger record inserted.');
    } else {
      console.log('Migration already recorded in ledger.');
    }
  } catch (err) {
    console.error('Migration failed:', err);
    throw err;
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

run().catch((err) => {
  console.error('Fatal error during migration:', err);
  process.exit(1);
});
