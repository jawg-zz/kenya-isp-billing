import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
declare class SubscriptionController {
    getSubscriptions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    createSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    renewSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    cancelSubscription(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    toggleAutoRenew(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getAllSubscriptions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getExpiringSubscriptions(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const subscriptionController: SubscriptionController;
export default subscriptionController;
//# sourceMappingURL=subscription.controller.d.ts.map