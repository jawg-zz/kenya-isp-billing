import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Pending Payment Cleanup Worker
 * Runs hourly to clean up subscriptions stuck in PENDING_PAYMENT status.
 *
 * When a customer initiates subscription with insufficient balance, the system
 * creates a subscription in PENDING_PAYMENT status and sends an STK Push.
 * If the customer cancels the STK Push on their phone, the subscription
 * stays PENDING_PAYMENT forever. This worker expires those stale subscriptions.
 */
export async function runPendingPaymentCleanup(): Promise<{
  checked: number;
  expired: number;
  errors: number;
}> {
  let expired = 0;
  let errors = 0;

  logger.info('[PendingPaymentCleanup] Starting cleanup run...');

  try {
    // Find subscriptions in PENDING_PAYMENT status older than 24 hours
    const cutoffDate = new Date();
    cutoffDate.setHours(cutoffDate.getHours() - 24);

    const staleSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'PENDING_PAYMENT',
        createdAt: {
          lt: cutoffDate,
        },
      },
      include: {
        customer: {
          include: {
            user: {
              select: {
                id: true,
                firstName: true,
                lastName: true,
                phone: true,
              },
            },
          },
        },
        plan: {
          select: {
            name: true,
          },
        },
      },
    });

    const checked = staleSubscriptions.length;
    logger.info(`[PendingPaymentCleanup] Found ${checked} stale PENDING_PAYMENT subscriptions`);

    for (const subscription of staleSubscriptions) {
      try {
        await prisma.subscription.update({
          where: { id: subscription.id },
          data: { status: 'EXPIRED' },
        });

        expired++;

        logger.info(
          `[PendingPaymentCleanup] Expired subscription ${subscription.id} ` +
          `(plan: ${subscription.plan.name}, customer: ${subscription.customer.user.firstName} ${subscription.customer.user.lastName}, ` +
          `created: ${subscription.createdAt.toISOString()})`
        );
      } catch (error) {
        errors++;
        logger.error(`[PendingPaymentCleanup] Error expiring subscription ${subscription.id}:`, error);
      }
    }

    logger.info(
      `[PendingPaymentCleanup] Run complete. Checked: ${checked}, Expired: ${expired}, Errors: ${errors}`
    );

    return { checked, expired, errors };
  } catch (error) {
    logger.error('[PendingPaymentCleanup] Fatal error during cleanup run:', error);
    throw error;
  }
}

export default { runPendingPaymentCleanup };
