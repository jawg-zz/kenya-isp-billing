import { Router, Response, NextFunction } from 'express';
import axios from 'axios';
import { Payment, PaymentMethod, PaymentStatus } from '../entities/Payment';
import { MpesaTransaction, MpesaStatus, MpesaTransactionType } from '../entities/MpesaTransaction';
import { Invoice, InvoiceStatus } from '../entities/Invoice';
import { Customer } from '../entities/Customer';
import { AppDataSource } from '../database';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const paymentRepository = () => AppDataSource.getRepository(Payment);
const mpesaRepository = () => AppDataSource.getRepository(MpesaTransaction);
const invoiceRepository = () => AppDataSource.getRepository(Invoice);
const customerRepository = () => AppDataSource.getRepository(Customer);

// M-Pesa credentials
const MPESA_SHORTCODE = process.env.MPESA_SHORTCODE || '600000';
const MPESA_CONSUMER_KEY = process.env.MPESA_CONSUMER_KEY || '';
const MPESA_CONSUMER_SECRET = process.env.MPESA_CONSUMER_SECRET || '';
const MPESA_PASSKEY = process.env.MPESA_PASSKEY || '';
const MPESA_ENV = process.env.MPESA_ENV || 'sandbox';

// Get access token
async function getMpesaAccessToken(): Promise<string> {
  const auth = Buffer.from(`${MPESA_CONSUMER_KEY}:${MPESA_CONSUMER_SECRET}`).toString('base64');
  const url = MPESA_ENV === 'production'
    ? 'https://api.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials'
    : 'https://sandbox.safaricom.co.ke/oauth/v1/generate?grant_type=client_credentials';

  const response = await axios.get(url, { headers: { Authorization: `Basic ${auth}` } });
  return response.data.access_token;
}

// STK Push
router.post('/mpesa/stk-push', async (req, res, next) => {
  try {
    const { phone, amount, invoiceId, customerId } = req.body;

    if (!phone || !amount) {
      throw createError('Phone and amount are required', 400, 'VALIDATION_ERROR');
    }

    const accessToken = await getMpesaAccessToken();
    const timestamp = new Date().toISOString().replace(/[^0-9]/g, '').slice(0, 14);
    const password = Buffer.from(`${MPESA_SHORTCODE}${MPESA_PASSKEY}${timestamp}`).toString('base64');

    const url = MPESA_ENV === 'production'
      ? 'https://api.safaricom.co.ke/mpesa/stkpush/v1/processrequest'
      : 'https://sandbox.safaricom.co.ke/mpesa/stkpush/v1/processrequest';

    const payload = {
      BusinessShortCode: MPESA_SHORTCODE,
      Password: password,
      Timestamp: timestamp,
      TransactionType: 'CustomerPayBillOnline',
      Amount: Math.ceil(amount),
      PartyA: phone,
      PartyB: MPESA_SHORTCODE,
      PhoneNumber: phone,
      CallBackURL: `${process.env.BASE_URL}/webhooks/mpesa`,
      AccountReference: customerId || invoiceId || 'BILL',
      TransactionDesc: 'ISP Bill Payment',
    };

    const response = await axios.post(url, payload, {
      headers: { Authorization: `Bearer ${accessToken}`, 'Content-Type': 'application/json' },
    });

    // Save transaction
    const mpesaTx = mpesaRepository().create({
      transactionType: MpesaTransactionType.STK_PUSH,
      amount,
      customerPhone: phone,
      billRefNumber: customerId || invoiceId,
      conversationId: response.data.ConversationID,
      originatorConversationId: response.data.OriginatorConversationID,
      status: MpesaStatus.PENDING,
    });
    await mpesaRepository().save(mpesaTx);

    logger.info(`STK Push initiated: ${phone}, amount: ${amount}`);
    res.json({ success: true, data: response.data, transactionId: mpesaTx.id });
  } catch (error: any) {
    logger.error('STK Push failed:', error.response?.data || error.message);
    next(createError('M-Pesa payment failed', 500, 'MPESA_ERROR'));
  }
});

// Manual payment entry
router.post('/manual', async (req, res, next) => {
  try {
    const { customerId, invoiceId, amount, paymentMethod, bankReference, notes } = req.body;

    if (!customerId || !amount || !paymentMethod) {
      throw createError('Customer, amount and payment method are required', 400, 'VALIDATION_ERROR');
    }

    const payment = paymentRepository().create({
      customerId,
      invoiceId,
      amount,
      paymentMethod: paymentMethod as PaymentMethod,
      bankReference,
      status: PaymentStatus.COMPLETED,
      paidAt: new Date(),
      notes,
    });

    await paymentRepository().save(payment);

    // Update invoice if linked
    if (invoiceId) {
      const invoice = await invoiceRepository().findOne({ where: { id: invoiceId } });
      if (invoice) {
        invoice.amountPaid += amount;
        if (invoice.amountPaid >= invoice.totalAmount) {
          invoice.status = InvoiceStatus.PAID;
        }
        await invoiceRepository().save(invoice);
      }
    }

    // Update customer balance
    const customer = await customerRepository().findOne({ where: { id: customerId } });
    if (customer) {
      customer.balance -= amount;
      await customerRepository().save(customer);
    }

    logger.info(`Manual payment recorded: ${customerId}, amount: ${amount}`);
    res.status(201).json({ success: true, data: payment });
  } catch (error) {
    next(error);
  }
});

// Get all payments
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, customerId, status } = req.query;
    const query = paymentRepository().createQueryBuilder('payment')
      .leftJoinAndSelect('payment.customer', 'customer');

    if (customerId) query.andWhere('payment.customerId = :customerId', { customerId });
    if (status) query.andWhere('payment.status = :status', { status });

    const [payments, total] = await query
      .orderBy('payment.createdAt', 'DESC')
      .skip((Number(page) - 1) * Number(limit))
      .take(Number(limit))
      .getManyAndCount();

    res.json({ success: true, data: payments, pagination: { page: Number(page), limit: Number(limit), total } });
  } catch (error) {
    next(error);
  }
});

export const paymentRouter = router;
