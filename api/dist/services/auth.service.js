"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.authService = void 0;
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const jsonwebtoken_1 = __importDefault(require("jsonwebtoken"));
const crypto_1 = __importDefault(require("crypto"));
const database_1 = require("../config/database");
const config_1 = __importDefault(require("../config"));
const redis_1 = require("../config/redis");
const logger_1 = require("../config/logger");
const sms_service_1 = require("./sms.service");
const types_1 = require("../types");
class AuthService {
    // Register new user
    async register(input) {
        // Check if user already exists
        const existingUser = await database_1.prisma.user.findFirst({
            where: {
                OR: [
                    { email: input.email.toLowerCase() },
                    { phone: input.phone },
                ],
            },
        });
        if (existingUser) {
            if (existingUser.email === input.email.toLowerCase()) {
                throw new types_1.ConflictError('Email already registered');
            }
            throw new types_1.ConflictError('Phone number already registered');
        }
        // Hash password
        const hashedPassword = await bcryptjs_1.default.hash(input.password, 12);
        // Generate customer code
        const customerCode = this.generateCustomerCode();
        const accountNumber = this.generateAccountNumber();
        // Create user and customer in transaction
        const result = await database_1.prisma.$transaction(async (tx) => {
            const user = await tx.user.create({
                data: {
                    email: input.email.toLowerCase(),
                    password: hashedPassword,
                    firstName: input.firstName,
                    lastName: input.lastName,
                    phone: input.phone,
                    addressLine1: input.addressLine1,
                    addressLine2: input.addressLine2,
                    city: input.city,
                    county: input.county,
                    postalCode: input.postalCode,
                    idNumber: input.idNumber,
                    phoneVerified: false,
                    emailVerified: false,
                    accountStatus: 'PENDING_VERIFICATION',
                },
                select: {
                    id: true,
                    email: true,
                    firstName: true,
                    lastName: true,
                    phone: true,
                    role: true,
                    accountStatus: true,
                    createdAt: true,
                },
            });
            const customer = await tx.customer.create({
                data: {
                    userId: user.id,
                    customerCode,
                    accountNumber,
                },
            });
            return { user, customer };
        });
        // Generate tokens
        const tokens = await this.generateTokens(result.user);
        // Create notification
        await database_1.prisma.notification.create({
            data: {
                userId: result.user.id,
                type: 'WELCOME',
                title: 'Welcome to ISP Billing',
                message: `Welcome ${result.user.firstName}! Your account has been created. Customer Code: ${customerCode}`,
                channel: 'in_app',
            },
        });
        logger_1.logger.info(`User registered: ${result.user.email}`);
        return { user: result.user, tokens };
    }
    // Login
    async login(email, password) {
        const user = await database_1.prisma.user.findUnique({
            where: { email: email.toLowerCase() },
            select: {
                id: true,
                email: true,
                password: true,
                firstName: true,
                lastName: true,
                phone: true,
                role: true,
                accountStatus: true,
            },
        });
        if (!user) {
            throw new types_1.UnauthorizedError('Invalid email or password');
        }
        // Check password
        const isPasswordValid = await bcryptjs_1.default.compare(password, user.password);
        if (!isPasswordValid) {
            throw new types_1.UnauthorizedError('Invalid email or password');
        }
        // Check account status
        if (user.accountStatus === 'SUSPENDED' || user.accountStatus === 'TERMINATED') {
            throw new types_1.UnauthorizedError('Account is suspended or terminated');
        }
        // Update last login
        await database_1.prisma.user.update({
            where: { id: user.id },
            data: { lastLoginAt: new Date() },
        });
        // Generate tokens
        const tokens = await this.generateTokens(user);
        // Remove password from response
        const { password: _, ...userWithoutPassword } = user;
        logger_1.logger.info(`User logged in: ${user.email}`);
        return { user: userWithoutPassword, tokens };
    }
    // Refresh token
    async refreshToken(refreshToken) {
        // Check if token exists in cache (blacklist check)
        const isRevoked = await redis_1.cache.get(`revoked:${refreshToken}`);
        if (isRevoked) {
            throw new types_1.UnauthorizedError('Token has been revoked');
        }
        try {
            const decoded = jsonwebtoken_1.default.verify(refreshToken, config_1.default.jwt.refreshSecret);
            // Check if refresh token exists in database
            const storedToken = await database_1.prisma.refreshToken.findUnique({
                where: { id: decoded.jti },
                include: { user: true },
            });
            if (!storedToken || storedToken.expiresAt < new Date()) {
                throw new types_1.UnauthorizedError('Invalid or expired refresh token');
            }
            // Delete old refresh token
            await database_1.prisma.refreshToken.delete({
                where: { id: storedToken.id },
            });
            // Generate new tokens
            const tokens = await this.generateTokens(storedToken.user);
            // Revoke old token
            await redis_1.cache.set(`revoked:${refreshToken}`, true, 7 * 24 * 60 * 60);
            return tokens;
        }
        catch (error) {
            if (error instanceof jsonwebtoken_1.default.JsonWebTokenError) {
                throw new types_1.UnauthorizedError('Invalid refresh token');
            }
            throw error;
        }
    }
    // Logout
    async logout(userId, refreshToken) {
        if (refreshToken) {
            // Revoke specific refresh token
            const token = await database_1.prisma.refreshToken.findFirst({
                where: { token: refreshToken, userId },
            });
            if (token) {
                await database_1.prisma.refreshToken.delete({ where: { id: token.id } });
                await redis_1.cache.set(`revoked:${refreshToken}`, true, 7 * 24 * 60 * 60);
            }
        }
        else {
            // Revoke all refresh tokens for user
            await database_1.prisma.refreshToken.deleteMany({ where: { userId } });
        }
        logger_1.logger.info(`User logged out: ${userId}`);
    }
    // Change password
    async changePassword(userId, currentPassword, newPassword) {
        const user = await database_1.prisma.user.findUnique({
            where: { id: userId },
            select: { password: true },
        });
        if (!user) {
            throw new types_1.NotFoundError('User not found');
        }
        const isPasswordValid = await bcryptjs_1.default.compare(currentPassword, user.password);
        if (!isPasswordValid) {
            throw new types_1.UnauthorizedError('Current password is incorrect');
        }
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 12);
        await database_1.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });
        // Revoke all refresh tokens
        await database_1.prisma.refreshToken.deleteMany({ where: { userId } });
        logger_1.logger.info(`Password changed for user: ${userId}`);
    }
    // Forgot password
    async forgotPassword(email) {
        const user = await database_1.prisma.user.findUnique({
            where: { email: email.toLowerCase() },
        });
        if (!user) {
            // Don't reveal if user exists
            return;
        }
        // Generate reset token
        const resetToken = crypto_1.default.randomBytes(32).toString('hex');
        const hashedToken = crypto_1.default.createHash('sha256').update(resetToken).digest('hex');
        // Store in cache with 1 hour expiry
        await redis_1.cache.set(`passwordReset:${hashedToken}`, user.id, 3600);
        // Send SMS with reset token
        try {
            const smsResult = await sms_service_1.smsService.send({
                to: user.phone,
                message: `Your ISP password reset code: ${resetToken}. Valid for 1 hour.`,
            });
            if (smsResult.success) {
                logger_1.logger.info(`Password reset SMS sent to: ${user.phone}`);
            }
            else {
                logger_1.logger.error(`Failed to send password reset SMS to: ${user.phone}`, smsResult.error);
            }
        }
        catch (error) {
            logger_1.logger.error(`Error sending password reset SMS to: ${user.phone}`, error);
        }
        logger_1.logger.info(`Password reset requested for: ${email}`);
    }
    // Reset password
    async resetPassword(token, newPassword) {
        const hashedToken = crypto_1.default.createHash('sha256').update(token).digest('hex');
        const userId = await redis_1.cache.get(`passwordReset:${hashedToken}`);
        if (!userId) {
            throw new types_1.UnauthorizedError('Invalid or expired reset token');
        }
        const hashedPassword = await bcryptjs_1.default.hash(newPassword, 12);
        await database_1.prisma.user.update({
            where: { id: userId },
            data: { password: hashedPassword },
        });
        // Delete reset token
        await redis_1.cache.del(`passwordReset:${hashedToken}`);
        // Revoke all refresh tokens
        await database_1.prisma.refreshToken.deleteMany({ where: { userId } });
        logger_1.logger.info(`Password reset for user: ${userId}`);
    }
    // Generate JWT tokens
    async generateTokens(user) {
        const tokenId = crypto_1.default.randomUUID();
        const accessToken = jsonwebtoken_1.default.sign({
            id: user.id,
            email: user.email,
            role: user.role,
        }, config_1.default.jwt.secret, { expiresIn: config_1.default.jwt.expiresIn });
        const refreshToken = jsonwebtoken_1.default.sign({
            id: user.id,
            email: user.email,
            role: user.role,
            jti: tokenId,
        }, config_1.default.jwt.refreshSecret, { expiresIn: config_1.default.jwt.refreshExpiresIn });
        // Store refresh token in database
        const expiresAt = new Date();
        expiresAt.setDate(expiresAt.getDate() + 30);
        await database_1.prisma.refreshToken.create({
            data: {
                id: tokenId,
                token: refreshToken,
                userId: user.id,
                expiresAt,
            },
        });
        return {
            accessToken,
            refreshToken,
            expiresIn: config_1.default.jwt.expiresIn,
        };
    }
    // Generate unique customer code
    generateCustomerCode() {
        const timestamp = Date.now().toString(36).toUpperCase();
        const random = crypto_1.default.randomBytes(2).toString('hex').toUpperCase();
        return `CUST${timestamp}${random}`;
    }
    // Generate unique account number
    generateAccountNumber() {
        const random = crypto_1.default.randomBytes(4).toString('hex').toUpperCase();
        return `ACC${random}`;
    }
}
exports.authService = new AuthService();
exports.default = exports.authService;
//# sourceMappingURL=auth.service.js.map