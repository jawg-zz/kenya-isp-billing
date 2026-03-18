import { z } from 'zod';
import {
  uuidSchema,
  optionalTrimmedString,
  trimmedString,
} from './common';

// Create subscription (customer context — customerId comes from auth)
export const createSubscriptionSchema = z.object({
  planId: uuidSchema,
  type: z.enum(['PREPAID', 'POSTPAID']),
  autoRenew: z.boolean().default(true),
  startDate: z.string().datetime().optional(),
});

// Admin create subscription (explicit customer)
export const adminCreateSubscriptionSchema = z
  .object({
    customerId: uuidSchema,
    planId: uuidSchema,
    type: z.enum(['PREPAID', 'POSTPAID']),
    startDate: z.string().datetime().optional(),
    endDate: z.string().datetime().optional(),
    autoRenew: z.boolean().default(true),
  })
  .refine(
    (data) => {
      if (data.startDate && data.endDate) {
        return new Date(data.startDate) < new Date(data.endDate);
      }
      return true;
    },
    {
      message: 'Start date must be before end date',
      path: ['endDate'],
    }
  );

// Update subscription
export const updateSubscriptionSchema = z.object({
  planId: uuidSchema.optional(),
  autoRenew: z.boolean().optional(),
});

// Cancel subscription
export const cancelSubscriptionSchema = z.object({
  subscriptionId: uuidSchema,
  reason: optionalTrimmedString(500),
  immediate: z.boolean().default(false),
});

// Subscription filter
export const subscriptionFilterSchema = z.object({
  status: z
    .enum(['ACTIVE', 'SUSPENDED', 'TERMINATED', 'PENDING_VERIFICATION'])
    .optional(),
  type: z.enum(['PREPAID', 'POSTPAID']).optional(),
  customerId: uuidSchema.optional(),
  planId: uuidSchema.optional(),
  expiringSoon: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    })
    .optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Renew subscription
export const renewSubscriptionSchema = z.object({
  subscriptionId: uuidSchema,
  paymentMethod: z.enum([
    'MPESA',
    'AIRTEL_MONEY',
    'CASH',
    'BANK_TRANSFER',
    'CARD',
    'BALANCE',
  ]),
});

// Transfer subscription
export const transferSubscriptionSchema = z.object({
  subscriptionId: uuidSchema,
  toCustomerId: uuidSchema,
  reason: trimmedString(10, 500, 'Reason'),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type AdminCreateSubscriptionInput = z.infer<typeof adminCreateSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
export type SubscriptionFilterInput = z.infer<typeof subscriptionFilterSchema>;
export type RenewSubscriptionInput = z.infer<typeof renewSubscriptionSchema>;
export type TransferSubscriptionInput = z.infer<typeof transferSubscriptionSchema>;
