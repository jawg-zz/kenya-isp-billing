import { z } from 'zod';
export declare const createSubscriptionSchema: z.ZodObject<{
    planId: z.ZodString;
    autoRenew: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    planId?: string;
    autoRenew?: boolean;
}, {
    planId?: string;
    autoRenew?: boolean;
}>;
export declare const updateSubscriptionSchema: z.ZodObject<{
    planId: z.ZodOptional<z.ZodString>;
    autoRenew: z.ZodOptional<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    planId?: string;
    autoRenew?: boolean;
}, {
    planId?: string;
    autoRenew?: boolean;
}>;
export declare const cancelSubscriptionSchema: z.ZodObject<{
    subscriptionId: z.ZodString;
    reason: z.ZodOptional<z.ZodString>;
    immediate: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    reason?: string;
    subscriptionId?: string;
    immediate?: boolean;
}, {
    reason?: string;
    subscriptionId?: string;
    immediate?: boolean;
}>;
export declare const subscriptionFilterSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["ACTIVE", "SUSPENDED", "TERMINATED", "PENDING_VERIFICATION"]>>;
    type: z.ZodOptional<z.ZodEnum<["PREPAID", "POSTPAID"]>>;
    customerId: z.ZodOptional<z.ZodString>;
    planId: z.ZodOptional<z.ZodString>;
    expiringSoon: z.ZodOptional<z.ZodBoolean>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type?: "PREPAID" | "POSTPAID";
    limit?: number;
    page?: number;
    status?: "SUSPENDED" | "TERMINATED" | "PENDING_VERIFICATION" | "ACTIVE";
    customerId?: string;
    planId?: string;
    expiringSoon?: boolean;
}, {
    type?: "PREPAID" | "POSTPAID";
    limit?: number;
    page?: number;
    status?: "SUSPENDED" | "TERMINATED" | "PENDING_VERIFICATION" | "ACTIVE";
    customerId?: string;
    planId?: string;
    expiringSoon?: boolean;
}>;
export declare const renewSubscriptionSchema: z.ZodObject<{
    subscriptionId: z.ZodString;
    paymentMethod: z.ZodEnum<["MPESA", "AIREL_MONEY", "CASH", "BANK_TRANSFER", "CARD"]>;
}, "strip", z.ZodTypeAny, {
    subscriptionId?: string;
    paymentMethod?: "MPESA" | "AIREL_MONEY" | "CASH" | "BANK_TRANSFER" | "CARD";
}, {
    subscriptionId?: string;
    paymentMethod?: "MPESA" | "AIREL_MONEY" | "CASH" | "BANK_TRANSFER" | "CARD";
}>;
export declare const transferSubscriptionSchema: z.ZodObject<{
    subscriptionId: z.ZodString;
    toCustomerId: z.ZodString;
    reason: z.ZodString;
}, "strip", z.ZodTypeAny, {
    reason?: string;
    subscriptionId?: string;
    toCustomerId?: string;
}, {
    reason?: string;
    subscriptionId?: string;
    toCustomerId?: string;
}>;
export type CreateSubscriptionInput = z.infer<typeof createSubscriptionSchema>;
export type UpdateSubscriptionInput = z.infer<typeof updateSubscriptionSchema>;
export type CancelSubscriptionInput = z.infer<typeof cancelSubscriptionSchema>;
export type SubscriptionFilterInput = z.infer<typeof subscriptionFilterSchema>;
export type RenewSubscriptionInput = z.infer<typeof renewSubscriptionSchema>;
export type TransferSubscriptionInput = z.infer<typeof transferSubscriptionSchema>;
//# sourceMappingURL=subscription.validator.d.ts.map