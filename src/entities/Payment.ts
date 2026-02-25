import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Invoice } from './Invoice';
import { Customer } from './Customer';

export enum PaymentMethod {
  MPESA = 'mpesa',
  BANK = 'bank',
  CASH = 'cash',
  CREDIT = 'credit',
}

export enum PaymentStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  REFUNDED = 'refunded',
}

@Entity('payments')
export class Payment {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Invoice, (inv) => inv.payments)
  @JoinColumn({ name: 'invoice_id' })
  invoice!: Invoice;

  @Column({ name: 'invoice_id', nullable: true })
  invoiceId!: string;

  @ManyToOne(() => Customer, (c) => c.payments)
  @JoinColumn({ name: 'customer_id' })
  customer!: Customer;

  @Column({ name: 'customer_id' })
  customerId!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ type: 'enum', enum: PaymentMethod, name: 'payment_method' })
  paymentMethod!: PaymentMethod;

  @Column({ nullable: true, name: 'mpesa_receipt' })
  mpesaReceipt!: string;

  @Column({ nullable: true, name: 'transaction_id' })
  transactionId!: string;

  @Column({ nullable: true, name: 'bank_reference' })
  bankReference!: string;

  @Column({ type: 'enum', enum: PaymentStatus, default: PaymentStatus.PENDING })
  status!: PaymentStatus;

  @Column({ nullable: true })
  notes!: string;

  @Column({ name: 'paid_at', type: 'timestamp', nullable: true })
  paidAt!: Date;

  @CreateDateColumn()
  createdAt!: Date;
}
