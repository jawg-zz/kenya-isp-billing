import { Router, IRouter } from 'express';
import { usageController } from '../controllers/usage.controller';
import { authenticate, authorize } from '../middleware/auth';

const router: IRouter = Router();

router.use(authenticate);

// Customer routes
router.get('/summary', usageController.getUsageSummary);
router.get('/realtime', usageController.getRealtimeUsage);
router.get('/history', usageController.getUsageHistory);
router.get('/format', usageController.formatBytes);

// Admin routes
router.get('/admin/analytics', authorize('ADMIN', 'SUPPORT'), usageController.getUsageAnalytics);

export default router;
