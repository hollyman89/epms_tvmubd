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

async function verify() {
  await AppDataSource.initialize();
  const queryRunner = AppDataSource.createQueryRunner();

  console.log('=== VERIFYING PHYSICAL EXISTENCE FOR 10 EARLY MIGRATIONS ===\n');

  // 1. UpdateTenderStatusEnum1721180000000
  const [tStatus] = await queryRunner.query(`
    SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenders' AND COLUMN_NAME = 'status'
  `);
  console.log('1. tenders.status COLUMN_TYPE:', tStatus?.COLUMN_TYPE);

  // 2. EvolveContractsModule1721182000000
  const contractCols = await queryRunner.query(`
    SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contracts' AND COLUMN_NAME IN ('project_manager_id', 'ops_team_activated_at')
  `);
  const hasAmendments = await queryRunner.hasTable('contract_amendments');
  console.log('2. contracts columns:', contractCols);
  console.log('   contract_amendments table exists:', hasAmendments);

  // 3. AddRefreshTokenToUsers1721387600000 & 10. ChangeRefreshTokenToText1786632000000
  const [uRefresh] = await queryRunner.query(`
    SELECT COLUMN_NAME, DATA_TYPE, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'users' AND COLUMN_NAME = 'refresh_token'
  `);
  console.log('3 & 10. users.refresh_token:', uRefresh);

  // 4. AddOptimisticLockVersionColumns1721500000000
  const versionTables = ['tenders', 'purchase_requests', 'purchase_orders', 'project_wbs', 'contracts', 'payments', 'goods_receipts', 'work_breakdown_structures'];
  const vCols = await queryRunner.query(`
    SELECT TABLE_NAME, COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME IN (${versionTables.map(t => `'${t}'`).join(',')}) AND COLUMN_NAME = 'version'
  `);
  console.log('4. version columns found on tables:');
  console.table(vCols);

  const wbsTables = await queryRunner.query(`
    SELECT TABLE_NAME FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_SCHEMA = DATABASE() AND (TABLE_NAME LIKE '%wbs%' OR TABLE_NAME LIKE '%structure%')
  `);
  console.log('WBS tables in DB:', wbsTables);

  // 5. AddRevisionRequestedEnum1785484532784
  const [cLegal] = await queryRunner.query(`
    SELECT COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contracts' AND COLUMN_NAME = 'legal_status'
  `);
  console.log('5. contracts.legal_status COLUMN_TYPE:', cLegal?.COLUMN_TYPE);

  // 6. CleanupOrphanedContracts1785500000000
  // Data-cleanup migration, verify contracts table exists
  const hasContracts = await queryRunner.hasTable('contracts');
  console.log('6. contracts table exists for data-cleanup migration:', hasContracts);

  // 7. AddGoNoGoGateToTenders1785600000000
  const gonogoCols = await queryRunner.query(`
    SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenders' AND COLUMN_NAME IN ('go_nogo_status', 'go_nogo_notes', 'go_nogo_by', 'go_nogo_at')
  `);
  console.log('7. tenders go_nogo columns count:', gonogoCols.length, 'expected: 4');
  console.table(gonogoCols);

  // 8. AddRevisionStatusToTenders1785700000000
  const [revStatus] = await queryRunner.query(`
    SELECT COLUMN_NAME, COLUMN_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'tenders' AND COLUMN_NAME = 'revision_status'
  `);
  console.log('8. tenders.revision_status COLUMN_TYPE:', revStatus?.COLUMN_TYPE);

  // 9. AddGraceColumnsToContracts1785800000000
  const graceCols = await queryRunner.query(`
    SELECT COLUMN_NAME, DATA_TYPE FROM INFORMATION_SCHEMA.COLUMNS
    WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'contracts' AND COLUMN_NAME IN ('grace_deadline', 'grace_extension_count', 'grace_extended_by', 'grace_extended_at')
  `);
  console.log('9. contracts grace columns count:', graceCols.length, 'expected: 4');
  console.table(graceCols);

  await queryRunner.release();
  await AppDataSource.destroy();
}

verify().catch(err => {
  console.error('Verification error:', err);
  process.exit(1);
});
