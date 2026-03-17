import { Router, Response } from 'express';
import { authenticate, authorize } from '../middleware/auth';
import { triggerJob } from '../workers/scheduler';
import { runInvoiceGeneration } from '../workers/invoiceGenerator';
import { runAutoSuspend } from '../workers/autoSuspend';
import { runLateFees } from '../workers/lateFees';
import { runUsageReset } from '../workers/usageReset';
import { logger } from '../config/logger';
import { AuthenticatedRequest } from '../types';

const router = Router();

// All admin routes require authentication + ADMIN role
router.use(authenticate);
router.use(authorize('ADMIN'));

/**
 * POST /api/v1/admin/run-billing
 * Manually trigger invoice generation
 */
router.post('/run-billing', async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info(`[Admin] Manual billing trigger by user ${req.user?.id}`);
    const result = await runInvoiceGeneration();

    res.json({
      success: true,
      message: 'Invoice generation completed',
      data: result,
    });
  } catch (error) {
    logger.error('[Admin] Error running invoice generation:', error);
    res.status(500).json({
      success: false,
      message: 'Invoice generation failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/admin/run-suspend
 * Manually trigger auto-suspend
 */
router.post('/run-suspend', async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info(`[Admin] Manual auto-suspend trigger by user ${req.user?.id}`);
    const result = await runAutoSuspend();

    res.json({
      success: true,
      message: 'Auto-suspend completed',
      data: result,
    });
  } catch (error) {
    logger.error('[Admin] Error running auto-suspend:', error);
    res.status(500).json({
      success: false,
      message: 'Auto-suspend failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/admin/run-late-fees
 * Manually trigger late fee calculation
 */
router.post('/run-late-fees', async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info(`[Admin] Manual late fees trigger by user ${req.user?.id}`);
    const result = await runLateFees();

    res.json({
      success: true,
      message: 'Late fee calculation completed',
      data: result,
    });
  } catch (error) {
    logger.error('[Admin] Error running late fees:', error);
    res.status(500).json({
      success: false,
      message: 'Late fee calculation failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/admin/run-usage-reset
 * Manually trigger usage reset
 */
router.post('/run-usage-reset', async (req: AuthenticatedRequest, res: Response) => {
  try {
    logger.info(`[Admin] Manual usage reset trigger by user ${req.user?.id}`);
    const result = await runUsageReset();

    res.json({
      success: true,
      message: 'Usage reset completed',
      data: result,
    });
  } catch (error) {
    logger.error('[Admin] Error running usage reset:', error);
    res.status(500).json({
      success: false,
      message: 'Usage reset failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

/**
 * POST /api/v1/admin/run-job/:jobName
 * Trigger any registered scheduler job by name
 */
router.post('/run-job/:jobName', async (req: AuthenticatedRequest, res: Response) => {
  try {
    const jobName = (req as any).params.jobName;
    logger.info(`[Admin] Manual job trigger: ${jobName} by user ${req.user?.id}`);

    const result = await triggerJob(jobName);

    res.json({
      success: result.success,
      message: result.message,
    });
  } catch (error) {
    logger.error('[Admin] Error triggering job:', error);
    res.status(500).json({
      success: false,
      message: 'Job trigger failed',
      error: error instanceof Error ? error.message : 'Unknown error',
    });
  }
});

export default router;
