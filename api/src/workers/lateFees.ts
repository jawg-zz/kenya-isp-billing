import { prisma } from '../config/database';
import { logger } from '../config/logger';

/**
 * Late Fee Worker
 * Runs daily at 1:30 AM
 *
 * Reads `late_fee_percentage` from SystemSetting.
 * For each unpaid invoice past due date, adds a late fee.
 * Uses the existing late fee calculation approach in billing.service.ts
 * but reads the configurable percentage from system settings.
 */
export async function runLateFees(): Promise<{
  processed: number;
  totalFeesApplied: number;
  skipped: number;
  errors: number;
}> {
  let processed = 0;
  let totalFeesApplied = 0;
  let skipped = 0;
  let errors = 0;

  logger.info('[LateFees] Starting late fee calculation run...');

  try {
    // Read late fee percentage from system settings
    const lateFeeSetting = await prisma.systemSetting.findUnique({
      where: { key: 'late_fee_percentage' },
    });

    // Default to 2% if not configured (matching existing billing.service.ts logic)
    const lateFeePercentage = lateFeeSetting
      ? parseFloat(lateFeeSetting.value)
      : 2.0;

    if (isNaN(lateFeePercentage) || lateFeePercentage < 0) {
      logger.warn(
        `[LateFees] Invalid late_fee_percentage value: "${lateFeeSetting?.value}". Skipping run.`
      );
      return { processed: 0, totalFeesApplied: 0, skipped: 0, errors: 0 };
    }

    logger.info(`[LateFees] Late fee percentage: ${lateFeePercentage}% per week overdue`);

    // Find all invoices that are overdue (past due date, not paid/cancelled)
    const overdueInvoices = await prisma.invoice.findMany({
      where: {
        status: { in: ['PENDING', 'OVERDUE'] },
        dueDate: {
          lt: new Date(), // Past due date
        },
      },
      include: {
        customer: true,
      },
      orderBy: { dueDate: 'asc' },
    });

    logger.info(`[LateFees] Found ${overdueInvoices.length} overdue invoices to process`);

    for (const invoice of overdueInvoices) {
      try {
        const now = new Date();
        const dueDate = new Date(invoice.dueDate);
        const daysOverdue = Math.floor(
          (now.getTime() - dueDate.getTime()) / (1000 * 60 * 60 * 24)
        );

        if (daysOverdue <= 0) {
          skipped++;
          continue;
        }

        // Calculate weeks overdue (rounded up)
        const weeksOverdue = Math.ceil(daysOverdue / 7);

        // Calculate late fee
        const invoiceAmount = Number(invoice.totalAmount);
        const lateFeeAmount = invoiceAmount * (lateFeePercentage / 100) * weeksOverdue;

        if (lateFeeAmount <= 0) {
          skipped++;
          continue;
        }

        // Check if we already applied a late fee for this current week
        const metadata = (invoice.metadata as Record<string, any>) || {};
        const existingLateFee = metadata.lateFee;

        if (existingLateFee) {
          const lastAppliedWeeks = existingLateFee.weeksOverdue || 0;
          if (lastAppliedWeeks >= weeksOverdue) {
            // Already applied for this period, skip
            skipped++;
            continue;
          }
        }

        // Apply late fee: update invoice total and mark as OVERDUE
        const newTotal = invoiceAmount + lateFeeAmount;

        await prisma.invoice.update({
          where: { id: invoice.id },
          data: {
            status: 'OVERDUE',
            totalAmount: newTotal,
            metadata: {
              ...metadata,
              lateFee: {
                amount: lateFeeAmount,
                totalApplied: ((existingLateFee?.totalApplied as number) || 0) + lateFeeAmount,
                percentage: lateFeePercentage,
                weeksOverdue,
                appliedAt: now.toISOString(),
                history: [
                  ...((existingLateFee?.history as Array<{
                    amount: number;
                    weeksOverdue: number;
                    appliedAt: string;
                  }>) || []),
                  {
                    amount: lateFeeAmount,
                    weeksOverdue,
                    appliedAt: now.toISOString(),
                  },
                ],
              },
            },
          },
        });

        processed++;
        totalFeesApplied += lateFeeAmount;

        logger.info(
          `[LateFees] Applied late fee of KES ${lateFeeAmount.toFixed(2)} to invoice ` +
          `${invoice.invoiceNumber} (${daysOverdue} days / ${weeksOverdue} weeks overdue, ` +
          `new total: KES ${newTotal.toFixed(2)})`
        );
      } catch (error) {
        errors++;
        logger.error(`[LateFees] Error applying late fee to invoice ${invoice.id}:`, error);
      }
    }

    logger.info(
      `[LateFees] Run complete. Processed: ${processed}, ` +
      `Total fees applied: KES ${totalFeesApplied.toFixed(2)}, ` +
      `Skipped: ${skipped}, Errors: ${errors}`
    );

    return { processed, totalFeesApplied, skipped, errors };
  } catch (error) {
    logger.error('[LateFees] Fatal error during late fee run:', error);
    throw error;
  }
}

export default { runLateFees };
