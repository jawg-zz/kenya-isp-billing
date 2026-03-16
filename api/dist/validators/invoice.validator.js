"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateBulkInvoicesSchema = exports.sendInvoiceSchema = exports.updateInvoiceStatusSchema = exports.invoiceFilterSchema = exports.createInvoiceSchema = void 0;
const zod_1 = require("zod");
// Create manual invoice (admin)
exports.createInvoiceSchema = zod_1.z.object({
    customerId: zod_1.z.string().uuid('Invalid customer ID'),
    subscriptionId: zod_1.z.string().uuid('Invalid subscription ID').optional(),
    items: zod_1.z.array(zod_1.z.object({
        description: zod_1.z.string().min(1, 'Description is required'),
        quantity: zod_1.z.number().int().positive('Quantity must be positive'),
        unitPrice: zod_1.z.number().positive('Unit price must be positive'),
    })).min(1, 'At least one item is required'),
    dueDate: zod_1.z.string().datetime().optional(),
    notes: zod_1.z.string().max(1000).optional(),
});
// Invoice filter
exports.invoiceFilterSchema = zod_1.z.object({
    status: zod_1.z.enum(['DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']).optional(),
    customerId: zod_1.z.string().uuid().optional(),
    startDate: zod_1.z.string().datetime().optional(),
    endDate: zod_1.z.string().datetime().optional(),
    minAmount: zod_1.z.number().positive().optional(),
    maxAmount: zod_1.z.number().positive().optional(),
    page: zod_1.z.number().int().positive().default(1),
    limit: zod_1.z.number().int().positive().max(100).default(20),
});
// Update invoice status
exports.updateInvoiceStatusSchema = zod_1.z.object({
    status: zod_1.z.enum(['DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']),
    notes: zod_1.z.string().max(1000).optional(),
});
// Send invoice via email
exports.sendInvoiceSchema = zod_1.z.object({
    invoiceId: zod_1.z.string().uuid('Invalid invoice ID'),
    email: zod_1.z.string().email('Invalid email address').optional(),
    sendSms: zod_1.z.boolean().default(true),
});
// Generate bulk invoices (admin)
exports.generateBulkInvoicesSchema = zod_1.z.object({
    customerId: zod_1.z.string().uuid().optional(),
    subscriptionIds: zod_1.z.array(zod_1.z.string().uuid()).optional(),
    billingDate: zod_1.z.string().datetime().optional(),
    dueDays: zod_1.z.number().int().positive().max(90).default(30),
});
//# sourceMappingURL=invoice.validator.js.map