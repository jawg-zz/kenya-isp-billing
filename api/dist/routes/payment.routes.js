"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const payment_controller_1 = require("../controllers/payment.controller");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const rateLimiter_1 = require("../middleware/rateLimiter");
const mpesaValidation_1 = require("../middleware/mpesaValidation");
const payment_validator_1 = require("../validators/payment.validator");
const router = (0, express_1.Router)();
// M-Pesa webhook callbacks - IP allowlist + signature verification + idempotency
router.post('/mpesa/callback', mpesaValidation_1.validateMpesaIP, mpesaValidation_1.validateMpesaSignature, mpesaValidation_1.mpesaIdempotencyCheck, payment_controller_1.paymentController.mpesaCallback);
router.post('/mpesa/timeout', mpesaValidation_1.validateMpesaIP, mpesaValidation_1.validateMpesaSignature, payment_controller_1.paymentController.mpesaTimeout);
router.post('/airtel/callback', payment_controller_1.paymentController.airtelCallback);
// All other routes require authentication
router.use(auth_1.authenticate);
// Customer payment routes
router.post('/mpesa/initiate', rateLimiter_1.paymentRateLimiter, (0, validate_1.validate)(payment_validator_1.mpesaSTKPushSchema), payment_controller_1.paymentController.initiateMpesaPayment);
router.get('/mpesa/status/:paymentId', payment_controller_1.paymentController.checkMpesaStatus);
router.post('/airtel/initiate', rateLimiter_1.paymentRateLimiter, (0, validate_1.validate)(payment_validator_1.airtelPaymentSchema), payment_controller_1.paymentController.initiateAirtelPayment);
router.get('/history', payment_controller_1.paymentController.getPaymentHistory);
router.get('/:id', payment_controller_1.paymentController.getPayment);
// Admin routes
router.get('/', (0, auth_1.authorize)('ADMIN', 'SUPPORT'), payment_controller_1.paymentController.getAllPayments);
router.post('/cash', (0, auth_1.authorize)('ADMIN', 'SUPPORT'), (0, validate_1.validate)(payment_validator_1.cashPaymentSchema), payment_controller_1.paymentController.processCashPayment);
router.get('/stats', (0, auth_1.authorize)('ADMIN', 'SUPPORT'), payment_controller_1.paymentController.getPaymentStats);
exports.default = router;
//# sourceMappingURL=payment.routes.js.map