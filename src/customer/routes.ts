import { Router, Response, NextFunction } from 'express';
import { Customer, CustomerTier, CustomerStatus } from '../entities/Customer';
import { AppDataSource } from '../database';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const customerRepository = () => AppDataSource.getRepository(Customer);

// Generate customer number
async function generateCustomerNumber(): Promise<string> {
  const count = await customerRepository().count();
  return `CUS-${String(count + 1).padStart(6, '0')}`;
}

// Get all customers
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, limit = 20, tier, status, search } = req.query;
    
    const query = customerRepository().createQueryBuilder('customer');

    if (tier) query.andWhere('customer.tier = :tier', { tier });
    if (status) query.andWhere('customer.status = :status', { status });
    if (search) {
      query.andWhere(
        '(customer.name ILIKE :search OR customer.email ILIKE :search OR customer.phone ILIKE :search OR customer.customerNumber ILIKE :search)',
        { search: `%${search}%` }
      );
    }

    const [customers, total] = await query
      .orderBy('customer.createdAt', 'DESC')
      .skip((Number(page) - 1) * Number(limit))
      .take(Number(limit))
      .getManyAndCount();

    res.json({
      success: true,
      data: customers,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total,
        pages: Math.ceil(total / Number(limit)),
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get customer by ID
router.get('/:id', async (req, res, next) => {
  try {
    const customer = await customerRepository().findOne({
      where: { id: req.params.id },
      relations: ['subscriptions', 'invoices', 'payments'],
    });

    if (!customer) {
      throw createError('Customer not found', 404, 'NOT_FOUND');
    }

    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
});

// Create customer
router.post('/', async (req, res, next) => {
  try {
    const { name, email, phone, kraPin, address, tier, creditLimit } = req.body;

    if (!name || !phone) {
      throw createError('Name and phone are required', 400, 'VALIDATION_ERROR');
    }

    const customer = customerRepository().create({
      customerNumber: await generateCustomerNumber(),
      name,
      email,
      phone,
      kraPin,
      address,
      tier: tier || CustomerTier.RESIDENTIAL,
      creditLimit: creditLimit || 0,
    });

    await customerRepository().save(customer);
    logger.info(`Customer created: ${customer.customerNumber}`);

    res.status(201).json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
});

// Update customer
router.put('/:id', async (req, res, next) => {
  try {
    const customer = await customerRepository().findOne({
      where: { id: req.params.id },
    });

    if (!customer) {
      throw createError('Customer not found', 404, 'NOT_FOUND');
    }

    const { name, email, phone, kraPin, address, tier, status, creditLimit } = req.body;

    Object.assign(customer, {
      name: name ?? customer.name,
      email: email ?? customer.email,
      phone: phone ?? customer.phone,
      kraPin: kraPin ?? customer.kraPin,
      address: address ?? customer.address,
      tier: tier ?? customer.tier,
      status: status ?? customer.status,
      creditLimit: creditLimit ?? customer.creditLimit,
    });

    await customerRepository().save(customer);
    logger.info(`Customer updated: ${customer.customerNumber}`);

    res.json({ success: true, data: customer });
  } catch (error) {
    next(error);
  }
});

// Delete customer (soft delete - disconnect)
router.delete('/:id', async (req, res, next) => {
  try {
    const customer = await customerRepository().findOne({
      where: { id: req.params.id },
    });

    if (!customer) {
      throw createError('Customer not found', 404, 'NOT_FOUND');
    }

    customer.status = CustomerStatus.DISCONNECTED;
    await customerRepository().save(customer);
    logger.info(`Customer disconnected: ${customer.customerNumber}`);

    res.json({ success: true, message: 'Customer disconnected' });
  } catch (error) {
    next(error);
  }
});

export const customerRouter = router;
