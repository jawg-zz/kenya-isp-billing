import { z } from 'zod';

// Create subscription
export const createSubscriptionSchema = z.object({
  planId: z.string().uuid('Invalid plan ID'),
  autoRenew: z.boolean().default(true),
});

// Update subscription
export const updateSubscriptionSchema = z.object({
  planId: z.string().uuid('Invalid plan ID').optional(),
  autoRenew: z.boolean().optional(),
});

// Cancel subscription
export const cancelSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid('Invalid subscription ID'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500).optional(),
  immediate: z.boolean().default(false),
});

// Subscription filter
export const subscriptionFilterSchema = z.object({
  status: z.enum(['ACTIVE', 'SUSPENDED', 'TERMINATED', 'PENDING_VERIFICATION']).optional(),
  type: z.enum(['PREPAID', 'POSTPAID']).optional(),
  customerId: z.string().uuid().optional(),
  planId: z.string().uuid().optional(),
  expiringSoon: z.boolean().optional(), // Subscriptions expiring within 3 days
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// Renew subscription
export const renewSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid('Invalid subscription ID'),
  paymentMethod: z.enum(['MPESA', 'AIREL_MONEY', 'CASH', 'BANK_TRANSFER', 'CARD']),
});

// Transfer subscription
export const transferSubscriptionSchema = z.object({
  subscriptionId: z.string().uuid('Invalid subscription ID'),
  toCustomerId: z.string().uuid('Invalid customer ID'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
});

export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
export type SubscriptionFilterInput = z.infer<typeof subscriptionFilterSchema>;
export type RenewSubscriptionInput = z.infer<typeof renewSubscriptionSchema>;
export type TransferSubscriptionInput = z.infer<typeof transferSubscriptionSchema>;
