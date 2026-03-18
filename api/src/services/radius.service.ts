import crypto from 'crypto';
import bcrypt from 'bcryptjs';
import dgram from 'dgram';
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
  // Sanity check constants for RADIUS accounting data
  private static readonly MAX_REASONABLE_BYTES = 1_000_000_000_000_000; // 1 PB
  private static readonly MAX_REASONABLE_PACKETS = 100_000_000_000; // 100 billion

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
        dataRemaining: subscription?.dataRemaining != null ? Number(subscription.dataRemaining) : null,
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

    // Input validation for RADIUS accounting data
    if (request.inputOctets < 0 || request.outputOctets < 0) {
      logger.warn(`RADIUS accounting rejected: negative octets for ${request.username} (inputOctets=${request.inputOctets}, outputOctets=${request.outputOctets})`);
      return;
    }

    if (request.inputPackets < 0 || request.outputPackets < 0) {
      logger.warn(`RADIUS accounting rejected: negative packets for ${request.username} (inputPackets=${request.inputPackets}, outputPackets=${request.outputPackets})`);
      return;
    }

    if (request.inputOctets > RadiusService.MAX_REASONABLE_BYTES || request.outputOctets > RadiusService.MAX_REASONABLE_BYTES) {
      logger.warn(`RADIUS accounting rejected: octets exceed sanity limit for ${request.username} (inputOctets=${request.inputOctets}, outputOctets=${request.outputOctets}, max=${RadiusService.MAX_REASONABLE_BYTES})`);
      return;
    }

    if (request.inputPackets > RadiusService.MAX_REASONABLE_PACKETS || request.outputPackets > RadiusService.MAX_REASONABLE_PACKETS) {
      logger.warn(`RADIUS accounting rejected: packets exceed sanity limit for ${request.username} (inputPackets=${request.inputPackets}, outputPackets=${request.outputPackets}, max=${RadiusService.MAX_REASONABLE_PACKETS})`);
      return;
    }

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

    // Compute delta octets since last update for this session
    const cacheKey = `radius:session:${request.sessionId}:cumulative`;
    const previous = await cache.get<{ inputOctets: number; outputOctets: number; inputPackets: number; outputPackets: number }>(cacheKey);
    let deltaInputOctets = request.inputOctets;
    let deltaOutputOctets = request.outputOctets;
    let deltaInputPackets = request.inputPackets;
    let deltaOutputPackets = request.outputPackets;

    if (previous) {
      deltaInputOctets = Math.max(0, request.inputOctets - previous.inputOctets);
      deltaOutputOctets = Math.max(0, request.outputOctets - previous.outputOctets);
      deltaInputPackets = Math.max(0, request.inputPackets - previous.inputPackets);
      deltaOutputPackets = Math.max(0, request.outputPackets - previous.outputPackets);
    }

    // Store current cumulative for next delta
    await cache.set(cacheKey, {
      inputOctets: request.inputOctets,
      outputOctets: request.outputOctets,
      inputPackets: request.inputPackets,
      outputPackets: request.outputPackets,
    }, 3600); // expire after 1 hour (should be longer for long sessions)

    // Update usage record with delta
    await this.updateUsageRecord(
      radiusConfig.customer.userId,
      radiusConfig.customerId,
      subscription.id,
      request.sessionId,
      request.nasIpAddress,
      deltaInputOctets,
      deltaOutputOctets,
      deltaInputPackets,
      deltaOutputPackets
    );

    // Update subscription data used with delta
    const deltaTotalOctets = deltaInputOctets + deltaOutputOctets;
    await this.updateSubscriptionUsage(subscription.id, deltaTotalOctets);

    // Check FUP threshold (using updated subscription.dataUsed)
    await this.checkFUPThreshold(subscription.id);
  }

  // Update usage record (with delta octets)
  private async updateUsageRecord(
    userId: string,
    customerId: string,
    subscriptionId: string,
    sessionId: string,
    nasIpAddress: string,
    deltaInputOctets: number,
    deltaOutputOctets: number,
    deltaInputPackets: number,
    deltaOutputPackets: number
  ): Promise<void> {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const totalDeltaOctets = deltaInputOctets + deltaOutputOctets;

    // Upsert daily usage record (increment)
    await prisma.usageRecord.upsert({
      where: {
        id: `${subscriptionId}_${today.toISOString().split('T')[0]}`,
      },
      update: {
        inputOctets: { increment: deltaInputOctets },
        outputOctets: { increment: deltaOutputOctets },
        totalOctets: { increment: totalDeltaOctets },
        inputPackets: { increment: deltaInputPackets },
        outputPackets: { increment: deltaOutputPackets },
      },
      create: {
        id: `${subscriptionId}_${today.toISOString().split('T')[0]}`,
        userId,
        customerId,
        subscriptionId,
        sessionId,
        inputOctets: deltaInputOctets,
        outputOctets: deltaOutputOctets,
        totalOctets: totalDeltaOctets,
        inputPackets: deltaInputPackets,
        outputPackets: deltaOutputPackets,
        nasIpAddress,
      },
    });
  }

  // Update subscription data usage with delta
  private async updateSubscriptionUsage(subscriptionId: string, deltaTotalOctets: number): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true },
    });

    if (!subscription || !subscription.plan.dataAllowance) {
      return;
    }

    const currentDataUsed = subscription.dataUsed;
    const newDataUsed = currentDataUsed + BigInt(deltaTotalOctets);
    const dataAllowance = BigInt(subscription.plan.dataAllowance);
    const dataRemaining = dataAllowance > newDataUsed ? dataAllowance - newDataUsed : 0n;

    await prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        dataUsed: newDataUsed,
        dataRemaining: dataRemaining,
      },
    });

    // Invalidate cache
    await cache.del(`radius:user:cust_${subscription.customerId}`);
  }

  // Check Fair Usage Policy threshold
  private async checkFUPThreshold(subscriptionId: string): Promise<void> {
    const subscription = await prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: { plan: true, customer: { include: { user: true } } },
    });
    
    if (!subscription || !subscription.plan.fupThreshold) {
      return;
    }

    const plan = subscription.plan;
    const fupThreshold = BigInt(plan.fupThreshold);
    const currentUsage = subscription.dataUsed;
    const usagePercentage = Number((currentUsage * 100n) / fupThreshold);

    // Check if FUP threshold reached (90% and 100%)
    if (usagePercentage >= 90 && usagePercentage < 100) {
      // Send warning at 90% (only once)
      const warningKey = `fup:warning:${subscriptionId}`;
      const warningSent = await cache.get(warningKey);
      
      if (!warningSent && subscription.customer?.user) {
        await prisma.notification.create({
          data: {
            userId: subscription.customer.userId,
            type: 'FUP_THRESHOLD',
            title: 'Fair Usage Warning',
            message: `You have used ${usagePercentage}% of your fair usage allowance. Your speed may be reduced after reaching the limit.`,
            channel: 'in_app',
          },
        });
        await cache.set(warningKey, true, 86400);
      }
    } else if (usagePercentage >= 100) {
      // FUP threshold reached - apply speed limit (only once)
      const thresholdReachedKey = `fup:reached:${subscriptionId}`;
      const alreadyReached = await cache.get(thresholdReachedKey);
      
      if (!alreadyReached) {
        logger.info(`FUP threshold reached for subscription ${subscriptionId}`);
        
        // In a real system, this would trigger a RADIUS CoA (Change of Authorization)
        // to update the user's speed limit on the NAS device
        await this.applyFUPLimit(subscription);
        await cache.set(thresholdReachedKey, true, 30 * 24 * 60 * 60); // 30 days
      }
    } else if (usagePercentage < 90) {
      // Usage dropped below threshold, clear flags
      await cache.del(`fup:warning:${subscriptionId}`);
      await cache.del(`fup:reached:${subscriptionId}`);
      await cache.del(`radius:fup:${subscriptionId}`);
    }
  }

  // Apply FUP speed limit via RADIUS CoA
  private async applyFUPLimit(subscription: any): Promise<void> {
    try {
      // Get the user's RADIUS config and active sessions to find the NAS
      const radiusConfig = await prisma.radiusConfig.findUnique({
        where: { customerId: subscription.customerId },
      });

      if (!radiusConfig) {
        logger.warn(`Cannot apply FUP limit: no RADIUS config for customer ${subscription.customerId}`);
        await this.cacheFUPLimit(subscription);
        return;
      }

      // Find active sessions to determine the NAS
      const activeSessions = await prisma.radiusSession.findMany({
        where: {
          user: { customer: { radiusConfig: { username: radiusConfig.username } } },
          status: 'ACTIVE',
        },
      });

      if (activeSessions.length === 0) {
        logger.info(`No active sessions for ${radiusConfig.username}; caching FUP limit for next login`);
        await this.cacheFUPLimit(subscription);
        return;
      }

      const fupSpeedLimit = subscription.plan.fupSpeedLimit;
      if (!fupSpeedLimit) {
        logger.warn(`No fupSpeedLimit defined for plan ${subscription.plan.name}`);
        return;
      }

      // Send CoA to each NAS where the user has an active session
      const results = await Promise.allSettled(
        activeSessions.map(async (session) => {
          const nasPort = parseInt(process.env.RADIUS_COA_PORT || '3799', 10);
          const success = await this.sendCoA(session.nasIpAddress, nasPort, {
            'User-Name': radiusConfig.username,
            'NAS-IP-Address': session.nasIpAddress,
            'NAS-Port': session.nasPortId ? parseInt(session.nasPortId, 10) : 0,
          });

          if (success) {
            logger.info(`FUP CoA sent to ${session.nasIpAddress} for ${radiusConfig.username}: speed=${fupSpeedLimit}`);
          } else {
            logger.warn(`FUP CoA failed for ${radiusConfig.username} on ${session.nasIpAddress}`);
          }

          return success;
        })
      );

      const anySuccess = results.some((r) => r.status === 'fulfilled' && r.value);
      if (anySuccess) {
        await this.cacheFUPLimit(subscription);
      } else {
        logger.warn(`All FUP CoA attempts failed for subscription ${subscription.id}; will retry`);
      }
    } catch (error) {
      logger.error(`Error applying FUP limit for subscription ${subscription.id}:`, error);
      await this.cacheFUPLimit(subscription);
    }
  }

  // Cache FUP limit state (used as fallback and for tracking)
  private async cacheFUPLimit(subscription: any): Promise<void> {
    await cache.set(
      `radius:fup:${subscription.id}`,
      {
        appliedAt: new Date().toISOString(),
        newSpeed: subscription.plan.fupSpeedLimit,
        planName: subscription.plan.name,
      },
      86400
    );
    logger.info(`FUP limit cached for subscription ${subscription.id}`);
  }

  // Disconnect user session (sends RADIUS Disconnect-Request)
  async disconnectUser(username: string): Promise<void> {
    const activeSessions = await prisma.radiusSession.findMany({
      where: {
        user: { customer: { radiusConfig: { username } } },
        status: 'ACTIVE',
      },
    });

    // Send Disconnect-Request to each NAS where the user has an active session
    const nasPort = parseInt(process.env.RADIUS_COA_PORT || '3799', 10);

    await Promise.allSettled(
      activeSessions.map(async (session) => {
        const success = await this.sendDisconnectRequest(session.nasIpAddress, nasPort, {
          'User-Name': username,
          'NAS-IP-Address': session.nasIpAddress,
          'NAS-Port': session.nasPortId ? parseInt(session.nasPortId, 10) : 0,
        });

        if (success) {
          logger.info(`Disconnect-Request sent to ${session.nasIpAddress} for ${username}`);
        } else {
          logger.warn(`Disconnect-Request failed for ${username} on ${session.nasIpAddress}`);
        }
      })
    );

    // Mark sessions as closed in DB regardless of NAS response
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

  // Sync user to RADIUS server (writes to FreeRADIUS radcheck table)
  private async syncUserToRadius(config: { username: string; password: string; isActive?: boolean }): Promise<void> {
    try {
      const { username, password, isActive = true } = config;

      // Check if FreeRADIUS radcheck table exists
      const tableExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'radcheck'
        ) as exists
      ` as { exists: boolean }[];

      if (!tableExists[0]?.exists) {
        logger.warn('FreeRADIUS radcheck table not found, skipping sync');
        return;
      }

      // Delete existing radcheck records for this user
      await prisma.$executeRaw`
        DELETE FROM radcheck WHERE username = ${username}
      `;

      if (isActive) {
        // Insert new radcheck record with User-Password attribute
        // Using bcrypt hashing for password security
        await prisma.$executeRaw`
          INSERT INTO radcheck (username, attribute, op, value)
          VALUES (${username}, 'User-Password', ':=', ${password})
        `;

        // Add Auth-Type attribute for PAP authentication
        await prisma.$executeRaw`
          INSERT INTO radcheck (username, attribute, op, value)
          VALUES (${username}, 'Auth-Type', ':=', 'PAP')
        `;

        logger.info(`RADIUS user ${username} synced to radcheck table (active)`);
      } else {
        logger.info(`RADIUS user ${username} disabled (radcheck records removed)`);
      }
    } catch (error) {
      logger.error(`Failed to sync RADIUS user ${config.username}:`, error);
      // Don't throw - allow the operation to continue even if RADIUS sync fails
    }
  }

  // Disable RADIUS user by removing radcheck records
  async disableRadiusUser(customerId: string): Promise<void> {
    const radiusConfig = await prisma.radiusConfig.findUnique({
      where: { customerId },
    });

    if (!radiusConfig) {
      return;
    }

    await this.syncUserToRadius({
      username: radiusConfig.username,
      password: radiusConfig.password,
      isActive: false,
    });

    // Also disconnect any active sessions
    await this.disconnectUser(radiusConfig.username);
  }

  // Enable RADIUS user by restoring radcheck records
  async enableRadiusUser(customerId: string): Promise<void> {
    const radiusConfig = await prisma.radiusConfig.findUnique({
      where: { customerId },
    });

    if (!radiusConfig) {
      throw new AppError('RADIUS config not found', 404);
    }

    // Note: We need the plaintext password to restore, but we only have the hash
    // In practice, you'd either:
    // 1. Store the plaintext temporarily
    // 2. Regenerate the password
    // 3. Have the user reset their password

    // For now, we'll regenerate the password
    const { plaintext } = await RadiusService.generatePassword();

    await this.syncUserToRadius({
      username: radiusConfig.username,
      password: plaintext,
      isActive: true,
    });

    logger.info(`RADIUS user ${radiusConfig.username} re-enabled`);
  }

  // ========================
  // RADIUS CoA (Change of Authorization)
  // ========================

  // RADIUS attribute types (RFC 2865 / RFC 2869)
  private static readonly ATTR_USERNAME = 1;        // User-Name
  private static readonly ATTR_NAS_IP = 4;          // NAS-IP-Address
  private static readonly ATTR_NAS_PORT = 5;        // NAS-Port
  private static readonly ATTR_MESSAGE_AUTH = 80;   // Message-Authenticator
  private static readonly ATTR_EVENT_TIMESTAMP = 55; // Event-Timestamp
  private static readonly ATTR_CALLED_STATION = 30;  // Called-Station-Id (user identifier)

  // RADIUS packet codes
  private static readonly CODE_COA_REQUEST = 40;
  private static readonly CODE_DISCONNECT_REQUEST = 41;

  // Default CoA port (RFC 5176)
  static readonly COA_PORT = 3799;

  /**
   * Build a RADIUS CoA-Request packet with the given attributes.
   * Format per RFC 2865:
   *   Code (1) | Identifier (1) | Length (2) | Authenticator (16) | Attributes...
   *
   * Each attribute: Type (1) | Length (1) | Value (variable)
   */
  private buildCoAPacket(
    attributes: Record<string, any>,
    nasSecret: string
  ): Buffer {
    // 16-byte request authenticator (random for CoA)
    const authenticator = crypto.randomBytes(16);

    // Build attribute bytes
    const attrBuffers: Buffer[] = [];

    // Encode attributes by type
    for (const [name, value] of Object.entries(attributes)) {
      let attrType: number | undefined;
      let attrValue: Buffer;

      switch (name) {
        case 'User-Name':
          attrType = RadiusService.ATTR_USERNAME;
          attrValue = Buffer.from(String(value), 'utf-8');
          break;
        case 'NAS-IP-Address':
          attrType = RadiusService.ATTR_NAS_IP;
          // IPv4 as 4-byte big-endian
          const ipParts = String(value).split('.').map(Number);
          attrValue = Buffer.from(ipParts);
          break;
        case 'NAS-Port':
          attrType = RadiusService.ATTR_NAS_PORT;
          attrValue = Buffer.alloc(4);
          attrValue.writeUInt32BE(Number(value), 0);
          break;
        case 'Event-Timestamp':
          attrType = RadiusService.ATTR_EVENT_TIMESTAMP;
          attrValue = Buffer.alloc(4);
          attrValue.writeUInt32BE(Math.floor(Date.now() / 1000), 0);
          break;
        default:
          // Skip unknown attributes
          continue;
      }

      if (attrType !== undefined) {
        // Attribute header: type (1) + length (1) + value
        const totalLen = 2 + attrValue.length;
        const attrBuf = Buffer.alloc(totalLen);
        attrBuf.writeUInt8(attrType, 0);
        attrBuf.writeUInt8(totalLen, 1);
        attrValue.copy(attrBuf, 2);
        attrBuffers.push(attrBuf);
      }
    }

    const attrsBuffer = Buffer.concat(attrBuffers);

    // RADIUS packet: Code (1) + Identifier (1) + Length (2) + Authenticator (16) + Attributes
    const packetLength = 1 + 1 + 2 + 16 + attrsBuffer.length;
    const packet = Buffer.alloc(packetLength);

    let offset = 0;
    packet.writeUInt8(RadiusService.CODE_COA_REQUEST, offset); offset += 1;
    packet.writeUInt8(crypto.randomBytes(1)[0], offset); offset += 1; // Random identifier
    packet.writeUInt16BE(packetLength, offset); offset += 2;
    authenticator.copy(packet, offset); offset += 16;
    attrsBuffer.copy(packet, offset);

    // Compute the Response Authenticator (Message-Authenticator equivalent for CoA)
    // RADIUS shared secret is applied by appending it to the packet and MD5-hashing
    const md5Input = Buffer.concat([packet.slice(0, 4), authenticator, attrsBuffer, Buffer.from(nasSecret, 'utf-8')]);
    const responseAuth = crypto.createHash('md5').update(md5Input).digest();

    // Overwrite the authenticator field with the computed response auth
    responseAuth.copy(packet, 4);

    return packet;
  }

  /**
   * Build a RADIUS Disconnect-Request packet.
   */
  private buildDisconnectPacket(
    attributes: Record<string, any>,
    nasSecret: string
  ): Buffer {
    const authenticator = crypto.randomBytes(16);
    const attrBuffers: Buffer[] = [];

    for (const [name, value] of Object.entries(attributes)) {
      let attrType: number | undefined;
      let attrValue: Buffer;

      switch (name) {
        case 'User-Name':
          attrType = RadiusService.ATTR_USERNAME;
          attrValue = Buffer.from(String(value), 'utf-8');
          break;
        case 'NAS-IP-Address':
          attrType = RadiusService.ATTR_NAS_IP;
          const ipParts = String(value).split('.').map(Number);
          attrValue = Buffer.from(ipParts);
          break;
        case 'NAS-Port':
          attrType = RadiusService.ATTR_NAS_PORT;
          attrValue = Buffer.alloc(4);
          attrValue.writeUInt32BE(Number(value), 0);
          break;
        case 'Calling-Station-Id':
          attrType = 31;
          attrValue = Buffer.from(String(value), 'utf-8');
          break;
        default:
          continue;
      }

      if (attrType !== undefined) {
        const totalLen = 2 + attrValue.length;
        const attrBuf = Buffer.alloc(totalLen);
        attrBuf.writeUInt8(attrType, 0);
        attrBuf.writeUInt8(totalLen, 1);
        attrValue.copy(attrBuf, 2);
        attrBuffers.push(attrBuf);
      }
    }

    const attrsBuffer = Buffer.concat(attrBuffers);
    const packetLength = 1 + 1 + 2 + 16 + attrsBuffer.length;
    const packet = Buffer.alloc(packetLength);

    let offset = 0;
    packet.writeUInt8(RadiusService.CODE_DISCONNECT_REQUEST, offset); offset += 1;
    packet.writeUInt8(crypto.randomBytes(1)[0], offset); offset += 1;
    packet.writeUInt16BE(packetLength, offset); offset += 2;
    authenticator.copy(packet, offset); offset += 16;
    attrsBuffer.copy(packet, offset);

    const md5Input = Buffer.concat([packet.slice(0, 4), authenticator, attrsBuffer, Buffer.from(nasSecret, 'utf-8')]);
    const responseAuth = crypto.createHash('md5').update(md5Input).digest();
    responseAuth.copy(packet, 4);

    return packet;
  }

  /**
   * Send a RADIUS CoA-Request to a NAS device.
   * Returns true if the packet was sent successfully (does not wait for CoA-ACK).
   */
  async sendCoA(
    nasIp: string,
    nasPort: number,
    attributes: Record<string, any>
  ): Promise<boolean> {
    try {
      const nasSecret = config.radius.secret;
      const packet = this.buildCoAPacket(attributes, nasSecret);

      return new Promise((resolve) => {
        const client = dgram.createSocket('udp4');
        let resolved = false;

        client.send(packet, nasPort || RadiusService.COA_PORT, nasIp, (err) => {
          if (resolved) return;
          resolved = true;
          client.close();

          if (err) {
            logger.error(`CoA send failed to ${nasIp}:${nasPort}: ${err.message}`);
            resolve(false);
          } else {
            logger.info(`CoA-Request sent to ${nasIp}:${nasPort || RadiusService.COA_PORT}`);
            resolve(true);
          }
        });

        // Timeout after 5 seconds
        setTimeout(() => {
          if (resolved) return;
          resolved = true;
          client.close();
          logger.error(`CoA send timed out to ${nasIp}:${nasPort}`);
          resolve(false);
        }, 5000);
      });
    } catch (error) {
      logger.error('CoA error:', error);
      return false;
    }
  }

  /**
   * Send a RADIUS Disconnect-Request to a NAS device.
   */
  async sendDisconnectRequest(
    nasIp: string,
    nasPort: number,
    attributes: Record<string, any>
  ): Promise<boolean> {
    try {
      const nasSecret = config.radius.secret;
      const packet = this.buildDisconnectPacket(attributes, nasSecret);

      return new Promise((resolve) => {
        const client = dgram.createSocket('udp4');
        let resolved = false;

        client.send(packet, nasPort || RadiusService.COA_PORT, nasIp, (err) => {
          if (resolved) return;
          resolved = true;
          client.close();

          if (err) {
            logger.error(`Disconnect-Request send failed to ${nasIp}:${nasPort}: ${err.message}`);
            resolve(false);
          } else {
            logger.info(`Disconnect-Request sent to ${nasIp}:${nasPort || RadiusService.COA_PORT}`);
            resolve(true);
          }
        });

        setTimeout(() => {
          if (resolved) return;
          resolved = true;
          client.close();
          logger.error(`Disconnect-Request timed out to ${nasIp}:${nasPort}`);
          resolve(false);
        }, 5000);
      });
    } catch (error) {
      logger.error('Disconnect-Request error:', error);
      return false;
    }
  }

  // ========================
  // NAS (Network Access Server) Management
  // ========================

  /**
   * List all NAS devices with pagination
   */
  async listNas(options: { page?: number; limit?: number; isActive?: boolean } = {}) {
    const page = options.page || 1;
    const limit = options.limit || 20;
    const skip = (page - 1) * limit;

    const where: any = {};
    if (options.isActive !== undefined) {
      where.isActive = options.isActive;
    }

    const [devices, total] = await Promise.all([
      prisma.nas.findMany({
        where,
        include: {
          _count: { select: { sessions: true } },
        },
        orderBy: { createdAt: 'desc' },
        skip,
        take: limit,
      }),
      prisma.nas.count({ where }),
    ]);

    return {
      devices,
      meta: { total, page, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Get a single NAS by ID
   */
  async getNas(id: string) {
    const nas = await prisma.nas.findUnique({
      where: { id },
      include: {
        _count: { select: { sessions: true } },
      },
    });
    if (!nas) throw new AppError('NAS device not found', 404);
    return nas;
  }

  /**
   * Create a new NAS device
   */
  async createNas(data: {
    nasname: string;
    shortname?: string;
    type?: string;
    ports?: number;
    secret: string;
    server?: string;
    description?: string;
  }) {
    const nas = await prisma.nas.create({
      data: {
        nasname: data.nasname,
        shortname: data.shortname,
        type: data.type || 'other',
        ports: data.ports,
        secret: data.secret,
        server: data.server,
        description: data.description || 'RADIUS Client',
        isActive: true,
      },
    });

    // Sync to FreeRADIUS radclient table
    await this.syncNasToRadius(nas);

    logger.info(`NAS device created: ${nas.nasname} (${nas.id})`);
    return nas;
  }

  /**
   * Update a NAS device
   */
  async updateNas(
    id: string,
    data: Partial<{
      nasname: string;
      shortname: string;
      type: string;
      ports: number;
      secret: string;
      server: string;
      description: string;
      isActive: boolean;
    }>
  ) {
    const existing = await prisma.nas.findUnique({ where: { id } });
    if (!existing) throw new AppError('NAS device not found', 404);

    const nas = await prisma.nas.update({
      where: { id },
      data,
    });

    // Re-sync to FreeRADIUS if secret or nasname changed
    if (data.secret || data.nasname || data.isActive !== undefined) {
      await this.syncNasToRadius(nas);
    }

    logger.info(`NAS device updated: ${nas.nasname} (${nas.id})`);
    return nas;
  }

  /**
   * Delete a NAS device
   */
  async deleteNas(id: string) {
    const existing = await prisma.nas.findUnique({ where: { id } });
    if (!existing) throw new AppError('NAS device not found', 404);

    // Remove from FreeRADIUS radclient table
    await this.removeNasFromRadius(existing.nasname);

    // Remove the NAS (sessions keep nasIpAddress for historical data)
    await prisma.nas.delete({ where: { id } });

    logger.info(`NAS device deleted: ${existing.nasname} (${id})`);
  }

  /**
   * Get active sessions for a specific NAS
   */
  async getNasSessions(nasId: string, options: { page?: number; limit?: number } = {}) {
    const nas = await prisma.nas.findUnique({ where: { id: nasId } });
    if (!nas) throw new AppError('NAS device not found', 404);

    const page = options.page || 1;
    const limit = options.limit || 50;
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      prisma.radiusSession.findMany({
        where: {
          OR: [{ nasId }, { nasIpAddress: nas.nasname }],
          status: 'ACTIVE',
        },
        include: {
          user: {
            select: {
              firstName: true,
              lastName: true,
              email: true,
              phone: true,
              customer: {
                select: { accountNumber: true, customerCode: true },
              },
            },
          },
        },
        orderBy: { startTime: 'desc' },
        skip,
        take: limit,
      }),
      prisma.radiusSession.count({
        where: {
          OR: [{ nasId }, { nasIpAddress: nas.nasname }],
          status: 'ACTIVE',
        },
      }),
    ]);

    return {
      sessions,
      meta: { total, page, totalPages: Math.ceil(total / limit) },
    };
  }

  /**
   * Sync NAS to FreeRADIUS radclient table
   */
  private async syncNasToRadius(nas: {
    nasname: string;
    secret: string;
    isActive: boolean;
    shortname?: string | null;
    server?: string | null;
  }): Promise<void> {
    try {
      const tableExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'radclient'
        ) as exists
      ` as { exists: boolean }[];

      if (!tableExists[0]?.exists) {
        logger.warn('FreeRADIUS radclient table not found, skipping NAS sync');
        return;
      }

      // Delete existing radclient record for this NAS
      await prisma.$executeRaw`
        DELETE FROM radclient WHERE ipaddr = ${nas.nasname}
      `;

      if (nas.isActive) {
        await prisma.$executeRaw`
          INSERT INTO radclient (ipaddr, secret, shortname, nasname)
          VALUES (${nas.nasname}, ${nas.secret}, ${nas.shortname || ''}, ${nas.shortname || ''})
        `;
        logger.info(`NAS ${nas.nasname} synced to radclient table`);
      } else {
        logger.info(`NAS ${nas.nasname} disabled (radclient record removed)`);
      }
    } catch (error) {
      logger.error(`Failed to sync NAS ${nas.nasname} to FreeRADIUS:`, error);
    }
  }

  /**
   * Remove NAS from FreeRADIUS radclient table
   */
  private async removeNasFromRadius(nasname: string): Promise<void> {
    try {
      const tableExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'radclient'
        ) as exists
      ` as { exists: boolean }[];

      if (!tableExists[0]?.exists) return;

      await prisma.$executeRaw`
        DELETE FROM radclient WHERE ipaddr = ${nasname}
      `;
      logger.info(`NAS ${nasname} removed from radclient table`);
    } catch (error) {
      logger.error(`Failed to remove NAS ${nasname} from FreeRADIUS:`, error);
    }
  }

  // ========================
  // Customer RADIUS Credential Management
  // ========================

  /**
   * Get customer's RADIUS config and active sessions
   */
  async getCustomerRadiusConfig(customerId: string) {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: {
        user: { select: { firstName: true, lastName: true, email: true, phone: true } },
        radiusConfig: true,
      },
    });

    if (!customer) throw new AppError('Customer not found', 404);

    const activeSessions = await prisma.radiusSession.findMany({
      where: {
        userId: customer.userId,
        status: 'ACTIVE',
      },
      orderBy: { startTime: 'desc' },
    });

    return {
      customer: {
        id: customer.id,
        accountNumber: customer.accountNumber,
        customerCode: customer.customerCode,
        user: customer.user,
      },
      radiusConfig: customer.radiusConfig
        ? {
            username: customer.radiusConfig.username,
            isActive: customer.radiusConfig.isActive,
            createdAt: customer.radiusConfig.createdAt,
          }
        : null,
      activeSessions,
    };
  }

  /**
   * Reset customer's RADIUS password
   */
  async resetCustomerRadiusPassword(customerId: string): Promise<string> {
    return this.updatePassword(customerId);
  }

  /**
   * Force disconnect all active sessions for a customer
   */
  async disconnectCustomerSessions(customerId: string): Promise<number> {
    const customer = await prisma.customer.findUnique({
      where: { id: customerId },
      include: { radiusConfig: true },
    });

    if (!customer) throw new AppError('Customer not found', 404);
    if (!customer.radiusConfig) throw new AppError('RADIUS config not found for customer', 404);

    const activeSessions = await prisma.radiusSession.findMany({
      where: { userId: customer.userId, status: 'ACTIVE' },
    });

    if (activeSessions.length === 0) return 0;

    // Send disconnect requests to NAS devices
    await this.disconnectUser(customer.radiusConfig.username);

    return activeSessions.length;
  }

  // ========================
  // Speed Plan RADIUS Attribute Sync
  // ========================

  /**
   * Sync a plan's speed attributes to FreeRADIUS radgroupreply table
   */
  async syncPlanToRadius(planId: string): Promise<{ plan: string; attributes: string[] }> {
    const plan = await prisma.plan.findUnique({ where: { id: planId } });
    if (!plan) throw new AppError('Plan not found', 404);

    const attributes: string[] = [];

    try {
      const tableExists = await prisma.$queryRaw`
        SELECT EXISTS (
          SELECT FROM information_schema.tables
          WHERE table_schema = 'public'
          AND table_name = 'radgroupreply'
        ) as exists
      ` as { exists: boolean }[];

      if (!tableExists[0]?.exists) {
        logger.warn('FreeRADIUS radgroupreply table not found, skipping plan sync');
        return { plan: plan.name, attributes };
      }

      const groupname = `plan_${plan.code.toLowerCase()}`;

      // Delete existing radgroupreply records for this plan group
      await prisma.$executeRaw`
        DELETE FROM radgroupreply WHERE groupname = ${groupname}
      `;

      // Insert speed limit attribute (MikroTik-Router-Limit-Bytes-Total-Out = 0 means unlimited)
      if (plan.speedLimit && plan.speedLimit > 0) {
        // Convert Mbps to bps for FreeRADIUS
        const speedLimitBps = plan.speedLimit * 1000000;
        await prisma.$executeRaw`
          INSERT INTO radgroupreply (groupname, attribute, op, value)
          VALUES (${groupname}, 'MikroTik-Rate-Limit', ':=', ${`${speedLimitBps}/${speedLimitBps}`})
        `;
        attributes.push(`MikroTik-Rate-Limit: ${speedLimitBps}/${speedLimitBps}`);
      }

      // Insert FUP speed limit (MikroTik-Filter-Rule or queue simple)
      if (plan.fupSpeedLimit && plan.fupSpeedLimit > 0) {
        const fupSpeedBps = plan.fupSpeedLimit * 1000000;
        // Store FUP limit for reference - actual enforcement via CoA
        await prisma.$executeRaw`
          INSERT INTO radgroupreply (groupname, attribute, op, value)
          VALUES (${groupname}, 'MikroTik-Filter-Rule', ':=', ${`${fupSpeedBps}/${fupSpeedBps}`})
        `;
        attributes.push(`MikroTik-Filter-Rule: ${fupSpeedBps}/${fupSpeedBps}`);
      }

      // Always add service-type for the group
      await prisma.$executeRaw`
        INSERT INTO radgroupreply (groupname, attribute, op, value)
        VALUES (${groupname}, 'Service-Type', ':=', 'Framed-User')
      `;
      attributes.push('Service-Type: Framed-User');

      logger.info(`Plan ${plan.name} synced to radgroupreply as group '${groupname}'`);
    } catch (error) {
      logger.error(`Failed to sync plan ${plan.name} to FreeRADIUS:`, error);
      throw new AppError(`Failed to sync plan to FreeRADIUS: ${(error as Error).message}`, 500);
    }

    return { plan: plan.name, attributes };
  }

  /**
   * Sync all active plans to FreeRADIUS radgroupreply table
   */
  async syncAllPlansToRadius(): Promise<{ planId: string; planName: string; attributes: string[] }[]> {
    const activePlans = await prisma.plan.findMany({
      where: { isActive: true },
    });

    const results: { planId: string; planName: string; attributes: string[] }[] = [];

    for (const plan of activePlans) {
      try {
        const result = await this.syncPlanToRadius(plan.id);
        results.push({
          planId: plan.id,
          planName: result.plan,
          attributes: result.attributes,
        });
      } catch (error) {
        logger.error(`Failed to sync plan ${plan.name}:`, error);
        results.push({
          planId: plan.id,
          planName: plan.name,
          attributes: [],
        });
      }
    }

    logger.info(`Synced ${results.length} plans to FreeRADIUS`);
    return results;
  }
}

export const radiusService = new RadiusService();
export default radiusService;
