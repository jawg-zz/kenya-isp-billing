import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
declare class CustomerController {
    getCustomers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    createCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    updateCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    adjustBalance(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getCustomerStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    deleteCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const customerController: CustomerController;
export default customerController;
//# sourceMappingURL=customer.controller.d.ts.map