import { prisma } from '../config/database';
import { cache } from '../config/redis';
import { cacheAsideWithMutex } from '../utils/cacheMutex';
import { logger } from '../config/logger';
import { NotFoundError, UsageStats } from '../types';
import { createNotification } from './notification.service';

interface UsageSummary {
  daily: {
    date: string;
    inputOctets: number;
    outputOctets: number;
    totalOctets: number;
  }[];
  total: {
    inputOctets: number;
    outputOctets: number;
    totalOctets: number;
  };
  percentageUsed: number;
  isFupThresholdReached: boolean;
  daysRemaining: number;
}

class UsageService {
  // Get customer usage summary
  async getCustomerUsage(customerId: string): Promise<UsageSummary> {
    const subscription = await prisma.subscription.findFirst({
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
      throw new NotFoundError('No active subscription found');
    }

    // Get usage records for current period
    const startDate = new Date(subscription.startDate);
    const endDate = new Date(subscription.endDate);

    const usageRecords = await prisma.usageRecord.findMany({
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
    const dailyUsage = new Map<string, {
      inputOctets: number;
      outputOctets: number;
      totalOctets: number;
    }>();

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
  async getRealtimeUsage(customerId: string): Promise<UsageStats> {
    return cacheAsideWithMutex<UsageStats>({
      key: `usage:realtime:${customerId}`,
      ttlSeconds: 30,
      fetcher: async () => {
        const subscription = await prisma.subscription.findFirst({
          where: {
            customerId,
            status: 'ACTIVE',
          },
          include: {
            plan: true,
          },
        });

        if (!subscription) {
          throw new NotFoundError('No active subscription found');
        }

        const plan = subscription.plan;
        const dataAllowance = plan.dataAllowance ? Number(plan.dataAllowance) : null;
        const fupThreshold = plan.fupThreshold ? Number(plan.fupThreshold) : null;

        const totalUsed = Number(subscription.dataUsed) || 0;
        const totalRemaining = dataAllowance ? Math.max(0, dataAllowance - totalUsed) : null;
        const percentageUsed = dataAllowance ? (totalUsed / dataAllowance) * 100 : 0;

        return {
          totalUsed,
          totalRemaining: totalRemaining || 0,
          percentageUsed: Math.round(percentageUsed * 100) / 100,
          isFupThresholdReached: fupThreshold ? totalUsed >= fupThreshold : false,
        };
      },
    });
  }

  // Track bandwidth usage (called from RADIUS accounting)
  async trackUsage(data: {
    customerId: string;
    userId: string;
    subscriptionId: string;
    sessionId: string;
    nasIpAddress: string;
    inputOctets: number;
    outputOctets: number;
    inputPackets: number;
    outputPackets: number;
  }): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = today.toISOString().split('T')[0];

    const totalOctets = data.inputOctets + data.outputOctets;

    // Upsert daily usage record (increment)
    await prisma.usageRecord.upsert({
      where: {
        id: `${data.subscriptionId}_${dateStr}`,
      },
      update: {
        inputOctets: { increment: data.inputOctets },
        outputOctets: { increment: data.outputOctets },
        totalOctets: { increment: totalOctets },
        inputPackets: { increment: data.inputPackets },
        outputPackets: { increment: data.outputPackets },
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

    // Update subscription usage (increment)
    await prisma.subscription.update({
      where: { id: data.subscriptionId },
      data: {
        dataUsed: { increment: totalOctets },
      },
    });

    // Invalidate cache
    await cache.del(`usage:realtime:${data.customerId}`);

    // Check FUP threshold
    await this.checkFUPThreshold(data.customerId, data.subscriptionId);
  }

  // Check and enforce FUP
  private async checkFUPThreshold(customerId: string, subscriptionId: string): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true, customer: { include: { user: true } } },
    });

    if (!subscription || !subscription.plan.fupThreshold) {
      return;
    }

    const fupThreshold = Number(subscription.plan.fupThreshold);
    const dataUsed = Number(subscription.dataUsed);

    // Check if FUP threshold reached (only notify once per billing period)
    const thresholdReachedKey = `fup:reached:${subscriptionId}`;
    const alreadyReached = await cache.get(thresholdReachedKey);

    if (dataUsed >= fupThreshold && !alreadyReached) {
      // FUP threshold just crossed - apply speed limit
      logger.info(`FUP threshold reached for customer ${customerId}`);

      // Create notification
      await createNotification({
        userId: subscription.customer.userId,
        type: 'FUP_THRESHOLD',
        title: 'Fair Usage Policy Applied',
        message: `You have reached the fair usage limit of ${this.formatBytes(fupThreshold)}. Your internet speed has been reduced to ${subscription.plan.fupSpeedLimit || 1} Mbps.`,
        channel: 'in_app',
      });

      // Update cache to trigger speed limit on next RADIUS auth
      await cache.set(
        `radius:fup:${subscriptionId}`,
        {
          appliedAt: new Date().toISOString(),
          newSpeed: subscription.plan.fupSpeedLimit || 1,
        },
        86400 // 24 hours
      );
      
      // Mark threshold as reached (expire after billing period - 30 days)
      await cache.set(thresholdReachedKey, true, 30 * 24 * 60 * 60);
    } else if (dataUsed < fupThreshold && alreadyReached) {
      // Usage dropped below threshold (maybe new billing period), clear flags
      await cache.del(`radius:fup:${subscriptionId}`);
      await cache.del(thresholdReachedKey);
    }

    // Warning at 90% (only once)
    const warningThreshold = fupThreshold * 0.9;
    if (dataUsed >= warningThreshold && dataUsed < fupThreshold) {
      const warningKey = `fup:warning:${subscriptionId}`;
      const warningSent = await cache.get(warningKey);

      if (!warningSent) {
        const percentageUsed = Math.round((dataUsed / fupThreshold) * 100);

        await createNotification({
          userId: subscription.customer.userId,
          type: 'FUP_THRESHOLD',
          title: 'Fair Usage Warning',
          message: `You have used ${percentageUsed}% of your fair usage allowance. Speed may be reduced after reaching ${this.formatBytes(fupThreshold)}.`,
          channel: 'in_app',
        });

        await cache.set(warningKey, true, 86400);
      }
    }
  }

  // Get usage analytics for admin
  async getUsageAnalytics(startDate?: Date, endDate?: Date): Promise<any> {
    const start = startDate || new Date(new Date().setDate(new Date().getDate() - 30));
    const end = endDate || new Date();

    const [totalUsage, topUsers, usageByDay] = await Promise.all([
      // Total usage
      prisma.usageRecord.aggregate({
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
      prisma.usageRecord.groupBy({
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
      prisma.$queryRaw`
        SELECT 
          DATE(timestamp) as date,
          SUM("inputOctets") as "inputOctets",
          SUM("outputOctets") as "outputOctets",
          SUM("totalOctets") as "totalOctets"
        FROM usage_records
        WHERE timestamp >= ${start} AND timestamp <= ${end}
        GROUP BY DATE(timestamp)
        ORDER BY date ASC
      ` as Promise<any[]>,
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
  private formatBytes(bytes: number): string {
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
  async resetUsageForNewPeriod(customerId: string): Promise<void> {
    const subscription = await prisma.subscription.findFirst({
      where: {
        customerId,
        status: 'ACTIVE',
      },
      include: { plan: true },
    });

    if (!subscription) {
      return;
    }

    await prisma.subscription.update({
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
    await cache.del(`usage:realtime:${customerId}`);

    logger.info(`Usage reset for customer ${customerId}`);
  }
}

export const usageService = new UsageService();
export default usageService;
