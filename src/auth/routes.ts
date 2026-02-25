import { Router, Request, Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import bcrypt from 'bcrypt';
import { User } from '../entities/User';
import { AppDataSource } from '../database';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret';

interface AuthRequest extends Request {
  user?: User;
}

// Login
router.post('/login', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      throw createError('Email and password are required', 400, 'VALIDATION_ERROR');
    }

    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { email } });

    if (!user) {
      throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      throw createError('Invalid credentials', 401, 'INVALID_CREDENTIALS');
    }

    if (user.status !== 'active') {
      throw createError('Account is not active', 403, 'ACCOUNT_INACTIVE');
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { userId: user.id },
      JWT_REFRESH_SECRET,
      { expiresIn: '7d' }
    );

    user.lastLogin = new Date();
    await userRepository.save(user);

    logger.info(`User logged in: ${user.email}`);

    res.json({
      success: true,
      data: {
        accessToken,
        refreshToken,
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Refresh token
router.post('/refresh', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      throw createError('Refresh token is required', 400, 'VALIDATION_ERROR');
    }

    const decoded = jwt.verify(refreshToken, JWT_REFRESH_SECRET) as { userId: string };
    
    const userRepository = AppDataSource.getRepository(User);
    const user = await userRepository.findOne({ where: { id: decoded.userId } });

    if (!user || user.status !== 'active') {
      throw createError('Invalid refresh token', 401, 'INVALID_TOKEN');
    }

    const accessToken = jwt.sign(
      { userId: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '15m' }
    );

    res.json({
      success: true,
      data: { accessToken },
    });
  } catch (error) {
    next(error);
  }
});

// Logout (client-side token removal, but we can log it)
router.post('/logout', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader) {
      const token = authHeader.split(' ')[1];
      const decoded = jwt.decode(token) as { email?: string };
      if (decoded?.email) {
        logger.info(`User logged out: ${decoded.email}`);
      }
    }

    res.json({ success: true, message: 'Logged out successfully' });
  } catch (error) {
    next(error);
  }
});

// Register (admin only in production)
router.post('/register', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { email, password, name, phone, role } = req.body;

    if (!email || !password || !name) {
      throw createError('Email, password, and name are required', 400, 'VALIDATION_ERROR');
    }

    const userRepository = AppDataSource.getRepository(User);
    
    const existingUser = await userRepository.findOne({ where: { email } });
    if (existingUser) {
      throw createError('User already exists', 400, 'USER_EXISTS');
    }

    const hashedPassword = await bcrypt.hash(password, 10);

    const user = userRepository.create({
      email,
      password: hashedPassword,
      name,
      phone,
      role: role || 'support',
    });

    await userRepository.save(user);

    logger.info(`New user registered: ${user.email}`);

    res.status(201).json({
      success: true,
      data: {
        user: {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

export const authRouter = router;
