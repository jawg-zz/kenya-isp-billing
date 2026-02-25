import {
  Entity,
  PrimaryGeneratedColumn,
  Column,
  ManyToOne,
  JoinColumn,
} from 'typeorm';
import { Invoice } from './Invoice';

@Entity('invoice_items')
export class InvoiceItem {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ManyToOne(() => Invoice, (inv) => inv.items)
  @JoinColumn({ name: 'invoice_id' })
  invoice!: Invoice;

  @Column({ name: 'invoice_id' })
  invoiceId!: string;

  @Column()
  description!: string;

  @Column({ type: 'int' })
  quantity!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  unitPrice!: number;

  @Column({ type: 'decimal', precision: 12, scale: 2 })
  totalPrice!: number;

  @Column({ nullable: true, name: 'tax_code' })
  taxCode!: string;

  @Column({ type: 'decimal', precision: 5, scale: 2, default: 0 })
  taxRate!: number;
}
