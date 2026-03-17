import bcrypt from 'bcryptjs';
import { Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { smsService } from '../services/sms.service';
import { radiusService } from '../services/radius.service';
import { AuthenticatedRequest, ApiResponse, NotFoundError, ConflictError } from '../types';
import { logger } from '../config/logger';

class CustomerController {
  // Get all customers (admin)
  async getCustomers(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const page = parseInt(req.query.page as string) || 1;
      const limit = parseInt(req.query.limit as string) || 20;
      const status = req.query.status as string;
      const search = req.query.search as string;
      const county = req.query.county as string;

      const where: any = {};

      if (status) {
        where.user = { accountStatus: status };
      }

      if (county) {
        where.user = { ...where.user, county };
      }

      if (search) {
        where.OR = [
          { customerCode: { contains: search, mode: 'insensitive' } },
          { accountNumber: { contains: search, mode: 'insensitive' } },
          { user: { firstName: { contains: search, mode: 'insensitive' } } },
          { user: { lastName: { contains: search, mode: 'insensitive' } } },
          { user: { email: { contains: search, mode: 'insensitive' } } },
          { user: { phone: { contains: search } } },
        ];
      }

      const [customers, total] = await Promise.all([
        prisma.customer.findMany({
          where,
          include: {
            user: {
              select: {
                firstName: true,
                lastName: true,
                email: true,
                phone: true,
                accountStatus: true,
                county: true,
                createdAt: true,
              },
            },
            subscriptions: {
              where: { status: 'ACTIVE' },
              include: { plan: { select: { name: true } } },
              take: 1,
            },
            _count: {
              select: {
                subscriptions: true,
                payments: true,
                invoices: true,
              },
            },
          },
          orderBy: { createdAt: 'desc' },
          skip: (page - 1) * limit,
          take: limit,
        }),
        prisma.customer.count({ where }),
      ]);

      const response: ApiResponse = {
        success: true,
        data: {
          customers,
          meta: { total, page, limit, totalPages: Math.ceil(total / limit) },
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Get single customer (admin)
  async getCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;

      const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
          user: true,
          subscriptions: {
            include: { plan: true },
            orderBy: { createdAt: 'desc' },
            take: 5,
          },
          payments: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          invoices: {
            orderBy: { createdAt: 'desc' },
            take: 10,
          },
          radiusConfig: true,
        },
      });

      if (!customer) {
        throw new NotFoundError('Customer not found');
      }

      const response: ApiResponse = {
        success: true,
        data: { customer },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Create customer (admin)
  async createCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        email,
        password,
        firstName,
        lastName,
        phone,
        addressLine1,
        addressLine2,
        city,
        county,
        postalCode,
        idNumber,
        kraPin,
        creditLimit,
        notes,
      } = req.body;

      // Check if user exists
      const existingUser = await prisma.user.findFirst({
        where: {
          OR: [
            { email: email.toLowerCase() },
            { phone },
          ],
        },
      });

      if (existingUser) {
        throw new ConflictError('User with this email or phone already exists');
      }

      const hashedPassword = await bcrypt.hash(password, 12);
      const customerCode = `CUST${Date.now().toString(36).toUpperCase()}`;
      const accountNumber = `ACC${Math.random().toString(16).substr(2, 8).toUpperCase()}`;

      const result = await prisma.$transaction(async (tx) => {
        const user = await tx.user.create({
          data: {
            email: email.toLowerCase(),
            password: hashedPassword,
            firstName,
            lastName,
            phone,
            addressLine1,
            addressLine2,
            city,
            county,
            postalCode,
            idNumber,
            kraPin,
            accountStatus: 'ACTIVE',
            phoneVerified: true,
            emailVerified: true,
          },
        });

        const customer = await tx.customer.create({
          data: {
            userId: user.id,
            customerCode,
            accountNumber,
            creditLimit: creditLimit || 0,
            notes,
          },
        });

        return { user, customer };
      });

      // Create RADIUS user
      await radiusService.createRadiusUser(result.customer.id);

      // Send welcome SMS
      if (phone) {
        await smsService.send({
          to: phone,
          message: `Welcome to ISP Billing! Your customer code is ${customerCode}. Your account is now active.`
        });
      }

      logger.info(`Customer created: ${result.customer.customerCode}`);

      const response: ApiResponse = {
        success: true,
        message: 'Customer created successfully',
        data: {
          customer: {
            ...result.customer,
            user: result.user,
          },
        },
      };

      res.status(201).json(response);
    } catch (error) {
      next(error);
    }
  }

  // Update customer (admin)
  async updateCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const updateData = req.body;

      const customer = await prisma.customer.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!customer) {
        throw new NotFoundError('Customer not found');
      }

      // Separate user and customer fields
      const userFields = ['firstName', 'lastName', 'phone', 'addressLine1', 'addressLine2', 'city', 'county', 'postalCode', 'idNumber', 'kraPin', 'accountStatus'];
      const customerFields = ['creditLimit', 'notes'];

      const userData: any = {};
      const customerData: any = {};

      for (const [key, value] of Object.entries(updateData)) {
        if (userFields.includes(key)) userData[key] = value;
        if (customerFields.includes(key)) customerData[key] = value;
      }

      const [updatedUser, updatedCustomer] = await Promise.all([
        Object.keys(userData).length > 0
          ? prisma.user.update({ where: { id: customer.userId }, data: userData })
          : null,
        Object.keys(customerData).length > 0
          ? prisma.customer.update({ where: { id }, data: customerData })
          : null,
      ]);

      // Handle account status changes
      if (userData.accountStatus === 'SUSPENDED') {
        await radiusService.disableUser(id);
      } else if (userData.accountStatus === 'ACTIVE') {
        await radiusService.enableUser(id);
      }

      const response: ApiResponse = {
        success: true,
        message: 'Customer updated successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Adjust customer balance (admin)
  async adjustBalance(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;
      const { amount, reason, type } = req.body;

      const customer = await prisma.customer.findUnique({
        where: { id },
        include: { user: true },
      });

      if (!customer) {
        throw new NotFoundError('Customer not found');
      }

      const adjustment = type === 'CREDIT' ? amount : -amount;

      await prisma.customer.update({
        where: { id },
        data: {
          balance: {
            increment: adjustment,
          },
          metadata: {
            ...((customer.metadata as object) || {}),
            lastBalanceAdjustment: {
              amount: adjustment,
              reason,
              type,
              adjustedBy: req.user!.id,
              adjustedAt: new Date().toISOString(),
            },
          },
        },
      });

      // Create notification
      await prisma.notification.create({
        data: {
          userId: customer.userId,
          type: 'PAYMENT_RECEIVED',
          title: 'Balance Adjustment',
          message: `Your account balance has been ${type === 'CREDIT' ? 'credited' : 'debited'} with KES ${amount}. Reason: ${reason}`,
          channel: 'in_app',
        },
      });

      const response: ApiResponse = {
        success: true,
        message: `Balance ${type === 'CREDIT' ? 'credited' : 'debited'} successfully`,
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Get customer stats (admin)
  async getCustomerStats(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const [totalCustomers, activeCustomers, suspendedCustomers, newCustomers] = await Promise.all([
        prisma.customer.count(),
        prisma.customer.count({
          where: { user: { accountStatus: 'ACTIVE' } },
        }),
        prisma.customer.count({
          where: { user: { accountStatus: 'SUSPENDED' } },
        }),
        prisma.customer.count({
          where: {
            createdAt: {
              gte: new Date(new Date().setDate(new Date().getDate() - 30)),
            },
          },
        }),
      ]);

      const customersByCounty = await prisma.user.groupBy({
        by: ['county'],
        _count: true,
        where: {
          role: 'CUSTOMER',
          county: { not: null },
        },
      });

      const response: ApiResponse = {
        success: true,
        data: {
          totalCustomers,
          activeCustomers,
          suspendedCustomers,
          newCustomers,
          customersByCounty,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  // Delete customer (admin)
  async deleteCustomer(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const id = req.params.id as string;

      const customer = await prisma.customer.findUnique({
        where: { id },
        include: {
          subscriptions: { where: { status: 'ACTIVE' } },
        },
      });

      if (!customer) {
        throw new NotFoundError('Customer not found');
      }

      if (customer.subscriptions.length > 0) {
        res.status(400).json({
          success: false,
          message: 'Cannot delete customer with active subscriptions',
        });
        return;
      }

      // Soft delete - set status to TERMINATED
      await prisma.user.update({
        where: { id: customer.userId },
        data: { accountStatus: 'TERMINATED' },
      });

      // Disable RADIUS user
      await radiusService.disableUser(id);

      const response: ApiResponse = {
        success: true,
        message: 'Customer terminated successfully',
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const customerController = new CustomerController();
export default customerController;
