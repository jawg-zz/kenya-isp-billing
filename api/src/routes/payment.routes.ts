import { Router, IRouter } from 'express';
import { paymentController } from '../controllers/payment.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { paymentRateLimiter } from '../middleware/rateLimiter';
import {
  validateMpesaIP,
  validateMpesaSignature,
  mpesaIdempotencyCheck,
} from '../middleware/mpesaValidation';
import {
  validateAirtelIP,
  validateAirtelAuth,
  validateAirtelIdempotency,
} from '../middleware/airtelCallbackAuth';
import {
  mpesaSTKPushSchema,
  airtelPaymentSchema,
  cashPaymentSchema,
} from '../validators/payment.validator';

const router: IRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Payments
 *   description: Payment processing (M-Pesa, Airtel Money, cash)
 */

// M-Pesa webhook callbacks — IP allowlist + signature verification + idempotency
router.post(
  '/mpesa/callback',
  validateMpesaIP,
  validateMpesaSignature,
  mpesaIdempotencyCheck,
  paymentController.mpesaCallback
);
router.post('/mpesa/timeout', validateMpesaIP, validateMpesaSignature, paymentController.mpesaTimeout);
router.post(
  '/airtel/callback',
  validateAirtelIP,
  validateAirtelAuth,
  validateAirtelIdempotency,
  paymentController.airtelCallback
);

// All other routes require authentication
router.use(authenticate);

/**
 * @swagger
 * /payments/mpesa/initiate:
 *   post:
 *     summary: Initiate M-Pesa STK Push payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/MpesaSTKPushRequest'
 *     responses:
 *       201:
 *         description: Payment initiated — check phone for M-Pesa prompt
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
 *                     paymentId:
 *                       type: string
 *                     checkoutRequestId:
 *                       type: string
 *                     customerMessage:
 *                       type: string
 *       400:
 *         description: Invalid amount
 *       404:
 *         description: Customer not found
 */
router.post('/mpesa/initiate', validate(mpesaSTKPushSchema), paymentController.initiateMpesaPayment);

/**
 * @swagger
 * /payments/mpesa/status/{paymentId}:
 *   get:
 *     summary: Check M-Pesa payment status
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: paymentId
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Payment status
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     payment:
 *                       $ref: '#/components/schemas/Payment'
 *       404:
 *         description: Payment not found
 */
router.get('/mpesa/status/:paymentId', paymentController.checkMpesaStatus);

/**
 * @swagger
 * /payments/airtel/initiate:
 *   post:
 *     summary: Initiate Airtel Money payment
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/AirtelPaymentRequest'
 *     responses:
 *       201:
 *         description: Payment initiated
 *       400:
 *         description: Invalid amount
 *       404:
 *         description: Customer not found
 */
router.post('/airtel/initiate', validate(airtelPaymentSchema), paymentController.initiateAirtelPayment);

/**
 * @swagger
 * /payments/history:
 *   get:
 *     summary: Get payment history
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [PENDING, COMPLETED, FAILED, REFUNDED, TIMEOUT]
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *           enum: [MPESA, AIREL_MONEY, CASH, BANK]
 *     responses:
 *       200:
 *         description: Paginated payment history
 */
router.get('/history', paymentController.getPaymentHistory);

/**
 * @swagger
 * /payments/stats:
 *   get:
 *     summary: Get payment statistics (admin)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *         description: Start date (YYYY-MM-DD). Defaults to 30 days ago.
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
 *         description: End date (YYYY-MM-DD). Defaults to today.
 *     responses:
 *       200:
 *         description: Payment statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/PaymentStats'
 *       403:
 *         description: Forbidden (admin only)
 */
router.get('/stats', authorize('ADMIN', 'SUPPORT'), paymentController.getPaymentStats);

/**
 * @swagger
 * /payments:
 *   get:
 *     summary: Get all payments (admin)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
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
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: method
 *         schema:
 *           type: string
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
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
 *     responses:
 *       200:
 *         description: Paginated payments list
 */
router.get('/', authorize('ADMIN', 'SUPPORT'), paymentController.getAllPayments);

/**
 * @swagger
 * /payments/cash:
 *   post:
 *     summary: Process cash payment (admin/agent)
 *     tags: [Payments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CashPaymentRequest'
 *     responses:
 *       201:
 *         description: Cash payment processed
 *       400:
 *         description: Invalid amount
 *       404:
 *         description: Customer not found
 */
router.post('/cash', authorize('ADMIN', 'SUPPORT'), validate(cashPaymentSchema), paymentController.processCashPayment);

/**
 * @swagger
 * /payments/{id}:
 *   get:
 *     summary: Get single payment details
 *     tags: [Payments]
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
 *         description: Payment details
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     payment:
 *                       $ref: '#/components/schemas/Payment'
 *       404:
 *         description: Payment not found
 */
router.get('/:id', paymentController.getPayment);

export default router;
