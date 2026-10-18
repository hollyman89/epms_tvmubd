import { MigrationInterface, QueryRunner } from "typeorm";

export class EvolveBaselineScheduleSnapshot1791200000000 implements MigrationInterface {
  name = "EvolveBaselineScheduleSnapshot1791200000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    // 1. Add planned schedule columns to project_baseline_wbs_items
    const hasPlannedStart = await queryRunner.hasColumn(
      "project_baseline_wbs_items",
      "planned_start_date",
    );
    if (!hasPlannedStart) {
      await queryRunner.query(`
        ALTER TABLE \`project_baseline_wbs_items\`
        ADD COLUMN \`planned_start_date\` DATE NULL AFTER \`task_name_snapshot\`,
        ADD COLUMN \`planned_end_date\` DATE NULL AFTER \`planned_start_date\`,
        ADD COLUMN \`planned_duration\` INT UNSIGNED NULL AFTER \`planned_end_date\`,
        ADD COLUMN \`is_milestone\` TINYINT(1) NOT NULL DEFAULT 0 AFTER \`planned_duration\`;
      `);
    }

    // 2. Deterministic schedule backfill for existing active baseline items with mapped tasks
    await queryRunner.query(`
      UPDATE \`project_baseline_wbs_items\` bi
      JOIN \`tasks\` t ON t.id = bi.task_id
      SET
        bi.planned_start_date = t.start_date,
        bi.planned_end_date = IF(t.is_milestone = 1, t.start_date, t.end_date),
        bi.planned_duration = IF(t.is_milestone = 1, 0, t.duration),
        bi.is_milestone = t.is_milestone
      WHERE bi.task_id IS NOT NULL;
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasPlannedStart = await queryRunner.hasColumn(
      "project_baseline_wbs_items",
      "planned_start_date",
    );
    if (hasPlannedStart) {
      await queryRunner.query(`
        ALTER TABLE \`project_baseline_wbs_items\`
        DROP COLUMN \`is_milestone\`,
        DROP COLUMN \`planned_duration\`,
        DROP COLUMN \`planned_end_date\`,
        DROP COLUMN \`planned_start_date\`;
      `);
    }
  }
}
