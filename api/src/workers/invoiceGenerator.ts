import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { billingService } from '../services/billing.service';
import { smsService } from '../services/sms.service';
import config from '../config';

/**
 * Invoice Generation Worker
 * Runs daily at 1:00 AM
 *
 * For each ACTIVE subscription, checks if it's billable today:
 * - POSTPAID: generates invoice if billing cycle date matches
 * - PREPAID: generates invoice 3 days before expiry
 * Skips if invoice already exists for the billing period.
 */
export async function runInvoiceGeneration(): Promise<{
  generated: number;
  errors: number;
  skipped: number;
}> {
  let generated = 0;
  let errors = 0;
  let skipped = 0;

  logger.info('[InvoiceGenerator] Starting invoice generation run...');

  const now = new Date();

  try {
    // === POSTPAID subscriptions ===
    const postpaidSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        type: 'POSTPAID',
      },
      include: {
        customer: {
          include: { user: true },
        },
        plan: true,
      },
    });

    logger.info(`[InvoiceGenerator] Found ${postpaidSubscriptions.length} active postpaid subscriptions`);

    for (const subscription of postpaidSubscriptions) {
      try {
        // Check if we already have an invoice for this billing period
        const shouldInvoice = await shouldGeneratePostpaidInvoice(subscription, now);

        if (!shouldInvoice) {
          skipped++;
          continue;
        }

        // Generate invoice using billing service
        await billingService.generateSubscriptionInvoice(subscription.id);
        generated++;

        logger.info(
          `[InvoiceGenerator] Generated postpaid invoice for subscription ${subscription.id} (customer: ${subscription.customerId})`
        );
      } catch (error) {
        errors++;
        logger.error(
          `[InvoiceGenerator] Error generating postpaid invoice for subscription ${subscription.id}:`,
          error
        );
      }
    }

    // === PREPAID subscriptions (generate 3 days before expiry) ===
    const threeDaysFromNow = new Date(now);
    threeDaysFromNow.setDate(threeDaysFromNow.getDate() + 3);

    const prepaidSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        type: 'PREPAID',
        endDate: {
          lte: threeDaysFromNow,
          gte: now, // Not already expired
        },
      },
      include: {
        customer: {
          include: { user: true },
        },
        plan: true,
      },
    });

    logger.info(`[InvoiceGenerator] Found ${prepaidSubscriptions.length} prepaid subscriptions nearing expiry`);

    for (const subscription of prepaidSubscriptions) {
      try {
        // Check if we already have an invoice for this subscription's current period
        const existingInvoice = await prisma.invoice.findFirst({
          where: {
            subscriptionId: subscription.id,
            createdAt: {
              gte: new Date(subscription.startDate),
            },
          },
          orderBy: { createdAt: 'desc' },
        });

        // Skip if we already generated an invoice since the subscription started
        if (existingInvoice) {
          skipped++;
          continue;
        }

        // Generate invoice using billing service
        await billingService.generateSubscriptionInvoice(subscription.id);
        generated++;

        logger.info(
          `[InvoiceGenerator] Generated prepaid invoice for subscription ${subscription.id} (customer: ${subscription.customerId}, expires: ${subscription.endDate})`
        );
      } catch (error) {
        errors++;
        logger.error(
          `[InvoiceGenerator] Error generating prepaid invoice for subscription ${subscription.id}:`,
          error
        );
      }
    }

    logger.info(
      `[InvoiceGenerator] Run complete. Generated: ${generated}, Skipped: ${skipped}, Errors: ${errors}`
    );

    return { generated, errors, skipped };
  } catch (error) {
    logger.error('[InvoiceGenerator] Fatal error during invoice generation run:', error);
    throw error;
  }
}

/**
 * Determine if a postpaid invoice should be generated based on billing cycle
 */
async function shouldGeneratePostpaidInvoice(
  subscription: {
    id: string;
    startDate: Date;
    plan: { billingCycle: string | null };
  },
  now: Date
): Promise<boolean> {
  // Find the most recent invoice for this subscription
  const lastInvoice = await prisma.invoice.findFirst({
    where: { subscriptionId: subscription.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!lastInvoice) {
    // No previous invoice - generate if subscription has started
    return subscription.startDate <= now;
  }

  const lastInvoiceDate = new Date(lastInvoice.createdAt);

  switch (subscription.plan.billingCycle) {
    case 'WEEKLY': {
      const weekAgo = new Date(now);
      weekAgo.setDate(weekAgo.getDate() - 7);
      return lastInvoiceDate <= weekAgo;
    }
    case 'MONTHLY': {
      const monthAgo = new Date(now);
      monthAgo.setMonth(monthAgo.getMonth() - 1);
      return lastInvoiceDate <= monthAgo;
    }
    case 'QUARTERLY': {
      const quarterAgo = new Date(now);
      quarterAgo.setMonth(quarterAgo.getMonth() - 3);
      return lastInvoiceDate <= quarterAgo;
    }
    case 'YEARLY': {
      const yearAgo = new Date(now);
      yearAgo.setFullYear(yearAgo.getFullYear() - 1);
      return lastInvoiceDate <= yearAgo;
    }
    default:
      logger.warn(
        `[InvoiceGenerator] Unknown billing cycle "${subscription.plan.billingCycle}" for subscription ${subscription.id}`
      );
      return false;
  }
}

export default { runInvoiceGeneration };
