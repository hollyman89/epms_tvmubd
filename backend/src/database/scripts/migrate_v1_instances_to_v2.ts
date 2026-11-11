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

function parseArgs(): { actorId: number; instanceIds: number[] } {
  const args = process.argv.slice(2);

  // Parse Actor ID
  const actorIdx = args.indexOf('--actor-id');
  if (actorIdx === -1 || !args[actorIdx + 1]) {
    console.error('ERROR: Missing required flag --actor-id <userId>');
    console.error('Usage: ts-node migrate_v1_instances_to_v2.ts --actor-id <SUPER_ADMIN_USER_ID> [--instances 110,109,103 | --instance 110]');
    process.exit(1);
  }
  const actorId = parseInt(args[actorIdx + 1], 10);
  if (isNaN(actorId) || actorId <= 0) {
    console.error(`ERROR: Invalid actor ID '${args[actorIdx + 1]}'. Must be a positive integer.`);
    process.exit(1);
  }

  // Parse Instance IDs
  let instanceIds: number[] = [];
  const instancesIdx = args.indexOf('--instances');
  const instanceIdx = args.indexOf('--instance');

  if (instancesIdx !== -1 && args[instancesIdx + 1]) {
    instanceIds = args[instancesIdx + 1]
      .split(',')
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !isNaN(n) && n > 0);
  } else if (instanceIdx !== -1 && args[instanceIdx + 1]) {
    const singleId = parseInt(args[instanceIdx + 1], 10);
    if (!isNaN(singleId) && singleId > 0) {
      instanceIds = [singleId];
    }
  }

  if (instanceIds.length === 0) {
    console.error('ERROR: Missing target instances. Provide --instances <id1,id2,...> or --instance <id>');
    process.exit(1);
  }

  return { actorId, instanceIds };
}

export async function runMigration() {
  const { actorId, instanceIds } = parseArgs();

  console.log('===============================================================');
  console.log('EPMS UBD & TVM — CONTROLLED V1 TO V2 WORKFLOW INSTANCE MIGRATION');
  console.log('===============================================================');
  console.log(`Executing Operator Actor ID : ${actorId}`);
  console.log(`Target Workflow Instance IDs: [${instanceIds.join(', ')}]`);

  console.log('\nConnecting to database...');
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
        `Security Violation: Operator user #${actorId} (${userRoles[0]?.full_name}) does not hold SUPER_ADMIN role. Only SUPER_ADMIN is authorized to execute workflow migrations.`,
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
        'Target workflow version 2 for definition 25 (PROJECT_PLAN_REVIEW_WORKFLOW) is not found in PUBLISHED status.',
      );
    }
    const targetVersionId = Number(v2Rows[0].id);
    const v2Graph = typeof v2Rows[0].bpmn_json === 'string' ? JSON.parse(v2Rows[0].bpmn_json) : v2Rows[0].bpmn_json;
    const v2NodeIds = (v2Graph?.nodes || []).map((n: any) => n.id);
    console.log(`Target published version resolved: Version #2 (ID: ${targetVersionId}) with ${v2NodeIds.length} nodes.`);

    // 3. Process Each Target Instance in an Isolated Transaction
    console.log('\n--- STEP 3: EXECUTING CONTROLLED INSTANCE MIGRATIONS ---');
    const results: { instanceId: number; status: string; details: string }[] = [];

    for (const instId of instanceIds) {
      console.log(`\n>>> Processing Workflow Instance #${instId}...`);

      // A. Read Instance Live State & Preconditions
      const instanceRows = await queryRunner.query(
        `SELECT id, workflow_definition_id, entity_type, entity_id, status, current_node_id, workflow_version_id, version, context
         FROM workflow_instances
         WHERE id = ?`,
        [instId],
      );

      if (!instanceRows || instanceRows.length === 0) {
        console.warn(`[SKIPPED] Instance #${instId} not found in database.`);
        results.push({ instanceId: instId, status: 'SKIPPED', details: 'Instance not found.' });
        continue;
      }

      const instance = instanceRows[0];

      // B. Idempotency Check
      if (Number(instance.workflow_version_id) === targetVersionId) {
        console.log(`[IDEMPOTENT] Instance #${instId} is ALREADY on Version 2 (ID: ${targetVersionId}). No changes needed.`);
        results.push({ instanceId: instId, status: 'IDEMPOTENT', details: 'Already on Version 2.' });
        continue;
      }

      // C. Strict Precondition Validations
      if (Number(instance.workflow_definition_id) !== 25) {
        throw new Error(
          `Security Precondition Failed: Instance #${instId} belongs to definition #${instance.workflow_definition_id}, not #25 (PROJECT_PLAN_REVIEW_WORKFLOW).`,
        );
      }

      if (instance.status !== 'IN_PROGRESS') {
        throw new Error(`Instance #${instId} status is '${instance.status}'. Only 'IN_PROGRESS' instances can be migrated.`);
      }

      if (Number(instance.workflow_version_id) !== 30) {
        throw new Error(`Instance #${instId} is on workflow_version_id '${instance.workflow_version_id}'. Expected '30' (Version 1).`);
      }

      if (!v2NodeIds.includes(instance.current_node_id)) {
        throw new Error(`Instance #${instId} current node '${instance.current_node_id}' does not exist in Version 2 graph.`);
      }

      // Check pending tasks for this instance
      const pendingTasks = await queryRunner.query(
        `SELECT id, node_id, status, assignee_role_id, assignee_user_id
         FROM workflow_tasks
         WHERE workflow_instance_id = ? AND status = 'PENDING'`,
        [instId],
      );

      if (pendingTasks.length !== 1) {
        throw new Error(`Instance #${instId} has ${pendingTasks.length} pending tasks. Expected exactly 1.`);
      }

      if (pendingTasks[0].node_id !== instance.current_node_id) {
        throw new Error(
          `Instance #${instId} pending task #${pendingTasks[0].id} node '${pendingTasks[0].node_id}' does not match instance current node '${instance.current_node_id}'.`,
        );
      }

      const expectedOptLockVersion = Number(instance.version);

      // D. Atomic Transaction for Instance
      await queryRunner.startTransaction();
      try {
        // Exclusive Row Lock
        const lockedRows = await queryRunner.query(
          `SELECT id, version, context FROM workflow_instances WHERE id = ? FOR UPDATE`,
          [instId],
        );

        if (!lockedRows || lockedRows.length === 0 || Number(lockedRows[0].version) !== expectedOptLockVersion) {
          throw new Error(`Concurrency Conflict: Instance #${instId} was modified by another transaction.`);
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

        // Update workflow_instances
        const updateResult = await queryRunner.query(
          `UPDATE workflow_instances
           SET workflow_version_id = ?,
               version = ?,
               updated_by = ?,
               updated_at = NOW(),
               context = ?
           WHERE id = ? AND version = ?`,
          [targetVersionId, newOptLockVersion, actorId, JSON.stringify(parsedContext), instId, expectedOptLockVersion],
        );

        if (updateResult.affectedRows !== 1) {
          throw new Error(`Failed to update Instance #${instId}. Affected rows: ${updateResult.affectedRows}.`);
        }

        // Insert AuditLog
        await queryRunner.query(
          `INSERT INTO audit_logs (
             table_name, record_id, action, old_value, new_value, created_by, created_at
           ) VALUES (?, ?, ?, ?, ?, ?, NOW())`,
          [
            'workflow_instances',
            instId,
            'WORKFLOW_VERSION_MIGRATED',
            JSON.stringify({ workflow_version_id: 30, version: 1, optLockVersion: expectedOptLockVersion }),
            JSON.stringify({ workflow_version_id: targetVersionId, version: 2, optLockVersion: newOptLockVersion }),
            actorId,
          ],
        );

        await queryRunner.commitTransaction();
        console.log(`[SUCCESS] Instance #${instId} migrated to Version 2. (OptLock: ${expectedOptLockVersion} -> ${newOptLockVersion})`);
        results.push({
          instanceId: instId,
          status: 'SUCCESS',
          details: `Migrated from Version 1 (ID 30) to Version 2 (ID ${targetVersionId}).`,
        });
      } catch (subErr: any) {
        if (queryRunner.isTransactionActive) {
          await queryRunner.rollbackTransaction();
        }
        throw subErr;
      }
    }

    console.log('\n===============================================================');
    console.log('MIGRATION SUMMARY');
    console.log('===============================================================');
    console.table(results);
    console.log('All targeted instances processed cleanly.');
    console.log('===============================================================');
  } catch (err: any) {
    if (queryRunner.isTransactionActive) {
      await queryRunner.rollbackTransaction();
      console.error('\n[ROLLBACK] Active transaction rolled back due to error.');
    }
    console.error(`\nMigration Aborted: ${err.message}`);
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
