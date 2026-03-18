import { prisma } from '../config/database';
import { cache } from '../config/redis';
import { logger } from '../config/logger';
import { smsService } from '../services/sms.service';
import { radiusService } from '../services/radius.service';

/**
 * Auto-Suspend Worker
 * Runs daily at 2:00 AM
 *
 * Reads `auto_suspend_overdue` and `auto_suspend_grace_days` from SystemSetting.
 * If enabled, finds all users with invoices overdue by grace_days.
 * Changes user accountStatus to 'SUSPENDED' and sends SMS notification.
 */
export async function runAutoSuspend(): Promise<{
  checked: number;
  suspended: number;
  skipped: number;
  errors: number;
}> {
  let checked = 0;
  let suspended = 0;
  let skipped = 0;
  let errors = 0;

  logger.info('[AutoSuspend] Starting auto-suspend run...');

  try {
    // Read system settings (cached 5 min)
    const cacheKey = 'system:settings:auto_suspend';
    let settings = await cache.get<{ autoSuspendEnabled: boolean; graceDays: number }>(cacheKey);

    if (!settings) {
      const [autoSuspendSetting, graceDaysSetting] = await Promise.all([
        prisma.systemSetting.findUnique({ where: { key: 'auto_suspend_overdue' } }),
        prisma.systemSetting.findUnique({ where: { key: 'auto_suspend_grace_days' } }),
      ]);

      const autoSuspendEnabled = autoSuspendSetting?.value?.toLowerCase() === 'true';
      const graceDays = parseInt(graceDaysSetting?.value || '3', 10);
      const effectiveGraceDays = isNaN(graceDays) || graceDays < 0 ? 3 : graceDays;

      settings = { autoSuspendEnabled, graceDays: effectiveGraceDays };
      await cache.set(cacheKey, settings, 300); // 5 min TTL
    }

    // Check if auto-suspend is enabled
    if (!settings.autoSuspendEnabled) {
      logger.info('[AutoSuspend] Auto-suspend is disabled. Skipping run.');
      return { checked: 0, suspended: 0, skipped: 0, errors: 0 };
    }

    // Get grace days (default to 3 if not set)
    const effectiveGraceDays = settings.graceDays;

    logger.info(`[AutoSuspend] Auto-suspend enabled. Grace period: ${effectiveGraceDays} days`);

    // Calculate the cutoff date
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - effectiveGraceDays);

    // Find overdue invoices that haven't resulted in suspension yet
    // We look for PENDING and OVERDUE invoices past the grace period
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: {
          lt: cutoffDate,
        },
        customer: {
          user: {
            accountStatus: 'ACTIVE', // Only suspend active accounts
          },
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
                email: true,
                phone: true,
                accountStatus: true,
              },
            },
          },
        },
      },
      distinct: ['customerId'], // One invoice per customer (earliest overdue)
      orderBy: { dueDate: 'asc' },
    });

    checked = overdueInvoices.length;
    logger.info(`[AutoSuspend] Found ${checked} customers with invoices overdue by >${effectiveGraceDays} days`);

    // Track which customers we've already suspended (avoid duplicate processing)
    const suspendedCustomerIds = new Set<string>();

    for (const invoice of overdueInvoices) {
      const customerId = invoice.customerId;
      const user = invoice.customer.user;

      // Skip if already suspended in this run
      if (suspendedCustomerIds.has(customerId)) {
        skipped++;
        continue;
      }

      // Skip if already not active (shouldn't happen due to query filter, but safety check)
      if (user.accountStatus !== 'ACTIVE') {
        skipped++;
        continue;
      }

      try {
        // Calculate days overdue for the notification
        const daysOverdue = Math.floor(
          (Date.now() - new Date(invoice.dueDate).getTime()) / (1000 * 60 * 60 * 24)
        );

        // Suspend the user account
        await prisma.user.update({
          where: { id: user.id },
          data: { accountStatus: 'SUSPENDED' },
        });

        // Sync to FreeRADIUS - remove radcheck entries and disconnect sessions
        try {
          await radiusService.disableRadiusUser(customerId);
        } catch (radiusError) {
          logger.error(`[AutoSuspend] Failed to disable RADIUS for customer ${customerId}:`, radiusError);
          // Don't increment errors - account was suspended successfully
        }

        // Update all pending invoices for this customer to OVERDUE
        await prisma.invoice.updateMany({
          where: {
            customerId,
            status: 'PENDING',
          },
          data: { status: 'OVERDUE' },
        });

        // Create in-app notification
        await prisma.notification.create({
          data: {
            userId: user.id,
            type: 'ACCOUNT_SUSPENDED',
            title: 'Account Suspended',
            message: `Your account has been suspended due to overdue payments (${daysOverdue} days past due). Please make a payment to restore service.`,
            channel: 'in_app',
          },
        });

        // Send SMS notification
        if (user.phone) {
          const smsResult = await smsService.sendAccountSuspended(
            user.phone,
            `Overdue payment (${daysOverdue} days)`
          );
          if (!smsResult.success) {
            logger.warn(`[AutoSuspend] Failed to send SMS to ${user.phone}: ${smsResult.error}`);
          }
        }

        suspendedCustomerIds.add(customerId);
        suspended++;

        logger.info(
          `[AutoSuspend] Suspended customer ${customerId} (${user.firstName} ${user.lastName}, ` +
          `${daysOverdue} days overdue on invoice ${invoice.invoiceNumber})`
        );
      } catch (error) {
        errors++;
        logger.error(`[AutoSuspend] Error suspending customer ${customerId}:`, error);
      }
    }

    logger.info(
      `[AutoSuspend] Run complete. Checked: ${checked}, Suspended: ${suspended}, Skipped: ${skipped}, Errors: ${errors}`
    );

    return { checked, suspended, skipped, errors };
  } catch (error) {
    logger.error('[AutoSuspend] Fatal error during auto-suspend run:', error);
    throw error;
  }
}

export default { runAutoSuspend };
