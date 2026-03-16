"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.authController = void 0;
const auth_service_1 = require("../services/auth.service");
class AuthController {
    // Register new user
    async register(req, res, next) {
        try {
            const result = await auth_service_1.authService.register(req.body);
            const response = {
                success: true,
                message: 'Registration successful',
                data: {
                    user: result.user,
                    tokens: result.tokens,
                },
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Login
    async login(req, res, next) {
        try {
            const { email, password } = req.body;
            const result = await auth_service_1.authService.login(email, password);
            const response = {
                success: true,
                message: 'Login successful',
                data: {
                    user: result.user,
                    tokens: result.tokens,
                },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Refresh token
    async refreshToken(req, res, next) {
        try {
            const { refreshToken } = req.body;
            const tokens = await auth_service_1.authService.refreshToken(refreshToken);
            const response = {
                success: true,
                message: 'Token refreshed',
                data: { tokens },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Logout
    async logout(req, res, next) {
        try {
            const { refreshToken } = req.body;
            await auth_service_1.authService.logout(req.user.id, refreshToken);
            const response = {
                success: true,
                message: 'Logged out successfully',
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Get current user profile
    async getProfile(req, res, next) {
        try {
            const { prisma } = require('../config/database');
            const user = await prisma.user.findUnique({
                where: { id: req.user.id },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    phoneVerified: true,
                    emailVerified: true,
                    role: true,
                    accountStatus: true,
                    networkProvider: true,
                    preferredPayment: true,
                    addressLine1: true,
                    addressLine2: true,
                    city: true,
                    county: true,
                    postalCode: true,
                    lastLoginAt: true,
                    createdAt: true,
                    customer: {
                        select: {
                            customerCode: true,
                            accountNumber: true,
                            balance: true,
                            creditLimit: true,
                        },
                    },
                },
            });
            const response = {
                success: true,
                data: { user },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Update profile
    async updateProfile(req, res, next) {
        try {
            const { prisma } = require('../config/database');
            const user = await prisma.user.update({
                where: { id: req.user.id },
                data: req.body,
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    phoneVerified: true,
                    emailVerified: true,
                    role: true,
                    accountStatus: true,
                    addressLine1: true,
                    addressLine2: true,
                    city: true,
                    county: true,
                    postalCode: true,
                    updatedAt: true,
                },
            });
            const response = {
                success: true,
                message: 'Profile updated successfully',
                data: { user },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Change password
    async changePassword(req, res, next) {
        try {
            const { currentPassword, newPassword } = req.body;
            await auth_service_1.authService.changePassword(req.user.id, currentPassword, newPassword);
            const response = {
                success: true,
                message: 'Password changed successfully',
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Forgot password
    async forgotPassword(req, res, next) {
        try {
            const { email } = req.body;
            await auth_service_1.authService.forgotPassword(email);
            // Always return success to prevent email enumeration
            const response = {
                success: true,
                message: 'If an account exists with that email, a password reset link has been sent.',
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Reset password
    async resetPassword(req, res, next) {
        try {
            const { token, password } = req.body;
            await auth_service_1.authService.resetPassword(token, password);
            const response = {
                success: true,
                message: 'Password reset successfully',
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Verify email
    async verifyEmail(req, res, next) {
        try {
            const { prisma } = require('../config/database');
            const { cache } = require('../config/redis');
            const { token } = req.body;
            const userId = await cache.get(`emailVerify:${token}`);
            if (!userId) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid or expired verification token',
                });
                return;
            }
            await prisma.user.update({
                where: { id: userId },
                data: { emailVerified: true },
            });
            await cache.del(`emailVerify:${token}`);
            const response = {
                success: true,
                message: 'Email verified successfully',
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Verify phone
    async verifyPhone(req, res, next) {
        try {
            const { prisma } = require('../config/database');
            const { cache } = require('../config/redis');
            const { code } = req.body;
            const storedCode = await cache.get(`phoneVerify:${req.user.id}`);
            if (!storedCode || storedCode !== code) {
                res.status(400).json({
                    success: false,
                    message: 'Invalid verification code',
                });
                return;
            }
            await prisma.user.update({
                where: { id: req.user.id },
                data: { phoneVerified: true },
            });
            await cache.del(`phoneVerify:${req.user.id}`);
            const response = {
                success: true,
                message: 'Phone verified successfully',
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Get notifications
    async getNotifications(req, res, next) {
        try {
            const { prisma } = require('../config/database');
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const unreadOnly = req.query.unreadOnly === 'true';
            const where = { userId: req.user.id };
            if (unreadOnly) {
                where.readAt = null;
            }
            const [notifications, total] = await Promise.all([
                prisma.notification.findMany({
                    where,
                    orderBy: { createdAt: 'desc' },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                prisma.notification.count({ where }),
            ]);
            const response = {
                success: true,
                data: {
                    notifications,
                    meta: {
                        total,
                        page,
                        limit,
                        totalPages: Math.ceil(total / limit),
                    },
                },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Mark notification as read
    async markNotificationRead(req, res, next) {
        try {
            const { prisma } = require('../config/database');
            const { id } = req.params;
            await prisma.notification.updateMany({
                where: {
                    id,
                    userId: req.user.id,
                },
                data: { readAt: new Date() },
            });
            const response = {
                success: true,
                message: 'Notification marked as read',
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Mark all notifications as read
    async markAllNotificationsRead(req, res, next) {
        try {
            const { prisma } = require('../config/database');
            await prisma.notification.updateMany({
                where: {
                    userId: req.user.id,
                    readAt: null,
                },
                data: { readAt: new Date() },
            });
            const response = {
                success: true,
                message: 'All notifications marked as read',
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.authController = new AuthController();
exports.default = exports.authController;
//# sourceMappingURL=auth.controller.js.map