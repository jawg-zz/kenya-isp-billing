import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import config from '../config';
import { prisma } from '../config/database';
import { AuthenticatedRequest, UnauthorizedError, TokenPayload } from '../types';
import { createChildLogger } from './requestTracing';

export const authenticate = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new UnauthorizedError('No token provided');
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;

    // Check if user exists and is active
    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        accountStatus: true,
      },
    });

    if (!user) {
      throw new UnauthorizedError('User not found');
    }

    if (user.accountStatus === 'SUSPENDED' || user.accountStatus === 'TERMINATED' || user.accountStatus === 'PENDING_VERIFICATION') {
      throw new UnauthorizedError('Account is suspended, terminated, or not verified');
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    // Update the request-scoped logger with userId for correlation
    if (req.id) {
      (req as any).log = createChildLogger(req.id, user.id);
    }

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(new UnauthorizedError('Token expired'));
    } else if (error instanceof jwt.JsonWebTokenError) {
      next(new UnauthorizedError('Invalid token'));
    } else {
      next(error);
    }
  }
};

// Role-based access control
export const authorize = (...roles: string[]) => {
  return (req: AuthenticatedRequest, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      return next(new UnauthorizedError());
    }

    if (!roles.includes(req.user.role)) {
      return next(new UnauthorizedError('Insufficient permissions'));
    }

    next();
  };
};

// Optional authentication (doesn't fail if no token)
export const optionalAuth = async (
  req: AuthenticatedRequest,
  _res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return next();
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwt.secret) as TokenPayload;

    const user = await prisma.user.findUnique({
      where: { id: decoded.id },
      select: {
        id: true,
        email: true,
        role: true,
        accountStatus: true,
      },
    });

    if (user && user.accountStatus === 'ACTIVE') {
      req.user = {
        id: user.id,
        email: user.email,
        role: user.role,
      };
    }

    next();
  } catch {
    // If token is invalid, just continue without user
    next();
  }
};
