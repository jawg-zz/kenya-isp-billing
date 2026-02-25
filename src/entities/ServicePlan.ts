import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Subscription } from './Subscription';

export enum PlanType {
  PREPAID = 'prepaid',
  POSTPAID = 'postpaid',
  HYBRID = 'hybrid',
}

export enum PlanStatus {
  ACTIVE = 'active',
  DEPRECATED = 'deprecated',
}

@Entity('service_plans')
export class ServicePlan {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  description!: string;

  @Column({ name: 'bandwidth_down' })
  bandwidthDown!: string;

  @Column({ name: 'bandwidth_up' })
  bandwidthUp!: string;

  @Column({ name: 'data_cap_gb', nullable: true })
  dataCapGb!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'monthly_price' })
  monthlyPrice!: number;

  @Column({ type: 'enum', enum: PlanType, default: PlanType.POSTPAID, name: 'plan_type' })
  planType!: PlanType;

  @Column({ type: 'enum', enum: PlanStatus, default: PlanStatus.ACTIVE })
  status!: PlanStatus;

  @Column({ default: true })
  isPublic!: boolean;

  @OneToMany(() => Subscription, (sub) => sub.plan)
  subscriptions!: Subscription[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
