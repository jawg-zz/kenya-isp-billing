import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  Index,
} from 'typeorm';

export enum AuditAction {
  CREATE = 'create',
  READ = 'read',
  UPDATE = 'update',
  DELETE = 'delete',
  LOGIN = 'login',
  LOGOUT = 'logout',
  PAYMENT = 'payment',
  INVOICE = 'invoice',
  REFUND = 'refund',
}

@Entity('audit_logs')
@Index(['entityType', 'entityId'])
@Index(['userId'])
@Index(['createdAt'])
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'user_id', nullable: true })
  userId!: string;

  @Column({ nullable: true })
  userEmail!: string;

  @Column({ name: 'action' })
  action!: string;

  @Column({ name: 'entity_type', nullable: true })
  entityType!: string;

  @Column({ name: 'entity_id', nullable: true })
  entityId!: string;

  @Column({ type: 'jsonb', nullable: true })
  oldValues!: Record<string, any>;

  @Column({ type: 'jsonb', nullable: true })
  newValues!: Record<string, any>;

  @Column({ nullable: true, name: 'ip_address' })
  ipAddress!: string;

  @Column({ nullable: true, name: 'user_agent' })
  userAgent!: string;

  @Column({ nullable: true })
  description!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
