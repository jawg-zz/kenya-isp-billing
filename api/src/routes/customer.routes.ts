import { Router, Request, Response, NextFunction, IRouter } from 'express';
import { customerController } from '../controllers/customer.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { idParamSchema } from '../validators/common';
import { billingService } from '../services/billing.service';

const router: IRouter = Router();

router.use(authenticate);
router.use(authorize('ADMIN', 'SUPPORT'));

/**
 * @swagger
 * tags:
 *   name: Customers
 *   description: Customer management
 */

/**
 * @swagger
 * /customers:
 *   get:
 *     summary: List all customers
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 20
 *       - in: query
 *         name: search
 *         schema:
 *           type: string
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [ACTIVE, SUSPENDED, PENDING, TERMINATED]
 *     responses:
 *       200:
 *         description: Paginated customer list
 */
// Customer management
router.get('/', customerController.getCustomers);

/**
 * @swagger
 * /customers/stats:
 *   get:
 *     summary: Get customer statistics
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Customer statistics
 */
router.get('/stats', customerController.getCustomerStats);

/**
 * @swagger
 * /customers/{id}:
 *   get:
 *     summary: Get customer details
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer details
 *       404:
 *         description: Customer not found
 */
router.get('/:id', validate(idParamSchema, 'params'), customerController.getCustomer);

/**
 * @swagger
 * /customers:
 *   post:
 *     summary: Create a new customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, firstName, lastName]
 *             properties:
 *               email:
 *                 type: string
 *                 format: email
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               addressLine1:
 *                 type: string
 *               city:
 *                 type: string
 *               county:
 *                 type: string
 *     responses:
 *       201:
 *         description: Customer created
 *       409:
 *         description: Email already exists
 */
router.post('/', customerController.createCustomer);

/**
 * @swagger
 * /customers/{id}:
 *   put:
 *     summary: Update customer details
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             properties:
 *               firstName:
 *                 type: string
 *               lastName:
 *                 type: string
 *               phone:
 *                 type: string
 *               addressLine1:
 *                 type: string
 *               city:
 *                 type: string
 *               county:
 *                 type: string
 *     responses:
 *       200:
 *         description: Customer updated
 *       404:
 *         description: Customer not found
 */
router.put('/:id', validate(idParamSchema, 'params'), customerController.updateCustomer);

/**
 * @swagger
 * /customers/{id}:
 *   delete:
 *     summary: Delete a customer
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Customer deleted
 *       404:
 *         description: Customer not found
 */
router.delete('/:id', validate(idParamSchema, 'params'), customerController.deleteCustomer);

/**
 * @swagger
 * /customers/{id}/balance:
 *   post:
 *     summary: Adjust customer balance
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [amount, reason]
 *             properties:
 *               amount:
 *                 type: number
 *               reason:
 *                 type: string
 *     responses:
 *       200:
 *         description: Balance adjusted
 *       404:
 *         description: Customer not found
 */
router.post('/:id/balance', validate(idParamSchema, 'params'), customerController.adjustBalance);

/**
 * @swagger
 * /customers/{id}/billing-summary:
 *   get:
 *     summary: Get customer billing summary
 *     tags: [Customers]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Billing summary with invoices and payments
 *       404:
 *         description: Customer not found
 */
router.get('/:id/billing-summary', validate(idParamSchema, 'params'), async (req: Request, res: Response, next: NextFunction) => {
  try {
    const result = await billingService.getCustomerBillingSummary(req.params.id as string);
    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

export default router;
