import { Router, Response, NextFunction } from 'express';
import { MpesaTransaction, MpesaStatus } from '../entities/MpesaTransaction';
import { Payment, PaymentMethod, PaymentStatus } from '../entities/Payment';
import { Invoice, InvoiceStatus } from '../entities/Invoice';
import { Customer } from '../entities/Customer';
import { AppDataSource } from '../database';
import { logger } from '../utils/logger';

const router = Router();

// M-Pesa callback
router.post('/mpesa', async (req: any, res: Response, next: NextFunction) => {
  try {
    const { Body } = req.body;
    
    if (!Body?.stkCallback) {
      logger.warn('Invalid M-Pesa callback received');
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    const callback = Body.stkCallback;
    const { MerchantRequestID, CheckoutRequestID, ResultCode, ResultDesc, CallbackMetadata } = callback;

    // Find the transaction
    const mpesaRepo = AppDataSource.getRepository(MpesaTransaction);
    const transaction = await mpesaRepo.findOne({
      where: { originatorConversationId: CheckoutRequestID },
    });

    if (!transaction) {
      logger.warn('M-Pesa transaction not found', { CheckoutRequestID });
      return res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
    }

    if (ResultCode === 0) {
      // Success
      const item = CallbackMetadata?.Item || [];
      const getValue = (name: string) => item.find((i: any) => i.Name === name)?.Value;

      transaction.mpesaReceipt = getValue('MpesaReceiptNumber');
      transaction.transactionId = getValue('TransactionId');
      transaction.status = MpesaStatus.COMPLETED;
      transaction.resultCode = String(ResultCode);
      transaction.resultDesc = ResultDesc;
      transaction.callbackData = req.body;

      await mpesaRepo.save(transaction);

      // Create payment record
      const paymentRepo = AppDataSource.getRepository(Payment);
      
      // Try to find customer/invoice by bill reference
      let customerId = null;
      let invoiceId = null;
      
      if (transaction.billRefNumber) {
        const customerRepo = AppDataSource.getRepository(Customer);
        const customer = await customerRepo.findOne({ where: { id: transaction.billRefNumber } });
        if (customer) customerId = customer.id;

        const invoiceRepo = AppDataSource.getRepository(Invoice);
        const invoice = await invoiceRepo.findOne({ where: { id: transaction.billRefNumber } });
        if (invoice) invoiceId = invoice.id;
      }

      const payment = paymentRepo.create({
        customerId: customerId || transaction.billRefNumber || '',
        invoiceId: invoiceId || undefined,
        amount: transaction.amount,
        paymentMethod: PaymentMethod.MPESA,
        mpesaReceipt: transaction.mpesaReceipt || undefined,
        transactionId: transaction.transactionId || undefined,
        status: PaymentStatus.COMPLETED,
        paidAt: new Date(),
      });

      await paymentRepo.save(payment);

      // Update invoice if exists
      if (invoiceId) {
        const invoiceRepo = AppDataSource.getRepository(Invoice);
        const invoice = await invoiceRepo.findOne({ where: { id: invoiceId } });
        if (invoice) {
          invoice.amountPaid += transaction.amount;
          if (invoice.amountPaid >= invoice.totalAmount) {
            invoice.status = InvoiceStatus.PAID;
          }
          await invoiceRepo.save(invoice);
        }
      }

      // Update customer balance
      if (customerId) {
        const customerRepo = AppDataSource.getRepository(Customer);
        const customer = await customerRepo.findOne({ where: { id: customerId } });
        if (customer) {
          customer.balance -= transaction.amount;
          await customerRepo.save(customer);
        }
      }

      logger.info(`M-Pesa payment completed: ${transaction.mpesaReceipt}, amount: ${transaction.amount}`);
    } else {
      // Failed
      transaction.status = MpesaStatus.FAILED;
      transaction.resultCode = String(ResultCode);
      transaction.resultDesc = ResultDesc;
      await mpesaRepo.save(transaction);
      logger.warn(`M-Pesa payment failed: ${ResultDesc}`);
    }

    res.json({ ResultCode: 0, ResultDesc: 'Accepted' });
  } catch (error) {
    logger.error('M-Pesa callback error:', error);
    res.json({ ResultCode: 0, ResultDesc: 'Accepted' }); // Don't retry
  }
});

// KRA eTIMS webhook (placeholder)
router.post('/kra', async (req, res, next) => {
  try {
    logger.info('KRA webhook received:', req.body);
    // Handle eTIMS responses here
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});

// Network webhook (placeholder)
router.post('/network', async (req, res, next) => {
  try {
    logger.info('Network webhook received:', req.body);
    // Handle MikroTik/UniFi events here
    res.json({ status: 'ok' });
  } catch (error) {
    next(error);
  }
});

export const webhookRouter = router;
