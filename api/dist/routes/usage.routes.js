"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const usage_controller_1 = require("../controllers/usage.controller");
const auth_1 = require("../middleware/auth");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Customer routes
router.get('/summary', usage_controller_1.usageController.getUsageSummary);
router.get('/realtime', usage_controller_1.usageController.getRealtimeUsage);
router.get('/history', usage_controller_1.usageController.getUsageHistory);
router.get('/format', usage_controller_1.usageController.formatBytes);
// Admin routes
router.get('/admin/analytics', (0, auth_1.authorize)('ADMIN', 'SUPPORT'), usage_controller_1.usageController.getUsageAnalytics);
exports.default = router;
//# sourceMappingURL=usage.routes.js.map