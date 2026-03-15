import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import { prisma } from '../config/database';
import config from '../config';
import { logger } from '../config/logger';
import { AppError } from '../types';
import { cache } from '../config/redis';

interface RadiusAuthRequest {
  username: string;
  password: string;
  nasIpAddress: string;
  nasPortId?: string;
  nasPortType?: string;
}

interface RadiusAccountingRequest {
  sessionId: string;
  username: string;
  nasIpAddress: string;
  nasPortId?: string;
  framedIpAddress?: string;
  inputOctets: number;
  outputOctets: number;
  inputPackets: number;
  outputPackets: number;
  sessionTime: number;
  terminateCause?: string;
}

interface UserInfo {
  username: string;
  password: string;
  isActive: boolean;
  dataRemaining: number | null;
  speedLimit: number | null;
  fupSpeedLimit: number | null;
  subscriptionActive: boolean;
}

class RadiusService {
  // Generate RADIUS password (for PAP authentication)
  // Returns both plaintext (for RADIUS server sync) and hashed (for DB storage)
  static async generatePassword(): Promise<{ plaintext: string; hashed: string }> {
    const plaintext = crypto.randomBytes(16).toString('hex');
    const hashed = await bcrypt.hash(plaintext, 12);
    return { plaintext, hashed };
  }

  // Create RADIUS user for customer
  async createRadiusUser(customerId: string): Promise<any> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        user: true,
        radiusConfig: true,
      },
    });

    if (!customer) {
      throw new AppError('Customer not found', 404);
    }

    if (customer.radiusConfig) {
      return customer.radiusConfig;
    }

    // Generate username and password
    const username = `cust_${customer.customerCode.toLowerCase()}`;
    const { plaintext, hashed } = await RadiusService.generatePassword();

    // Create RADIUS config with hashed password
    const radiusConfig = await prisma.radiusConfig.create({
      data: {
        customerId: customer.id,
        username,
        password: hashed,
        isActive: true,
      },
    });

    // Sync plaintext password with RADIUS server (not the hash)
    await this.syncUserToRadius({ ...radiusConfig, password: plaintext });

    logger.info(`RADIUS user created for customer ${customer.customerCode}`);
    return radiusConfig;
  }

  // Update RADIUS user password
  async updatePassword(customerId: string): Promise<string> {
    const radiusConfig = await prisma.radiusConfig.findUnique({
      where: { customerId },
    });

    if (!radiusConfig) {
      throw new AppError('RADIUS config not found', 404);
    }

    const { plaintext, hashed } = await RadiusService.generatePassword();

    await prisma.radiusConfig.update({
      where: { id: radiusConfig.id },
      data: { password: hashed },
    });

    // Sync plaintext password with RADIUS server
    await this.syncUserToRadius({ ...radiusConfig, password: plaintext });

    logger.info(`RADIUS password updated for customer ${customerId}`);
    return plaintext;
  }

  // Disable RADIUS user
  async disableUser(customerId: string): Promise<void> {
    const radiusConfig = await prisma.radiusConfig.findUnique({
      where: { customerId },
    });

    if (!radiusConfig) {
      return;
    }

    await prisma.radiusConfig.update({
      where: { id: radiusConfig.id },
      data: { isActive: false },
    });

    // Disconnect any active sessions
    await this.disconnectUser(radiusConfig.username);

    logger.info(`RADIUS user disabled for customer ${customerId}`);
  }

  // Enable RADIUS user
  async enableUser(customerId: string): Promise<void> {
    const radiusConfig = await prisma.radiusConfig.findUnique({
      where: { customerId },
    });

    if (!radiusConfig) {
      throw new AppError('RADIUS config not found', 404);
    }

    await prisma.radiusConfig.update({
      where: { id: radiusConfig.id },
      data: { isActive: true },
    });

    logger.info(`RADIUS user enabled for customer ${customerId}`);
  }

  // Handle Access-Request (called by RADIUS server via API)
  async handleAccessRequest(request: RadiusAuthRequest): Promise<{
    accept: boolean;
    attributes?: {
      speedLimit?: number;
      dataRemaining?: number;
    };
  }> {
    logger.info(`RADIUS Access-Request for ${request.username} from ${request.nasIpAddress}`);

    // Check cache first
    const cachedInfo = await cache.get<UserInfo>(`radius:user:${request.username}`);
    
    let userInfo: UserInfo | null = cachedInfo;
    
    if (!userInfo) {
      // Fetch from database
      const radiusConfig = await prisma.radiusConfig.findUnique({
        where: { username: request.username },
        include: {
          customer: {
            include: {
              subscriptions: {
                where: { status: 'ACTIVE' },
                include: { plan: true },
                orderBy: { createdAt: 'desc' },
                take: 1,
              },
            },
          },
        },
      });

      if (!radiusConfig || !radiusConfig.isActive) {
        logger.warn(`RADIUS auth failed: user not found or inactive - ${request.username}`);
        return { accept: false };
      }

      const subscription = radiusConfig.customer.subscriptions[0];

      userInfo = {
        username: radiusConfig.username,
        password: radiusConfig.password,
        isActive: radiusConfig.isActive,
        dataRemaining: subscription?.dataRemaining ?? null,
        speedLimit: subscription?.plan.speedLimit ?? null,
        fupSpeedLimit: subscription?.plan.fupSpeedLimit ?? null,
        subscriptionActive: !!subscription && subscription.status === 'ACTIVE',
      };

      // Cache for 5 minutes
      await cache.set(`radius:user:${request.username}`, userInfo, 300);
    }

    // Verify password (compare against bcrypt hash)
    const passwordValid = await bcrypt.compare(request.password, userInfo.password);
    if (!passwordValid) {
      logger.warn(`RADIUS auth failed: invalid password for ${request.username}`);
      return { accept: false };
    }

    // Check subscription status
    if (!userInfo.subscriptionActive) {
      logger.warn(`RADIUS auth failed: no active subscription for ${request.username}`);
      return { accept: false };
    }

    // Check data remaining (for prepaid)
    if (userInfo.dataRemaining !== null && userInfo.dataRemaining <= 0) {
      logger.warn(`RADIUS auth failed: data depleted for ${request.username}`);
      return { accept: false };
    }

    logger.info(`RADIUS Access-Accept for ${request.username}`);
    
    return {
      accept: true,
      attributes: {
        speedLimit: userInfo.speedLimit,
        dataRemaining: userInfo.dataRemaining,
      },
    };
  }

  // Handle Accounting-Request (session start/stop/interim-update)
  async handleAccountingRequest(request: RadiusAccountingRequest): Promise<void> {
    logger.info(`RADIUS Accounting-Request for ${request.username}: ${request.sessionTime}s`);

    const radiusConfig = await prisma.radiusConfig.findUnique({
      where: { username: request.username },
      include: {
        customer: {
          include: {
            subscriptions: {
              where: { status: 'ACTIVE' },
              include: { plan: true },
              orderBy: { createdAt: 'desc' },
              take: 1,
            },
          },
        },
      },
    });

    if (!radiusConfig) {
      logger.warn(`RADIUS accounting: user not found - ${request.username}`);
      return;
    }

    const subscription = radiusConfig.customer.subscriptions[0];
    if (!subscription) {
      logger.warn(`RADIUS accounting: no subscription - ${request.username}`);
      return;
    }

    // Check if this is a new session or update
    let session = await prisma.radiusSession.findUnique({
      where: { sessionId: request.sessionId },
    });

    const totalOctets = request.inputOctets + request.outputOctets;

    if (session) {
      // Update existing session
      await prisma.radiusSession.update({
        where: { id: session.id },
        data: {
          inputOctets: request.inputOctets,
          outputOctets: request.outputOctets,
          totalOctets,
          inputPackets: request.inputPackets,
          outputPackets: request.outputPackets,
          status: request.terminateCause ? 'CLOSED' : 'ACTIVE',
          stopTime: request.terminateCause ? new Date() : undefined,
          terminateCause: request.terminateCause,
          framedIpAddress: request.framedIpAddress,
        },
      });
    } else {
      // Create new session
      session = await prisma.radiusSession.create({
        data: {
          userId: radiusConfig.customer.userId,
          subscriptionId: subscription.id,
          sessionId: request.sessionId,
          nasIpAddress: request.nasIpAddress,
          nasPortId: request.nasPortId,
          framedIpAddress: request.framedIpAddress,
          inputOctets: request.inputOctets,
          outputOctets: request.outputOctets,
          totalOctets,
          inputPackets: request.inputPackets,
          outputPackets: request.outputPackets,
          status: request.terminateCause ? 'CLOSED' : 'ACTIVE',
          stopTime: request.terminateCause ? new Date() : undefined,
          terminateCause: request.terminateCause,
        },
      });
    }

    // Update usage record
    await this.updateUsageRecord(
      radiusConfig.customer.userId,
      radiusConfig.customerId,
      subscription.id,
      request
    );

    // Update subscription data used
    await this.updateSubscriptionUsage(subscription.id, totalOctets);

    // Check FUP threshold
    await this.checkFUPThreshold(subscription, totalOctets);
  }

  // Update usage record
  private async updateUsageRecord(
    userId: string,
    customerId: string,
    subscriptionId: string,
    request: RadiusAccountingRequest
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Upsert daily usage record
    await prisma.usageRecord.upsert({
      where: {
        id: `${subscriptionId}_${today.toISOString().split('T')[0]}`,
      },
      update: {
        inputOctets: request.inputOctets,
        outputOctets: request.outputOctets,
        totalOctets: request.inputOctets + request.outputOctets,
        inputPackets: request.inputPackets,
        outputPackets: request.outputPackets,
      },
      create: {
        id: `${subscriptionId}_${today.toISOString().split('T')[0]}`,
        userId,
        customerId,
        subscriptionId,
        sessionId: request.sessionId,
        inputOctets: request.inputOctets,
        outputOctets: request.outputOctets,
        totalOctets: request.inputOctets + request.outputOctets,
        inputPackets: request.inputPackets,
        outputPackets: request.outputPackets,
        nasIpAddress: request.nasIpAddress,
      },
    });
  }

  // Update subscription data usage
  private async updateSubscriptionUsage(subscriptionId: string, totalOctets: number): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription || !subscription.plan.dataAllowance) {
      return;
    }

    // Calculate remaining data
    const dataUsed = totalOctets;
    const dataRemaining = Math.max(0, BigInt(subscription.plan.dataAllowance) - BigInt(dataUsed));

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        dataUsed: BigInt(dataUsed),
        dataRemaining: dataRemaining,
      },
    });

    // Invalidate cache
    await cache.del(`radius:user:cust_${subscription.customerId}`);
  }

  // Check Fair Usage Policy threshold
  private async checkFUPThreshold(subscription: any, totalOctets: number): Promise<void> {
    const plan = subscription.plan;
    
    if (!plan.fupThreshold) {
      return;
    }

    const fupThreshold = BigInt(plan.fupThreshold);
    const currentUsage = BigInt(totalOctets);
    const usagePercentage = Number((currentUsage * 100n) / fupThreshold);

    // Check if FUP threshold reached (90% and 100%)
    if (usagePercentage >= 90 && usagePercentage < 100) {
      // Send warning at 90%
      const customer = await prisma.customer.findUnique({
        where: { id: subscription.customerId },
        include: { user: true },
      });

      if (customer && customer.user) {
        await prisma.notification.create({
          data: {
            userId: customer.userId,
            type: 'FUP_THRESHOLD',
            title: 'Fair Usage Warning',
            message: `You have used ${usagePercentage}% of your fair usage allowance. Your speed may be reduced after reaching the limit.`,
            channel: 'in_app',
          },
        });
      }
    } else if (usagePercentage >= 100) {
      // FUP threshold reached - apply speed limit
      logger.info(`FUP threshold reached for subscription ${subscription.id}`);
      
      // In a real system, this would trigger a RADIUS CoA (Change of Authorization)
      // to update the user's speed limit on the NAS device
      await this.applyFUPLimit(subscription);
    }
  }

  // Apply FUP speed limit
  private async applyFUPLimit(subscription: any): Promise<void> {
    // This would send a RADIUS CoA packet to the NAS
    // For now, we'll just log and update the cache
    
    await cache.set(
      `radius:fup:${subscription.id}`,
      {
        appliedAt: new Date().toISOString(),
        newSpeed: subscription.plan.fupSpeedLimit,
      },
      86400
    );

    logger.info(`FUP limit applied for subscription ${subscription.id}`);
  }

  // Disconnect user session
  async disconnectUser(username: string): Promise<void> {
    // In a real implementation, this would send a RADIUS Disconnect-Request
    // to the NAS device
    
    const activeSessions = await prisma.radiusSession.findMany({
      where: {
        user: { radiusConfig: { username } },
        status: 'ACTIVE',
      },
    });

    for (const session of activeSessions) {
      await prisma.radiusSession.update({
        where: { id: session.id },
        data: {
          status: 'CLOSED',
          stopTime: new Date(),
          terminateCause: 'ADMIN_DISCONNECT',
        },
      });
    }

    // Invalidate cache
    await cache.del(`radius:user:${username}`);

    logger.info(`Disconnected user ${username} (${activeSessions.length} sessions)`);
  }

  // Get active sessions for customer
  async getActiveSessions(customerId: string): Promise<any[]> {
    const sessions = await prisma.radiusSession.findMany({
      where: {
        user: { customer: { id: customerId } },
        status: 'ACTIVE',
      },
      orderBy: { startTime: 'desc' },
    });

    return sessions;
  }

  // Sync user to RADIUS server (placeholder for actual RADIUS server integration)
  private async syncUserToRadius(config: any): Promise<void> {
    // In production, this would update the RADIUS server's user database
    // (e.g., via radcli, freeradius API, or database sync)
    
    logger.info(`Synced RADIUS user ${config.username} to server`);
  }
}

export const radiusService = new RadiusService();
export default radiusService;
