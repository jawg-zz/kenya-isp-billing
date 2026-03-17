import { Router, IRouter } from 'express';
import { subscriptionController } from '../controllers/subscription.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import {
  createSubscriptionSchema,
  cancelSubscriptionSchema,
} from '../validators/subscription.validator';

const router: IRouter = Router();

router.use(authenticate);

// Customer routes
router.get('/', subscriptionController.getSubscriptions);
router.get('/:id', subscriptionController.getSubscription);
router.post('/', validate(createSubscriptionSchema), subscriptionController.createSubscription);
router.post('/renew', subscriptionController.renewSubscription);
router.post('/cancel', validate(cancelSubscriptionSchema), subscriptionController.cancelSubscription);
router.put('/auto-renew', subscriptionController.toggleAutoRenew);

// Admin routes
router.get('/admin/all', authorize('ADMIN', 'SUPPORT'), subscriptionController.getAllSubscriptions);
router.get('/admin/expiring', authorize('ADMIN', 'SUPPORT'), subscriptionController.getExpiringSubscriptions);

export default router;
