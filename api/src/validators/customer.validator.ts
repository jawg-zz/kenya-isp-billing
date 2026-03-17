import { z } from 'zod';
import {
  emailSchema,
  phoneInputSchema,
  passwordSchema,
  trimmedString,
  optionalTrimmedString,
  countySchema,
  idNumberSchema,
  kraPinSchema,
  uuidSchema,
  positiveDecimal,
} from './common';

// Create customer (admin)
export const createCustomerSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  firstName: trimmedString(2, 50, 'First name'),
  lastName: trimmedString(2, 50, 'Last name'),
  phone: phoneInputSchema,
  addressLine1: optionalTrimmedString(200),
  addressLine2: optionalTrimmedString(200),
  city: optionalTrimmedString(100),
  county: countySchema.optional(),
  postalCode: z.string().trim().max(10).optional(),
  idNumber: idNumberSchema.optional(),
  kraPin: kraPinSchema.optional(),
  creditLimit: z
    .number()
    .nonnegative('Credit limit cannot be negative')
    .default(0),
  notes: optionalTrimmedString(500),
});

// Update customer (admin)
export const updateCustomerSchema = z.object({
  firstName: trimmedString(2, 50, 'First name').optional(),
  lastName: trimmedString(2, 50, 'Last name').optional(),
  phone: phoneInputSchema.optional(),
  addressLine1: optionalTrimmedString(200),
  addressLine2: optionalTrimmedString(200),
  city: optionalTrimmedString(100),
  county: countySchema.optional(),
  postalCode: z.string().trim().max(10).optional(),
  idNumber: idNumberSchema.optional(),
  kraPin: kraPinSchema.optional(),
  creditLimit: z.number().nonnegative('Credit limit cannot be negative').optional(),
  accountStatus: z
    .enum(['ACTIVE', 'SUSPENDED', 'TERMINATED', 'PENDING_VERIFICATION'])
    .optional(),
  notes: optionalTrimmedString(500),
});

// Customer filter
export const customerFilterSchema = z.object({
  status: z
    .enum(['ACTIVE', 'SUSPENDED', 'TERMINATED', 'PENDING_VERIFICATION'])
    .optional(),
  county: countySchema.optional(),
  networkProvider: z.enum(['SAFARICOM', 'AIRTEL', 'TELKOM', 'OTHER']).optional(),
  search: z.string().trim().optional(),
  hasActiveSubscription: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    })
    .optional(),
  sortBy: z
    .enum(['createdAt', 'firstName', 'lastName', 'accountNumber'])
    .default('createdAt'),
  sortOrder: z.enum(['asc', 'desc']).default('desc'),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Adjust customer balance
export const adjustBalanceSchema = z.object({
  amount: z.number().refine((val) => val !== 0, 'Amount cannot be zero'),
  reason: trimmedString(10, 500, 'Reason'),
  type: z.enum(['CREDIT', 'DEBIT']),
});

// Add customer notes
export const addCustomerNotesSchema = z.object({
  notes: trimmedString(1, 1000, 'Notes'),
  isInternal: z.boolean().default(false),
});

export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerFilterInput = z.infer<typeof customerFilterSchema>;
export type AdjustBalanceInput = z.infer<typeof adjustBalanceSchema>;
export type AddCustomerNotesInput = z.infer<typeof addCustomerNotesSchema>;
