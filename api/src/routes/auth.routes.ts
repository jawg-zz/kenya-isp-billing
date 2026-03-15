import { Router } from 'express';
import { authController } from '../controllers/auth.controller';
import { authenticate, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { authRateLimiter } from '../middleware/rateLimiter';
import {
  registerSchema,
  loginSchema,
  refreshTokenSchema,
  changePasswordSchema,
  updateProfileSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validator';

const router = Router();

// Public routes
router.post('/register', authRateLimiter, validate(registerSchema), authController.register);
router.post('/login', authRateLimiter, validate(loginSchema), authController.login);
router.post('/refresh-token', validate(refreshTokenSchema), authController.refreshToken);
router.post('/forgot-password', validate(forgotPasswordSchema), authController.forgotPassword);
router.post('/reset-password', validate(resetPasswordSchema), authController.resetPassword);
router.post('/verify-email', authController.verifyEmail);

// Protected routes
router.use(authenticate);

router.get('/profile', authController.getProfile);
router.put('/profile', validate(updateProfileSchema), authController.updateProfile);
router.post('/change-password', validate(changePasswordSchema), authController.changePassword);
router.post('/logout', authController.logout);
router.post('/verify-phone', authController.verifyPhone);

// Notifications
router.get('/notifications', authController.getNotifications);
router.put('/notifications/:id/read', authController.markNotificationRead);
router.put('/notifications/read-all', authController.markAllNotificationsRead);

export default router;
