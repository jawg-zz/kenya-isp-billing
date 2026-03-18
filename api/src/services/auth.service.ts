import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import { prisma } from '../config/database';
import config from '../config';
import { cache } from '../config/redis';
import { logger } from '../config/logger';
import { smsService } from './sms.service';
import { emailService } from './email.service';
import { redactEmail, redactPhone } from '../utils/redact';
import {
  UnauthorizedError,
  ConflictError,
  NotFoundError,
  TokenPayload,
} from '../types';

interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  expiresIn: string;
}

interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  phone: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  county?: string;
  postalCode?: string;
  idNumber?: string;
}

class AuthService {
  // Register new user
  async register(input: RegisterInput): Promise<{ user: any; tokens: AuthTokens }> {
    // Check if user already exists
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: input.email.toLowerCase() },
          { phone: input.phone },
        ],
      },
    });

    if (existingUser) {
      if (existingUser.email === input.email.toLowerCase()) {
        throw new ConflictError('Email already registered');
      }
      throw new ConflictError('Phone number already registered');
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(input.password, 12);

    // Generate customer code
    const customerCode = this.generateCustomerCode();
    const accountNumber = this.generateAccountNumber();

    // Create user and customer in transaction
    const result = await prisma.$transaction(async (tx) => {
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
          accountStatus: 'ACTIVE',
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
    await prisma.notification.create({
      data: {
        userId: result.user.id,
        type: 'WELCOME',
        title: 'Welcome to ISP Billing',
        message: `Welcome ${result.user.firstName}! Your account has been created. Customer Code: ${customerCode}`,
        channel: 'in_app',
      },
    });

    // Send welcome SMS
    try {
      await smsService.send({
        to: result.user.phone,
        message: `Welcome to ISP Billing, ${result.user.firstName}! Your customer code is ${customerCode}. You can now subscribe to a plan.`,
      });
    } catch (error) {
      logger.error('Failed to send welcome SMS:', error);
    }

    // Send email verification link
    try {
      const verifyToken = crypto.randomBytes(32).toString('hex');
      await cache.set(`emailVerify:${verifyToken}`, result.user.id, 24 * 60 * 60); // 24h expiry
      await emailService.sendVerificationEmail(result.user.email, verifyToken, result.user.firstName);
    } catch (error) {
      logger.error('Failed to send verification email:', error);
    }

    logger.info(`User registered: ${redactEmail(result.user.email)}`);

    return { user: result.user, tokens };
  }

  // Login
  async login(email: string, password: string): Promise<{ user: any; tokens: AuthTokens }> {
    // Check if account is locked
    const lockKey = `loginLock:${email.toLowerCase()}`;
    const isLocked = await cache.get(lockKey);
    if (isLocked) {
      throw new UnauthorizedError('Account temporarily locked due to too many failed attempts. Try again in 15 minutes.');
    }

    const user = await prisma.user.findUnique({
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
      throw new UnauthorizedError('Invalid email or password');
    }

    // Check password
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      // Track failed attempts
      const failKey = `loginFail:${email.toLowerCase()}`;
      const fails = (await cache.get<number>(failKey) || 0) + 1;
      await cache.set(failKey, fails, 15 * 60); // 15 min window

      if (fails >= 5) {
        await cache.set(lockKey, true, 15 * 60); // Lock for 15 min
        logger.warn(`Account locked after 5 failed attempts: ${redactEmail(email)}`);
      }

      throw new UnauthorizedError('Invalid email or password');
    }

    // Check account status
    if (user.accountStatus === 'SUSPENDED' || user.accountStatus === 'TERMINATED') {
      throw new UnauthorizedError('Account is suspended or terminated');
    }

    if (user.accountStatus === 'PENDING_VERIFICATION') {
      throw new UnauthorizedError('Please verify your account before logging in');
    }

    // Clear failed attempts on success
    await cache.del(`loginFail:${email.toLowerCase()}`);

    // Update last login
    await prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate tokens
    const tokens = await this.generateTokens(user);

    // Remove password from response
    const { password: _, ...userWithoutPassword } = user;

    logger.info(`User logged in: ${redactEmail(user.email)}`);

    return { user: userWithoutPassword, tokens };
  }

  // Refresh token
  async refreshToken(refreshToken: string): Promise<AuthTokens> {
    // Check if token exists in cache (blacklist check)
    const isRevoked = await cache.get(`revoked:${refreshToken}`);
    if (isRevoked) {
      throw new UnauthorizedError('Token has been revoked');
    }

    try {
      const decoded = jwt.verify(refreshToken, config.jwt.refreshSecret) as TokenPayload & {
        jti: string;
      };

      // Check if refresh token exists in database (compare against hash)
      const storedToken = await prisma.refreshToken.findFirst({
        where: { userId: decoded.id },
        include: { user: true },
      });

      if (!storedToken || storedToken.expiresAt < new Date() || !(await bcrypt.compare(refreshToken, storedToken.token))) {
        throw new UnauthorizedError('Invalid or expired refresh token');
      }

      // Delete old refresh token
      await prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });

      // Generate new tokens
      const tokens = await this.generateTokens(storedToken.user);

      // Revoke old token
      await cache.set(`revoked:${refreshToken}`, true, 7 * 24 * 60 * 60);

      return tokens;
    } catch (error) {
      if (error instanceof jwt.JsonWebTokenError) {
        throw new UnauthorizedError('Invalid refresh token');
      }
      throw error;
    }
  }

  // Logout
  async logout(userId: string, refreshToken?: string): Promise<void> {
    if (refreshToken) {
      // Find token by userId and compare against stored hash
      const tokens = await prisma.refreshToken.findMany({
        where: { userId },
      });

      let matched: { id: string } | null = null;
      for (const t of tokens) {
        if (await bcrypt.compare(refreshToken, t.token)) {
          matched = t;
          break;
        }
      }

      if (matched) {
        await prisma.refreshToken.delete({ where: { id: matched.id } });
        await cache.set(`revoked:${refreshToken}`, true, 7 * 24 * 60 * 60);
      }
    } else {
      // Revoke all refresh tokens for user
      await prisma.refreshToken.deleteMany({ where: { userId } });
    }

    logger.info(`User logged out: ${userId}`);
  }

  // Change password
  async changePassword(
    userId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { password: true },
    });

    if (!user) {
      throw new NotFoundError('User not found');
    }

    const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
    if (!isPasswordValid) {
      throw new UnauthorizedError('Current password is incorrect');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Revoke all refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId } });

    logger.info(`Password changed for user: ${userId}`);
  }

  // Forgot password
  async forgotPassword(email: string): Promise<void> {
    const user = await prisma.user.findUnique({
      where: { email: email.toLowerCase() },
    });

    if (!user) {
      // Don't reveal if user exists
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

    // Store in cache with 1 hour expiry (use raw token as key so it matches the URL param)
    await cache.set(`passwordReset:${resetToken}`, user.id, 3600);

    // Send email with reset link (primary method)
    try {
      await emailService.sendPasswordResetEmail(user.email, resetToken, user.firstName);
      logger.info(`Password reset email sent to: ${redactEmail(user.email)}`);
    } catch (error) {
      logger.error(`Failed to send password reset email to: ${redactEmail(user.email)}`, error);
    }

    // Also send SMS with reset token (backup method)
    try {
      await smsService.send({
        to: user.phone,
        message: `Your ISP password reset code: ${resetToken.substring(0, 8)}. Use the link sent to your email to reset your password.`,
      });
      logger.info(`Password reset SMS sent to: ${redactPhone(user.phone)}`);
    } catch (error) {
      logger.error(`Failed to send password reset SMS to: ${redactPhone(user.phone)}`, error);
    }
  }

  // Reset password
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const userId = await cache.get<string>(`passwordReset:${token}`);
    if (!userId) {
      throw new UnauthorizedError('Invalid or expired reset token');
    }

    const hashedPassword = await bcrypt.hash(newPassword, 12);

    await prisma.user.update({
      where: { id: userId },
      data: { password: hashedPassword },
    });

    // Delete reset token
    await cache.del(`passwordReset:${token}`);

    // Revoke all refresh tokens
    await prisma.refreshToken.deleteMany({ where: { userId } });

    logger.info(`Password reset for user: ${userId}`);
  }

  // Generate JWT tokens
  private async generateTokens(user: any): Promise<AuthTokens> {
    const tokenId = crypto.randomUUID();

    const accessToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
      },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    const refreshToken = jwt.sign(
      {
        id: user.id,
        email: user.email,
        role: user.role,
        jti: tokenId,
      },
      config.jwt.refreshSecret,
      { expiresIn: config.jwt.refreshExpiresIn }
    );

    // Hash refresh token before storing in database
    const hashedRefreshToken = await bcrypt.hash(refreshToken, 8);
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 30);

    await prisma.refreshToken.create({
      data: {
        id: tokenId,
        token: hashedRefreshToken,
        userId: user.id,
        expiresAt,
      },
    });

    return {
      accessToken,
      refreshToken,
      expiresIn: config.jwt.expiresIn,
    };
  }

  // Send phone verification code via SMS
  async sendPhoneVerificationCode(userId: string): Promise<void> {
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) throw new NotFoundError('User not found');

    // Generate 6-digit code
    const code = Math.floor(100000 + Math.random() * 900000).toString();

    // Store in Redis with 15-minute expiry
    await cache.set(`phoneVerify:${userId}`, code, 15 * 60);

    // Send via SMS
    await smsService.send({
      to: user.phone,
      message: `Your ISP verification code: ${code}. Valid for 15 minutes.`,
    });

    logger.info(`Phone verification code sent to ${redactPhone(user.phone)}`);
  }

  // Generate unique customer code
  private generateCustomerCode(): string {
    const timestamp = Date.now().toString(36).toUpperCase();
    const random = crypto.randomBytes(2).toString('hex').toUpperCase();
    return `CUST${timestamp}${random}`;
  }

  // Generate unique account number
  private generateAccountNumber(): string {
    const random = crypto.randomBytes(4).toString('hex').toUpperCase();
    return `ACC${random}`;
  }
}

export const authService = new AuthService();
export default authService;
