import { Router, Response, NextFunction } from 'express';
import { ServicePlan, PlanType, PlanStatus } from '../entities/ServicePlan';
import { AppDataSource } from '../database';
import { createError } from '../middleware/errorHandler';
import { logger } from '../utils/logger';

const router = Router();
const planRepository = () => AppDataSource.getRepository(ServicePlan);

// Get all plans
router.get('/', async (req, res, next) => {
  try {
    const { type, status } = req.query;
    const query = planRepository().createQueryBuilder('plan');

    if (type) query.andWhere('plan.planType = :type', { type });
    if (status) query.andWhere('plan.status = :status', { status });

    const plans = await query.orderBy('plan.monthlyPrice', 'ASC').getMany();
    res.json({ success: true, data: plans });
  } catch (error) {
    next(error);
  }
});

// Get plan by ID
router.get('/:id', async (req, res, next) => {
  try {
    const plan = await planRepository().findOne({ where: { id: req.params.id } });
    if (!plan) throw createError('Plan not found', 404, 'NOT_FOUND');
    res.json({ success: true, data: plan });
  } catch (error) {
    next(error);
  }
});

// Create plan
router.post('/', async (req, res, next) => {
  try {
    const { name, description, bandwidthDown, bandwidthUp, dataCapGb, monthlyPrice, planType } = req.body;

    if (!name || !monthlyPrice) {
      throw createError('Name and price are required', 400, 'VALIDATION_ERROR');
    }

    const plan = planRepository().create({
      name,
      description,
      bandwidthDown: bandwidthDown || '10Mbps',
      bandwidthUp: bandwidthUp || '5Mbps',
      dataCapGb,
      monthlyPrice,
      planType: planType || PlanType.POSTPAID,
    });

    await planRepository().save(plan);
    logger.info(`Plan created: ${plan.name}`);

    res.status(201).json({ success: true, data: plan });
  } catch (error) {
    next(error);
  }
});

// Update plan
router.put('/:id', async (req, res, next) => {
  try {
    const plan = await planRepository().findOne({ where: { id: req.params.id } });
    if (!plan) throw createError('Plan not found', 404, 'NOT_FOUND');

    Object.assign(plan, req.body);
    await planRepository().save(plan);
    logger.info(`Plan updated: ${plan.name}`);

    res.json({ success: true, data: plan });
  } catch (error) {
    next(error);
  }
});

// Delete plan (deprecate)
router.delete('/:id', async (req, res, next) => {
  try {
    const plan = await planRepository().findOne({ where: { id: req.params.id } });
    if (!plan) throw createError('Plan not found', 404, 'NOT_FOUND');

    plan.status = PlanStatus.DEPRECATED;
    await planRepository().save(plan);

    res.json({ success: true, message: 'Plan deprecated' });
  } catch (error) {
    next(error);
  }
});

export const subscriptionRouter = router;
