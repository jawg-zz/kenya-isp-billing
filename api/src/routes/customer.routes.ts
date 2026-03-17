import { Router, Request, Response, NextFunction, IRouter } from 'express';
import { customerController } from '../controllers/customer.controller';
import { authenticate, authorize } from '../middleware/auth';
import { billingService } from '../services/billing.service';

const router: IRouter = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'SUPPORT'));

// Customer management
router.get('/', customerController.getCustomers);
router.get('/stats', customerController.getCustomerStats);
router.get('/:id', customerController.getCustomer);
router.post('/', customerController.createCustomer);
router.put('/:id', customerController.updateCustomer);
router.delete('/:id', customerController.deleteCustomer);
router.post('/:id/balance', customerController.adjustBalance);

// Billing routes
router.get('/:id/billing-summary', async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await billingService.getCustomerBillingSummary(req.params.id as string);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
