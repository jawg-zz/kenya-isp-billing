import { z } from 'zod';

// Create manual invoice (admin)
export const createInvoiceSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  subscriptionId: z.string().uuid('Invalid subscription ID').optional(),
  items: z.array(z.object({
    description: z.string().min(1, 'Description is required'),
    quantity: z.number().int().positive('Quantity must be positive'),
    unitPrice: z.number().positive('Unit price must be positive'),
  })).min(1, 'At least one item is required'),
  dueDate: z.string().datetime().optional(),
  notes: z.string().max(1000).optional(),
});

// Invoice filter
export const invoiceFilterSchema = z.object({
  status: z.enum(['DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']).optional(),
  customerId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minAmount: z.number().positive().optional(),
  maxAmount: z.number().positive().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// Update invoice status
export const updateInvoiceStatusSchema = z.object({
  status: z.enum(['DRAFT', 'PENDING', 'PAID', 'OVERDUE', 'CANCELLED', 'REFUNDED']),
  notes: z.string().max(1000).optional(),
});

// Send invoice via email
export const sendInvoiceSchema = z.object({
  invoiceId: z.string().uuid('Invalid invoice ID'),
  email: z.string().email('Invalid email address').optional(),
  sendSms: z.boolean().default(true),
});

// Generate bulk invoices (admin)
export const generateBulkInvoicesSchema = z.object({
  customerId: z.string().uuid().optional(),
  subscriptionIds: z.array(z.string().uuid()).optional(),
  billingDate: z.string().datetime().optional(),
  dueDays: z.number().int().positive().max(90).default(30),
});

export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type InvoiceFilterInput = z.infer<typeof invoiceFilterSchema>;
export type UpdateInvoiceStatusInput = z.infer<typeof updateInvoiceStatusSchema>;
export type SendInvoiceInput = z.infer<typeof sendInvoiceSchema>;
export type GenerateBulkInvoicesInput = z.infer<typeof generateBulkInvoicesSchema>;
