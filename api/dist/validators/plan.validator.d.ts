import { z } from 'zod';
export declare const createPlanSchema: z.ZodObject<{
    name: z.ZodString;
    description: z.ZodOptional<z.ZodString>;
    code: z.ZodString;
    type: z.ZodEnum<["PREPAID", "POSTPAID"]>;
    dataType: z.ZodDefault<z.ZodEnum<["DATA", "VOICE", "SMS", "BUNDLE"]>>;
    price: z.ZodNumber;
    dataAllowance: z.ZodOptional<z.ZodNumber>;
    voiceMinutes: z.ZodOptional<z.ZodNumber>;
    smsAllowance: z.ZodOptional<z.ZodNumber>;
    speedLimit: z.ZodOptional<z.ZodNumber>;
    billingCycle: z.ZodOptional<z.ZodEnum<["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]>>;
    validityDays: z.ZodDefault<z.ZodNumber>;
    fupThreshold: z.ZodOptional<z.ZodNumber>;
    fupSpeedLimit: z.ZodOptional<z.ZodNumber>;
    isFeatured: z.ZodDefault<z.ZodBoolean>;
    sortOrder: z.ZodDefault<z.ZodNumber>;
    prices: z.ZodOptional<z.ZodArray<z.ZodObject<{
        billingCycle: z.ZodEnum<["WEEKLY", "MONTHLY", "QUARTERLY", "YEARLY"]>;
        price: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        price?: number;
        billingCycle?: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
    }, {
        price?: number;
        billingCycle?: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
    }>, "many">>;
}, "strip", z.ZodTypeAny, {
    description?: string;
    type?: "PREPAID" | "POSTPAID";
    name?: string;
    code?: string;
    dataType?: "DATA" | "VOICE" | "SMS" | "BUNDLE";
    price?: number;
    dataAllowance?: number;
    voiceMinutes?: number;
    smsAllowance?: number;
    speedLimit?: number;
    billingCycle?: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
    validityDays?: number;
    fupThreshold?: number;
    fupSpeedLimit?: number;
    isFeatured?: boolean;
    sortOrder?: number;
    prices?: {
        price?: number;
        billingCycle?: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
    }[];
}, {
    description?: string;
    type?: "PREPAID" | "POSTPAID";
    name?: string;
    code?: string;
    dataType?: "DATA" | "VOICE" | "SMS" | "BUNDLE";
    price?: number;
    dataAllowance?: number;
    voiceMinutes?: number;
    smsAllowance?: number;
    speedLimit?: number;
    billingCycle?: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
    validityDays?: number;
    fupThreshold?: number;
    fupSpeedLimit?: number;
    isFeatured?: boolean;
    sortOrder?: number;
    prices?: {
        price?: number;
        billingCycle?: "WEEKLY" | "MONTHLY" | "QUARTERLY" | "YEARLY";
    }[];
}>;
export declare const updatePlanSchema: z.ZodObject<{
    name: z.ZodOptional<z.ZodString>;
    description: z.ZodOptional<z.ZodString>;
    price: z.ZodOptional<z.ZodNumber>;
    dataAllowance: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    voiceMinutes: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    smsAllowance: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    speedLimit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    validityDays: z.ZodOptional<z.ZodNumber>;
    fupThreshold: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    fupSpeedLimit: z.ZodOptional<z.ZodNullable<z.ZodNumber>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    isFeatured: z.ZodOptional<z.ZodBoolean>;
    sortOrder: z.ZodOptional<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    description?: string;
    name?: string;
    price?: number;
    dataAllowance?: number;
    voiceMinutes?: number;
    smsAllowance?: number;
    speedLimit?: number;
    validityDays?: number;
    fupThreshold?: number;
    fupSpeedLimit?: number;
    isActive?: boolean;
    isFeatured?: boolean;
    sortOrder?: number;
}, {
    description?: string;
    name?: string;
    price?: number;
    dataAllowance?: number;
    voiceMinutes?: number;
    smsAllowance?: number;
    speedLimit?: number;
    validityDays?: number;
    fupThreshold?: number;
    fupSpeedLimit?: number;
    isActive?: boolean;
    isFeatured?: boolean;
    sortOrder?: number;
}>;
export declare const planFilterSchema: z.ZodObject<{
    type: z.ZodOptional<z.ZodEnum<["PREPAID", "POSTPAID"]>>;
    dataType: z.ZodOptional<z.ZodEnum<["DATA", "VOICE", "SMS", "BUNDLE"]>>;
    isActive: z.ZodOptional<z.ZodBoolean>;
    isFeatured: z.ZodOptional<z.ZodBoolean>;
    minPrice: z.ZodOptional<z.ZodNumber>;
    maxPrice: z.ZodOptional<z.ZodNumber>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    type?: "PREPAID" | "POSTPAID";
    limit?: number;
    page?: number;
    dataType?: "DATA" | "VOICE" | "SMS" | "BUNDLE";
    isActive?: boolean;
    isFeatured?: boolean;
    minPrice?: number;
    maxPrice?: number;
}, {
    type?: "PREPAID" | "POSTPAID";
    limit?: number;
    page?: number;
    dataType?: "DATA" | "VOICE" | "SMS" | "BUNDLE";
    isActive?: boolean;
    isFeatured?: boolean;
    minPrice?: number;
    maxPrice?: number;
}>;
export type CreatePlanInput = z.infer<typeof createPlanSchema>;
export type UpdatePlanInput = z.infer<typeof updatePlanSchema>;
export type PlanFilterInput = z.infer<typeof planFilterSchema>;
//# sourceMappingURL=plan.validator.d.ts.map