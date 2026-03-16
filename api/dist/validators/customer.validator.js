"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.addCustomerNotesSchema = exports.adjustBalanceSchema = exports.customerFilterSchema = exports.updateCustomerSchema = exports.createCustomerSchema = void 0;
const zod_1 = require("zod");
// Phone number validation
const phoneSchema = zod_1.z.string()
    .regex(/^(\+254|0)[17]\d{8}$/, 'Invalid Kenyan phone number format');
// Create customer (admin)
exports.createCustomerSchema = zod_1.z.object({
    email: zod_1.z.string().email('Invalid email address'),
    password: zod_1.z.string()
        .min(8, 'Password must be at least 8 characters')
        .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
        .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
        .regex(/[0-9]/, 'Password must contain at least one number'),
    firstName: zod_1.z.string().min(2).max(50),
    lastName: zod_1.z.string().min(2).max(50),
    phone: phoneSchema,
    addressLine1: zod_1.z.string().optional(),
    addressLine2: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    county: zod_1.z.string().optional(),
    postalCode: zod_1.z.string().optional(),
    idNumber: zod_1.z.string().regex(/^\d{8}$/).optional(),
    kraPin: zod_1.z.string().regex(/^[A-Z]{1}\d{9}[A-Z]{1}$/).optional(),
    creditLimit: zod_1.z.number().min(0).default(0),
    notes: zod_1.z.string().max(500).optional(),
});
// Update customer (admin)
exports.updateCustomerSchema = zod_1.z.object({
    firstName: zod_1.z.string().min(2).max(50).optional(),
    lastName: zod_1.z.string().min(2).max(50).optional(),
    phone: phoneSchema.optional(),
    addressLine1: zod_1.z.string().optional(),
    addressLine2: zod_1.z.string().optional(),
    city: zod_1.z.string().optional(),
    county: zod_1.z.string().optional(),
    postalCode: zod_1.z.string().optional(),
    idNumber: zod_1.z.string().regex(/^\d{8}$/).optional(),
    kraPin: zod_1.z.string().regex(/^[A-Z]{1}\d{9}[A-Z]{1}$/).optional(),
    creditLimit: zod_1.z.number().min(0).optional(),
    accountStatus: zod_1.z.enum(['ACTIVE', 'SUSPENDED', 'TERMINATED', 'PENDING_VERIFICATION']).optional(),
    notes: zod_1.z.string().max(500).optional(),
});
// Customer filter
exports.customerFilterSchema = zod_1.z.object({
    status: zod_1.z.enum(['ACTIVE', 'SUSPENDED', 'TERMINATED', 'PENDING_VERIFICATION']).optional(),
    county: zod_1.z.string().optional(),
    networkProvider: zod_1.z.enum(['SAFARICOM', 'AIRTEL', 'TELKOM', 'OTHER']).optional(),
    search: zod_1.z.string().optional(), // Search by name, email, phone, customer code
    hasActiveSubscription: zod_1.z.boolean().optional(),
    sortBy: zod_1.z.enum(['createdAt', 'firstName', 'lastName', 'accountNumber']).default('createdAt'),
    sortOrder: zod_1.z.enum(['asc', 'desc']).default('desc'),
    page: zod_1.z.number().int().positive().default(1),
    limit: zod_1.z.number().int().positive().max(100).default(20),
});
// Adjust customer balance
exports.adjustBalanceSchema = zod_1.z.object({
    amount: zod_1.z.number().refine((val) => val !== 0, 'Amount cannot be zero'),
    reason: zod_1.z.string().min(10, 'Reason must be at least 10 characters').max(500),
    type: zod_1.z.enum(['CREDIT', 'DEBIT']),
});
// Add customer notes
exports.addCustomerNotesSchema = zod_1.z.object({
    notes: zod_1.z.string().min(1, 'Notes cannot be empty').max(1000),
    isInternal: zod_1.z.boolean().default(false),
});
//# sourceMappingURL=customer.validator.js.map