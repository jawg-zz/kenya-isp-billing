"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const subscription_controller_1 = require("../controllers/subscription.controller");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const subscription_validator_1 = require("../validators/subscription.validator");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Customer routes
router.get('/', subscription_controller_1.subscriptionController.getSubscriptions);
router.get('/:id', subscription_controller_1.subscriptionController.getSubscription);
router.post('/', (0, validate_1.validate)(subscription_validator_1.createSubscriptionSchema), subscription_controller_1.subscriptionController.createSubscription);
router.post('/renew', subscription_controller_1.subscriptionController.renewSubscription);
router.post('/cancel', (0, validate_1.validate)(subscription_validator_1.cancelSubscriptionSchema), subscription_controller_1.subscriptionController.cancelSubscription);
router.put('/auto-renew', subscription_controller_1.subscriptionController.toggleAutoRenew);
// Admin routes
router.get('/admin/all', (0, auth_1.authorize)('ADMIN', 'SUPPORT'), subscription_controller_1.subscriptionController.getAllSubscriptions);
router.get('/admin/expiring', (0, auth_1.authorize)('ADMIN', 'SUPPORT'), subscription_controller_1.subscriptionController.getExpiringSubscriptions);
exports.default = router;
//# sourceMappingURL=subscription.routes.js.map