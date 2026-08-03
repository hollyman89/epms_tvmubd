import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('projects')
export class Project {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'manager_id' })
  managerId: number;

  @Column({ unique: true })
  code: string;

  @Column()
  name: string;

  @Column({ default: 'PLANNING' })
  status: string;

  @Column({ type: 'date', name: 'start_date', nullable: true })
  startDate: string;

  @Column({ type: 'date', name: 'end_date', nullable: true })
  endDate: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
