import { Router } from 'express';
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
  mpesaSTKPushSchema,
  airtelPaymentSchema,
  cashPaymentSchema,
} from '../validators/payment.validator';

const router = Router();

// M-Pesa webhook callbacks - IP allowlist + signature verification + idempotency
router.post(
  '/mpesa/callback',
  validateMpesaIP,
  validateMpesaSignature,
  mpesaIdempotencyCheck,
  paymentController.mpesaCallback
);
router.post('/mpesa/timeout', validateMpesaIP, validateMpesaSignature, paymentController.mpesaTimeout);
router.post('/airtel/callback', paymentController.airtelCallback);

// All other routes require authentication
router.use(authenticate);

// Customer payment routes
router.post('/mpesa/initiate', paymentRateLimiter, validate(mpesaSTKPushSchema), paymentController.initiateMpesaPayment);
router.get('/mpesa/status/:paymentId', paymentController.checkMpesaStatus);
router.post('/airtel/initiate', paymentRateLimiter, validate(airtelPaymentSchema), paymentController.initiateAirtelPayment);
router.get('/history', paymentController.getPaymentHistory);
router.get('/:id', paymentController.getPayment);

// Admin routes
router.get('/', authorize('ADMIN', 'SUPPORT'), paymentController.getAllPayments);
router.post('/cash', authorize('ADMIN', 'SUPPORT'), validate(cashPaymentSchema), paymentController.processCashPayment);
router.get('/stats', authorize('ADMIN', 'SUPPORT'), paymentController.getPaymentStats);

export default router;
