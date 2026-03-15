import { z } from 'zod';

// Plan price schema
const planPriceSchema = z.object({
  billingCycle: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  price: z.number().positive('Price must be positive'),
});

// Create plan
export const createPlanSchema = z.object({
  name: z.string()
    .min(3, 'Plan name must be at least 3 characters')
    .max(100, 'Plan name must not exceed 100 characters'),
  description: z.string().max(500).optional(),
  code: z.string()
    .min(2, 'Plan code must be at least 2 characters')
    .max(20, 'Plan code must not exceed 20 characters')
    .regex(/^[A-Z0-9_-]+$/, 'Plan code can only contain uppercase letters, numbers, underscores and hyphens'),
  type: z.enum(['PREPAID', 'POSTPAID']),
  dataType: z.enum(['DATA', 'VOICE', 'SMS', 'BUNDLE']).default('DATA'),
  price: z.number().positive('Price must be positive'),
  dataAllowance: z.number().int().positive().optional(), // In MB
  voiceMinutes: z.number().int().positive().optional(),
  smsAllowance: z.number().int().positive().optional(),
  speedLimit: z.number().positive().optional(), // In Mbps
  billingCycle: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']).optional(),
  validityDays: z.number().int().positive().max(365).default(30),
  fupThreshold: z.number().int().positive().optional(), // In MB
  fupSpeedLimit: z.number().positive().optional(), // In Mbps
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  prices: z.array(planPriceSchema).optional(),
});

// Update plan
export const updatePlanSchema = z.object({
  name: z.string().min(3).max(100).optional(),
  description: z.string().max(500).optional(),
  price: z.number().positive().optional(),
  dataAllowance: z.number().int().positive().nullable().optional(),
  voiceMinutes: z.number().int().positive().nullable().optional(),
  smsAllowance: z.number().int().positive().nullable().optional(),
  speedLimit: z.number().positive().nullable().optional(),
  validityDays: z.number().int().positive().max(365).optional(),
  fupThreshold: z.number().int().positive().nullable().optional(),
  fupSpeedLimit: z.number().positive().nullable().optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

// Plan filter
export const planFilterSchema = z.object({
  type: z.enum(['PREPAID', 'POSTPAID']).optional(),
  dataType: z.enum(['DATA', 'VOICE', 'SMS', 'BUNDLE']).optional(),
  isActive: z.boolean().optional(),
  isFeatured: z.boolean().optional(),
  minPrice: z.number().positive().optional(),
  maxPrice: z.number().positive().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type PlanFilterInput = z.infer<typeof planFilterSchema>;
