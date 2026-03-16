"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const express_1 = require("express");
const customer_controller_1 = require("../controllers/customer.controller");
const auth_1 = require("../middleware/auth");
const billing_service_1 = require("../services/billing.service");
const router = (0, express_1.Router)();
router.use(auth_1.authenticate);
router.use((0, auth_1.authorize)('ADMIN', 'SUPPORT'));
// Customer management
router.get('/', customer_controller_1.customerController.getCustomers);
router.get('/stats', customer_controller_1.customerController.getCustomerStats);
router.get('/:id', customer_controller_1.customerController.getCustomer);
router.post('/', customer_controller_1.customerController.createCustomer);
router.put('/:id', customer_controller_1.customerController.updateCustomer);
router.delete('/:id', customer_controller_1.customerController.deleteCustomer);
router.post('/:id/balance', customer_controller_1.customerController.adjustBalance);
// Billing routes
router.get('/:id/billing-summary', async (req, res, next) => {
    try {
        const result = await billing_service_1.billingService.getCustomerBillingSummary(req.params.id);
        res.json({ success: true, data: result });
    }
    catch (error) {
        next(error);
    }
});
exports.default = router;
//# sourceMappingURL=customer.routes.js.map