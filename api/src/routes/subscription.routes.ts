import { Router, IRouter } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createSubscriptionSchema,
  cancelSubscriptionSchema,
} from '../validators/subscription.validator';

const router: IRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Subscriptions
 *   description: Subscription management
 */

router.use(authenticate);

/**
 * @swagger
 * /subscriptions:
 *   get:
 *     summary: Get customer's subscriptions
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, EXPIRED, SUSPENDED, TERMINATED]
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
 *         description: Paginated subscriptions list
 */
router.get('/', subscriptionController.getSubscriptions);

/**
 * @swagger
 * /subscriptions/{id}:
 *   get:
 *     summary: Get subscription details
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Subscription details with recent invoices and payments
 *       404:
 *         description: Subscription not found
 */
router.get('/:id', subscriptionController.getSubscription);

/**
 * @swagger
 * /subscriptions:
 *   post:
 *     summary: Create a new subscription (purchase a plan)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreateSubscriptionRequest'
 *     responses:
 *       201:
 *         description: Subscription activated
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     subscription:
 *                       $ref: '#/components/schemas/Subscription'
 *       400:
 *         description: Already has active subscription
 *       404:
 *         description: Plan not found or inactive
 */
router.post('/', validate(createSubscriptionSchema), subscriptionController.createSubscription);

/**
 * @swagger
 * /subscriptions/renew:
 *   post:
 *     summary: Renew an existing subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subscriptionId]
 *             properties:
 *               subscriptionId:
 *                 type: string
 *                 format: uuid
 *     responses:
 *       200:
 *         description: Subscription renewed
 *       404:
 *         description: Subscription not found
 */
router.post('/renew', subscriptionController.renewSubscription);

/**
 * @swagger
 * /subscriptions/cancel:
 *   post:
 *     summary: Cancel a subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CancelSubscriptionRequest'
 *     responses:
 *       200:
 *         description: Subscription cancelled
 *       404:
 *         description: Active subscription not found
 */
router.post('/cancel', validate(cancelSubscriptionSchema), subscriptionController.cancelSubscription);

/**
 * @swagger
 * /subscriptions/auto-renew:
 *   put:
 *     summary: Toggle auto-renew for a subscription
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [subscriptionId, autoRenew]
 *             properties:
 *               subscriptionId:
 *                 type: string
 *               autoRenew:
 *                 type: boolean
 *     responses:
 *       200:
 *         description: Auto-renew toggled
 *       404:
 *         description: Subscription not found
 */
router.put('/auto-renew', subscriptionController.toggleAutoRenew);

/**
 * @swagger
 * /subscriptions/admin/all:
 *   get:
 *     summary: Get all subscriptions (admin)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
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
 *         description: All subscriptions
 *       403:
 *         description: Forbidden
 */
router.get('/admin/all', authorize('ADMIN', 'SUPPORT'), subscriptionController.getAllSubscriptions);

/**
 * @swagger
 * /subscriptions/admin/expiring:
 *   get:
 *     summary: Get expiring subscriptions (admin)
 *     tags: [Subscriptions]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: days
 *         schema:
 *           type: integer
 *           default: 3
 *         description: Number of days ahead to check
 *     responses:
 *       200:
 *         description: Expiring subscriptions
 *       403:
 *         description: Forbidden
 */
router.get('/admin/expiring', authorize('ADMIN', 'SUPPORT'), subscriptionController.getExpiringSubscriptions);

export default router;
