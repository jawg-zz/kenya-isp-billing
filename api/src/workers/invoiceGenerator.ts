import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { billingService } from '../services/billing.service';
import { smsService } from '../services/sms.service';
import config from '../config';

/**
 * Get current date in EAT (Africa/Nairobi, UTC+3).
 * Billing period logic should use EAT since the ISP operates in Kenya.
 * Mirrors the getEATDate helper in billing.service.ts.
 */
function getEATDate(date?: Date): Date {
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

  // Use EAT (Africa/Nairobi) for date comparisons to match billing.service.ts
  const now = getEATDate();

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
    // Use EAT time for consistency
    const threeDaysFromNow = new Date(now.getTime() + 3 * 24 * 60 * 60 * 1000);

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
  // Use EAT (Africa/Nairobi, UTC+3) for billing period comparisons to match billing.service.ts
  const nowEAT = getEATDate(now);

  // Find the most recent invoice for this subscription
  const lastInvoice = await prisma.invoice.findFirst({
    where: { subscriptionId: subscription.id },
    orderBy: { createdAt: 'desc' },
  });

  if (!lastInvoice) {
    // No previous invoice - generate if subscription has started (in EAT)
    const startDateEAT = getEATDate(new Date(subscription.startDate));
    return startDateEAT <= nowEAT;
  }

  const lastInvoiceDateEAT = getEATDate(new Date(lastInvoice.createdAt));

  switch (subscription.plan.billingCycle) {
    case 'WEEKLY': {
      const weekAgoEAT = getEATDate(new Date(nowEAT.getTime() - 7 * 24 * 60 * 60 * 1000));
      return lastInvoiceDateEAT <= weekAgoEAT;
    }
    case 'MONTHLY': {
      const monthAgoEAT = getEATDate(new Date(nowEAT.getTime() - 30 * 24 * 60 * 60 * 1000));
      return lastInvoiceDateEAT <= monthAgoEAT;
    }
    case 'QUARTERLY': {
      const quarterAgoEAT = getEATDate(new Date(nowEAT.getTime() - 90 * 24 * 60 * 60 * 1000));
      return lastInvoiceDateEAT <= quarterAgoEAT;
    }
    case 'YEARLY': {
      const yearAgoEAT = getEATDate(new Date(nowEAT.getTime() - 365 * 24 * 60 * 60 * 1000));
      return lastInvoiceDateEAT <= yearAgoEAT;
    }
    default:
      logger.warn(
        `[InvoiceGenerator] Unknown billing cycle "${subscription.plan.billingCycle}" for subscription ${subscription.id}`
      );
      return false;
  }
}

export default { runInvoiceGeneration };
