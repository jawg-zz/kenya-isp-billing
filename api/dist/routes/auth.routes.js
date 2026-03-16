"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const auth_controller_1 = require("../controllers/auth.controller");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const rateLimiter_1 = require("../middleware/rateLimiter");
const auth_validator_1 = require("../validators/auth.validator");
const router = (0, express_1.Router)();
// Public routes
router.post('/register', rateLimiter_1.authRateLimiter, (0, validate_1.validate)(auth_validator_1.registerSchema), auth_controller_1.authController.register);
router.post('/login', rateLimiter_1.authRateLimiter, (0, validate_1.validate)(auth_validator_1.loginSchema), auth_controller_1.authController.login);
router.post('/refresh-token', (0, validate_1.validate)(auth_validator_1.refreshTokenSchema), auth_controller_1.authController.refreshToken);
router.post('/forgot-password', (0, validate_1.validate)(auth_validator_1.forgotPasswordSchema), auth_controller_1.authController.forgotPassword);
router.post('/reset-password', (0, validate_1.validate)(auth_validator_1.resetPasswordSchema), auth_controller_1.authController.resetPassword);
router.post('/verify-email', auth_controller_1.authController.verifyEmail);
// Protected routes
router.use(auth_1.authenticate);
router.get('/profile', auth_controller_1.authController.getProfile);
router.put('/profile', (0, validate_1.validate)(auth_validator_1.updateProfileSchema), auth_controller_1.authController.updateProfile);
router.post('/change-password', (0, validate_1.validate)(auth_validator_1.changePasswordSchema), auth_controller_1.authController.changePassword);
router.post('/logout', auth_controller_1.authController.logout);
router.post('/verify-phone', auth_controller_1.authController.verifyPhone);
// Notifications
router.get('/notifications', auth_controller_1.authController.getNotifications);
router.put('/notifications/:id/read', auth_controller_1.authController.markNotificationRead);
router.put('/notifications/read-all', auth_controller_1.authController.markAllNotificationsRead);
exports.default = router;
//# sourceMappingURL=auth.routes.js.map