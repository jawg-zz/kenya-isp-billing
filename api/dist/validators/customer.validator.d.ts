import { z } from 'zod';
export declare const createCustomerSchema: z.ZodObject<{
    email: z.ZodString;
    password: z.ZodString;
    firstName: z.ZodString;
    lastName: z.ZodString;
    phone: z.ZodString;
    addressLine1: z.ZodOptional<z.ZodString>;
    addressLine2: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    county: z.ZodOptional<z.ZodString>;
    postalCode: z.ZodOptional<z.ZodString>;
    idNumber: z.ZodOptional<z.ZodString>;
    kraPin: z.ZodOptional<z.ZodString>;
    creditLimit: z.ZodDefault<z.ZodNumber>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    phone?: string;
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    county?: string;
    postalCode?: string;
    idNumber?: string;
    notes?: string;
    kraPin?: string;
    creditLimit?: number;
}, {
    phone?: string;
    email?: string;
    password?: string;
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    county?: string;
    postalCode?: string;
    idNumber?: string;
    notes?: string;
    kraPin?: string;
    creditLimit?: number;
}>;
export declare const updateCustomerSchema: z.ZodObject<{
    firstName: z.ZodOptional<z.ZodString>;
    lastName: z.ZodOptional<z.ZodString>;
    phone: z.ZodOptional<z.ZodString>;
    addressLine1: z.ZodOptional<z.ZodString>;
    addressLine2: z.ZodOptional<z.ZodString>;
    city: z.ZodOptional<z.ZodString>;
    county: z.ZodOptional<z.ZodString>;
    postalCode: z.ZodOptional<z.ZodString>;
    idNumber: z.ZodOptional<z.ZodString>;
    kraPin: z.ZodOptional<z.ZodString>;
    creditLimit: z.ZodOptional<z.ZodNumber>;
    accountStatus: z.ZodOptional<z.ZodEnum<["ACTIVE", "SUSPENDED", "TERMINATED", "PENDING_VERIFICATION"]>>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    phone?: string;
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    county?: string;
    postalCode?: string;
    idNumber?: string;
    notes?: string;
    kraPin?: string;
    creditLimit?: number;
    accountStatus?: "SUSPENDED" | "TERMINATED" | "PENDING_VERIFICATION" | "ACTIVE";
}, {
    phone?: string;
    firstName?: string;
    lastName?: string;
    addressLine1?: string;
    addressLine2?: string;
    city?: string;
    county?: string;
    postalCode?: string;
    idNumber?: string;
    notes?: string;
    kraPin?: string;
    creditLimit?: number;
    accountStatus?: "SUSPENDED" | "TERMINATED" | "PENDING_VERIFICATION" | "ACTIVE";
}>;
export declare const customerFilterSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["ACTIVE", "SUSPENDED", "TERMINATED", "PENDING_VERIFICATION"]>>;
    county: z.ZodOptional<z.ZodString>;
    networkProvider: z.ZodOptional<z.ZodEnum<["SAFARICOM", "AIRTEL", "TELKOM", "OTHER"]>>;
    search: z.ZodOptional<z.ZodString>;
    hasActiveSubscription: z.ZodOptional<z.ZodBoolean>;
    sortBy: z.ZodDefault<z.ZodEnum<["createdAt", "firstName", "lastName", "accountNumber"]>>;
    sortOrder: z.ZodDefault<z.ZodEnum<["asc", "desc"]>>;
    page: z.ZodDefault<z.ZodNumber>;
    limit: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    search?: string;
    limit?: number;
    page?: number;
    county?: string;
    status?: "SUSPENDED" | "TERMINATED" | "PENDING_VERIFICATION" | "ACTIVE";
    sortOrder?: "asc" | "desc";
    networkProvider?: "SAFARICOM" | "AIRTEL" | "TELKOM" | "OTHER";
    hasActiveSubscription?: boolean;
    sortBy?: "firstName" | "lastName" | "accountNumber" | "createdAt";
}, {
    search?: string;
    limit?: number;
    page?: number;
    county?: string;
    status?: "SUSPENDED" | "TERMINATED" | "PENDING_VERIFICATION" | "ACTIVE";
    sortOrder?: "asc" | "desc";
    networkProvider?: "SAFARICOM" | "AIRTEL" | "TELKOM" | "OTHER";
    hasActiveSubscription?: boolean;
    sortBy?: "firstName" | "lastName" | "accountNumber" | "createdAt";
}>;
export declare const adjustBalanceSchema: z.ZodObject<{
    amount: z.ZodEffects<z.ZodNumber, number, number>;
    reason: z.ZodString;
    type: z.ZodEnum<["CREDIT", "DEBIT"]>;
}, "strip", z.ZodTypeAny, {
    type?: "CREDIT" | "DEBIT";
    amount?: number;
    reason?: string;
}, {
    type?: "CREDIT" | "DEBIT";
    amount?: number;
    reason?: string;
}>;
export declare const addCustomerNotesSchema: z.ZodObject<{
    notes: z.ZodString;
    isInternal: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    notes?: string;
    isInternal?: boolean;
}, {
    notes?: string;
    isInternal?: boolean;
}>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerFilterInput = z.infer<typeof customerFilterSchema>;
export type AdjustBalanceInput = z.infer<typeof adjustBalanceSchema>;
export type AddCustomerNotesInput = z.infer<typeof addCustomerNotesSchema>;
//# sourceMappingURL=customer.validator.d.ts.map