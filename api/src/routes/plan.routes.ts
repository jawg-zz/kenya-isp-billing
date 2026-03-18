import { Router, IRouter } from 'express';
import { planController } from '../controllers/plan.controller';
import { authenticate, authorize, optionalAuth } from '../middleware/auth';
import { validate } from '../middleware/validate';
import { createPlanSchema, updatePlanSchema } from '../validators/plan.validator';
import { idParamSchema } from '../validators/common';

const router: IRouter = Router();

/**
 * @swagger
 * tags:
 *   name: Plans
 *   description: Internet plan management
 */

/**
 * @swagger
 * /plans:
 *   get:
 *     summary: List all active plans
 *     tags: [Plans]
 *     security: []
 *     parameters:
 *       - in: query
 *         name: type
 *         schema:
 *           type: string
 *           enum: [PREPAID, POSTPAID]
 *         description: Filter by plan type
 *       - in: query
 *         name: dataType
 *         schema:
 *           type: string
 *           enum: [LIMITED, UNLIMITED, FAIR_USAGE]
 *         description: Filter by data type
 *     responses:
 *       200:
 *         description: List of active plans
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
 *                     plans:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/Plan'
 */
router.get('/', planController.getPlans);

/**
 * @swagger
 * /plans/featured:
 *   get:
 *     summary: Get featured plans
 *     tags: [Plans]
 *     security: []
 *     responses:
 *       200:
 *         description: Featured plans (up to 6)
 */
router.get('/featured', planController.getFeaturedPlans);

/**
 * @swagger
 * /plans/{id}:
 *   get:
 *     summary: Get plan details
 *     tags: [Plans]
 *     security: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Plan details
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
 *                     plan:
 *                       $ref: '#/components/schemas/Plan'
 *       404:
 *         description: Plan not found
 */
router.get('/:id', validate(idParamSchema, 'params'), planController.getPlan);

// Admin routes
router.use(authenticate);

/**
 * @swagger
 * /plans:
 *   post:
 *     summary: Create a new plan (admin)
 *     tags: [Plans]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CreatePlanRequest'
 *     responses:
 *       201:
 *         description: Plan created
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
 *                     plan:
 *                       $ref: '#/components/schemas/Plan'
 *       403:
 *         description: Forbidden (admin only)
 */
router.post('/', authorize('ADMIN'), validate(createPlanSchema), planController.createPlan);

/**
 * @swagger
 * /plans/{id}:
 *   put:
 *     summary: Update a plan (admin)
 *     tags: [Plans]
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
 *             $ref: '#/components/schemas/CreatePlanRequest'
 *     responses:
 *       200:
 *         description: Plan updated
 *       403:
 *         description: Forbidden
 *       404:
 *         description: Plan not found
 */
router.put('/:id', authorize('ADMIN'), validate(idParamSchema, 'params'), validate(updatePlanSchema), planController.updatePlan);

/**
 * @swagger
 * /plans/{id}:
 *   delete:
 *     summary: Deactivate a plan (admin)
 *     description: Soft-deletes a plan by setting isActive to false. Cannot deactivate plans with active subscriptions.
 *     tags: [Plans]
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
 *         description: Plan deactivated
 *       400:
 *         description: Plan has active subscriptions
 *       403:
 *         description: Forbidden
 */
router.delete('/:id', authorize('ADMIN'), validate(idParamSchema, 'params'), planController.deletePlan);

export default router;
