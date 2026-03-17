import { prisma } from '../config/database';
import { logger } from '../config/logger';
import { smsService } from '../services/sms.service';

/**
 * Usage Reset Worker
 * Runs daily at midnight (00:00)
 *
 * For prepaid subscriptions past expiry, resets data usage to 0
 * and creates a new usage period by updating the subscription end date.
 */
export async function runUsageReset(): Promise<{
  processed: number;
  expired: number;
  renewed: number;
  errors: number;
}> {
  let processed = 0;
  let expired = 0;
  let renewed = 0;
  let errors = 0;

  logger.info('[UsageReset] Starting usage reset run...');

  try {
    const now = new Date();

    // Find all expired prepaid subscriptions that are still marked as ACTIVE
    const expiredSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        type: 'PREPAID',
        endDate: {
          lt: now, // End date is in the past
        },
      },
      include: {
        customer: {
          include: { user: true },
        },
        plan: true,
      },
    });

    expired = expiredSubscriptions.length;
    logger.info(`[UsageReset] Found ${expired} expired prepaid subscriptions`);

    for (const subscription of expiredSubscriptions) {
      try {
        const metadata = (subscription.metadata as Record<string, any>) || {};

        // Check if auto-renew is enabled
        if (subscription.autoRenew && subscription.customer.balance >= Number(subscription.plan.price)) {
          // Auto-renew: deduct from balance and extend the subscription
          const newEndDate = new Date(subscription.endDate);
          newEndDate.setDate(newEndDate.getDate() + subscription.plan.validityDays);

          await prisma.$transaction(async (tx) => {
            // Deduct plan price from customer balance
            await tx.customer.update({
              where: { id: subscription.customerId },
              data: {
                balance: {
                  decrement: Number(subscription.plan.price),
                },
              },
            });

            // Reset usage and extend subscription
            await tx.subscription.update({
              where: { id: subscription.id },
              data: {
                dataUsed: 0,
                voiceMinutesUsed: 0,
                smsUsed: 0,
                dataRemaining: subscription.plan.dataAllowance,
                startDate: now,
                endDate: newEndDate,
                metadata: {
                  ...metadata,
                  renewedAt: now.toISOString(),
                  previousEndDate: subscription.endDate,
                  renewalHistory: [
                    ...((metadata.renewalHistory as Array<{
                      renewedAt: string;
                      previousEndDate: string;
                      newEndDate: string;
                    }>) || []),
                    {
                      renewedAt: now.toISOString(),
                      previousEndDate: subscription.endDate,
                      newEndDate: newEndDate.toISOString(),
                    },
                  ],
                },
              },
            });
          });

          renewed++;

          logger.info(
            `[UsageReset] Auto-renewed subscription ${subscription.id} ` +
            `(customer: ${subscription.customerId}, new end: ${newEndDate.toISOString()})`
          );

          // Send renewal notification
          if (subscription.customer.user.phone) {
            await smsService.sendSubscriptionActivation(
              subscription.customer.user.phone,
              subscription.plan.name,
              newEndDate.toLocaleDateString('en-KE')
            );
          }
        } else {
          // No auto-renew or insufficient balance: deactivate and notify
          await prisma.subscription.update({
            where: { id: subscription.id },
            data: {
              status: 'TERMINATED',
              metadata: {
                ...metadata,
                terminatedAt: now.toISOString(),
                terminationReason: subscription.autoRenew
                  ? 'INSUFFICIENT_BALANCE'
                  : 'EXPIRED_NO_AUTORENEW',
              },
            },
          });

          // Send expiry notification
          if (subscription.customer.user.phone) {
            await smsService.sendSubscriptionExpired(
              subscription.customer.user.phone,
              subscription.plan.name
            );
          }

          logger.info(
            `[UsageReset] Terminated expired subscription ${subscription.id} ` +
            `(customer: ${subscription.customerId}, ` +
            `${subscription.autoRenew ? 'insufficient balance' : 'no auto-renew'})`
          );
        }

        processed++;
      } catch (error) {
        errors++;
        logger.error(
          `[UsageReset] Error processing expired subscription ${subscription.id}:`,
          error
        );
      }
    }

    // Also handle any prepaid subscriptions with usage but past their validity
    // that weren't caught (safety net for subscriptions that somehow stayed ACTIVE)
    const staleSubscriptions = await prisma.subscription.findMany({
      where: {
        status: 'ACTIVE',
        type: 'PREPAID',
        dataUsed: { gt: 0 },
        endDate: {
          lt: new Date(Date.now() - 24 * 60 * 60 * 1000), // More than 1 day expired
        },
      },
      select: { id: true },
    });

    if (staleSubscriptions.length > 0) {
      logger.info(
        `[UsageReset] Found ${staleSubscriptions.length} stale prepaid subscriptions with usage past expiry`
      );

      // Reset their usage to 0 as a safety measure
      await prisma.subscription.updateMany({
        where: {
          id: { in: staleSubscriptions.map((s) => s.id) },
        },
        data: {
          dataUsed: 0,
          voiceMinutesUsed: 0,
          smsUsed: 0,
        },
      });
    }

    logger.info(
      `[UsageReset] Run complete. Processed: ${processed}, ` +
      `Expired: ${expired}, Renewed: ${renewed}, Errors: ${errors}`
    );

    return { processed, expired, renewed, errors };
  } catch (error) {
    logger.error('[UsageReset] Fatal error during usage reset run:', error);
    throw error;
  }
}

export default { runUsageReset };
