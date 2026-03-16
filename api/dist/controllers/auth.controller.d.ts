import { Request, Response, NextFunction } from 'express';
import { AuthenticatedRequest } from '../types';
declare class AuthController {
    register(req: Request, res: Response, next: NextFunction): Promise<void>;
    login(req: Request, res: Response, next: NextFunction): Promise<void>;
    refreshToken(req: Request, res: Response, next: NextFunction): Promise<void>;
    logout(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    updateProfile(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    changePassword(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    forgotPassword(req: Request, res: Response, next: NextFunction): Promise<void>;
    resetPassword(req: Request, res: Response, next: NextFunction): Promise<void>;
    verifyEmail(req: Request, res: Response, next: NextFunction): Promise<void>;
    verifyPhone(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    getNotifications(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    markNotificationRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
    markAllNotificationsRead(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void>;
}
export declare const authController: AuthController;
export default authController;
//# sourceMappingURL=auth.controller.d.ts.map