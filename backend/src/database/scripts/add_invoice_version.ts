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

AppDataSource.initialize()
  .then(async () => {
    console.log('Database connected.');
    const queryRunner = AppDataSource.createQueryRunner();
    try {
        await queryRunner.query('ALTER TABLE `invoices` ADD `version` int NOT NULL DEFAULT 1;');
        console.log('Column version added successfully.');
    } catch(err) {
        console.error('Migration failed:', err);
    } finally {
        await queryRunner.release();
    }
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error:', error);
    process.exit(1);
  });
