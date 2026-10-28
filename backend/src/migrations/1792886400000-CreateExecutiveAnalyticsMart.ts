import { MigrationInterface, QueryRunner } from 'typeorm';

/** Additive analytics-only schema. No transaction table or business record is modified. */
export class CreateExecutiveAnalyticsMart1792886400000 implements MigrationInterface {
  name='CreateExecutiveAnalyticsMart1792886400000';
  async up(q: QueryRunner): Promise<void> {
    await q.query(`CREATE TABLE executive_analytics_runs (
      id varchar(36) NOT NULL PRIMARY KEY, status varchar(16) NOT NULL,
      as_of datetime(3) NOT NULL, published_at datetime(3) NULL,
      schema_version int NOT NULL DEFAULT 1, fact_count int NOT NULL DEFAULT 0,
      INDEX idx_executive_run_published (status, as_of)
    ) ENGINE=InnoDB`);
    await q.query(`CREATE TABLE executive_fact_snapshots (
      run_id varchar(36) NOT NULL, fact_kind varchar(32) NOT NULL, source_id varchar(80) NOT NULL,
      amount decimal(24,2) NULL, occurred_on date NULL, attributes json NOT NULL,
      PRIMARY KEY (run_id,fact_kind,source_id), INDEX idx_executive_fact_date (fact_kind,occurred_on),
      CONSTRAINT fk_executive_fact_run FOREIGN KEY (run_id) REFERENCES executive_analytics_runs(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
    await q.query(`CREATE TABLE executive_kpi_targets (
      id bigint unsigned NOT NULL AUTO_INCREMENT PRIMARY KEY, metric_code varchar(64) NOT NULL,
      start_date date NOT NULL, end_date date NOT NULL, scope_key varchar(64) NOT NULL DEFAULT 'INSTALLATION',
      currency char(3) NOT NULL DEFAULT 'IDR', amount decimal(24,2) NOT NULL, version int NOT NULL,
      approved_by bigint unsigned NOT NULL, approved_at datetime NOT NULL,
      UNIQUE KEY uq_executive_target (metric_code,start_date,end_date,scope_key,currency,version)
    ) ENGINE=InnoDB`);
    await q.query(`CREATE TABLE executive_summary_snapshots (
      run_id varchar(36) NOT NULL, period_code varchar(24) NOT NULL, scope_key varchar(64) NOT NULL,
      payload json NOT NULL, PRIMARY KEY (run_id,period_code,scope_key),
      CONSTRAINT fk_executive_summary_run FOREIGN KEY (run_id) REFERENCES executive_analytics_runs(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
    await q.query(`CREATE TABLE executive_action_snapshots (
      run_id varchar(36) NOT NULL, recipient_user_id bigint unsigned NOT NULL,
      roles_key varchar(512) NOT NULL, projected_at datetime(3) NOT NULL, payload json NOT NULL,
      PRIMARY KEY (run_id,recipient_user_id),
      CONSTRAINT fk_executive_action_run FOREIGN KEY (run_id) REFERENCES executive_analytics_runs(id) ON DELETE CASCADE
    ) ENGINE=InnoDB`);
  }
  async down(q: QueryRunner): Promise<void> {
    for(const name of ['executive_action_snapshots','executive_summary_snapshots','executive_kpi_targets','executive_fact_snapshots','executive_analytics_runs']) await q.query(`DROP TABLE ${name}`);
  }
}
