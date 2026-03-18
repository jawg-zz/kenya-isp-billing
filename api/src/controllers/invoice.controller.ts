import { Response, NextFunction } from 'express';
import fs from 'fs';
import { prisma } from '../config/database';
import { cache } from '../config/redis';
import { cacheAsideWithMutex } from '../utils/cacheMutex';
import { invoiceService } from '../services/invoice.service';
import { generateInvoicePDF } from '../templates/invoice-pdf';
import config from '../config';
import { AuthenticatedRequest, ApiResponse, NotFoundError } from '../types';

class InvoiceController {
  // Get customer's invoices
  async getInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const status = req.query.status as string;
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;

      const where: any = {
        customer: { userId: req.user!.id },
      };
      if (status) where.status = status;

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
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
        prisma.invoice.count({ where }),
      ]);

      const response: ApiResponse = {
        success: true,
        data: {
          invoices,
          meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Get single invoice
  async getInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;

      const invoice = await prisma.invoice.findFirst({
        where: {
          id,
          customer: { userId: req.user!.id },
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
        throw new NotFoundError('Invoice not found');
      }

      const response: ApiResponse = {
        success: true,
        data: { invoice },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Download invoice PDF
  async downloadInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;

      const invoice = await prisma.invoice.findFirst({
        where: {
          id,
          customer: { userId: req.user!.id },
        },
        include: {
          customer: {
            include: { user: true },
          },
          subscription: {
            include: { plan: true },
          },
        },
      });

      if (!invoice) {
        throw new NotFoundError('Invoice not found');
      }

      const filePath = invoiceService.getInvoiceFilePath(invoice.invoiceNumber);
      const fileExists = invoiceService.invoiceExists(invoice.invoiceNumber);

      // Generate PDF using the new template
      if (!fileExists) {
        const companySettings = {
          companyName: config.invoice.companyName,
          companyAddress: config.invoice.companyAddress,
          companyPhone: config.invoice.companyPhone,
          companyEmail: config.invoice.companyEmail,
          companyKraPin: config.invoice.companyKraPin,
          mpesaPaybill: config.mpesa.shortcode,
          tagline: 'Thank you for your business!',
        };

        await generateInvoicePDF(
          {
            invoiceNumber: invoice.invoiceNumber,
            status: invoice.status,
            subtotal: Number(invoice.subtotal),
            taxRate: Number(invoice.taxRate),
            taxAmount: Number(invoice.taxAmount),
            totalAmount: Number(invoice.totalAmount),
            createdAt: invoice.createdAt,
            dueDate: invoice.dueDate,
            notes: invoice.notes,
            metadata: invoice.metadata as { items?: Array<{ description: string; quantity: number; unitPrice: number; amount: number }> } | null,
          },
          {
            customerCode: invoice.customer.customerCode,
            accountNumber: invoice.customer.accountNumber,
            user: {
              firstName: invoice.customer.user.firstName,
              lastName: invoice.customer.user.lastName,
              email: invoice.customer.user.email,
              phone: invoice.customer.user.phone,
              addressLine1: invoice.customer.user.addressLine1,
              city: invoice.customer.user.city,
              county: invoice.customer.user.county,
              postalCode: invoice.customer.user.postalCode,
            },
          },
          companySettings
        );
      }

      res.setHeader('Content-Type', 'application/pdf');
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="Invoice_${invoice.invoiceNumber}.pdf"`
      );

      const fileStream = fs.createReadStream(filePath);
      fileStream.pipe(res);
    } catch (error) {
      next(error);
    }
  }

  // Get single invoice (admin)
  async getAdminInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;

      const invoice = await prisma.invoice.findUnique({
        where: { id },
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
        throw new NotFoundError('Invoice not found');
      }

      const response: ApiResponse = {
        success: true,
        data: { invoice },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Get all invoices (admin)
  async getAllInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const customerId = req.query.customerId as string;
      const startDate = req.query.startDate as string;
      const endDate = req.query.endDate as string;

      const where: any = {};
      if (status) where.status = status;
      if (customerId) where.customerId = customerId;
      if (startDate || endDate) {
        where.createdAt = {};
        if (startDate) where.createdAt.gte = new Date(startDate);
        if (endDate) where.createdAt.lte = new Date(endDate);
      }

      const [invoices, total] = await Promise.all([
        prisma.invoice.findMany({
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
        prisma.invoice.count({ where }),
      ]);

      const response: ApiResponse = {
        success: true,
        data: {
          invoices,
          meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Create invoice (admin)
  async createInvoice(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { billingService } = require('../services/billing.service');

      const invoice = await billingService.createManualInvoice(req.body);

      const response: ApiResponse = {
        success: true,
        message: 'Invoice created successfully',
        data: { invoice },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  // Update invoice status (admin)
  async updateInvoiceStatus(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const { status, notes } = req.body;

      const invoice = await prisma.invoice.findUnique({
        where: { id },
      });

      if (!invoice) {
        throw new NotFoundError('Invoice not found');
      }

      const updateData: any = { status };
      if (notes) updateData.notes = notes;
      if (status === 'PAID') updateData.paidAt = new Date();
      if (status === 'CANCELLED') updateData.cancelledAt = new Date();

      const updatedInvoice = await prisma.invoice.update({
        where: { id },
        data: updateData,
      });

      const response: ApiResponse = {
        success: true,
        message: 'Invoice status updated',
        data: { invoice: updatedInvoice },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Generate invoices (admin)
  async generateInvoices(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { billingService } = require('../services/billing.service');

      const result = await billingService.generateDueInvoices();

      const response: ApiResponse = {
        success: true,
        message: `Generated ${result.generated} invoices with ${result.errors} errors`,
        data: result,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Get invoice stats (admin) — cached 5 min with mutex protection
  async getInvoiceStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await cacheAsideWithMutex({
        key: 'admin:invoice-stats',
        ttlSeconds: 300,
        fetcher: async () => {
          const [
            totalInvoices,
            paidInvoices,
            pendingInvoices,
            overdueInvoices,
            totalAmount,
            paidAmount,
            pendingAmount,
          ] = await Promise.all([
            prisma.invoice.count(),
            prisma.invoice.count({ where: { status: 'PAID' } }),
            prisma.invoice.count({ where: { status: 'PENDING' } }),
            prisma.invoice.count({ where: { status: 'OVERDUE' } }),
            prisma.invoice.aggregate({
              _sum: { totalAmount: true },
            }),
            prisma.invoice.aggregate({
              where: { status: 'PAID' },
              _sum: { totalAmount: true },
            }),
            prisma.invoice.aggregate({
              where: { status: 'PENDING' },
              _sum: { totalAmount: true },
            }),
          ]);

          return {
            totalInvoices,
            paidInvoices,
            pendingInvoices,
            overdueInvoices,
            totalAmount: Number(totalAmount._sum.totalAmount) || 0,
            paidAmount: Number(paidAmount._sum.totalAmount) || 0,
            pendingAmount: Number(pendingAmount._sum.totalAmount) || 0,
          };
        },
      });

      const response: ApiResponse = {
        success: true,
        data,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const invoiceController = new InvoiceController();
export default invoiceController;
