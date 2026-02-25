import { Router, Response, NextFunction } from 'express';
import { Invoice, InvoiceStatus, EtimsStatus } from '../entities/Invoice';
import { InvoiceItem } from '../entities/InvoiceItem';
import { AppDataSource } from '../database';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const invoiceRepository = () => AppDataSource.getRepository(Invoice);
const itemRepository = () => AppDataSource.getRepository(InvoiceItem);

// Generate invoice number
async function generateInvoiceNumber(): Promise<string> {
  const count = await invoiceRepository().count();
  const date = new Date();
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  return `INV-${year}${month}-${String(count + 1).padStart(5, '0')}`;
}

// Get all invoices
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, status, customerId } = req.query;
    const query = invoiceRepository().createQueryBuilder('invoice')
      .leftJoinAndSelect('invoice.customer', 'customer');

    if (status) query.andWhere('invoice.status = :status', { status });
    if (customerId) query.andWhere('invoice.customerId = :customerId', { customerId });

    const [invoices, total] = await query
      .orderBy('invoice.issueDate', 'DESC')
      .skip((Number(page) - 1) * Number(limit))
      .take(Number(limit))
      .getManyAndCount();

    res.json({
      success: true,
      data: invoices,
      pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) },
    });
  } catch (error) {
    next(error);
  }
});

// Get invoice by ID
router.get('/:id', async (req, res, next) => {
  try {
    const invoice = await invoiceRepository().findOne({
      where: { id: req.params.id },
      relations: ['customer', 'items', 'payments'],
    });
    if (!invoice) throw createError('Invoice not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
});

// Create invoice
router.post('/', async (req, res, next) => {
  try {
    const { customerId, issueDate, dueDate, items, notes } = req.body;

    if (!customerId || !items || items.length === 0) {
      throw createError('Customer and items are required', 400, 'VALIDATION_ERROR');
    }

    let subtotal = 0;
    const invoiceItems = items.map((item: any) => {
      const total = item.quantity * item.unitPrice;
      subtotal += total;
      return itemRepository().create({ ...item, totalPrice: total });
    });

    const taxAmount = subtotal * 0.16; // 16% VAT
    const totalAmount = subtotal + taxAmount;

    const invoice = invoiceRepository().create({
      invoiceNumber: await generateInvoiceNumber(),
      customerId,
      issueDate: new Date(issueDate),
      dueDate: new Date(dueDate),
      subtotal,
      taxAmount,
      totalAmount,
      status: InvoiceStatus.DRAFT,
      etimsStatus: EtimsStatus.PENDING,
      notes,
    });

    await invoiceRepository().save(invoice);
    
    for (const item of invoiceItems) {
      item.invoiceId = invoice.id;
      await itemRepository().save(item);
    }

    await invoiceRepository().findOne({ where: { id: invoice.id }, relations: ['items'] });

    logger.info(`Invoice created: ${invoice.invoiceNumber}`);
    res.status(201).json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
});

// Issue invoice
router.post('/:id/issue', async (req, res, next) => {
  try {
    const invoice = await invoiceRepository().findOne({ where: { id: req.params.id } });
    if (!invoice) throw createError('Invoice not found', 404, 'NOT_FOUND');
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw createError('Only draft invoices can be issued', 400, 'INVALID_STATE');
    }

    invoice.status = InvoiceStatus.ISSUED;
    await invoiceRepository().save(invoice);
    logger.info(`Invoice issued: ${invoice.invoiceNumber}`);

    // TODO: Send to KRA eTIMS
    // TODO: Send invoice to customer

    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
});

// Cancel invoice
router.post('/:id/cancel', async (req, res, next) => {
  try {
    const invoice = await invoiceRepository().findOne({ where: { id: req.params.id } });
    if (!invoice) throw createError('Invoice not found', 404, 'NOT_FOUND');

    invoice.status = InvoiceStatus.CANCELLED;
    await invoiceRepository().save(invoice);
    logger.info(`Invoice cancelled: ${invoice.invoiceNumber}`);

    res.json({ success: true, data: invoice });
  } catch (error) {
    next(error);
  }
});

export const invoiceRouter = router;
