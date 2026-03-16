import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
declare class InvoiceController {
    getInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    downloadInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getAllInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    createInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    updateInvoiceStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    generateInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getInvoiceStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const invoiceController: InvoiceController;
export default invoiceController;
//# sourceMappingURL=invoice.controller.d.ts.map