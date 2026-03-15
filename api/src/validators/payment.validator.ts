import { z } from 'zod';

// Phone number validation (Kenyan format)
const phoneSchema = z.string()
  .regex(/^(\+254|0)[17]\d{8}$/, 'Invalid Kenyan phone number format');

// M-Pesa STK Push request
export const mpesaSTKPushSchema = z.object({
  phoneNumber: phoneSchema,
  amount: z.number()
    .positive('Amount must be positive')
    .min(1, 'Minimum amount is KES 1')
    .max(150000, 'Maximum amount is KES 150,000'),
  accountReference: z.string()
    .min(1, 'Account reference is required')
    .max(20, 'Account reference must not exceed 20 characters'),
  transactionDesc: z.string()
    .min(1, 'Transaction description is required')
    .max(100, 'Transaction description must not exceed 100 characters'),
});

// Airtel Money payment request
export const airtelPaymentSchema = z.object({
  phoneNumber: phoneSchema,
  amount: z.number()
    .positive('Amount must be positive')
    .min(1, 'Minimum amount is KES 1')
    .max(150000, 'Maximum amount is KES 150,000'),
  reference: z.string()
    .min(1, 'Reference is required')
    .max(50, 'Reference must not exceed 50 characters'),
  description: z.string()
    .max(200, 'Description must not exceed 200 characters')
    .optional(),
});

// Payment verification
export const verifyPaymentSchema = z.object({
  checkoutRequestId: z.string().optional(),
  merchantRequestId: z.string().optional(),
  reference: z.string().optional(),
}).refine(
  (data) => data.checkoutRequestId || data.merchantRequestId || data.reference,
  { message: 'At least one identifier is required' }
);

// Payment filter for admin
export const paymentFilterSchema = z.object({
  status: z.enum(['PENDING', 'COMPLETED', 'FAILED', 'CANCELLED', 'REFUNDED', 'TIMEOUT']).optional(),
  method: z.enum(['MPESA', 'AIREL_MONEY', 'CASH', 'BANK_TRANSFER', 'CARD']).optional(),
  customerId: z.string().uuid().optional(),
  startDate: z.string().datetime().optional(),
  endDate: z.string().datetime().optional(),
  minAmount: z.number().positive().optional(),
  maxAmount: z.number().positive().optional(),
  page: z.number().int().positive().default(1),
  limit: z.number().int().positive().max(100).default(20),
});

// Refund payment
export const refundPaymentSchema = z.object({
  paymentId: z.string().uuid('Invalid payment ID'),
  reason: z.string().min(10, 'Reason must be at least 10 characters').max(500),
});

// Cash payment (for agents)
export const cashPaymentSchema = z.object({
  customerId: z.string().uuid('Invalid customer ID'),
  amount: z.number()
    .positive('Amount must be positive')
    .min(1, 'Minimum amount is KES 1'),
  reference: z.string().min(1, 'Reference is required'),
  notes: z.string().max(500).optional(),
});

// Bank transfer payment
export const bankTransferSchema = z.object({
  amount: z.number()
    .positive('Amount must be positive')
    .min(100, 'Minimum amount for bank transfer is KES 100'),
  bankName: z.string().min(1, 'Bank name is required'),
  accountNumber: z.string().min(1, 'Account number is required'),
  reference: z.string().min(1, 'Transaction reference is required'),
  notes: z.string().max(500).optional(),
});

export type MpesaSTKPushInput = z.infer<typeof mpesaSTKPushSchema>;
export type AirtelPaymentInput = z.infer<typeof airtelPaymentSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type PaymentFilterInput = z.infer<typeof paymentFilterSchema>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
export type CashPaymentInput = z.infer<typeof cashPaymentSchema>;
export type BankTransferInput = z.infer<typeof bankTransferSchema>;
