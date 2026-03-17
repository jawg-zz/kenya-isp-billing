import { z } from 'zod';
import {
  trimmedString,
  optionalTrimmedString,
  positiveDecimal,
  nonNegativeInt,
  positiveInt,
  uuidSchema,
} from './common';

// Plan price schema
const planPriceSchema = z.object({
  billingCycle: z.enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY']),
  price: positiveDecimal('Price', { min: 0.01 }),
});

// Create plan
export const createPlanSchema = z.object({
  name: trimmedString(3, 100, 'Plan name'),
  description: optionalTrimmedString(500),
  code: z
    .string()
    .trim()
    .min(2, 'Plan code must be at least 2 characters')
    .max(20, 'Plan code must not exceed 20 characters')
    .regex(
      /^[A-Z0-9_-]+$/,
      'Plan code can only contain uppercase letters, numbers, underscores and hyphens'
    ),
  type: z.enum(['PREPAID', 'POSTPAID']),
  dataType: z.enum(['DATA', 'VOICE', 'SMS', 'BUNDLE']).default('DATA'),
  price: positiveDecimal('Price', { min: 0.01 }),
  currency: z.string().trim().length(3, 'Currency must be a 3-letter ISO code').default('KES'),
  dataAllowance: z
    .number()
    .int()
    .nonnegative('Data allowance cannot be negative')
    .optional(),
  voiceMinutes: z
    .number()
    .int()
    .nonnegative('Voice minutes cannot be negative')
    .optional(),
  smsAllowance: z
    .number()
    .int()
    .nonnegative('SMS allowance cannot be negative')
    .optional(),
  speedLimit: z
    .number()
    .positive('Speed limit must be positive')
    .optional(),
  billingCycle: z
    .enum(['WEEKLY', 'MONTHLY', 'QUARTERLY', 'YEARLY'])
    .optional(),
  validityDays: z
    .number()
    .int()
    .positive('Validity days must be positive')
    .max(365, 'Validity days cannot exceed 365')
    .default(30),
  fupThreshold: z
    .number()
    .int()
    .nonnegative('FUP threshold cannot be negative')
    .optional(),
  fupSpeedLimit: z
    .number()
    .positive('FUP speed limit must be positive')
    .optional(),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false),
  sortOrder: z.number().int().default(0),
  prices: z.array(planPriceSchema).optional(),
});

// Update plan
export const updatePlanSchema = z
  .object({
    name: trimmedString(3, 100, 'Plan name').optional(),
    description: optionalTrimmedString(500),
    price: positiveDecimal('Price', { min: 0.01 }).optional(),
    currency: z.string().trim().length(3, 'Currency must be a 3-letter ISO code').optional(),
    dataAllowance: z
      .number()
      .int()
      .nonnegative('Data allowance cannot be negative')
      .nullable()
      .optional(),
    voiceMinutes: z
      .number()
      .int()
      .nonnegative('Voice minutes cannot be negative')
      .nullable()
      .optional(),
    smsAllowance: z
      .number()
      .int()
      .nonnegative('SMS allowance cannot be negative')
      .nullable()
      .optional(),
    speedLimit: z
      .number()
      .positive('Speed limit must be positive')
      .nullable()
      .optional(),
    validityDays: z
      .number()
      .int()
      .positive('Validity days must be positive')
      .max(365, 'Validity days cannot exceed 365')
      .optional(),
    fupThreshold: z
      .number()
      .int()
      .nonnegative('FUP threshold cannot be negative')
      .nullable()
      .optional(),
    fupSpeedLimit: z
      .number()
      .positive('FUP speed limit must be positive')
      .nullable()
      .optional(),
    isActive: z.boolean().optional(),
    isFeatured: z.boolean().optional(),
    sortOrder: z.number().int().optional(),
  })
  .refine(
    (data) => {
      // If fupSpeedLimit is set, fupThreshold should also be set
      if (data.fupSpeedLimit !== undefined && data.fupSpeedLimit !== null) {
        return data.fupThreshold !== undefined && data.fupThreshold !== null;
      }
      return true;
    },
    {
      message: 'FUP threshold is required when FUP speed limit is set',
      path: ['fupThreshold'],
    }
  );

// Plan filter
export const planFilterSchema = z.object({
  type: z.enum(['PREPAID', 'POSTPAID']).optional(),
  dataType: z.enum(['DATA', 'VOICE', 'SMS', 'BUNDLE']).optional(),
  isActive: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    })
    .optional(),
  isFeatured: z
    .union([z.boolean(), z.string()])
    .transform((val) => {
      if (typeof val === 'boolean') return val;
      if (val === 'true') return true;
      if (val === 'false') return false;
      return undefined;
    })
    .optional(),
  minPrice: z.coerce.number().positive().optional(),
  maxPrice: z.coerce.number().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type PlanFilterInput = z.infer<typeof planFilterSchema>;
