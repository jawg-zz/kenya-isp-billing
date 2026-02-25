import { Router, Response, NextFunction } from 'express';
import { AppDataSource } from '../database';
import { Invoice, InvoiceStatus } from '../entities/Invoice';
import { Payment, PaymentStatus, PaymentMethod } from '../entities/Payment';
import { Customer, CustomerStatus } from '../entities/Customer';
import { MpesaTransaction } from '../entities/MpesaTransaction';
import { Between, MoreThanOrEqual } from 'typeorm';

const router = Router();

// Revenue report
router.get('/revenue', async (req, res, next) => {
  try {
    const { startDate, endDate, groupBy = 'month' } = req.query;

    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    const invoiceRepo = AppDataSource.getRepository(Invoice);
    const invoices = await invoiceRepo
      .createQueryBuilder('invoice')
      .select(['invoice.issueDate', 'invoice.totalAmount', 'invoice.status'])
      .where('invoice.issueDate BETWEEN :start AND :end', { start, end })
      .andWhere('invoice.status IN (:...statuses)', { statuses: [InvoiceStatus.PAID, InvoiceStatus.ISSUED] })
      .getMany();

    // Group by period
    const revenue: Record<string, number> = {};
    for (const inv of invoices) {
      let key: string;
      const date = new Date(inv.issueDate);
      if (groupBy === 'day') {
        key = date.toISOString().split('T')[0];
      } else if (groupBy === 'year') {
        key = date.getFullYear().toString();
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
      }
      revenue[key] = (revenue[key] || 0) + Number(inv.totalAmount);
    }

    res.json({ success: true, data: Object.entries(revenue).map(([period, amount]) => ({ period, amount })) });
  } catch (error) {
    next(error);
  }
});

// Collection report
router.get('/collections', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    const paymentRepo = AppDataSource.getRepository(Payment);
    const payments = await paymentRepo
      .createQueryBuilder('payment')
      .select(['payment.amount', 'payment.status', 'payment.paymentMethod', 'payment.paidAt'])
      .where('payment.paidAt BETWEEN :start AND :end', { start, end })
      .andWhere('payment.status = :status', { status: PaymentStatus.COMPLETED })
      .getMany();

    const totalCollected = payments.reduce((sum: number, p) => sum + Number(p.amount), 0);
    const byMethod = payments.reduce((acc: Record<string, number>, p) => {
      acc[p.paymentMethod] = (acc[p.paymentMethod] || 0) + Number(p.amount);
      return acc;
    }, {} as Record<string, number>);

    res.json({
      success: true,
      data: {
        totalCollected,
        paymentCount: payments.length,
        byMethod,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Customer report
router.get('/customers', async (req, res, next) => {
  try {
    const customerRepo = AppDataSource.getRepository(Customer);

    const [total, active, suspended, disconnected] = await Promise.all([
      customerRepo.count(),
      customerRepo.count({ where: { status: CustomerStatus.ACTIVE } }),
      customerRepo.count({ where: { status: CustomerStatus.SUSPENDED } }),
      customerRepo.count({ where: { status: CustomerStatus.DISCONNECTED } }),
    ]);

    res.json({
      success: true,
      data: { total, active, suspended, disconnected },
    });
  } catch (error) {
    next(error);
  }
});

// M-Pesa report
router.get('/mpesa', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    const mpesaRepo = AppDataSource.getRepository(MpesaTransaction);
    const transactions = await mpesaRepo
      .createQueryBuilder('tx')
      .select(['tx.amount', 'tx.status', 'tx.transactionType', 'tx.createdAt'])
      .where('tx.createdAt BETWEEN :start AND :end', { start, end })
      .getMany();

    const total = transactions.reduce((sum: number, t) => sum + Number(t.amount), 0);
    const successful = transactions.filter(t => t.status === 'completed').length;
    const failed = transactions.filter(t => t.status === 'failed').length;

    res.json({
      success: true,
      data: {
        total,
        transactionCount: transactions.length,
        successful,
        failed,
        successRate: transactions.length ? (successful / transactions.length) * 100 : 0,
      },
    });
  } catch (error) {
    next(error);
  }
});

// Tax report
router.get('/taxes', async (req, res, next) => {
  try {
    const { startDate, endDate } = req.query;
    const start = startDate ? new Date(startDate as string) : new Date(new Date().getFullYear(), 0, 1);
    const end = endDate ? new Date(endDate as string) : new Date();

    const invoiceRepo = AppDataSource.getRepository(Invoice);
    const invoices = await invoiceRepo
      .createQueryBuilder('invoice')
      .select(['invoice.taxAmount', 'invoice.status'])
      .where('invoice.issueDate BETWEEN :start AND :end', { start, end })
      .andWhere('invoice.status IN (:...statuses)', { statuses: [InvoiceStatus.PAID, InvoiceStatus.ISSUED] })
      .getMany();

    const vatCollected = invoices.reduce((sum: number, inv) => sum + Number(inv.taxAmount), 0);

    res.json({
      success: true,
      data: {
        vatCollected,
        vatRate: 16,
        period: { start, end },
      },
    });
  } catch (error) {
    next(error);
  }
});

export const reportRouter = router;
