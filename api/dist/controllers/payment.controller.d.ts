import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
declare class PaymentController {
    initiateMpesaPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    mpesaCallback(req: Request, res: Response, next: NextFunction): Promise<void>;
    mpesaTimeout(req: Request, res: Response, next: NextFunction): Promise<void>;
    checkMpesaStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    initiateAirtelPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    airtelCallback(req: Request, res: Response, next: NextFunction): Promise<void>;
    getPaymentHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getAllPayments(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    processCashPayment(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getPaymentStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const paymentController: PaymentController;
export default paymentController;
//# sourceMappingURL=payment.controller.d.ts.map