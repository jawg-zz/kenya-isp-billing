"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const invoice_controller_1 = require("../controllers/invoice.controller");
const auth_1 = require("../middleware/auth");
const validate_1 = require("../middleware/validate");
const invoice_validator_1 = require("../validators/invoice.validator");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
// Customer routes
router.get('/', invoice_controller_1.invoiceController.getInvoices);
router.get('/:id', invoice_controller_1.invoiceController.getInvoice);
router.get('/:id/download', invoice_controller_1.invoiceController.downloadInvoice);
// Admin routes
router.get('/admin/all', (0, auth_1.authorize)('ADMIN', 'SUPPORT'), invoice_controller_1.invoiceController.getAllInvoices);
router.post('/admin/create', (0, auth_1.authorize)('ADMIN'), (0, validate_1.validate)(invoice_validator_1.createInvoiceSchema), invoice_controller_1.invoiceController.createInvoice);
router.put('/admin/:id/status', (0, auth_1.authorize)('ADMIN', 'SUPPORT'), invoice_controller_1.invoiceController.updateInvoiceStatus);
router.post('/admin/generate', (0, auth_1.authorize)('ADMIN'), invoice_controller_1.invoiceController.generateInvoices);
router.get('/admin/stats', (0, auth_1.authorize)('ADMIN', 'SUPPORT'), invoice_controller_1.invoiceController.getInvoiceStats);
exports.default = router;
//# sourceMappingURL=invoice.routes.js.map