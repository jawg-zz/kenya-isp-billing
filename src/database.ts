import { DataSource } from 'typeorm';
import { Customer } from './entities/Customer';
import { ServicePlan } from './entities/ServicePlan';
import { Subscription } from './entities/Subscription';
import { Invoice } from './entities/Invoice';
import { InvoiceItem } from './entities/InvoiceItem';
import { Payment } from './entities/Payment';
import { MpesaTransaction } from './entities/MpesaTransaction';
import { User } from './entities/User';
import { AuditLog } from './entities/AuditLog';

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DB_HOST || 'localhost',
  port: parseInt(process.env.DB_PORT || '5432'),
  username: process.env.DB_USER || 'postgres',
  password: process.env.DB_PASSWORD || 'postgres',
  database: process.env.DB_NAME || 'kenya_isp_billing',
  synchronize: process.env.NODE_ENV !== 'production',
  logging: process.env.NODE_ENV !== 'production',
  entities: [
    Customer,
    ServicePlan,
    Subscription,
    Invoice,
    InvoiceItem,
    Payment,
    MpesaTransaction,
    User,
    AuditLog,
  ],
  migrations: ['src/migrations/*.ts'],
  subscribers: [],
});
