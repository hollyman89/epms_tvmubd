import { MigrationInterface, QueryRunner } from "typeorm";

export class AddTaskActualExecutionDates1791300000000 implements MigrationInterface {
  name = "AddTaskActualExecutionDates1791300000000";

  public async up(queryRunner: QueryRunner): Promise<void> {
    const hasActualStart = await queryRunner.hasColumn(
      "tasks",
      "actual_start_at",
    );
    if (!hasActualStart) {
      await queryRunner.query(`
        ALTER TABLE \`tasks\`
        ADD COLUMN \`actual_start_at\` DATETIME NULL AFTER \`status\`,
        ADD COLUMN \`actual_finish_at\` DATETIME NULL AFTER \`actual_start_at\`;
      `);
    }
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    const hasActualStart = await queryRunner.hasColumn(
      "tasks",
      "actual_start_at",
    );
    if (hasActualStart) {
      await queryRunner.query(`
        ALTER TABLE \`tasks\`
        DROP COLUMN \`actual_finish_at\`,
        DROP COLUMN \`actual_start_at\`;
      `);
    }
  }
}
