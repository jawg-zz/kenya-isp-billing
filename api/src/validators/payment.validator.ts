import { z } from 'zod';
import {
  phoneInputSchema,
  uuidSchema,
  optionalTrimmedString,
  trimmedString,
} from './common';

// M-Pesa STK Push request
export const mpesaSTKPushSchema = z.object({
  phoneNumber: phoneInputSchema,
  amount: z
    .number()
    .positive('Amount must be positive')
    .min(1, 'Minimum amount is KES 1')
    .max(150000, 'Maximum amount is KES 150,000'),
  accountReference: trimmedString(1, 20, 'Account reference').optional(),
  transactionDesc: trimmedString(1, 100, 'Transaction description').optional(),
});

// Airtel Money payment request
export const airtelPaymentSchema = z.object({
  phoneNumber: phoneInputSchema,
  amount: z
    .number()
    .positive('Amount must be positive')
    .min(1, 'Minimum amount is KES 1')
    .max(150000, 'Maximum amount is KES 150,000'),
  reference: trimmedString(1, 50, 'Reference'),
  description: optionalTrimmedString(200),
});

// Payment verification
export const verifyPaymentSchema = z
  .object({
    checkoutRequestId: z.string().trim().optional(),
    merchantRequestId: z.string().trim().optional(),
    reference: z.string().trim().optional(),
  })
  .refine(
    (data) =>
      !!(data.checkoutRequestId || data.merchantRequestId || data.reference),
    {
      message:
        'At least one identifier is required (checkoutRequestId, merchantRequestId, or reference)',
      path: ['checkoutRequestId'],
    }
  );

// Payment filter for admin
export const paymentFilterSchema = z.object({
  status: z
    .enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'TIMEOUT'])
    .optional(),
  method: z
    .enum(['MPESA', 'AIRTEL_MONEY', 'CASH', 'BANK_TRANSFER', 'CARD', 'BALANCE'])
    .optional(),
  customerId: uuidSchema.optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minAmount: z.coerce.number().positive().optional(),
  maxAmount: z.coerce.number().positive().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

// Refund payment
export const refundPaymentSchema = z.object({
  paymentId: uuidSchema,
  reason: trimmedString(10, 500, 'Reason'),
});

// Cash payment (for agents)
export const cashPaymentSchema = z.object({
  customerId: uuidSchema,
  amount: z
    .number()
    .positive('Amount must be positive')
    .min(1, 'Minimum amount is KES 1'),
  reference: trimmedString(1, 100, 'Reference'),
  notes: optionalTrimmedString(500),
});

// Bank transfer payment
export const bankTransferSchema = z.object({
  amount: z
    .number()
    .positive('Amount must be positive')
    .min(100, 'Minimum amount for bank transfer is KES 100')
    .max(1000000, 'Maximum amount for bank transfer is KES 1,000,000'),
  bankName: trimmedString(1, 100, 'Bank name'),
  accountNumber: trimmedString(1, 30, 'Account number'),
  reference: trimmedString(1, 100, 'Transaction reference'),
  notes: optionalTrimmedString(500),
});

// Record manual payment (admin)
export const recordManualPaymentSchema = z.object({
  customerId: uuidSchema,
  invoiceId: uuidSchema.optional(),
  subscriptionId: uuidSchema.optional(),
  amount: z
    .number()
    .positive('Amount must be positive')
    .min(1, 'Minimum amount is KES 1'),
  method: z.enum(['MPESA', 'AIRTEL_MONEY', 'CASH', 'BANK_TRANSFER', 'CARD', 'BALANCE']),
  reference: trimmedString(1, 100, 'Reference'),
  notes: optionalTrimmedString(500),
});

export type MpesaSTKPushInput = z.infer<typeof mpesaSTKPushSchema>;
export type AirtelPaymentInput = z.infer<typeof airtelPaymentSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type PaymentFilterInput = z.infer<typeof paymentFilterSchema>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
export type CashPaymentInput = z.infer<typeof cashPaymentSchema>;
export type BankTransferInput = z.infer<typeof bankTransferSchema>;
export type RecordManualPaymentInput = z.infer<typeof recordManualPaymentSchema>;
