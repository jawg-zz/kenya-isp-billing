import { Router, IRouter } from 'express';
import { planController } from '../controllers/plan.controller';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createPlanSchema, updatePlanSchema } from '../validators/plan.validator';

const router: IRouter = Router();

// Public routes
router.get('/', planController.getPlans);
router.get('/featured', planController.getFeaturedPlans);
router.get('/:id', planController.getPlan);

// Admin routes
router.use(authenticate);
router.post('/', authorize('ADMIN'), validate(createPlanSchema), planController.createPlan);
router.put('/:id', authorize('ADMIN'), validate(updatePlanSchema), planController.updatePlan);
router.delete('/:id', authorize('ADMIN'), planController.deletePlan);

export default router;
