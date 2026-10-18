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

async function detailedAudit() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();

  // 1. Entity Inventory
  const entityInventory = AppDataSource.entityMetadatas.map(m => ({
    name: m.name,
    tableName: m.tableName,
    columnsCount: m.columns.length,
    relationsCount: m.relations.length,
    relations: m.relations.map(r => `${r.propertyName} (${r.relationType} -> ${r.inverseEntityMetadata?.name})`).join(', ')
  }));

  // 2. All Columns per table in DB
  const dbTables = await queryRunner.query(`
    SELECT TABLE_NAME, TABLE_ROWS 
    FROM INFORMATION_SCHEMA.TABLES 
    WHERE TABLE_SCHEMA = DATABASE()
    ORDER BY TABLE_NAME ASC
  `);

  // 3. Enum Columns in DB vs Entity Enums
  const enumCols = await queryRunner.query(`
    SELECT TABLE_NAME, COLUMN_NAME, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT
    FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND DATA_TYPE = 'enum'
    ORDER BY TABLE_NAME, COLUMN_NAME
  `);

  // 4. Missing Columns in DB
  const missingInDb: any[] = [];
  const extraInDb: any[] = [];
  const tableLevelStatus: any[] = [];

  for (const metadata of AppDataSource.entityMetadatas) {
    const tName = metadata.tableName;
    const exists = await queryRunner.hasTable(tName);
    if (!exists) {
      tableLevelStatus.push({ entity: metadata.name, table: tName, status: 'TABLE_MISSING' });
      continue;
    }

    const dbCols = await queryRunner.query(
      `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tName]
    );
    const dbColNames = new Set(dbCols.map((c: any) => c.COLUMN_NAME));
    const entityColNames = new Set(metadata.columns.map(c => c.databaseName));

    for (const c of metadata.columns) {
      if (!dbColNames.has(c.databaseName)) {
        missingInDb.push({ entity: metadata.name, table: tName, property: c.propertyName, column: c.databaseName });
      }
    }

    for (const c of dbCols) {
      if (!entityColNames.has(c.COLUMN_NAME)) {
        extraInDb.push({ entity: metadata.name, table: tName, column: c.COLUMN_NAME, type: c.COLUMN_TYPE });
      }
    }

    tableLevelStatus.push({
      entity: metadata.name,
      table: tName,
      entityCols: metadata.columns.length,
      dbCols: dbCols.length,
      missingInDb: metadata.columns.filter(c => !dbColNames.has(c.databaseName)).length,
      extraInDb: dbCols.filter((c: any) => !entityColNames.has(c.COLUMN_NAME)).length,
    });
  }

  console.log('=== TABLE LEVEL SUMMARY ===');
  console.table(tableLevelStatus);

  console.log('\n=== MISSING COLUMNS IN DB ===');
  console.table(missingInDb);

  console.log('\n=== EXTRA COLUMNS IN DB (UNMAPPED IN ENTITY) ===');
  console.table(extraInDb);

  console.log('\n=== ENUM COLUMNS IN DB ===');
  console.table(enumCols);

  await queryRunner.release();
  await AppDataSource.destroy();
}

detailedAudit().catch(console.error);
