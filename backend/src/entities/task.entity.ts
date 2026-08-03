import { Entity, PrimaryGeneratedColumn, Column, CreateDateColumn, UpdateDateColumn, DeleteDateColumn } from 'typeorm';

@Entity('tasks')
export class Task {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ name: 'wbs_id' })
  wbsId: number;

  @Column({ name: 'assignee_id', nullable: true })
  assigneeId: number;

  @Column()
  name: string;

  @Column({ default: 'TODO' })
  status: string;

  @Column({ type: 'date', name: 'start_date', nullable: true })
  startDate: string;

  @Column({ type: 'date', name: 'due_date', nullable: true })
  dueDate: string;

  @CreateDateColumn({ name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ name: 'deleted_at' })
  deletedAt: Date;
}
