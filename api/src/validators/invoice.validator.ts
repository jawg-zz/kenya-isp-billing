import { z } from 'zod';
import {
  uuidSchema,
  futureDateSchema,
  optionalTrimmedString,
  positiveDecimal,
} from './common';

// Create manual invoice (admin)
export const createInvoiceSchema = z.object({
  customerId: uuidSchema,
  subscriptionId: uuidSchema.optional(),
  items: z
    .array(
      z.object({
        description: z.string().trim().min(1, 'Description is required').max(200),
        quantity: z.number().int().positive('Quantity must be positive'),
        unitPrice: positiveDecimal('Unit price', { min: 0.01 }),
      })
    )
    .min(1, 'At least one item is required')
    .max(50, 'Cannot have more than 50 line items'),
  dueDate: futureDateSchema.optional(),
  notes: optionalTrimmedString(1000),
});

// Invoice filter
export const invoiceFilterSchema = z.object({
  status: z
    .enum(['DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED'])
    .optional(),
  customerId: uuidSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minAmount: z.coerce.number().positive().optional(),
  maxAmount: z.coerce.number().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Update invoice status
export const updateInvoiceStatusSchema = z.object({
  status: z.enum([
    'DRAFT',
    'PENDING',
    'PAID',
    'OVERDUE',
    'CANCELLED',
    'REFUNDED',
  ]),
  notes: optionalTrimmedString(1000),
});

// Send invoice via email
export const sendInvoiceSchema = z.object({
  invoiceId: uuidSchema,
  email: z
    .string()
    .email('Invalid email address')
    .trim()
    .toLowerCase()
    .optional(),
  sendSms: z.boolean().default(true),
});

// Generate bulk invoices (admin)
export const generateBulkInvoicesSchema = z
  .object({
    customerId: uuidSchema.optional(),
    subscriptionIds: z.array(uuidSchema).max(100).optional(),
    billingDate: z.string().datetime().optional(),
    dueDays: z
      .number()
      .int()
      .positive('Due days must be positive')
      .max(90, 'Due days cannot exceed 90')
      .default(30),
  })
  .refine(
    (data) => data.customerId || data.subscriptionIds?.length,
    {
      message: 'Either customerId or subscriptionIds must be provided',
      path: ['customerId'],
    }
  );

// Bulk status update
export const bulkInvoiceStatusSchema = z.object({
  invoiceIds: z
    .array(uuidSchema)
    .min(1, 'At least one invoice ID is required')
    .max(100, 'Cannot update more than 100 invoices at once'),
  status: z.enum(['DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']),
  notes: optionalTrimmedString(1000),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type InvoiceFilterInput = z.infer<typeof invoiceFilterSchema>;
export type UpdateInvoiceStatusInput = z.infer<typeof updateInvoiceStatusSchema>;
export type SendInvoiceInput = z.infer<typeof sendInvoiceSchema>;
export type GenerateBulkInvoicesInput = z.infer<typeof generateBulkInvoicesSchema>;
export type BulkInvoiceStatusInput = z.infer<typeof bulkInvoiceStatusSchema>;
