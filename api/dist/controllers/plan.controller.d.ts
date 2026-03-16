import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
declare class PlanController {
    getPlans(req: Request, res: Response, next: NextFunction): Promise<void>;
    getPlan(req: Request, res: Response, next: NextFunction): Promise<void>;
    createPlan(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    updatePlan(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    deletePlan(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getFeaturedPlans(req: Request, res: Response, next: NextFunction): Promise<void>;
}
export declare const planController: PlanController;
export default planController;
//# sourceMappingURL=plan.controller.d.ts.map