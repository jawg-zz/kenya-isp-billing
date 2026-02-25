import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  UpdateDateColumn,
  ManyToOne,
  OneToMany,
  JoinColumn,
} from 'typeorm';
import { Customer } from './Customer';
import { InvoiceItem } from './InvoiceItem';
import { Payment } from './Payment';

export enum InvoiceStatus {
  DRAFT = 'draft',
  ISSUED = 'issued',
  PAID = 'paid',
  OVERDUE = 'overdue',
  CANCELLED = 'cancelled',
}

export enum EtimsStatus {
  PENDING = 'pending',
  SENT = 'sent',
  ACCEPTED = 'accepted',
  REJECTED = 'rejected',
}

@Entity('invoices')
export class Invoice {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ unique: true })
  invoiceNumber!: string;

  @ManyToOne(() => Customer, (c) => c.invoices)
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ name: 'customer_id' })
  customerId!: string;

  @Column({ name: 'issue_date', type: 'date' })
  issueDate!: Date;

  @Column({ name: 'due_date', type: 'date' })
  dueDate!: Date;

  @Column({ type: 'decimal', precision: 12, scale: 2, default: 0 })
  subtotal!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'tax_amount', default: 0 })
  taxAmount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'total_amount' })
  totalAmount!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2, name: 'amount_paid', default: 0 })
  amountPaid!: number;

  @Column({ type: 'enum', enum: InvoiceStatus, default: InvoiceStatus.DRAFT })
  status!: InvoiceStatus;

  @Column({ type: 'enum', enum: EtimsStatus, name: 'etims_status', default: EtimsStatus.PENDING })
  etimsStatus!: EtimsStatus;

  @Column({ nullable: true, name: 'etims_id' })
  etimsId!: string;

  @Column({ nullable: true })
  notes!: string;

  @OneToMany(() => InvoiceItem, (item) => item.invoice)
  items!: InvoiceItem[];

  @OneToMany(() => Payment, (pay) => pay.invoice)
  payments!: Payment[];

  @CreateDateColumn()
  createdAt!: Date;

  @UpdateDateColumn()
  updatedAt!: Date;
}
