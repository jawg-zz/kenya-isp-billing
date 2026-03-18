import cron, { ScheduledTask } from 'node-cron';
import { logger } from '../config/logger';
import { runInvoiceGeneration } from './invoiceGenerator';
import { runAutoSuspend } from './autoSuspend';
import { runLateFees } from './lateFees';
import { runUsageReset } from './usageReset';
import { runPendingPaymentCleanup } from './pendingPaymentCleanup';

interface ScheduledJob {
  name: string;
  schedule: string;
  handler: () => Promise<any>;
  cronJob?: ScheduledTask;
}

const jobs: ScheduledJob[] = [
  {
    name: 'Usage Reset',
    schedule: '0 0 * * *', // Every day at midnight (00:00)
    handler: runUsageReset,
  },
  {
    name: 'Invoice Generation',
    schedule: '0 1 * * *', // Every day at 1:00 AM
    handler: runInvoiceGeneration,
  },
  {
    name: 'Late Fee Calculation',
    schedule: '30 1 * * *', // Every day at 1:30 AM
    handler: runLateFees,
  },
  {
    name: 'Auto-Suspend',
    schedule: '0 2 * * *', // Every day at 2:00 AM
    handler: runAutoSuspend,
  },
  {
    name: 'Pending Payment Cleanup',
    schedule: '0 * * * *', // Every hour at minute 0
    handler: runPendingPaymentCleanup,
  },
];

/**
 * Start the cron scheduler
 * Registers all scheduled jobs and starts them
 */
export function startScheduler(): void {
  logger.info('Starting billing workers scheduler...');

  for (const job of jobs) {
    if (!cron.validate(job.schedule)) {
      logger.error(`Invalid cron schedule for job "${job.name}": ${job.schedule}`);
      continue;
    }

    job.cronJob = cron.schedule(job.schedule, async () => {
      logger.info(`[Scheduler] Starting job: ${job.name}`);
      const startTime = Date.now();

      try {
        await job.handler();
        const duration = Date.now() - startTime;
        logger.info(`[Scheduler] Job "${job.name}" completed in ${duration}ms`);
      } catch (error) {
        const duration = Date.now() - startTime;
        logger.error(`[Scheduler] Job "${job.name}" failed after ${duration}ms:`, error);
      }
    });

    logger.info(`[Scheduler] Registered job: "${job.name}" (${job.schedule})`);
  }

  logger.info(`Scheduler started with ${jobs.length} jobs`);
}

/**
 * Stop all scheduled jobs (for graceful shutdown)
 */
export function stopScheduler(): void {
  logger.info('Stopping billing workers scheduler...');

  for (const job of jobs) {
    if (job.cronJob) {
      job.cronJob.stop();
      logger.info(`[Scheduler] Stopped job: "${job.name}"`);
    }
  }

  logger.info('Scheduler stopped');
}

/**
 * Manually trigger a specific job by name (for admin endpoints)
 */
export async function triggerJob(jobName: string): Promise<{ success: boolean; message: string }> {
  const job = jobs.find(
    (j) => j.name.toLowerCase() === jobName.toLowerCase()
  );

  if (!job) {
    return {
      success: false,
      message: `Job "${jobName}" not found. Available: ${jobs.map((j) => j.name).join(', ')}`,
    };
  }

  logger.info(`[Scheduler] Manually triggering job: ${job.name}`);

  try {
    await job.handler();
    return {
      success: true,
      message: `Job "${job.name}" executed successfully`,
    };
  } catch (error) {
    logger.error(`[Scheduler] Manual trigger of "${job.name}" failed:`, error);
    return {
      success: false,
      message: `Job "${job.name}" failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
    };
  }
}

export default { startScheduler, stopScheduler, triggerJob };
