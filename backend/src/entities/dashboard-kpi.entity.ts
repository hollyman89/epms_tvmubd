import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, Index } from 'typeorm';

@Entity('dashboard_kpis')
@Index('idx_kpi_period', ['periodDate'])
export class DashboardKpi {
  @PrimaryGeneratedColumn('increment', { type: 'bigint', unsigned: true })
  id: number;

  @Column({ name: 'kpi_type', type: 'varchar', length: 50 })
  kpiType: string;

  @Column({ name: 'kpi_value', type: 'decimal', precision: 19, scale: 2 })
  kpiValue: number;

  @Column({ name: 'period_date', type: 'date' })
  periodDate: Date;

  @Column({ type: 'json', nullable: true })
  metadata: any;

  @CreateDateColumn({ name: 'created_at', type: 'datetime' })
  createdAt: Date;
}
