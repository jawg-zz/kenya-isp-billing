"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const plan_controller_1 = require("../controllers/plan.controller");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const plan_validator_1 = require("../validators/plan.validator");
const router = (0, express_1.Router)();
// Public routes
router.get('/', plan_controller_1.planController.getPlans);
router.get('/featured', plan_controller_1.planController.getFeaturedPlans);
router.get('/:id', plan_controller_1.planController.getPlan);
// Admin routes
router.use(auth_1.authenticate);
router.post('/', (0, auth_1.authorize)('ADMIN'), (0, validate_1.validate)(plan_validator_1.createPlanSchema), plan_controller_1.planController.createPlan);
router.put('/:id', (0, auth_1.authorize)('ADMIN'), (0, validate_1.validate)(plan_validator_1.updatePlanSchema), plan_controller_1.planController.updatePlan);
router.delete('/:id', (0, auth_1.authorize)('ADMIN'), plan_controller_1.planController.deletePlan);
exports.default = router;
//# sourceMappingURL=plan.routes.js.map