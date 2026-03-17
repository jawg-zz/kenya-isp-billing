"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceController = void 0;
const fs_1 = __importDefault(require("fs"));
const database_1 = require("../config/database");
const invoice_service_1 = require("../services/invoice.service");
const types_1 = require("../types");
class InvoiceController {
    // Get customer's invoices
    async getInvoices(req, res, next) {
        try {
            const status = req.query.status;
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const where = {
                customer: { userId: req.user.id },
            };
            if (status)
                where.status = status;
            const [invoices, total] = await Promise.all([
                database_1.prisma.invoice.findMany({
                    where,
                    include: {
                        payments: {
                            select: {
                                id: true,
                                amount: true,
                                status: true,
                                method: true,
                                processedAt: true,
                            },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                database_1.prisma.invoice.count({ where }),
            ]);
            const response = {
                success: true,
                data: {
                    invoices,
                    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
                },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Get single invoice
    async getInvoice(req, res, next) {
        try {
            const id = req.params.id;
            const invoice = await database_1.prisma.invoice.findFirst({
                where: {
                    id,
                    customer: { userId: req.user.id },
                },
                include: {
                    customer: {
                        include: { user: true },
                    },
                    subscription: {
                        include: { plan: true },
                    },
                    payments: true,
                },
            });
            if (!invoice) {
                throw new types_1.NotFoundError('Invoice not found');
            }
            const response = {
                success: true,
                data: { invoice },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Download invoice PDF
    async downloadInvoice(req, res, next) {
        try {
            const id = req.params.id;
            const invoice = await database_1.prisma.invoice.findFirst({
                where: {
                    id,
                    customer: { userId: req.user.id },
                },
            });
            if (!invoice) {
                throw new types_1.NotFoundError('Invoice not found');
            }
            // Generate PDF if not exists
            if (!invoice_service_1.invoiceService.invoiceExists(invoice.invoiceNumber)) {
                await invoice_service_1.invoiceService.generatePDF(invoice.id);
            }
            const filePath = invoice_service_1.invoiceService.getInvoiceFilePath(invoice.invoiceNumber);
            res.setHeader('Content-Type', 'application/pdf');
            res.setHeader('Content-Disposition', `attachment; filename="Invoice_${invoice.invoiceNumber}.pdf"`);
            const fileStream = fs_1.default.createReadStream(filePath);
            fileStream.pipe(res);
        }
        catch (error) {
            next(error);
        }
    }
    // Get all invoices (admin)
    async getAllInvoices(req, res, next) {
        try {
            const page = parseInt(req.query.page) || 1;
            const limit = parseInt(req.query.limit) || 20;
            const status = req.query.status;
            const customerId = req.query.customerId;
            const startDate = req.query.startDate;
            const endDate = req.query.endDate;
            const where = {};
            if (status)
                where.status = status;
            if (customerId)
                where.customerId = customerId;
            if (startDate || endDate) {
                where.createdAt = {};
                if (startDate)
                    where.createdAt.gte = new Date(startDate);
                if (endDate)
                    where.createdAt.lte = new Date(endDate);
            }
            const [invoices, total] = await Promise.all([
                database_1.prisma.invoice.findMany({
                    where,
                    include: {
                        customer: {
                            include: { user: { select: { firstName: true, lastName: true } } },
                        },
                    },
                    orderBy: { createdAt: 'desc' },
                    skip: (page - 1) * limit,
                    take: limit,
                }),
                database_1.prisma.invoice.count({ where }),
            ]);
            const response = {
                success: true,
                data: {
                    invoices,
                    meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
                },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Create invoice (admin)
    async createInvoice(req, res, next) {
        try {
            const { billingService } = require('../services/billing.service');
            const invoice = await billingService.createManualInvoice(req.body);
            const response = {
                success: true,
                message: 'Invoice created successfully',
                data: { invoice },
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Update invoice status (admin)
    async updateInvoiceStatus(req, res, next) {
        try {
            const id = req.params.id;
            const { status, notes } = req.body;
            const invoice = await database_1.prisma.invoice.findUnique({
                where: { id },
            });
            if (!invoice) {
                throw new types_1.NotFoundError('Invoice not found');
            }
            const updateData = { status };
            if (notes)
                updateData.notes = notes;
            if (status === 'PAID')
                updateData.paidAt = new Date();
            if (status === 'CANCELLED')
                updateData.cancelledAt = new Date();
            const updatedInvoice = await database_1.prisma.invoice.update({
                where: { id },
                data: updateData,
            });
            const response = {
                success: true,
                message: 'Invoice status updated',
                data: { invoice: updatedInvoice },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Generate invoices (admin)
    async generateInvoices(req, res, next) {
        try {
            const { billingService } = require('../services/billing.service');
            const result = await billingService.generateDueInvoices();
            const response = {
                success: true,
                message: `Generated ${result.generated} invoices with ${result.errors} errors`,
                data: result,
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Get invoice stats (admin)
    async getInvoiceStats(req, res, next) {
        try {
            const [totalInvoices, paidInvoices, pendingInvoices, overdueInvoices, totalAmount, paidAmount, pendingAmount,] = await Promise.all([
                database_1.prisma.invoice.count(),
                database_1.prisma.invoice.count({ where: { status: 'PAID' } }),
                database_1.prisma.invoice.count({ where: { status: 'PENDING' } }),
                database_1.prisma.invoice.count({ where: { status: 'OVERDUE' } }),
                database_1.prisma.invoice.aggregate({
                    _sum: { totalAmount: true },
                }),
                database_1.prisma.invoice.aggregate({
                    where: { status: 'PAID' },
                    _sum: { totalAmount: true },
                }),
                database_1.prisma.invoice.aggregate({
                    where: { status: 'PENDING' },
                    _sum: { totalAmount: true },
                }),
            ]);
            const response = {
                success: true,
                data: {
                    totalInvoices,
                    paidInvoices,
                    pendingInvoices,
                    overdueInvoices,
                    totalAmount: Number(totalAmount._sum.totalAmount) || 0,
                    paidAmount: Number(paidAmount._sum.totalAmount) || 0,
                    pendingAmount: Number(pendingAmount._sum.totalAmount) || 0,
                },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.invoiceController = new InvoiceController();
exports.default = exports.invoiceController;
//# sourceMappingURL=invoice.controller.js.map