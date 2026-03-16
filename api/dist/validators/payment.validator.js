"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bankTransferSchema = exports.cashPaymentSchema = exports.refundPaymentSchema = exports.paymentFilterSchema = exports.verifyPaymentSchema = exports.airtelPaymentSchema = exports.mpesaSTKPushSchema = void 0;
const zod_1 = require("zod");
// Phone number validation (Kenyan format)
const phoneSchema = zod_1.z.string()
    .regex(/^(\+254|0)[17]\d{8}$/, 'Invalid Kenyan phone number format');
// M-Pesa STK Push request
exports.mpesaSTKPushSchema = zod_1.z.object({
    phoneNumber: phoneSchema,
    amount: zod_1.z.number()
        .positive('Amount must be positive')
        .min(1, 'Minimum amount is KES 1')
        .max(150000, 'Maximum amount is KES 150,000'),
    accountReference: zod_1.z.string()
        .min(1, 'Account reference is required')
        .max(20, 'Account reference must not exceed 20 characters'),
    transactionDesc: zod_1.z.string()
        .min(1, 'Transaction description is required')
        .max(100, 'Transaction description must not exceed 100 characters'),
});
// Airtel Money payment request
exports.airtelPaymentSchema = zod_1.z.object({
    phoneNumber: phoneSchema,
    amount: zod_1.z.number()
        .positive('Amount must be positive')
        .min(1, 'Minimum amount is KES 1')
        .max(150000, 'Maximum amount is KES 150,000'),
    reference: zod_1.z.string()
        .min(1, 'Reference is required')
        .max(50, 'Reference must not exceed 50 characters'),
    description: zod_1.z.string()
        .max(200, 'Description must not exceed 200 characters')
        .optional(),
});
// Payment verification
exports.verifyPaymentSchema = zod_1.z.object({
    checkoutRequestId: zod_1.z.string().optional(),
    merchantRequestId: zod_1.z.string().optional(),
    reference: zod_1.z.string().optional(),
}).refine((data) => data.checkoutRequestId || data.merchantRequestId || data.reference, { message: 'At least one identifier is required' });
// Payment filter for admin
exports.paymentFilterSchema = zod_1.z.object({
    status: zod_1.z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'TIMEOUT']).optional(),
    method: zod_1.z.enum(['MPESA', 'AIREL_MONEY', 'CASH', 'BANK_TRANSFER', 'CARD']).optional(),
    customerId: zod_1.z.string().uuid().optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    minAmount: zod_1.z.number().positive().optional(),
    maxAmount: zod_1.z.number().positive().optional(),
    page: zod_1.z.number().int().positive().default(1),
    limit: zod_1.z.number().int().positive().max(100).default(20),
});
// Refund payment
exports.refundPaymentSchema = zod_1.z.object({
    paymentId: zod_1.z.string().uuid('Invalid payment ID'),
    reason: zod_1.z.string().min(10, 'Reason must be at least 10 characters').max(500),
});
// Cash payment (for agents)
exports.cashPaymentSchema = zod_1.z.object({
    customerId: zod_1.z.string().uuid('Invalid customer ID'),
    amount: zod_1.z.number()
        .positive('Amount must be positive')
        .min(1, 'Minimum amount is KES 1'),
    reference: zod_1.z.string().min(1, 'Reference is required'),
    notes: zod_1.z.string().max(500).optional(),
});
// Bank transfer payment
exports.bankTransferSchema = zod_1.z.object({
    amount: zod_1.z.number()
        .positive('Amount must be positive')
        .min(100, 'Minimum amount for bank transfer is KES 100'),
    bankName: zod_1.z.string().min(1, 'Bank name is required'),
    accountNumber: zod_1.z.string().min(1, 'Account number is required'),
    reference: zod_1.z.string().min(1, 'Transaction reference is required'),
    notes: zod_1.z.string().max(500).optional(),
});
//# sourceMappingURL=payment.validator.js.map