import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '3306'),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [path.join(__dirname, '../../src/entities/*.entity{.ts,.js}')],
});

async function checkMissing() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();

  const missingInDb: any[] = [];
  for (const metadata of AppDataSource.entityMetadatas) {
    const tName = metadata.tableName;
    const exists = await queryRunner.hasTable(tName);
    if (!exists) {
      console.log(`Table ${tName} does not exist in DB! (Entity: ${metadata.name})`);
      continue;
    }

    const dbCols = await queryRunner.query(
      `SELECT COLUMN_NAME FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tName]
    );
    const dbColNames = new Set(dbCols.map((c: any) => c.COLUMN_NAME));

    for (const c of metadata.columns) {
      if (!dbColNames.has(c.databaseName)) {
        missingInDb.push({ entity: metadata.name, table: tName, property: c.propertyName, column: c.databaseName });
      }
    }
  }

  console.log('Total Missing Columns in DB:', missingInDb.length);
  console.table(missingInDb);

  await queryRunner.release();
  await AppDataSource.destroy();
}

checkMissing().catch(console.error);
