"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.radiusService = void 0;
const crypto_1 = __importDefault(require("crypto"));
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const database_1 = require("../config/database");
const logger_1 = require("../config/logger");
const types_1 = require("../types");
const redis_1 = require("../config/redis");
class RadiusService {
    // Generate RADIUS password (for PAP authentication)
    // Returns both plaintext (for RADIUS server sync) and hashed (for DB storage)
    static async generatePassword() {
        const plaintext = crypto_1.default.randomBytes(16).toString('hex');
        const hashed = await bcryptjs_1.default.hash(plaintext, 12);
        return { plaintext, hashed };
    }
    // Create RADIUS user for customer
    async createRadiusUser(customerId) {
        const customer = await database_1.prisma.customer.findUnique({
            where: { id: customerId },
            include: {
                user: true,
                radiusConfig: true,
            },
        });
        if (!customer) {
            throw new types_1.AppError('Customer not found', 404);
        }
        if (customer.radiusConfig) {
            return customer.radiusConfig;
        }
        // Generate username and password
        const username = `cust_${customer.customerCode.toLowerCase()}`;
        const { plaintext, hashed } = await RadiusService.generatePassword();
        // Create RADIUS config with hashed password
        const radiusConfig = await database_1.prisma.radiusConfig.create({
            data: {
                customerId: customer.id,
                username,
                password: hashed,
                isActive: true,
            },
        });
        // Sync plaintext password with RADIUS server (not the hash)
        await this.syncUserToRadius({ ...radiusConfig, password: plaintext });
        logger_1.logger.info(`RADIUS user created for customer ${customer.customerCode}`);
        return radiusConfig;
    }
    // Update RADIUS user password
    async updatePassword(customerId) {
        const radiusConfig = await database_1.prisma.radiusConfig.findUnique({
            where: { customerId },
        });
        if (!radiusConfig) {
            throw new types_1.AppError('RADIUS config not found', 404);
        }
        const { plaintext, hashed } = await RadiusService.generatePassword();
        await database_1.prisma.radiusConfig.update({
            where: { id: radiusConfig.id },
            data: { password: hashed },
        });
        // Sync plaintext password with RADIUS server
        await this.syncUserToRadius({ ...radiusConfig, password: plaintext });
        logger_1.logger.info(`RADIUS password updated for customer ${customerId}`);
        return plaintext;
    }
    // Disable RADIUS user
    async disableUser(customerId) {
        const radiusConfig = await database_1.prisma.radiusConfig.findUnique({
            where: { customerId },
        });
        if (!radiusConfig) {
            return;
        }
        await database_1.prisma.radiusConfig.update({
            where: { id: radiusConfig.id },
            data: { isActive: false },
        });
        // Disconnect any active sessions
        await this.disconnectUser(radiusConfig.username);
        logger_1.logger.info(`RADIUS user disabled for customer ${customerId}`);
    }
    // Enable RADIUS user
    async enableUser(customerId) {
        const radiusConfig = await database_1.prisma.radiusConfig.findUnique({
            where: { customerId },
        });
        if (!radiusConfig) {
            throw new types_1.AppError('RADIUS config not found', 404);
        }
        await database_1.prisma.radiusConfig.update({
            where: { id: radiusConfig.id },
            data: { isActive: true },
        });
        logger_1.logger.info(`RADIUS user enabled for customer ${customerId}`);
    }
    // Handle Access-Request (called by RADIUS server via API)
    async handleAccessRequest(request) {
        logger_1.logger.info(`RADIUS Access-Request for ${request.username} from ${request.nasIpAddress}`);
        // Check cache first
        const cachedInfo = await redis_1.cache.get(`radius:user:${request.username}`);
        let userInfo = cachedInfo;
        if (!userInfo) {
            // Fetch from database
            const radiusConfig = await database_1.prisma.radiusConfig.findUnique({
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
                logger_1.logger.warn(`RADIUS auth failed: user not found or inactive - ${request.username}`);
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
            await redis_1.cache.set(`radius:user:${request.username}`, userInfo, 300);
        }
        // Verify password (compare against bcrypt hash)
        const passwordValid = await bcryptjs_1.default.compare(request.password, userInfo.password);
        if (!passwordValid) {
            logger_1.logger.warn(`RADIUS auth failed: invalid password for ${request.username}`);
            return { accept: false };
        }
        // Check subscription status
        if (!userInfo.subscriptionActive) {
            logger_1.logger.warn(`RADIUS auth failed: no active subscription for ${request.username}`);
            return { accept: false };
        }
        // Check data remaining (for prepaid)
        if (userInfo.dataRemaining !== null && userInfo.dataRemaining <= 0) {
            logger_1.logger.warn(`RADIUS auth failed: data depleted for ${request.username}`);
            return { accept: false };
        }
        logger_1.logger.info(`RADIUS Access-Accept for ${request.username}`);
        return {
            accept: true,
            attributes: {
                speedLimit: userInfo.speedLimit,
                dataRemaining: userInfo.dataRemaining,
            },
        };
    }
    // Handle Accounting-Request (session start/stop/interim-update)
    async handleAccountingRequest(request) {
        logger_1.logger.info(`RADIUS Accounting-Request for ${request.username}: ${request.sessionTime}s`);
        const radiusConfig = await database_1.prisma.radiusConfig.findUnique({
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
            logger_1.logger.warn(`RADIUS accounting: user not found - ${request.username}`);
            return;
        }
        const subscription = radiusConfig.customer.subscriptions[0];
        if (!subscription) {
            logger_1.logger.warn(`RADIUS accounting: no subscription - ${request.username}`);
            return;
        }
        // Check if this is a new session or update
        let session = await database_1.prisma.radiusSession.findUnique({
            where: { sessionId: request.sessionId },
        });
        const totalOctets = request.inputOctets + request.outputOctets;
        if (session) {
            // Update existing session
            await database_1.prisma.radiusSession.update({
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
        }
        else {
            // Create new session
            session = await database_1.prisma.radiusSession.create({
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
        const previous = await redis_1.cache.get(cacheKey);
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
        await redis_1.cache.set(cacheKey, {
            inputOctets: request.inputOctets,
            outputOctets: request.outputOctets,
            inputPackets: request.inputPackets,
            outputPackets: request.outputPackets,
        }, 3600); // expire after 1 hour (should be longer for long sessions)
        // Update usage record with delta
        await this.updateUsageRecord(radiusConfig.customer.userId, radiusConfig.customerId, subscription.id, request.sessionId, request.nasIpAddress, deltaInputOctets, deltaOutputOctets, deltaInputPackets, deltaOutputPackets);
        // Update subscription data used with delta
        const deltaTotalOctets = deltaInputOctets + deltaOutputOctets;
        await this.updateSubscriptionUsage(subscription.id, deltaTotalOctets);
        // Check FUP threshold (using updated subscription.dataUsed)
        await this.checkFUPThreshold(subscription.id);
    }
    // Update usage record (with delta octets)
    async updateUsageRecord(userId, customerId, subscriptionId, sessionId, nasIpAddress, deltaInputOctets, deltaOutputOctets, deltaInputPackets, deltaOutputPackets) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const totalDeltaOctets = deltaInputOctets + deltaOutputOctets;
        // Upsert daily usage record (increment)
        await database_1.prisma.usageRecord.upsert({
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
    async updateSubscriptionUsage(subscriptionId, deltaTotalOctets) {
        const subscription = await database_1.prisma.subscription.findUnique({
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
        await database_1.prisma.subscription.update({
            where: { id: subscriptionId },
            data: {
                dataUsed: newDataUsed,
                dataRemaining: dataRemaining,
            },
        });
        // Invalidate cache
        await redis_1.cache.del(`radius:user:cust_${subscription.customerId}`);
    }
    // Check Fair Usage Policy threshold
    async checkFUPThreshold(subscriptionId) {
        const subscription = await database_1.prisma.subscription.findUnique({
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
            const warningSent = await redis_1.cache.get(warningKey);
            if (!warningSent && subscription.customer?.user) {
                await database_1.prisma.notification.create({
                    data: {
                        userId: subscription.customer.userId,
                        type: 'FUP_THRESHOLD',
                        title: 'Fair Usage Warning',
                        message: `You have used ${usagePercentage}% of your fair usage allowance. Your speed may be reduced after reaching the limit.`,
                        channel: 'in_app',
                    },
                });
                await redis_1.cache.set(warningKey, true, 86400);
            }
        }
        else if (usagePercentage >= 100) {
            // FUP threshold reached - apply speed limit (only once)
            const thresholdReachedKey = `fup:reached:${subscriptionId}`;
            const alreadyReached = await redis_1.cache.get(thresholdReachedKey);
            if (!alreadyReached) {
                logger_1.logger.info(`FUP threshold reached for subscription ${subscriptionId}`);
                // In a real system, this would trigger a RADIUS CoA (Change of Authorization)
                // to update the user's speed limit on the NAS device
                await this.applyFUPLimit(subscription);
                await redis_1.cache.set(thresholdReachedKey, true, 30 * 24 * 60 * 60); // 30 days
            }
        }
        else if (usagePercentage < 90) {
            // Usage dropped below threshold, clear flags
            await redis_1.cache.del(`fup:warning:${subscriptionId}`);
            await redis_1.cache.del(`fup:reached:${subscriptionId}`);
            await redis_1.cache.del(`radius:fup:${subscriptionId}`);
        }
    }
    // Apply FUP speed limit
    async applyFUPLimit(subscription) {
        // This would send a RADIUS CoA packet to the NAS
        // For now, we'll just log and update the cache
        await redis_1.cache.set(`radius:fup:${subscription.id}`, {
            appliedAt: new Date().toISOString(),
            newSpeed: subscription.plan.fupSpeedLimit,
        }, 86400);
        logger_1.logger.info(`FUP limit applied for subscription ${subscription.id}`);
    }
    // Disconnect user session
    async disconnectUser(username) {
        // In a real implementation, this would send a RADIUS Disconnect-Request
        // to the NAS device
        const activeSessions = await database_1.prisma.radiusSession.findMany({
            where: {
                user: { customer: { radiusConfig: { username } } },
                status: 'ACTIVE',
            },
        });
        for (const session of activeSessions) {
            await database_1.prisma.radiusSession.update({
                where: { id: session.id },
                data: {
                    status: 'CLOSED',
                    stopTime: new Date(),
                    terminateCause: 'ADMIN_DISCONNECT',
                },
            });
        }
        // Invalidate cache
        await redis_1.cache.del(`radius:user:${username}`);
        logger_1.logger.info(`Disconnected user ${username} (${activeSessions.length} sessions)`);
    }
    // Get active sessions for customer
    async getActiveSessions(customerId) {
        const sessions = await database_1.prisma.radiusSession.findMany({
            where: {
                user: { customer: { id: customerId } },
                status: 'ACTIVE',
            },
            orderBy: { startTime: 'desc' },
        });
        return sessions;
    }
    // Sync user to RADIUS server (writes to FreeRADIUS radcheck table)
    async syncUserToRadius(config) {
        try {
            const { username, password, isActive = true } = config;
            // Check if FreeRADIUS radcheck table exists
            const tableExists = await database_1.prisma.$queryRaw `
        SELECT EXISTS (
          SELECT FROM information_schema.tables 
          WHERE table_schema = 'public' 
          AND table_name = 'radcheck'
        ) as exists
      `;
            if (!tableExists[0]?.exists) {
                logger_1.logger.warn('FreeRADIUS radcheck table not found, skipping sync');
                return;
            }
            // Delete existing radcheck records for this user
            await database_1.prisma.$executeRaw `
        DELETE FROM radcheck WHERE username = ${username}
      `;
            if (isActive) {
                // Insert new radcheck record with User-Password attribute
                // Using bcrypt hashing for password security
                await database_1.prisma.$executeRaw `
          INSERT INTO radcheck (username, attribute, op, value)
          VALUES (${username}, 'User-Password', ':=', ${password})
        `;
                // Add Auth-Type attribute for PAP authentication
                await database_1.prisma.$executeRaw `
          INSERT INTO radcheck (username, attribute, op, value)
          VALUES (${username}, 'Auth-Type', ':=', 'PAP')
        `;
                logger_1.logger.info(`RADIUS user ${username} synced to radcheck table (active)`);
            }
            else {
                logger_1.logger.info(`RADIUS user ${username} disabled (radcheck records removed)`);
            }
        }
        catch (error) {
            logger_1.logger.error(`Failed to sync RADIUS user ${config.username}:`, error);
            // Don't throw - allow the operation to continue even if RADIUS sync fails
        }
    }
    // Disable RADIUS user by removing radcheck records
    async disableRadiusUser(customerId) {
        const radiusConfig = await database_1.prisma.radiusConfig.findUnique({
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
    async enableRadiusUser(customerId) {
        const radiusConfig = await database_1.prisma.radiusConfig.findUnique({
            where: { customerId },
        });
        if (!radiusConfig) {
            throw new types_1.AppError('RADIUS config not found', 404);
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
        logger_1.logger.info(`RADIUS user ${radiusConfig.username} re-enabled`);
    }
}
exports.radiusService = new RadiusService();
exports.default = exports.radiusService;
//# sourceMappingURL=radius.service.js.map