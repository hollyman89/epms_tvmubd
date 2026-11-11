import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const AppDataSource = new DataSource({
  type: 'mysql',
  host: process.env.DATABASE_HOST || '127.0.0.1',
  port: parseInt(process.env.DATABASE_PORT || '3306', 10),
  username: process.env.DATABASE_USER || 'epms_app_user',
  password: process.env.DATABASE_PASSWORD,
  database: process.env.DATABASE_NAME || 'epms_tvmubd_db',
});

function parseActorId(): number {
  const args = process.argv.slice(2);
  const actorIdx = args.indexOf('--actor-id');
  if (actorIdx === -1 || !args[actorIdx + 1]) {
    console.error('ERROR: Missing required flag --actor-id <userId>');
    console.error('Usage: ts-node migrate_instance_106_to_v2.ts --actor-id <SUPER_ADMIN_USER_ID>');
    process.exit(1);
  }

  const rawId = args[actorIdx + 1];
  const parsed = parseInt(rawId, 10);
  if (isNaN(parsed) || parsed <= 0) {
    console.error(`ERROR: Invalid actor ID '${rawId}'. Must be a positive integer.`);
    process.exit(1);
  }

  return parsed;
}

export async function runMigration() {
  const actorId = parseActorId();
  console.log('===============================================================');
  console.log('EPMS UBD & TVM — CONTROLLED INSTANCE 106 MIGRATION TO V2');
  console.log('===============================================================');
  console.log(`Executing Operator Actor ID: ${actorId}`);

  console.log('Connecting to database...');
  await AppDataSource.initialize();
  console.log('Database connected successfully.');

  const queryRunner = AppDataSource.createQueryRunner();
  await queryRunner.connect();

  try {
    // 1. Validate Operator Actor Identity and SUPER_ADMIN Role
    console.log('\n--- STEP 1: VERIFYING OPERATOR AUTHORIZATION ---');
    const userRoles = await queryRunner.query(
      `SELECT u.id, u.full_name, u.email, u.is_active, r.name as role_name
       FROM users u
       JOIN user_roles ur ON u.id = ur.user_id
       JOIN roles r ON ur.role_id = r.id
       WHERE u.id = ? AND u.is_active = 1`,
      [actorId],
    );

    if (!userRoles || userRoles.length === 0) {
      throw new Error(`Operator user #${actorId} not found or is inactive in database.`);
    }

    const isSuperAdmin = userRoles.some((r: any) => r.role_name === 'SUPER_ADMIN');
    if (!isSuperAdmin) {
      throw new Error(
        `Security Violation: Operator user #${actorId} (${userRoles[0]?.full_name}) does not hold SUPER_ADMIN role. Only SUPER_ADMIN is authorized to execute workflow version migrations.`,
      );
    }
    console.log(`Authorization confirmed: User #${actorId} (${userRoles[0].full_name}) holds SUPER_ADMIN role.`);

    // 2. Resolve Target Published Workflow Version v2
    console.log('\n--- STEP 2: RESOLVING TARGET WORKFLOW VERSION 2 ---');
    const v2Rows = await queryRunner.query(
      `SELECT id, workflow_definition_id, version, status, bpmn_json
       FROM workflow_versions
       WHERE workflow_definition_id = 25 AND version = 2 AND status = 'PUBLISHED'`,
    );

    if (!v2Rows || v2Rows.length === 0) {
      throw new Error(
        'Target workflow version 2 for definition 25 (PROJECT_PLAN_REVIEW_WORKFLOW) is not found in PUBLISHED status. Ensure backend application has started and published v2 before migrating instances.',
      );
    }
    const targetVersionId = Number(v2Rows[0].id);
    console.log(`Target published version resolved: Version #2 (ID: ${targetVersionId})`);

    // 3. Inspect Instance 106 Live State & Idempotency Check
    console.log('\n--- STEP 3: CHECKING INSTANCE 106 LIVE STATE & PRECONDITIONS ---');
    const instanceRows = await queryRunner.query(
      `SELECT id, entity_type, entity_id, status, current_node_id, workflow_version_id, version, context
       FROM workflow_instances
       WHERE id = 106`,
    );

    if (!instanceRows || instanceRows.length === 0) {
      throw new Error('Workflow instance #106 not found in database.');
    }

    const currentInstance = instanceRows[0];
    console.log('Current Instance 106 State:', {
      id: currentInstance.id,
      entity_type: currentInstance.entity_type,
      entity_id: currentInstance.entity_id,
      status: currentInstance.status,
      current_node_id: currentInstance.current_node_id,
      workflow_version_id: currentInstance.workflow_version_id,
      version: currentInstance.version,
    });

    // Idempotency: Already on v2
    if (Number(currentInstance.workflow_version_id) === targetVersionId) {
      console.log('\n===============================================================');
      console.log(`[IDEMPOTENT] Workflow Instance #106 is ALREADY pointing to Version 2 (ID: ${targetVersionId}).`);
      console.log('Zero modifications executed.');
      console.log('===============================================================');
      return;
    }

    // Strict Preconditions Validation
    if (currentInstance.entity_type !== 'PROJECT' || Number(currentInstance.entity_id) !== 58) {
      throw new Error(`Precondition Failed: Instance 106 does not belong to PROJECT #58 (Found: ${currentInstance.entity_type} #${currentInstance.entity_id}).`);
    }

    if (currentInstance.status !== 'IN_PROGRESS') {
      throw new Error(`Precondition Failed: Instance 106 status is '${currentInstance.status}'. Expected 'IN_PROGRESS'.`);
    }

    if (currentInstance.current_node_id !== 'node_director_approval') {
      throw new Error(`Precondition Failed: Instance 106 current node is '${currentInstance.current_node_id}'. Expected 'node_director_approval'.`);
    }

    if (Number(currentInstance.workflow_version_id) !== 30) {
      throw new Error(`Precondition Failed: Instance 106 workflow_version_id is '${currentInstance.workflow_version_id}'. Expected '30' (Version 1).`);
    }

    const expectedOptLockVersion = Number(currentInstance.version);

    // 4. Inspect Task 263 Live State
    console.log('\n--- STEP 4: VERIFYING TASK 263 PRECONDITIONS ---');
    const taskRows = await queryRunner.query(
      `SELECT id, workflow_instance_id, node_id, status, action, decided_by, version
       FROM workflow_tasks
       WHERE id = 263 AND workflow_instance_id = 106`,
    );

    if (!taskRows || taskRows.length === 0) {
      throw new Error('Task #263 not found for Instance #106.');
    }

    const currentTask = taskRows[0];
    console.log('Current Task 263 State:', currentTask);

    if (currentTask.status !== 'PENDING') {
      throw new Error(`Precondition Failed: Task 263 status is '${currentTask.status}'. Expected 'PENDING'.`);
    }

    if (currentTask.node_id !== 'node_director_approval') {
      throw new Error(`Precondition Failed: Task 263 node_id is '${currentTask.node_id}'. Expected 'node_director_approval'.`);
    }

    console.log('All migration preconditions verified successfully.');

    // 5. Execute Transactional Migration with Pessimistic Row Lock
    console.log('\n--- STEP 5: EXECUTING ATOMIC MIGRATION TRANSACTION ---');
    await queryRunner.startTransaction();

    // Acquire exclusive row lock on Instance 106
    const lockedRows = await queryRunner.query(
      `SELECT id, version, context FROM workflow_instances WHERE id = 106 FOR UPDATE`,
    );

    if (!lockedRows || lockedRows.length === 0 || Number(lockedRows[0].version) !== expectedOptLockVersion) {
      throw new Error('Concurrency Conflict: Instance 106 state was modified by another transaction.');
    }

    let parsedContext: any = {};
    try {
      parsedContext = typeof lockedRows[0].context === 'string'
        ? JSON.parse(lockedRows[0].context)
        : (lockedRows[0].context || {});
    } catch {
      parsedContext = {};
    }

    parsedContext.versionMigration = {
      fromVersion: 1,
      fromVersionId: 30,
      toVersion: 2,
      toVersionId: targetVersionId,
      migratedAt: new Date().toISOString(),
      migratedBy: actorId,
    };

    const newOptLockVersion = expectedOptLockVersion + 1;

    // A. Update workflow_instances (only Instance 106!)
    const updateResult = await queryRunner.query(
      `UPDATE workflow_instances
       SET workflow_version_id = ?,
           version = ?,
           updated_by = ?,
           updated_at = NOW(),
           context = ?
       WHERE id = 106 AND version = ?`,
      [targetVersionId, newOptLockVersion, actorId, JSON.stringify(parsedContext), expectedOptLockVersion],
    );

    if (updateResult.affectedRows !== 1) {
      throw new Error(`Failed to update Instance 106. Affected rows: ${updateResult.affectedRows}.`);
    }

    // B. Record canonical AuditLog
    await queryRunner.query(
      `INSERT INTO audit_logs (
         table_name, record_id, action, old_value, new_value, created_by, created_at
       ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
      [
        'workflow_instances',
        106,
        'WORKFLOW_VERSION_MIGRATED',
        JSON.stringify({ workflow_version_id: 30, version: 1, optLockVersion: expectedOptLockVersion }),
        JSON.stringify({ workflow_version_id: targetVersionId, version: 2, optLockVersion: newOptLockVersion }),
        actorId,
      ],
    );

    await queryRunner.commitTransaction();
    console.log('\n===============================================================');
    console.log('MIGRATION TRANSACTION COMMITTED SUCCESSFULLY!');
    console.log(`- Instance #106 successfully migrated from Version #30 (v1) to #${targetVersionId} (v2).`);
    console.log(`- Optimistic lock counter incremented: ${expectedOptLockVersion} -> ${newOptLockVersion}.`);
    console.log(`- Task #263 remains PENDING at node_director_approval.`);
    console.log(`- AuditLog record inserted for actor #${actorId}.`);
    console.log('- Other active instances (103, 109, 110) remain untouched on Version 1.');
    console.log('===============================================================');
  } catch (err: any) {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
      console.error('\n[ROLLBACK] Transaction rolled back due to error.');
    }
    console.error(`\nMigration Failed: ${err.message}`);
    process.exit(1);
  } finally {
    await queryRunner.release();
    await AppDataSource.destroy();
  }
}

if (require.main === module) {
  runMigration().catch((err) => {
    console.error('Fatal Migration Error:', err);
    process.exit(1);
  });
}
