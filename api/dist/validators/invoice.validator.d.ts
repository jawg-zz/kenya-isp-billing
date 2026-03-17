import { z } from 'zod';
export declare const createInvoiceSchema: z.ZodObject<{
    customerId: z.ZodString;
    subscriptionId: z.ZodOptional<z.ZodString>;
    items: z.ZodArray<z.ZodObject<{
        description: z.ZodString;
        quantity: z.ZodNumber;
        unitPrice: z.ZodNumber;
    }, "strip", z.ZodTypeAny, {
        description?: string;
        quantity?: number;
        unitPrice?: number;
    }, {
        description?: string;
        quantity?: number;
        unitPrice?: number;
    }>, "many">;
    dueDate: z.ZodOptional<z.ZodString>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notes?: string;
    customerId?: string;
    subscriptionId?: string;
    dueDate?: string;
    items?: {
        description?: string;
        quantity?: number;
        unitPrice?: number;
    }[];
}, {
    notes?: string;
    customerId?: string;
    subscriptionId?: string;
    dueDate?: string;
    items?: {
        description?: string;
        quantity?: number;
        unitPrice?: number;
    }[];
}>;
export declare const invoiceFilterSchema: z.ZodObject<{
    status: z.ZodOptional<z.ZodEnum<["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"]>>;
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
    status?: "PAID" | "PENDING" | "CANCELLED" | "REFUNDED" | "DRAFT" | "OVERDUE";
    customerId?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
}, {
    limit?: number;
    page?: number;
    status?: "PAID" | "PENDING" | "CANCELLED" | "REFUNDED" | "DRAFT" | "OVERDUE";
    customerId?: string;
    startDate?: string;
    endDate?: string;
    minAmount?: number;
    maxAmount?: number;
}>;
export declare const updateInvoiceStatusSchema: z.ZodObject<{
    status: z.ZodEnum<["DRAFT", "PENDING", "PAID", "OVERDUE", "CANCELLED", "REFUNDED"]>;
    notes: z.ZodOptional<z.ZodString>;
}, "strip", z.ZodTypeAny, {
    notes?: string;
    status?: "PAID" | "PENDING" | "CANCELLED" | "REFUNDED" | "DRAFT" | "OVERDUE";
}, {
    notes?: string;
    status?: "PAID" | "PENDING" | "CANCELLED" | "REFUNDED" | "DRAFT" | "OVERDUE";
}>;
export declare const sendInvoiceSchema: z.ZodObject<{
    invoiceId: z.ZodString;
    email: z.ZodOptional<z.ZodString>;
    sendSms: z.ZodDefault<z.ZodBoolean>;
}, "strip", z.ZodTypeAny, {
    email?: string;
    invoiceId?: string;
    sendSms?: boolean;
}, {
    email?: string;
    invoiceId?: string;
    sendSms?: boolean;
}>;
export declare const generateBulkInvoicesSchema: z.ZodObject<{
    customerId: z.ZodOptional<z.ZodString>;
    subscriptionIds: z.ZodOptional<z.ZodArray<z.ZodString, "many">>;
    billingDate: z.ZodOptional<z.ZodString>;
    dueDays: z.ZodDefault<z.ZodNumber>;
}, "strip", z.ZodTypeAny, {
    customerId?: string;
    subscriptionIds?: string[];
    billingDate?: string;
    dueDays?: number;
}, {
    customerId?: string;
    subscriptionIds?: string[];
    billingDate?: string;
    dueDays?: number;
}>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type InvoiceFilterInput = z.infer<typeof invoiceFilterSchema>;
export type UpdateInvoiceStatusInput = z.infer<typeof updateInvoiceStatusSchema>;
export type SendInvoiceInput = z.infer<typeof sendInvoiceSchema>;
export type GenerateBulkInvoicesInput = z.infer<typeof generateBulkInvoicesSchema>;
//# sourceMappingURL=invoice.validator.d.ts.map