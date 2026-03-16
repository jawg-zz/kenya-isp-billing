"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planFilterSchema = exports.updatePlanSchema = exports.createPlanSchema = void 0;
const zod_1 = require("zod");
// Plan price schema
const planPriceSchema = zod_1.z.object({
    billingCycle: zod_1.z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
    price: zod_1.z.number().positive('Price must be positive'),
});
// Create plan
exports.createPlanSchema = zod_1.z.object({
    name: zod_1.z.string()
        .min(3, 'Plan name must be at least 3 characters')
        .max(100, 'Plan name must not exceed 100 characters'),
    description: zod_1.z.string().max(500).optional(),
    code: zod_1.z.string()
        .min(2, 'Plan code must be at least 2 characters')
        .max(20, 'Plan code must not exceed 20 characters')
        .regex(/^[A-Z0-9_-]+$/, 'Plan code can only contain uppercase letters, numbers, underscores and hyphens'),
    type: zod_1.z.enum(['PREPAID', 'POSTPAID']),
    dataType: zod_1.z.enum(['DATA', 'VOICE', 'SMS', 'BUNDLE']).default('DATA'),
    price: zod_1.z.number().positive('Price must be positive'),
    dataAllowance: zod_1.z.number().int().positive().optional(), // In MB
    voiceMinutes: zod_1.z.number().int().positive().optional(),
    smsAllowance: zod_1.z.number().int().positive().optional(),
    speedLimit: zod_1.z.number().positive().optional(), // In Mbps
    billingCycle: zod_1.z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
    validityDays: zod_1.z.number().int().positive().max(365).default(30),
    fupThreshold: zod_1.z.number().int().positive().optional(), // In MB
    fupSpeedLimit: zod_1.z.number().positive().optional(), // In Mbps
    isFeatured: zod_1.z.boolean().default(false),
    sortOrder: zod_1.z.number().int().default(0),
    prices: zod_1.z.array(planPriceSchema).optional(),
});
// Update plan
exports.updatePlanSchema = zod_1.z.object({
    name: zod_1.z.string().min(3).max(100).optional(),
    description: zod_1.z.string().max(500).optional(),
    price: zod_1.z.number().positive().optional(),
    dataAllowance: zod_1.z.number().int().positive().nullable().optional(),
    voiceMinutes: zod_1.z.number().int().positive().nullable().optional(),
    smsAllowance: zod_1.z.number().int().positive().nullable().optional(),
    speedLimit: zod_1.z.number().positive().nullable().optional(),
    validityDays: zod_1.z.number().int().positive().max(365).optional(),
    fupThreshold: zod_1.z.number().int().positive().nullable().optional(),
    fupSpeedLimit: zod_1.z.number().positive().nullable().optional(),
    isActive: zod_1.z.boolean().optional(),
    isFeatured: zod_1.z.boolean().optional(),
    sortOrder: zod_1.z.number().int().optional(),
});
// Plan filter
exports.planFilterSchema = zod_1.z.object({
    type: zod_1.z.enum(['PREPAID', 'POSTPAID']).optional(),
    dataType: zod_1.z.enum(['DATA', 'VOICE', 'SMS', 'BUNDLE']).optional(),
    isActive: zod_1.z.boolean().optional(),
    isFeatured: zod_1.z.boolean().optional(),
    minPrice: zod_1.z.number().positive().optional(),
    maxPrice: zod_1.z.number().positive().optional(),
    page: zod_1.z.number().int().positive().default(1),
    limit: zod_1.z.number().int().positive().max(100).default(20),
});
//# sourceMappingURL=plan.validator.js.map