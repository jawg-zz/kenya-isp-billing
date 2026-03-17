import { Router, IRouter } from 'express';
import { invoiceController } from '../controllers/invoice.controller';
import { authenticate, authorize } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createInvoiceSchema } from '../validators/invoice.validator';

const router: IRouter = Router();

router.use(authenticate);

// Customer routes
router.get('/', invoiceController.getInvoices);

// Admin routes (BEFORE /:id to avoid route conflicts)
router.get('/admin/all', authorize('ADMIN', 'SUPPORT'), invoiceController.getAllInvoices);
router.post('/admin/create', authorize('ADMIN'), validate(createInvoiceSchema), invoiceController.createInvoice);
router.put('/admin/:id/status', authorize('ADMIN', 'SUPPORT'), invoiceController.updateInvoiceStatus);
router.post('/admin/generate', authorize('ADMIN'), invoiceController.generateInvoices);
router.get('/admin/stats', authorize('ADMIN', 'SUPPORT'), invoiceController.getInvoiceStats);

// Dynamic routes LAST
router.get('/:id', invoiceController.getInvoice);
router.get('/:id/download', invoiceController.downloadInvoice);

export default router;
