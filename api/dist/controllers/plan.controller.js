"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.planController = void 0;
const database_1 = require("../config/database");
const types_1 = require("../types");
class PlanController {
    // Get all plans (public)
    async getPlans(req, res, next) {
        try {
            const type = req.query.type;
            const dataType = req.query.dataType;
            const where = { isActive: true };
            if (type)
                where.type = type;
            if (dataType)
                where.dataType = dataType;
            const plans = await database_1.prisma.plan.findMany({
                where,
                include: {
                    planPrices: true,
                },
                orderBy: [
                    { sortOrder: 'asc' },
                    { price: 'asc' },
                ],
            });
            const response = {
                success: true,
                data: { plans },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Get single plan
    async getPlan(req, res, next) {
        try {
            const id = req.params.id;
            const plan = await database_1.prisma.plan.findUnique({
                where: { id },
                include: {
                    planPrices: true,
                },
            });
            if (!plan) {
                throw new types_1.NotFoundError('Plan not found');
            }
            const response = {
                success: true,
                data: { plan },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Create plan (admin)
    async createPlan(req, res, next) {
        try {
            const { name, description, code, type, dataType, price, dataAllowance, voiceMinutes, smsAllowance, speedLimit, billingCycle, validityDays, fupThreshold, fupSpeedLimit, isFeatured, sortOrder, prices, } = req.body;
            const plan = await database_1.prisma.plan.create({
                data: {
                    name,
                    description,
                    code: code.toUpperCase(),
                    type,
                    dataType,
                    price,
                    dataAllowance: dataAllowance ? dataAllowance * 1024 * 1024 : null, // Convert MB to bytes
                    voiceMinutes,
                    smsAllowance,
                    speedLimit,
                    billingCycle,
                    validityDays,
                    fupThreshold: fupThreshold ? fupThreshold * 1024 * 1024 : null,
                    fupSpeedLimit,
                    isFeatured,
                    sortOrder,
                    planPrices: prices
                        ? {
                            create: prices.map((p) => ({
                                billingCycle: p.billingCycle,
                                price: p.price,
                            })),
                        }
                        : undefined,
                },
                include: {
                    planPrices: true,
                },
            });
            const response = {
                success: true,
                message: 'Plan created successfully',
                data: { plan },
            };
            res.status(201).json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Update plan (admin)
    async updatePlan(req, res, next) {
        try {
            const id = req.params.id;
            const updateData = req.body;
            // Convert MB to bytes if data fields are provided
            if (updateData.dataAllowance) {
                updateData.dataAllowance = updateData.dataAllowance * 1024 * 1024;
            }
            if (updateData.fupThreshold) {
                updateData.fupThreshold = updateData.fupThreshold * 1024 * 1024;
            }
            const plan = await database_1.prisma.plan.update({
                where: { id },
                data: updateData,
                include: {
                    planPrices: true,
                },
            });
            const response = {
                success: true,
                message: 'Plan updated successfully',
                data: { plan },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Delete plan (admin)
    async deletePlan(req, res, next) {
        try {
            const id = req.params.id;
            // Check if plan has active subscriptions
            const activeSubscriptions = await database_1.prisma.subscription.count({
                where: {
                    planId: id,
                    status: 'ACTIVE',
                },
            });
            if (activeSubscriptions > 0) {
                res.status(400).json({
                    success: false,
                    message: 'Cannot delete plan with active subscriptions',
                });
                return;
            }
            await database_1.prisma.plan.update({
                where: { id },
                data: { isActive: false },
            });
            const response = {
                success: true,
                message: 'Plan deactivated successfully',
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
    // Get featured plans
    async getFeaturedPlans(req, res, next) {
        try {
            const plans = await database_1.prisma.plan.findMany({
                where: {
                    isActive: true,
                    isFeatured: true,
                },
                include: {
                    planPrices: true,
                },
                orderBy: { sortOrder: 'asc' },
                take: 6,
            });
            const response = {
                success: true,
                data: { plans },
            };
            res.json(response);
        }
        catch (error) {
            next(error);
        }
    }
}
exports.planController = new PlanController();
exports.default = exports.planController;
//# sourceMappingURL=plan.controller.js.map