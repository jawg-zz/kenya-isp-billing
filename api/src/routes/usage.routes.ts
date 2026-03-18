import { Router, IRouter } from 'express';
import { usageController } from '../controllers/usage.controller';
import { authenticate, authorize } from '../middleware/auth';

const router: IRouter = Router();

router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Usage
 *   description: Bandwidth and data usage tracking
 */

/**
 * @swagger
 * /usage/summary:
 *   get:
 *     summary: Get usage summary for current user
 *     tags: [Usage]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Usage summary with current period data
 */
// Customer routes
router.get('/summary', usageController.getUsageSummary);

/**
 * @swagger
 * /usage/realtime:
 *   get:
 *     summary: Get realtime usage data
 *     tags: [Usage]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Realtime usage metrics
 */
router.get('/realtime', usageController.getRealtimeUsage);

/**
 * @swagger
 * /usage/history:
 *   get:
 *     summary: Get usage history
 *     tags: [Usage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *     responses:
 *       200:
 *         description: Paginated usage history
 */
router.get('/history', usageController.getUsageHistory);

/**
 * @swagger
 * /usage/format:
 *   get:
 *     summary: Format bytes to human-readable string
 *     tags: [Usage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: bytes
 *         schema:
 *           type: integer
 *         description: Number of bytes to format
 *     responses:
 *       200:
 *         description: Formatted size string
 */
router.get('/format', usageController.formatBytes);

/**
 * @swagger
 * /usage/admin/analytics:
 *   get:
 *     summary: Get usage analytics (admin)
 *     tags: [Usage]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: groupBy
 *         schema:
 *           type: string
 *           enum: [day, week, month]
 *     responses:
 *       200:
 *         description: Usage analytics data
 *       403:
 *         description: Forbidden (admin only)
 */
router.get('/admin/analytics', authorize('ADMIN', 'SUPPORT'), usageController.getUsageAnalytics);

export default router;
