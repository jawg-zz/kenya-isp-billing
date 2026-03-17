import { Router, IRouter } from 'express';
import { settingsController } from '../controllers/settings.controller';
import { authenticate, authorize } from '../middleware/auth';

const router: IRouter = Router();

// All routes require authentication
router.use(authenticate);

/**
 * @swagger
 * tags:
 *   name: Settings
 *   description: System settings management
 */

/**
 * @swagger
 * /settings:
 *   get:
 *     summary: List all settings grouped by category
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       200:
 *         description: Settings grouped by category
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
 *                     settings:
 *                       type: object
 *                       additionalProperties:
 *                         type: array
 *                         items:
 *                           $ref: '#/components/schemas/SystemSetting'
 *                     total:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/', settingsController.listSettings);

/**
 * @swagger
 * /settings/category/{category}:
 *   get:
 *     summary: Get settings by category
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: category
 *         required: true
 *         schema:
 *           type: string
 *         description: Category name (e.g. company, payment, billing)
 *     responses:
 *       200:
 *         description: Settings for the specified category
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
 *                     category:
 *                       type: string
 *                     settings:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SystemSetting'
 *                     total:
 *                       type: integer
 *       401:
 *         description: Unauthorized
 */
router.get('/category/:category', settingsController.getSettingsByCategory);

/**
 * @swagger
 * /settings/{key}:
 *   get:
 *     summary: Get a single setting by key
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *         description: Setting key (e.g. company_name, tax_rate)
 *     responses:
 *       200:
 *         description: Setting found
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
 *                     setting:
 *                       $ref: '#/components/schemas/SystemSetting'
 *       401:
 *         description: Unauthorized
 *       404:
 *         description: Setting not found
 */
router.get('/:key', settingsController.getSetting);

/**
 * @swagger
 * /settings/{key}:
 *   put:
 *     summary: Update a setting value (admin only)
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: key
 *         required: true
 *         schema:
 *           type: string
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [value]
 *             properties:
 *               value:
 *                 oneOf:
 *                   - type: string
 *                   - type: number
 *                   - type: boolean
 *     responses:
 *       200:
 *         description: Setting updated
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
 *                     setting:
 *                       $ref: '#/components/schemas/SystemSetting'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: Setting not found
 */
router.put('/:key', authorize('ADMIN'), settingsController.updateSetting);

/**
 * @swagger
 * /settings/bulk:
 *   post:
 *     summary: Update multiple settings at once (admin only)
 *     tags: [Settings]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [settings]
 *             properties:
 *               settings:
 *                 type: array
 *                 items:
 *                   type: object
 *                   required: [key, value]
 *                   properties:
 *                     key:
 *                       type: string
 *                     value:
 *                       oneOf:
 *                         - type: string
 *                         - type: number
 *                         - type: boolean
 *     responses:
 *       200:
 *         description: Settings updated
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
 *                     settings:
 *                       type: array
 *                       items:
 *                         $ref: '#/components/schemas/SystemSetting'
 *       401:
 *         description: Unauthorized
 *       403:
 *         description: Forbidden — admin role required
 *       404:
 *         description: One or more setting keys not found
 */
router.post('/bulk', authorize('ADMIN'), settingsController.bulkUpdateSettings);

export default router;
