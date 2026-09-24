import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as fs from 'fs';
import * as path from 'path';

dotenv.config();

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST,
  port: parseInt(process.env.DATABASE_PORT || '3306'),
  username: process.env.DATABASE_USER,
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME,
  entities: [path.join(__dirname, '../../entities/*.entity{.ts,.js}')],
});

async function compareEntitiesWithDb() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();

  // Load all metadata from TypeORM initialized entities
  const entityMetadatas = AppDataSource.entityMetadatas;

  console.log(`Loaded ${entityMetadatas.length} entities from TypeORM DataSource.`);

  const comparisonResults: any[] = [];

  for (const metadata of entityMetadatas) {
    const tableName = metadata.tableName;
    
    // Check if table exists in DB
    const tableExists = await queryRunner.hasTable(tableName);
    if (!tableExists) {
      comparisonResults.push({
        entity: metadata.name,
        table: tableName,
        status: 'TABLE_MISSING_IN_DB',
        details: 'Table does not exist in MySQL database',
      });
      continue;
    }

    // Get DB Columns
    const dbColumns = await queryRunner.query(
      `SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE, IS_NULLABLE, COLUMN_DEFAULT, EXTRA 
       FROM INFORMATION_SCHEMA.COLUMNS 
       WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = ?`,
      [tableName]
    );
    const dbColMap = new Map(dbColumns.map((c: any) => [c.COLUMN_NAME, c]));

    // Check Entity Columns against DB
    for (const column of metadata.columns) {
      const dbColName = column.databaseName;
      const dbCol = dbColMap.get(dbColName);

      if (!dbCol) {
        comparisonResults.push({
          entity: metadata.name,
          table: tableName,
          property: column.propertyName,
          column: dbColName,
          status: 'MISSING_IN_DB',
          details: `Entity defines column ${dbColName} but it does not exist in DB table ${tableName}`,
        });
      } else {
        // Compare nullability
        const entityNullable = column.isNullable;
        const dbNullable = (dbCol as any).IS_NULLABLE === 'YES';

        if (entityNullable !== dbNullable && !column.isPrimary && !column.isGenerated) {
          comparisonResults.push({
            entity: metadata.name,
            table: tableName,
            property: column.propertyName,
            column: dbColName,
            status: 'NULLABLE_MISMATCH',
            details: `Entity nullable=${entityNullable} vs DB nullable=${dbNullable}`,
          });
        }
      }
    }

    // Check for Extra DB Columns not mapped in Entity
    const entityColNames = new Set(metadata.columns.map((c) => c.databaseName));
    for (const dbCol of dbColumns) {
      if (!entityColNames.has(dbCol.COLUMN_NAME)) {
        comparisonResults.push({
          entity: metadata.name,
          table: tableName,
          column: dbCol.COLUMN_NAME,
          status: 'EXTRA_IN_DB',
          details: `Database has column ${dbCol.COLUMN_NAME} (type: ${dbCol.COLUMN_TYPE}) not mapped in Entity ${metadata.name}`,
        });
      }
    }
  }

  console.log('\n=== ENTITY VS DATABASE COMPARISON SUMMARY ===');
  console.table(comparisonResults);

  await queryRunner.release();
  await AppDataSource.destroy();
}

compareEntitiesWithDb().catch(console.error);
