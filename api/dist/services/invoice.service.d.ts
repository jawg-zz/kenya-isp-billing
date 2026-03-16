declare class InvoiceService {
    private outputDir;
    constructor();
    private ensureOutputDir;
    generateInvoiceNumber(): string;
    generatePDF(invoiceId: string): Promise<string>;
    private drawHeader;
    private drawFooter;
    private drawItemsTable;
    getInvoiceFilePath(invoiceNumber: string): string;
    invoiceExists(invoiceNumber: string): boolean;
    generateBulkInvoices(customerId?: string): Promise<{
        generated: number;
        errors: number;
    }>;
}
export declare const invoiceService: InvoiceService;
export default invoiceService;
//# sourceMappingURL=invoice.service.d.ts.map