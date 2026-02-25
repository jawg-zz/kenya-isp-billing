import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  CreateDateColumn,
} from 'typeorm';

export enum MpesaTransactionType {
  STK_PUSH = 'CustomerPayBillOnline',
  C2B = 'PayBill',
  B2C = 'BusinessPayment',
  REVERSAL = 'TransactionReversal',
}

export enum MpesaStatus {
  PENDING = 'pending',
  COMPLETED = 'completed',
  FAILED = 'failed',
  CANCELLED = 'cancelled',
}

@Entity('mpesa_transactions')
export class MpesaTransaction {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ nullable: true, name: 'transaction_type', type: 'varchar' })
  transactionType!: string;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  amount!: number;

  @Column({ name: 'customer_phone' })
  customerPhone!: string;

  @Column({ nullable: true, name: 'bill_ref_number' })
  billRefNumber!: string;

  @Column({ nullable: true, name: 'mpesa_receipt' })
  mpesaReceipt!: string;

  @Column({ nullable: true })
  transactionId!: string;

  @Column({ nullable: true })
  conversationId!: string;

  @Column({ nullable: true, name: 'originator_conversation_id' })
  originatorConversationId!: string;

  @Column({ type: 'enum', enum: MpesaStatus, default: MpesaStatus.PENDING })
  status!: MpesaStatus;

  @Column({ type: 'jsonb', nullable: true, name: 'callback_data' })
  callbackData!: Record<string, any>;

  @Column({ nullable: true, name: 'result_code' })
  resultCode!: string;

  @Column({ nullable: true, name: 'result_desc' })
  resultDesc!: string;

  @CreateDateColumn()
  createdAt!: Date;
}
