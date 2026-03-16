"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.transferSubscriptionSchema = exports.renewSubscriptionSchema = exports.subscriptionFilterSchema = exports.cancelSubscriptionSchema = exports.updateSubscriptionSchema = exports.createSubscriptionSchema = void 0;
const zod_1 = require("zod");
// Create subscription
exports.createSubscriptionSchema = zod_1.z.object({
    planId: zod_1.z.string().uuid('Invalid plan ID'),
    autoRenew: zod_1.z.boolean().default(true),
});
// Update subscription
exports.updateSubscriptionSchema = zod_1.z.object({
    planId: zod_1.z.string().uuid('Invalid plan ID').optional(),
    autoRenew: zod_1.z.boolean().optional(),
});
// Cancel subscription
exports.cancelSubscriptionSchema = zod_1.z.object({
    subscriptionId: zod_1.z.string().uuid('Invalid subscription ID'),
    reason: zod_1.z.string().min(10, 'Reason must be at least 10 characters').max(500).optional(),
    immediate: zod_1.z.boolean().default(false),
});
// Subscription filter
exports.subscriptionFilterSchema = zod_1.z.object({
    status: zod_1.z.enum(['ACTIVE', 'SUSPENDED', 'TERMINATED', 'PENDING_VERIFICATION']).optional(),
    type: zod_1.z.enum(['PREPAID', 'POSTPAID']).optional(),
    customerId: zod_1.z.string().uuid().optional(),
    planId: zod_1.z.string().uuid().optional(),
    expiringSoon: zod_1.z.boolean().optional(), // Subscriptions expiring within 3 days
    page: zod_1.z.number().int().positive().default(1),
    limit: zod_1.z.number().int().positive().max(100).default(20),
});
// Renew subscription
exports.renewSubscriptionSchema = zod_1.z.object({
    subscriptionId: zod_1.z.string().uuid('Invalid subscription ID'),
    paymentMethod: zod_1.z.enum(['MPESA', 'AIREL_MONEY', 'CASH', 'BANK_TRANSFER', 'CARD']),
});
// Transfer subscription
exports.transferSubscriptionSchema = zod_1.z.object({
    subscriptionId: zod_1.z.string().uuid('Invalid subscription ID'),
    toCustomerId: zod_1.z.string().uuid('Invalid customer ID'),
    reason: zod_1.z.string().min(10, 'Reason must be at least 10 characters').max(500),
});
//# sourceMappingURL=subscription.validator.js.map