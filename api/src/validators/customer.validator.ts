import { z } from 'zod';

// Phone number validation
const phoneSchema = z.string()
  .regex(/^(\+254|0)[17]\d{8}$/, 'Invalid Kenyan phone number format');

// Create customer (admin)
export const createCustomerSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  firstName: z.string().min(2).max(50),
  lastName: z.string().min(2).max(50),
  phone: phoneSchema,
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  postalCode: z.string().optional(),
  idNumber: z.string().regex(/^\d{8}$/).optional(),
  kraPin: z.string().regex(/^[A-Z]{1}\d{9}[A-Z]{1}$/).optional(),
  creditLimit: z.number().min(0).default(0),
  notes: z.string().max(500).optional(),
});

// Update customer (admin)
export const updateCustomerSchema = z.object({
  firstName: z.string().min(2).max(50).optional(),
  lastName: z.string().min(2).max(50).optional(),
  phone: phoneSchema.optional(),
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  county: z.string().optional(),
  postalCode: z.string().optional(),
  idNumber: z.string().regex(/^\d{8}$/).optional(),
  kraPin: z.string().regex(/^[A-Z]{1}\d{9}[A-Z]{1}$/).optional(),
  creditLimit: z.number().min(0).optional(),
  accountStatus: z.enum(['ACTIVE', 'SUSPENDED', 'TERMINATED', 'PENDING_VERIFICATION']).optional(),
  notes: z.string().max(500).optional(),
});

// Customer filter
export const customerFilterSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'TERMINATED', 'PENDING_VERIFICATION']).optional(),
  county: z.string().optional(),
  networkProvider: z.enum(['SAFARICOM', 'AIRTEL', 'TELKOM', 'OTHER']).optional(),
  search: z.string().optional(), // Search by name, email, phone, customer code
  hasActiveSubscription: z.boolean().optional(),
  sortBy: z.enum(['createdAt', 'firstName', 'lastName', 'accountNumber']).default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// Adjust customer balance
export const adjustBalanceSchema = z.object({
  amount: z.number().refine((val) => val !== 0, 'Amount cannot be zero'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
  type: z.enum(['CREDIT', 'DEBIT']),
});

// Add customer notes
export const addCustomerNotesSchema = z.object({
  notes: z.string().min(1, 'Notes cannot be empty').max(1000),
  isInternal: z.boolean().default(false),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerFilterInput = z.infer<typeof customerFilterSchema>;
export type AdjustBalanceInput = z.infer<typeof adjustBalanceSchema>;
export type AddCustomerNotesInput = z.infer<typeof addCustomerNotesSchema>;
