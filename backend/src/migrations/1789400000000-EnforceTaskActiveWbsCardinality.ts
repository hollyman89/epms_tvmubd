import { MigrationInterface, QueryRunner } from 'typeorm';

export class EnforceTaskActiveWbsCardinality1789400000000
  implements MigrationInterface
{
  name = 'EnforceTaskActiveWbsCardinality1789400000000';

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Mandatory Pre-Flight: check for duplicate active tasks per WBS
    const duplicates = await queryRunner.query(`
      SELECT project_id, wbs_id, COUNT(*) AS duplicate_count
      FROM tasks
      WHERE deleted_at IS NULL
      GROUP BY project_id, wbs_id
      HAVING COUNT(*) > 1;
    `);

    if (duplicates && duplicates.length > 0) {
      throw new Error(
        `[PRE-FLIGHT ABORT] Cannot apply BD-06 unique constraint. Found ${duplicates.length} WBS with duplicate active tasks. Data cleanup required before migration.`,
      );
    }

    // 2. Add active_wbs_id virtual generated column
    const hasColumn = await queryRunner.hasColumn('tasks', 'active_wbs_id');
    if (!hasColumn) {
      await queryRunner.query(`
        ALTER TABLE \`tasks\`
        ADD COLUMN \`active_wbs_id\` BIGINT UNSIGNED
        GENERATED ALWAYS AS (IF(\`deleted_at\` IS NULL, \`wbs_id\`, NULL)) VIRTUAL;
      `);
    }

    // 3. Add unique index on (project_id, active_wbs_id)
    await queryRunner.query(`
      ALTER TABLE \`tasks\`
      ADD CONSTRAINT \`uq_tasks_active_wbs\`
      UNIQUE INDEX (\`project_id\`, \`active_wbs_id\`);
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    // 1. Drop unique index if exists
    const table = await queryRunner.getTable('tasks');
    const uqIndex = table?.indices.find((idx) => idx.name === 'uq_tasks_active_wbs');
    if (uqIndex) {
      await queryRunner.query(`
        ALTER TABLE \`tasks\`
        DROP INDEX \`uq_tasks_active_wbs\`;
      `);
    }

    // 2. Drop virtual generated column
    const hasColumn = await queryRunner.hasColumn('tasks', 'active_wbs_id');
    if (hasColumn) {
      await queryRunner.query(`
        ALTER TABLE \`tasks\`
        DROP COLUMN \`active_wbs_id\`;
      `);
    }
  }
}
