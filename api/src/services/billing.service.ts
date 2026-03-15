import { Decimal } from '@prisma/client/runtime/library';
import { prisma } from '../config/database';
import config from '../config';
import { logger } from '../config/logger';
import { AppError, NotFoundError } from '../types';
import { invoiceService } from './invoice.service';
import { smsService } from './sms.service';

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
    const invoiceNumber = invoiceService.generateInvoiceNumber();
    
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
    await prisma.notification.create({
      data: {
        userId: subscription.customer.userId,
        type: 'INVOICE_GENERATED',
        title: 'New Invoice',
        message: `Invoice ${invoiceNumber} for KES ${totalAmount.toFixed(2)} has been generated.`,
        channel: 'in_app',
      },
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
          // Deduct from balance
          await prisma.customer.update({
            where: { id: invoice.customerId },
            data: {
              balance: {
                decrement: invoice.totalAmount,
              },
            },
          });

          // Mark invoice as paid
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              status: 'PAID',
              paidAt: new Date(),
            },
          });

          // Create payment record
          await prisma.payment.create({
            data: {
              paymentNumber: `AUTO-${Date.now()}`,
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
            await prisma.notification.create({
              data: {
                userId: invoice.customer.userId,
                type: 'ACCOUNT_SUSPENDED',
                title: 'Account Suspended',
                message: 'Your account has been suspended due to overdue payments. Please make a payment to restore service.',
                channel: 'in_app',
              },
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

  // Check if invoice should be generated
  private shouldGenerateInvoice(subscription: any, lastInvoice: any): boolean {
    const now = new Date();

    if (!lastInvoice) {
      // First invoice - generate if subscription started
      return subscription.startDate <= now;
    }

    const lastInvoiceDate = new Date(lastInvoice.createdAt);

    switch (subscription.plan.billingCycle) {
      case 'WEEKLY':
        const weekAgo = new Date(now);
        weekAgo.setDate(weekAgo.getDate() - 7);
        return lastInvoiceDate <= weekAgo;

      case 'MONTHLY':
        const monthAgo = new Date(now);
        monthAgo.setMonth(monthAgo.getMonth() - 1);
        return lastInvoiceDate <= monthAgo;

      case 'QUARTERLY':
        const quarterAgo = new Date(now);
        quarterAgo.setMonth(quarterAgo.getMonth() - 3);
        return lastInvoiceDate <= quarterAgo;

      case 'YEARLY':
        const yearAgo = new Date(now);
        yearAgo.setFullYear(yearAgo.getFullYear() - 1);
        return lastInvoiceDate <= yearAgo;

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

    // Create invoice
    const invoiceNumber = invoiceService.generateInvoiceNumber();

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
        metadata: { items },
      },
      include: {
        customer: {
          include: { user: true },
        },
      },
    });

    // Notify customer
    await prisma.notification.create({
      data: {
        userId: customer.userId,
        type: 'INVOICE_GENERATED',
        title: 'New Invoice',
        message: `Invoice ${invoiceNumber} for KES ${totalAmount.toFixed(2)} has been created.`,
        channel: 'in_app',
      },
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
        const lateFee = Number(invoice.totalAmount) * 0.02 * weeksOverdue;

        if (lateFee > 0) {
          await prisma.invoice.update({
            where: { id: invoice.id },
            data: {
              totalAmount: Number(invoice.totalAmount) + lateFee,
              metadata: {
                ...((invoice.metadata as object) || {}),
                lateFee: {
                  amount: lateFee,
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
