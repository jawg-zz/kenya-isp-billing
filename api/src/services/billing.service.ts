import crypto from 'crypto';
import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../config/database';
import config from '../config';
import { logger } from '../config/logger';
import { AppError, NotFoundError } from '../types';
import { invoiceService } from './invoice.service';
import { smsService } from './sms.service';
import { createNotification } from './notificationHelper';

interface CreateInvoiceInput {
  customerId: string;
  subscriptionId?: string;
  items: Array<{
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  dueDate?: Date;
  notes?: string;
}

class BillingService {
  // Generate invoice for subscription
  async generateSubscriptionInvoice(subscriptionId: string): Promise<any> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        customer: {
          include: { user: true },
        },
        plan: true,
      },
    });

    if (!subscription) {
      throw new NotFoundError('Subscription not found');
    }

    // Check if invoice already exists for this period
    const existingInvoice = await prisma.invoice.findFirst({
      where: {
        subscriptionId,
        createdAt: {
          gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
        },
      },
    });

    if (existingInvoice) {
      logger.warn(`Invoice already exists for subscription ${subscriptionId}`);
      return existingInvoice;
    }

    // Create invoice items
    const items = [];
    const plan = subscription.plan;

    // Base subscription charge
    items.push({
      description: `${plan.name} - ${plan.type === 'PREPAID' ? 'Data Bundle' : 'Monthly Subscription'}`,
      quantity: 1,
      unitPrice: Number(plan.price),
      amount: Number(plan.price),
    });

    // Calculate totals
    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxRate = config.business.taxRate;
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;

    // Set due date
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() + 30);

    // Create invoice
    const invoiceNumber = await invoiceService.generateInvoiceNumber();

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId: subscription.customerId,
        subscriptionId,
        subtotal,
        taxRate,
        taxAmount,
        totalAmount,
        dueDate,
        notes: `Subscription: ${plan.name}`,
        metadata: {
          items,
          planId: plan.id,
          billingPeriod: {
            start: subscription.startDate,
            end: subscription.endDate,
          },
        },
      },
      include: {
        customer: {
          include: { user: true },
        },
      },
    });

    // Send notification
    await createNotification({
      userId: subscription.customer.userId,
      type: 'INVOICE_GENERATED',
      title: 'New Invoice',
      message: `Invoice ${invoiceNumber} for KES ${totalAmount.toFixed(2)} has been generated.`,
      channel: 'in_app',
    });

    // Send SMS if customer has phone
    if (subscription.customer.user.phone) {
      await smsService.sendInvoiceNotification(
        subscription.customer.user.phone,
        invoiceNumber,
        totalAmount,
        dueDate.toLocaleDateString('en-KE')
      );
    }

    logger.info(`Invoice ${invoiceNumber} generated for subscription ${subscriptionId}`);
    return invoice;
  }

  // Process pending invoices
  async processPendingInvoices(): Promise<{ processed: number; errors: number }> {
    let processed = 0;
    let errors = 0;

    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        status: 'PENDING',
        dueDate: {
          lte: new Date(),
        },
      },
      include: {
        customer: true,
      },
    });

    for (const invoice of pendingInvoices) {
      try {
        // Check if customer has sufficient balance
        if (invoice.customer.balance >= invoice.totalAmount) {
          // Use transaction to ensure atomic deduction and invoice payment
          await prisma.$transaction(async (tx) => {
            // Step 1: Atomically mark invoice as PAID only if still pending (CAS)
            const invoiceUpdateResult = await tx.invoice.updateMany({
              where: {
                id: invoice.id,
                status: 'PENDING',
              },
              data: {
                status: 'PAID',
                paidAt: new Date(),
              },
            });

            if (invoiceUpdateResult.count === 0) {
              // Invoice already processed by another process — skip, no balance change
              return;
            }

            // Step 2: Only now decrement balance (invoice is confirmed PAID)
            const decrementResult = await tx.$executeRaw`
              UPDATE customers 
              SET balance = balance - ${invoice.totalAmount}
              WHERE id = ${invoice.customerId} 
                AND balance >= ${invoice.totalAmount}
            `;

            if (decrementResult === 0) {
              // Balance went below amount between our check and this step (rare).
              // Rollback the invoice status back to PENDING.
              await tx.invoice.update({
                where: { id: invoice.id },
                data: { status: 'PENDING', paidAt: null },
              });
              logger.warn(`Invoice ${invoice.id}: balance insufficient after invoice mark, rolled back`);
              return;
            }

            // Step 3: Create payment record
            await tx.payment.create({
              data: {
                paymentNumber: `AUTO-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
                customerId: invoice.customerId,
                invoiceId: invoice.id,
                amount: invoice.totalAmount,
                method: 'BANK_TRANSFER',
                status: 'COMPLETED',
                processedAt: new Date(),
                metadata: {
                  type: 'AUTO_DEDUCTION',
                  description: 'Automatic deduction from account balance',
                },
              },
            });

            processed++;
          });
        } else {
          // Check if invoice is overdue
          const daysOverdue = Math.floor(
            (Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
          );

          if (daysOverdue > config.business.gracePeriodDays) {
            // Suspend customer
            await prisma.customer.update({
              where: { id: invoice.customerId },
              data: {
                user: {
                  update: {
                    accountStatus: 'SUSPENDED',
                  },
                },
              },
            });

            // Mark invoice as overdue
            await prisma.invoice.update({
              where: { id: invoice.id },
              data: { status: 'OVERDUE' },
            });

            // Notify customer
            await createNotification({
              userId: invoice.customer.userId,
              type: 'ACCOUNT_SUSPENDED',
              title: 'Account Suspended',
              message: 'Your account has been suspended due to overdue payments. Please make a payment to restore service.',
              channel: 'in_app',
            });

            logger.info(`Customer ${invoice.customerId} suspended for overdue invoice`);
          }
        }
      } catch (error) {
        logger.error(`Error processing invoice ${invoice.id}:`, error);
        errors++;
      }
    }

    return { processed, errors };
  }

  // Generate invoices for all due subscriptions
  async generateDueInvoices(): Promise<{ generated: number; errors: number }> {
    let generated = 0;
    let errors = 0;

    // Get subscriptions that need invoicing
    const subscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        type: 'POSTPAID',
      },
      include: {
        plan: true,
      },
    });

    for (const subscription of subscriptions) {
      try {
        // Check if invoice is due (based on billing cycle)
        const lastInvoice = await prisma.invoice.findFirst({
          where: { subscriptionId: subscription.id },
          orderBy: { createdAt: 'desc' },
        });

        const shouldInvoice = this.shouldGenerateInvoice(subscription, lastInvoice);

        if (shouldInvoice) {
          await this.generateSubscriptionInvoice(subscription.id);
          generated++;
        }
      } catch (error) {
        logger.error(`Error generating invoice for subscription ${subscription.id}:`, error);
        errors++;
      }
    }

    return { generated, errors };
  }

  /**
   * Get current date in EAT (Africa/Nairobi, UTC+3).
   * Billing period logic should use EAT since the ISP operates in Kenya.
   * Dates are stored in UTC but billing comparisons need local time.
   */
  private getEATDate(date?: Date): Date {
    const d = date || new Date();
    const formatter = new Intl.DateTimeFormat('en-US', {
      timeZone: 'Africa/Nairobi',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false,
    });
    const parts = formatter.formatToParts(d);
    const get = (type: string) => parts.find(p => p.type === type)?.value || '0';
    return new Date(
      parseInt(get('year')),
      parseInt(get('month')) - 1,
      parseInt(get('day')),
      parseInt(get('hour')),
      parseInt(get('minute')),
      parseInt(get('second')),
    );
  }

  // Check if invoice should be generated
  private shouldGenerateInvoice(subscription: any, lastInvoice: any): boolean {
    // Use EAT (Africa/Nairobi, UTC+3) for billing period comparisons
    const nowEAT = this.getEATDate();

    if (!lastInvoice) {
      // First invoice - generate if subscription started
      const startDateEAT = this.getEATDate(new Date(subscription.startDate));
      return startDateEAT <= nowEAT;
    }

    const lastInvoiceDateEAT = this.getEATDate(new Date(lastInvoice.createdAt));

    switch (subscription.plan.billingCycle) {
      case 'WEEKLY':
        const weekAgoEAT = this.getEATDate(new Date(nowEAT.getTime() - 7 * 24 * 60 * 60 * 1000));
        return lastInvoiceDateEAT <= weekAgoEAT;

      case 'MONTHLY':
        const monthAgoEAT = this.getEATDate(new Date(nowEAT.getTime() - 30 * 24 * 60 * 60 * 1000));
        return lastInvoiceDateEAT <= monthAgoEAT;

      case 'QUARTERLY':
        const quarterAgoEAT = this.getEATDate(new Date(nowEAT.getTime() - 90 * 24 * 60 * 60 * 1000));
        return lastInvoiceDateEAT <= quarterAgoEAT;

      case 'YEARLY':
        const yearAgoEAT = this.getEATDate(new Date(nowEAT.getTime() - 365 * 24 * 60 * 60 * 1000));
        return lastInvoiceDateEAT <= yearAgoEAT;

      default:
        return false;
    }
  }

  // Create manual invoice
  async createManualInvoice(input: CreateInvoiceInput): Promise<any> {
    const customer = await prisma.customer.findUnique({
      where: { id: input.customerId },
      include: { user: true },
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Calculate totals
    const items = input.items.map((item) => ({
      ...item,
      amount: item.quantity * item.unitPrice,
    }));

    const subtotal = items.reduce((sum, item) => sum + item.amount, 0);
    const taxRate = config.business.taxRate;
    const taxAmount = subtotal * taxRate;
    const totalAmount = subtotal + taxAmount;

    // Include tax as a line item in metadata so PDF rendering shows the correct total
    const itemsWithTax = [
      ...items,
      {
        description: `VAT (${(taxRate * 100).toFixed(0)}%)`,
        quantity: 1,
        unitPrice: taxAmount,
        amount: taxAmount,
      },
    ];

    // Create invoice
    const invoiceNumber = await invoiceService.generateInvoiceNumber();

    const invoice = await prisma.invoice.create({
      data: {
        invoiceNumber,
        customerId: input.customerId,
        subscriptionId: input.subscriptionId,
        subtotal,
        taxRate,
        taxAmount,
        totalAmount,
        dueDate: input.dueDate || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        notes: input.notes,
        metadata: { items: itemsWithTax },
      },
      include: {
        customer: {
          include: { user: true },
        },
      },
    });

    // Notify customer
    await createNotification({
      userId: customer.userId,
      type: 'INVOICE_GENERATED',
      title: 'New Invoice',
      message: `Invoice ${invoiceNumber} for KES ${totalAmount.toFixed(2)} has been created.`,
      channel: 'in_app',
    });

    logger.info(`Manual invoice ${invoiceNumber} created for customer ${input.customerId}`);
    return invoice;
  }

  // Apply late fees
  async applyLateFees(): Promise<{ processed: number }> {
    let processed = 0;

    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: 'OVERDUE',
      },
      include: {
        customer: true,
      },
    });

    for (const invoice of overdueInvoices) {
      try {
        const daysOverdue = Math.floor(
          (Date.now() - invoice.dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        // Apply 2% late fee per week overdue
        const weeksOverdue = Math.ceil(daysOverdue / 7);
        const lateFeeAmount = Number(invoice.totalAmount) * 0.02 * weeksOverdue;

        if (lateFeeAmount > 0) {
          const metadata = (invoice.metadata as Record<string, any>) || {};
          const existingItems = metadata.items || [];

          // Add late fee as a separate line item
          const lateFeeLineItem = {
            description: `Late Fee (${weeksOverdue} week${weeksOverdue > 1 ? 's' : ''} overdue)`,
            quantity: 1,
            unitPrice: lateFeeAmount,
            amount: lateFeeAmount,
          };

          // Filter out any previous late fee items to avoid duplicates on re-runs
          const nonLateFeeItems = existingItems.filter(
            (item: any) => !item.description?.startsWith('Late Fee')
          );
          const allItems = [...nonLateFeeItems, lateFeeLineItem];

          // Recalculate subtotal to include the late fee
          const subtotal = allItems.reduce((sum: number, item: any) => sum + Number(item.amount), 0);

          // Recalculate tax - late fees are subject to VAT in Kenya (16%)
          const taxRate = Number(invoice.taxRate) || 0.16;
          const taxAmount = subtotal * taxRate;
          const totalAmount = subtotal + taxAmount;

          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              subtotal,
              taxAmount,
              totalAmount,
              metadata: {
                ...metadata,
                items: allItems,
                lateFee: {
                  amount: lateFeeAmount,
                  appliedAt: new Date().toISOString(),
                  weeksOverdue,
                },
              },
            },
          });

          processed++;
        }
      } catch (error) {
        logger.error(`Error applying late fee to invoice ${invoice.id}:`, error);
      }
    }

    return { processed };
  }

  // Settle pending invoices for a customer using available balance
  // Returns the number of invoices settled
  async settlePendingInvoicesForCustomer(customerId: string): Promise<{ settled: number }> {
    let settled = 0;

    const pendingInvoices = await prisma.invoice.findMany({
      where: {
        customerId,
        status: 'PENDING',
      },
      orderBy: { dueDate: 'asc' },
      include: { customer: true },
    });

    for (const invoice of pendingInvoices) {
      try {
        // Use the same atomic transaction as processPendingInvoices
        await prisma.$transaction(async (tx) => {
          // Step 1: Atomically mark invoice as PAID only if still pending
          const invoiceUpdateResult = await tx.invoice.updateMany({
            where: { id: invoice.id, status: 'PENDING' },
            data: { status: 'PAID', paidAt: new Date() },
          });

          if (invoiceUpdateResult.count === 0) return;

          // Step 2: Decrement balance
          const decrementResult = await tx.$executeRaw`
            UPDATE customers
            SET balance = balance - ${invoice.totalAmount}
            WHERE id = ${invoice.customerId}
              AND balance >= ${invoice.totalAmount}
          `;

          if (decrementResult === 0) {
            await tx.invoice.update({
              where: { id: invoice.id },
              data: { status: 'PENDING', paidAt: null },
            });
            return;
          }

          // Step 3: Create payment record
          await tx.payment.create({
            data: {
              paymentNumber: `AUTO-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`,
              customerId: invoice.customerId,
              invoiceId: invoice.id,
              amount: invoice.totalAmount,
              method: 'BALANCE',
              status: 'COMPLETED',
              processedAt: new Date(),
              metadata: {
                type: 'AUTO_SETTLEMENT',
                description: 'Auto-settled from account balance after cash deposit',
              },
            },
          });

          settled++;
        });
      } catch (error) {
        logger.error(`Error settling invoice ${invoice.id}:`, error);
      }
    }

    return { settled };
  }

  // Get customer billing summary
  async getCustomerBillingSummary(customerId: string): Promise<any> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        user: {
          select: {
            firstName: true,
            lastName: true,
            email: true,
            phone: true,
            accountStatus: true,
          },
        },
        subscriptions: {
          where: { status: 'ACTIVE' },
          include: { plan: true },
        },
        invoices: {
          where: {
            status: { in: ['PENDING', 'OVERDUE'] },
          },
          orderBy: { dueDate: 'asc' },
          take: 5,
        },
        payments: {
          orderBy: { createdAt: 'desc' },
          take: 5,
        },
      },
    });

    if (!customer) {
      throw new NotFoundError('Customer not found');
    }

    // Calculate pending amounts
    const pendingInvoices = await prisma.invoice.aggregate({
      where: {
        customerId,
        status: { in: ['PENDING', 'OVERDUE'] },
      },
      _sum: {
        totalAmount: true,
      },
    });

    // Calculate total spent
    const totalSpent = await prisma.payment.aggregate({
      where: {
        customerId,
        status: 'COMPLETED',
      },
      _sum: {
        amount: true,
      },
    });

    return {
      customer: {
        ...customer,
        pendingAmount: pendingInvoices._sum.totalAmount || 0,
        totalSpent: totalSpent._sum.amount || 0,
      },
    };
  }
}

export const billingService = new BillingService();
export default billingService;
