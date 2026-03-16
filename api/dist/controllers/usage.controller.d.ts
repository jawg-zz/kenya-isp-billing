import { Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
declare class UsageController {
    getUsageSummary(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getRealtimeUsage(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getUsageHistory(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getUsageAnalytics(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    formatBytes(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const usageController: UsageController;
export default usageController;
//# sourceMappingURL=usage.controller.d.ts.map