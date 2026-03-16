import { z } from 'zod';
export declare const mpesaSTKPushSchema: z.ZodObject<{
    phoneNumber: z.ZodString;
    amount: z.ZodNumber;
    accountReference: z.ZodString;
    transactionDesc: z.ZodString;
}, "strip", z.ZodTypeAny, {
    phoneNumber?: string;
    amount?: number;
    accountReference?: string;
    transactionDesc?: string;
}, {
    phoneNumber?: string;
    amount?: number;
    accountReference?: string;
    transactionDesc?: string;
}>;
export declare const airtelPaymentSchema: z.ZodObject<{
    phoneNumber: z.ZodString;
    amount: z.ZodNumber;
    reference: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    description?: string;
    phoneNumber?: string;
    amount?: number;
    reference?: string;
}, {
    description?: string;
    phoneNumber?: string;
    amount?: number;
    reference?: string;
}>;
export declare const verifyPaymentSchema: z.ZodEffects<z.ZodObject<{
    checkoutRequestId: z.ZodOptional<z.ZodString>;
    merchantRequestId: z.ZodOptional<z.ZodString>;
    reference: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    checkoutRequestId?: string;
    merchantRequestId?: string;
    reference?: string;
}, {
    checkoutRequestId?: string;
    merchantRequestId?: string;
    reference?: string;
}>, {
    checkoutRequestId?: string;
    merchantRequestId?: string;
    reference?: string;
}, {
    checkoutRequestId?: string;
    merchantRequestId?: string;
    reference?: string;
}>;
export declare const paymentFilterSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["PENDING", "COMPLETED", "FAILED", "CANCELLED", "REFUNDED", "TIMEOUT"]>>;
    method: z.ZodOptional<z.ZodEnum<["MPESA", "AIREL_MONEY", "CASH", "BANK_TRANSFER", "CARD"]>>;
    customerId: z.ZodOptional<z.ZodString>;
    startDate: z.ZodOptional<z.ZodString>;
    endDate: z.ZodOptional<z.ZodString>;
    minAmount: z.ZodOptional<z.ZodNumber>;
    maxAmount: z.ZodOptional<z.ZodNumber>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    limit?: number;
    page?: number;
    status?: "COMPLETED" | "FAILED" | "PENDING" | "TIMEOUT" | "CANCELLED" | "REFUNDED";
    method?: "MPESA" | "AIREL_MONEY" | "CASH" | "BANK_TRANSFER" | "CARD";
    customerId?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
}, {
    limit?: number;
    page?: number;
    status?: "COMPLETED" | "FAILED" | "PENDING" | "TIMEOUT" | "CANCELLED" | "REFUNDED";
    method?: "MPESA" | "AIREL_MONEY" | "CASH" | "BANK_TRANSFER" | "CARD";
    customerId?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
}>;
export declare const refundPaymentSchema: z.ZodObject<{
    paymentId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    paymentId?: string;
    reason?: string;
}, {
    paymentId?: string;
    reason?: string;
}>;
export declare const cashPaymentSchema: z.ZodObject<{
    customerId: z.ZodString;
    amount: z.ZodNumber;
    reference: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount?: number;
    reference?: string;
    customerId?: string;
    notes?: string;
}, {
    amount?: number;
    reference?: string;
    customerId?: string;
    notes?: string;
}>;
export declare const bankTransferSchema: z.ZodObject<{
    amount: z.ZodNumber;
    bankName: z.ZodString;
    accountNumber: z.ZodString;
    reference: z.ZodString;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    amount?: number;
    reference?: string;
    notes?: string;
    bankName?: string;
    accountNumber?: string;
}, {
    amount?: number;
    reference?: string;
    notes?: string;
    bankName?: string;
    accountNumber?: string;
}>;
export type MpesaSTKPushInput = z.infer<typeof mpesaSTKPushSchema>;
export type AirtelPaymentInput = z.infer<typeof airtelPaymentSchema>;
export type VerifyPaymentInput = z.infer<typeof verifyPaymentSchema>;
export type PaymentFilterInput = z.infer<typeof paymentFilterSchema>;
export type RefundPaymentInput = z.infer<typeof refundPaymentSchema>;
export type CashPaymentInput = z.infer<typeof cashPaymentSchema>;
export type BankTransferInput = z.infer<typeof bankTransferSchema>;
//# sourceMappingURL=payment.validator.d.ts.map