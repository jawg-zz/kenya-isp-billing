import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  OneToMany,
} from 'typeorm';
import { Subscription } from './Subscription';
import { Invoice } from './Invoice';
import { Payment } from './Payment';

export enum CustomerTier {
  ENTERPRISE = 'enterprise',
  SME = 'sme',
  RESIDENTIAL = 'residential',
}

export enum CustomerStatus {
  ACTIVE = 'active',
  SUSPENDED = 'suspended',
  DISCONNECTED = 'disconnected',
}

@Entity('customers')
export class Customer {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  customerNumber!: string;

  @Column()
  name!: string;

  @Column({ nullable: true })
  email!: string;

  @Column()
  phone!: string;

  @Column({ nullable: true })
  kraPin!: string;

  @Column({ nullable: true })
  address!: string;

  @Column({ type: 'enum', enum: CustomerTier, default: CustomerTier.RESIDENTIAL })
  tier!: CustomerTier;

  @Column({ type: 'enum', enum: CustomerStatus, default: CustomerStatus.ACTIVE })
  status!: CustomerStatus;

  @Column({ default: 0 })
  creditLimit!: number;

  @Column({ default: 0 })
  balance!: number;

  @OneToMany(() => Subscription, (sub) => sub.customer)
  subscriptions!: Subscription[];

  @OneToMany(() => Invoice, (inv) => inv.customer)
  invoices!: Invoice[];

  @OneToMany(() => Payment, (pay) => pay.customer)
  payments!: Payment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
