"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.usageService = void 0;
const database_1 = require("../config/database");
const redis_1 = require("../config/redis");
const logger_1 = require("../config/logger");
const types_1 = require("../types");
class UsageService {
    // Get customer usage summary
    async getCustomerUsage(customerId) {
        const subscription = await database_1.prisma.subscription.findFirst({
            where: {
                customerId,
                status: 'ACTIVE',
            },
            include: {
                plan: true,
            },
            orderBy: { createdAt: 'desc' },
        });
        if (!subscription) {
            throw new types_1.NotFoundError('No active subscription found');
        }
        // Get usage records for current period
        const startDate = new Date(subscription.startDate);
        const endDate = new Date(subscription.endDate);
        const usageRecords = await database_1.prisma.usageRecord.findMany({
            where: {
                customerId,
                subscriptionId: subscription.id,
                timestamp: {
                    gte: startDate,
                    lte: endDate,
                },
            },
            orderBy: { timestamp: 'asc' },
        });
        // Group by day
        const dailyUsage = new Map();
        for (const record of usageRecords) {
            const dateKey = new Date(record.timestamp).toISOString().split('T')[0];
            const existing = dailyUsage.get(dateKey) || {
                inputOctets: 0,
                outputOctets: 0,
                totalOctets: 0,
            };
            dailyUsage.set(dateKey, {
                inputOctets: existing.inputOctets + Number(record.inputOctets),
                outputOctets: existing.outputOctets + Number(record.outputOctets),
                totalOctets: existing.totalOctets + Number(record.totalOctets),
            });
        }
        // Convert to array and calculate totals
        const daily = Array.from(dailyUsage.entries()).map(([date, usage]) => ({
            date,
            ...usage,
        }));
        const total = {
            inputOctets: daily.reduce((sum, d) => sum + d.inputOctets, 0),
            outputOctets: daily.reduce((sum, d) => sum + d.outputOctets, 0),
            totalOctets: daily.reduce((sum, d) => sum + d.totalOctets, 0),
        };
        // Calculate percentage used
        const dataAllowance = subscription.plan.dataAllowance
            ? Number(subscription.plan.dataAllowance)
            : null;
        const percentageUsed = dataAllowance
            ? Math.min(100, (total.totalOctets / dataAllowance) * 100)
            : 0;
        // Check FUP threshold
        const fupThreshold = subscription.plan.fupThreshold
            ? Number(subscription.plan.fupThreshold)
            : null;
        const isFupThresholdReached = fupThreshold
            ? total.totalOctets >= fupThreshold
            : false;
        // Calculate days remaining
        const now = new Date();
        const daysRemaining = Math.max(0, Math.ceil((endDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
        return {
            daily,
            total,
            percentageUsed: Math.round(percentageUsed * 100) / 100,
            isFupThresholdReached,
            daysRemaining,
        };
    }
    // Get real-time usage stats
    async getRealtimeUsage(customerId) {
        // Try cache first
        const cacheKey = `usage:realtime:${customerId}`;
        const cached = await redis_1.cache.get(cacheKey);
        if (cached) {
            return cached;
        }
        const subscription = await database_1.prisma.subscription.findFirst({
            where: {
                customerId,
                status: 'ACTIVE',
            },
            include: {
                plan: true,
            },
        });
        if (!subscription) {
            throw new types_1.NotFoundError('No active subscription found');
        }
        const plan = subscription.plan;
        const dataAllowance = plan.dataAllowance ? Number(plan.dataAllowance) : null;
        const fupThreshold = plan.fupThreshold ? Number(plan.fupThreshold) : null;
        const totalUsed = Number(subscription.dataUsed) || 0;
        const totalRemaining = dataAllowance ? Math.max(0, dataAllowance - totalUsed) : null;
        const percentageUsed = dataAllowance ? (totalUsed / dataAllowance) * 100 : 0;
        const result = {
            totalUsed,
            totalRemaining: totalRemaining || 0,
            percentageUsed: Math.round(percentageUsed * 100) / 100,
            isFupThresholdReached: fupThreshold ? totalUsed >= fupThreshold : false,
        };
        // Cache for 30 seconds
        await redis_1.cache.set(cacheKey, result, 30);
        return result;
    }
    // Track bandwidth usage (called from RADIUS accounting)
    async trackUsage(data) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const dateStr = today.toISOString().split('T')[0];
        const totalOctets = data.inputOctets + data.outputOctets;
        // Upsert daily usage record
        await database_1.prisma.usageRecord.upsert({
            where: {
                id: `${data.subscriptionId}_${dateStr}`,
            },
            update: {
                inputOctets: data.inputOctets,
                outputOctets: data.outputOctets,
                totalOctets,
                inputPackets: data.inputPackets,
                outputPackets: data.outputPackets,
            },
            create: {
                id: `${data.subscriptionId}_${dateStr}`,
                userId: data.userId,
                customerId: data.customerId,
                subscriptionId: data.subscriptionId,
                sessionId: data.sessionId,
                inputOctets: data.inputOctets,
                outputOctets: data.outputOctets,
                totalOctets,
                inputPackets: data.inputPackets,
                outputPackets: data.outputPackets,
                nasIpAddress: data.nasIpAddress,
                timestamp: today,
            },
        });
        // Update subscription usage
        await database_1.prisma.subscription.update({
            where: { id: data.subscriptionId },
            data: {
                dataUsed: totalOctets,
            },
        });
        // Invalidate cache
        await redis_1.cache.del(`usage:realtime:${data.customerId}`);
        // Check FUP threshold
        await this.checkFUPThreshold(data.customerId, data.subscriptionId);
    }
    // Check and enforce FUP
    async checkFUPThreshold(customerId, subscriptionId) {
        const subscription = await database_1.prisma.subscription.findUnique({
            where: { id: subscriptionId },
            include: { plan: true, customer: { include: { user: true } } },
        });
        if (!subscription || !subscription.plan.fupThreshold) {
            return;
        }
        const fupThreshold = Number(subscription.plan.fupThreshold);
        const dataUsed = Number(subscription.dataUsed);
        // Check if FUP threshold just crossed
        const previousUsage = dataUsed - (subscription.plan.dataAllowance || 0);
        const wasAboveThreshold = previousUsage >= fupThreshold;
        const isAboveThreshold = dataUsed >= fupThreshold;
        if (isAboveThreshold && !wasAboveThreshold) {
            // FUP threshold just crossed - apply speed limit
            logger_1.logger.info(`FUP threshold reached for customer ${customerId}`);
            // Create notification
            await database_1.prisma.notification.create({
                data: {
                    userId: subscription.customer.userId,
                    type: 'FUP_THRESHOLD',
                    title: 'Fair Usage Policy Applied',
                    message: `You have reached the fair usage limit of ${this.formatBytes(fupThreshold)}. Your internet speed has been reduced to ${subscription.plan.fupSpeedLimit || 1} Mbps.`,
                    channel: 'in_app',
                },
            });
            // Update cache to trigger speed limit on next RADIUS auth
            await redis_1.cache.set(`radius:fup:${subscriptionId}`, {
                appliedAt: new Date().toISOString(),
                newSpeed: subscription.plan.fupSpeedLimit || 1,
            }, 86400 // 24 hours
            );
        }
        else if (!isAboveThreshold && isAboveThreshold) {
            // Usage dropped below threshold (maybe new billing period)
            await redis_1.cache.del(`radius:fup:${subscriptionId}`);
        }
        // Warning at 90% (only once)
        const warningThreshold = fupThreshold * 0.9;
        if (dataUsed >= warningThreshold && dataUsed < fupThreshold) {
            const warningKey = `fup:warning:${subscriptionId}`;
            const warningSent = await redis_1.cache.get(warningKey);
            if (!warningSent) {
                const percentageUsed = Math.round((dataUsed / fupThreshold) * 100);
                await database_1.prisma.notification.create({
                    data: {
                        userId: subscription.customer.userId,
                        type: 'FUP_THRESHOLD',
                        title: 'Fair Usage Warning',
                        message: `You have used ${percentageUsed}% of your fair usage allowance. Speed may be reduced after reaching ${this.formatBytes(fupThreshold)}.`,
                        channel: 'in_app',
                    },
                });
                await redis_1.cache.set(warningKey, true, 86400);
            }
        }
    }
    // Get usage analytics for admin
    async getUsageAnalytics(startDate, endDate) {
        const start = startDate || new Date(new Date().setDate(new Date().getDate() - 30));
        const end = endDate || new Date();
        const [totalUsage, topUsers, usageByDay] = await Promise.all([
            // Total usage
            database_1.prisma.usageRecord.aggregate({
                where: {
                    timestamp: { gte: start, lte: end },
                },
                _sum: {
                    inputOctets: true,
                    outputOctets: true,
                    totalOctets: true,
                },
                _count: true,
            }),
            // Top users by usage
            database_1.prisma.usageRecord.groupBy({
                by: ['customerId'],
                where: {
                    timestamp: { gte: start, lte: end },
                },
                _sum: {
                    totalOctets: true,
                },
                orderBy: {
                    _sum: {
                        totalOctets: 'desc',
                    },
                },
                take: 10,
            }),
            // Usage by day
            database_1.prisma.$queryRaw `
        SELECT 
          DATE(timestamp) as date,
          SUM("inputOctets") as "inputOctets",
          SUM("outputOctets") as "outputOctets",
          SUM("totalOctets") as "totalOctets"
        FROM usage_records
        WHERE timestamp >= ${start} AND timestamp <= ${end}
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
      `,
        ]);
        return {
            totalUsage: {
                inputOctets: Number(totalUsage._sum.inputOctets) || 0,
                outputOctets: Number(totalUsage._sum.outputOctets) || 0,
                totalOctets: Number(totalUsage._sum.totalOctets) || 0,
                sessionCount: totalUsage._count,
            },
            topUsers,
            usageByDay,
            period: { start, end },
        };
    }
    // Format bytes to human readable
    formatBytes(bytes) {
        const units = ['B', 'KB', 'MB', 'GB', 'TB'];
        let value = bytes;
        let unitIndex = 0;
        while (value >= 1024 && unitIndex < units.length - 1) {
            value /= 1024;
            unitIndex++;
        }
        return `${value.toFixed(2)} ${units[unitIndex]}`;
    }
    // Reset usage for new billing period
    async resetUsageForNewPeriod(customerId) {
        const subscription = await database_1.prisma.subscription.findFirst({
            where: {
                customerId,
                status: 'ACTIVE',
            },
        });
        if (!subscription) {
            return;
        }
        await database_1.prisma.subscription.update({
            where: { id: subscription.id },
            data: {
                dataUsed: 0,
                dataRemaining: subscription.plan.dataAllowance,
                voiceMinutesUsed: 0,
                smsUsed: 0,
                startDate: new Date(),
                endDate: new Date(Date.now() + subscription.plan.validityDays * 24 * 60 * 60 * 1000),
            },
        });
        // Clear cache
        await redis_1.cache.del(`usage:realtime:${customerId}`);
        logger_1.logger.info(`Usage reset for customer ${customerId}`);
    }
}
exports.usageService = new UsageService();
exports.default = exports.usageService;
//# sourceMappingURL=usage.service.js.map