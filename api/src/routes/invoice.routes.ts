import { Router, IRouter } from 'express';
import { invoiceController } from '../controllers/invoice.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createInvoiceSchema } from '../validators/invoice.validator';

const router: IRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Invoices
 *   description: Invoice management and billing
 */

router.use(authenticate);

/**
 * @swagger
 * /invoices:
 *   get:
 *     summary: Get customer's invoices
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *           enum: [DRAFT, PENDING, PAID, OVERDUE, CANCELLED]
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
 *     responses:
 *       200:
 *         description: Paginated invoices list
 */
router.get('/', invoiceController.getInvoices);

/**
 * @swagger
 * /invoices/admin/all:
 *   get:
 *     summary: Get all invoices (admin)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *       - in: query
 *         name: customerId
 *         schema:
 *           type: string
 *       - in: query
 *         name: startDate
 *         schema:
 *           type: string
 *           format: date
 *       - in: query
 *         name: endDate
 *         schema:
 *           type: string
 *           format: date
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
 *     responses:
 *       200:
 *         description: All invoices
 *       403:
 *         description: Forbidden
 */
router.get('/admin/all', authorize('ADMIN', 'SUPPORT'), invoiceController.getAllInvoices);

/**
 * @swagger
 * /invoices/admin/create:
 *   post:
 *     summary: Create a manual invoice (admin)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [customerId, subscriptionId, items]
 *             properties:
 *               customerId:
 *                 type: string
 *               subscriptionId:
 *                 type: string
 *               items:
 *                 type: array
 *                 items:
 *                   type: object
 *                   properties:
 *                     description:
 *                       type: string
 *                     quantity:
 *                       type: number
 *                     unitPrice:
 *                       type: number
 *               dueDate:
 *                 type: string
 *                 format: date
 *               notes:
 *                 type: string
 *     responses:
 *       201:
 *         description: Invoice created
 *       403:
 *         description: Forbidden
 */
router.post('/admin/create', authorize('ADMIN'), validate(createInvoiceSchema), invoiceController.createInvoice);

/**
 * @swagger
 * /invoices/admin/{id}/status:
 *   put:
 *     summary: Update invoice status (admin)
 *     tags: [Invoices]
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
 *             required: [status]
 *             properties:
 *               status:
 *                 type: string
 *                 enum: [DRAFT, PENDING, PAID, OVERDUE, CANCELLED]
 *               notes:
 *                 type: string
 *     responses:
 *       200:
 *         description: Invoice status updated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Invoice not found
 */
router.put('/admin/:id/status', authorize('ADMIN', 'SUPPORT'), invoiceController.updateInvoiceStatus);

/**
 * @swagger
 * /invoices/admin/generate:
 *   post:
 *     summary: Generate due invoices (admin)
 *     description: Runs the billing engine to create invoices for subscriptions with due billing.
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Generation result
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 message:
 *                   type: string
 *                 data:
 *                   type: object
 *                   properties:
 *                     generated:
 *                       type: integer
 *                     errors:
 *                       type: integer
 *       403:
 *         description: Forbidden
 */
router.post('/admin/generate', authorize('ADMIN'), invoiceController.generateInvoices);

/**
 * @swagger
 * /invoices/admin/stats:
 *   get:
 *     summary: Get invoice statistics (admin)
 *     tags: [Invoices]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Invoice statistics
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   $ref: '#/components/schemas/InvoiceStats'
 *       403:
 *         description: Forbidden
 */
router.get('/admin/stats', authorize('ADMIN', 'SUPPORT'), invoiceController.getInvoiceStats);

/**
 * @swagger
 * /invoices/{id}:
 *   get:
 *     summary: Get invoice details
 *     tags: [Invoices]
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
 *         description: Invoice details with customer, subscription, and payments
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 success:
 *                   type: boolean
 *                 data:
 *                   type: object
 *                   properties:
 *                     invoice:
 *                       $ref: '#/components/schemas/Invoice'
 *       404:
 *         description: Invoice not found
 */
router.get('/:id', invoiceController.getInvoice);

/**
 * @swagger
 * /invoices/{id}/download:
 *   get:
 *     summary: Download invoice as PDF
 *     tags: [Invoices]
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
 *         description: PDF file download
 *         content:
 *           application/pdf:
 *             schema:
 *               type: string
 *               format: binary
 *       404:
 *         description: Invoice not found
 */
router.get('/:id/download', invoiceController.downloadInvoice);

export default router;
