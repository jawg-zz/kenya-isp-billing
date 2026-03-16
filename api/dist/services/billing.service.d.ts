interface CreateInvoiceInput {
    customerId: string;
    subscriptionId?: string;
    items: Array<{
        description: string;
        quantity: number;
        unitPrice: number;
    }>;
    dueDate?: Date;
    notes?: string;
}
declare class BillingService {
    generateSubscriptionInvoice(subscriptionId: string): Promise<any>;
    processPendingInvoices(): Promise<{
        processed: number;
        errors: number;
    }>;
    generateDueInvoices(): Promise<{
        generated: number;
        errors: number;
    }>;
    private shouldGenerateInvoice;
    createManualInvoice(input: CreateInvoiceInput): Promise<any>;
    applyLateFees(): Promise<{
        processed: number;
    }>;
    getCustomerBillingSummary(customerId: string): Promise<any>;
}
export declare const billingService: BillingService;
export default billingService;
//# sourceMappingURL=billing.service.d.ts.map