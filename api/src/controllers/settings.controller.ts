import { Request, Response, NextFunction } from 'express';
import { prisma } from '../config/database';
import { AuthenticatedRequest, ApiResponse, NotFoundError, ValidationError } from '../types';

class SettingsController {
  /**
   * List all settings grouped by category
   */
  async listSettings(_req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const settings = await prisma.systemSetting.findMany({
        orderBy: [{ category: 'asc' }, { key: 'asc' }],
      });

      // Group by category
      const grouped: Record<string, typeof settings> = {};
      for (const setting of settings) {
        if (!grouped[setting.category]) {
          grouped[setting.category] = [];
        }
        grouped[setting.category].push(setting);
      }

      const response: ApiResponse = {
        success: true,
        data: {
          settings: grouped,
          total: settings.length,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get a single setting by key
   */
  async getSetting(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params;

      const setting = await prisma.systemSetting.findUnique({
        where: { key },
      });

      if (!setting) {
        throw new NotFoundError(`Setting with key "${key}" not found`);
      }

      const response: ApiResponse = {
        success: true,
        data: { setting },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Get settings by category
   */
  async getSettingsByCategory(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { category } = req.params;

      const settings = await prisma.systemSetting.findMany({
        where: { category },
        orderBy: { key: 'asc' },
      });

      const response: ApiResponse = {
        success: true,
        data: {
          category,
          settings,
          total: settings.length,
        },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Update a single setting by key (admin only)
   */
  async updateSetting(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { key } = req.params;
      const { value } = req.body;

      if (value === undefined || value === null) {
        throw new ValidationError('Value is required');
      }

      // Check if setting exists
      const existing = await prisma.systemSetting.findUnique({
        where: { key },
      });

      if (!existing) {
        throw new NotFoundError(`Setting with key "${key}" not found`);
      }

      const setting = await prisma.systemSetting.update({
        where: { key },
        data: { value: String(value) },
      });

      const response: ApiResponse = {
        success: true,
        message: 'Setting updated successfully',
        data: { setting },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }

  /**
   * Bulk update settings (admin only)
   */
  async bulkUpdateSettings(req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { settings } = req.body;

      if (!Array.isArray(settings) || settings.length === 0) {
        throw new ValidationError('settings array is required and must not be empty');
      }

      // Validate each entry
      for (const item of settings) {
        if (!item.key || item.value === undefined) {
          throw new ValidationError('Each setting must have a key and value');
        }
      }

      // Check that all keys exist
      const keys = settings.map((s: { key: string }) => s.key);
      const existing = await prisma.systemSetting.findMany({
        where: { key: { in: keys } },
        select: { key: true },
      });

      const existingKeys = new Set(existing.map((s) => s.key));
      const missing = keys.filter((k: string) => !existingKeys.has(k));
      if (missing.length > 0) {
        throw new NotFoundError(`Settings not found: ${missing.join(', ')}`);
      }

      // Perform updates in a transaction
      const updated = await prisma.$transaction(
        settings.map((item: { key: string; value: unknown }) =>
          prisma.systemSetting.update({
            where: { key: item.key },
            data: { value: String(item.value) },
          })
        )
      );

      const response: ApiResponse = {
        success: true,
        message: `${updated.length} settings updated successfully`,
        data: { settings: updated },
      };

      res.json(response);
    } catch (error) {
      next(error);
    }
  }
}

export const settingsController = new SettingsController();
export default settingsController;
