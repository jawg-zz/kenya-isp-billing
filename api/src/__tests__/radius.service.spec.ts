import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock dependencies ─────────────────────────────────────────────────

vi.mock('../config/database', () => {
  const mockPrisma = {
    radiusConfig: { findUnique: vi.fn(), create: vi.fn(), update: vi.fn() },
    radiusSession: { findUnique: vi.fn(), findMany: vi.fn(), create: vi.fn(), update: vi.fn() },
    subscription: { findUnique: vi.fn(), findMany: vi.fn(), update: vi.fn() },
    usageRecord: { upsert: vi.fn() },
    customer: { findUnique: vi.fn() },
    notification: { create: vi.fn() },
    $queryRaw: vi.fn(),
    $executeRaw: vi.fn(),
  };
  return { prisma: mockPrisma };
});

vi.mock('../config/redis', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

vi.mock('../config', () => ({
  default: {
    radius: { secret: 'testing123' },
  },
}));

vi.mock('../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

import { radiusService } from '../services/radius.service';
import { prisma } from '../config/database';
import { cache } from '../config/redis';

// ─── Helpers ────────────────────────────────────────────────────────────

function resetMocks() {
  const p = prisma as any;
  for (const m of [
    p.radiusConfig.findUnique, p.radiusConfig.create, p.radiusConfig.update,
    p.radiusSession.findUnique, p.radiusSession.findMany, p.radiusSession.create, p.radiusSession.update,
    p.subscription.findUnique, p.subscription.findMany, p.subscription.update,
    p.usageRecord.upsert,
    p.customer.findUnique, p.notification.create,
    p.$queryRaw, p.$executeRaw,
  ]) {
    m.mockReset();
  }
  (cache.get as ReturnType<typeof vi.fn>).mockReset();
  (cache.set as ReturnType<typeof vi.fn>).mockReset();
  (cache.del as ReturnType<typeof vi.fn>).mockReset();
}

function buildRadiusConfig(overrides: Record<string, any> = {}) {
  return {
    id: 'rc-001',
    customerId: 'cust-001',
    username: 'cust_abc123',
    password: '$2a$12$hashedradiuspassword',
    isActive: true,
    ...overrides,
  };
}

function buildActiveSubscription(overrides: Record<string, any> = {}) {
  return {
    id: 'sub-001',
    status: 'ACTIVE',
    dataUsed: 0n,
    dataRemaining: 10_000_000_000n,
    plan: {
      id: 'plan-001',
      name: 'Home 10Mbps',
      speedLimit: 10,
      fupSpeedLimit: 2,
      fupThreshold: 8_000_000_000n,
      dataAllowance: 10_000_000_000n,
    },
    ...overrides,
  };
}

// ─── Access Request Tests ───────────────────────────────────────────────

describe('RADIUS - Access Request', () => {
  beforeEach(() => resetMocks());

  it('should accept access for active subscription with data remaining', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('plaintext-password', 12);
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma as any).radiusConfig.findUnique.mockResolvedValue({
      ...buildRadiusConfig({ password: hash }),
      isActive: true,
      customer: {
        user: { accountStatus: 'ACTIVE' },
        subscriptions: [buildActiveSubscription()],
      },
    });

    const result = await radiusService.handleAccessRequest({
      username: 'cust_abc123',
      password: 'plaintext-password',
      nasIpAddress: '192.168.1.1',
    });

    expect(result.accept).toBe(true);
    expect(result.attributes).toHaveProperty('speedLimit', 10);
    expect((cache.set as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });

  it('should reject access for expired subscription (no active subscription)', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('plaintext-password', 12);
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma as any).radiusConfig.findUnique.mockResolvedValue({
      ...buildRadiusConfig({ password: hash }),
      isActive: true,
      customer: {
        user: { accountStatus: 'ACTIVE' },
        subscriptions: [],
      },
    });

    const result = await radiusService.handleAccessRequest({
      username: 'cust_abc123',
      password: 'plaintext-password',
      nasIpAddress: '192.168.1.1',
    });

    expect(result.accept).toBe(false);
  });

  it('should reject access for suspended account', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('plaintext-password', 12);
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma as any).radiusConfig.findUnique.mockResolvedValue({
      ...buildRadiusConfig({ password: hash }),
      isActive: true,
      customer: {
        user: { accountStatus: 'SUSPENDED' },
        subscriptions: [buildActiveSubscription()],
      },
    });

    const result = await radiusService.handleAccessRequest({
      username: 'cust_abc123',
      password: 'plaintext-password',
      nasIpAddress: '192.168.1.1',
    });

    expect(result.accept).toBe(false);
  });

  it('should reject access when data is exceeded', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('plaintext-password', 12);
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma as any).radiusConfig.findUnique.mockResolvedValue({
      ...buildRadiusConfig({ password: hash }),
      isActive: true,
      customer: {
        user: { accountStatus: 'ACTIVE' },
        subscriptions: [buildActiveSubscription({ dataRemaining: 0n })],
      },
    });

    const result = await radiusService.handleAccessRequest({
      username: 'cust_abc123',
      password: 'plaintext-password',
      nasIpAddress: '192.168.1.1',
    });

    expect(result.accept).toBe(false);
  });

  it('should reject access for inactive/disabled RADIUS user', async () => {
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma as any).radiusConfig.findUnique.mockResolvedValue(null);

    const result = await radiusService.handleAccessRequest({
      username: 'cust_abc123',
      password: 'plaintext-password',
      nasIpAddress: '192.168.1.1',
    });

    expect(result.accept).toBe(false);
  });

  it('should reject access for wrong password', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('correct-password', 12);
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma as any).radiusConfig.findUnique.mockResolvedValue({
      ...buildRadiusConfig({ password: hash }),
      isActive: true,
      customer: {
        user: { accountStatus: 'ACTIVE' },
        subscriptions: [buildActiveSubscription()],
      },
    });

    const result = await radiusService.handleAccessRequest({
      username: 'cust_abc123',
      password: 'wrong-password',
      nasIpAddress: '192.168.1.1',
    });

    expect(result.accept).toBe(false);
  });

  it('should return cached user info on cache hit', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('plaintext-password', 12);
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue({
      username: 'cust_abc123',
      password: hash,
      isActive: true,
      dataRemaining: 10_000_000_000,
      speedLimit: 10,
      fupSpeedLimit: 2,
      subscriptionActive: true,
      accountStatus: 'ACTIVE',
    });

    const result = await radiusService.handleAccessRequest({
      username: 'cust_abc123',
      password: 'plaintext-password',
      nasIpAddress: '192.168.1.1',
    });

    expect(result.accept).toBe(true);
    expect((prisma as any).radiusConfig.findUnique).not.toHaveBeenCalled();
  });
});

// ─── Accounting Request Tests ───────────────────────────────────────────

describe('RADIUS - Accounting Request', () => {
  beforeEach(() => resetMocks());

  const BASE_ACCOUNTING = {
    sessionId: 'sess-001',
    username: 'cust_abc123',
    nasIpAddress: '192.168.1.1',
    inputOctets: 1000000,
    outputOctets: 500000,
    inputPackets: 1000,
    outputPackets: 500,
    sessionTime: 300,
  };

  it('should create a new session on first Accounting-Start', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('plaintext-password', 12);
    (prisma as any).radiusConfig.findUnique.mockResolvedValue({
      ...buildRadiusConfig({ password: hash }),
      customer: {
        userId: 'user-001',
        customerId: 'cust-001',
        subscriptions: [buildActiveSubscription()],
      },
    });
    (prisma as any).radiusSession.findUnique.mockResolvedValue(null);
    (prisma as any).radiusSession.create.mockResolvedValue({ id: 'rs-001', ...BASE_ACCOUNTING });
    (prisma as any).radiusSession.update.mockResolvedValue({});
    (prisma as any).usageRecord.upsert.mockResolvedValue({});
    (prisma as any).subscription.findUnique.mockResolvedValue({
      ...buildActiveSubscription(),
      plan: { ...buildActiveSubscription().plan, dataAllowance: 10_000_000_000n },
    });
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    await radiusService.handleAccountingRequest(BASE_ACCOUNTING);

    expect((prisma as any).radiusSession.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        sessionId: 'sess-001',
        inputOctets: 1000000,
        outputOctets: 500000,
        totalOctets: 1500000,
        status: 'ACTIVE',
      }),
    });
  });

  it('should close session on Accounting-Stop with terminate cause', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('plaintext-password', 12);
    (prisma as any).radiusConfig.findUnique.mockResolvedValue({
      ...buildRadiusConfig({ password: hash }),
      customer: {
        userId: 'user-001',
        customerId: 'cust-001',
        subscriptions: [buildActiveSubscription()],
      },
    });
    (prisma as any).radiusSession.findUnique.mockResolvedValue({ id: 'rs-001', sessionId: 'sess-001' });
    (prisma as any).radiusSession.update.mockResolvedValue({ id: 'rs-001', lastCumulativeInputOctets: 0, lastCumulativeOutputOctets: 0, lastCumulativeInputPackets: 0, lastCumulativeOutputPackets: 0 });
    (prisma as any).usageRecord.upsert.mockResolvedValue({});
    (prisma as any).subscription.findUnique.mockResolvedValue({
      ...buildActiveSubscription(),
      plan: { ...buildActiveSubscription().plan, dataAllowance: 10_000_000_000n },
    });
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    await radiusService.handleAccountingRequest({ ...BASE_ACCOUNTING, terminateCause: 'User-Request' });

    expect((prisma as any).radiusSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CLOSED',
          terminateCause: 'User-Request',
          stopTime: expect.any(Date),
        }),
      })
    );
  });

  it('should calculate cumulative octets delta correctly', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('plaintext-password', 12);
    (prisma as any).radiusConfig.findUnique.mockResolvedValue({
      ...buildRadiusConfig({ password: hash }),
      customer: {
        userId: 'user-001',
        customerId: 'cust-001',
        subscriptions: [buildActiveSubscription()],
      },
    });
    // The session already exists and has previous cumulative values
    const existingSession = {
      id: 'rs-001', sessionId: 'sess-001',
      lastCumulativeInputOctets: BigInt(1000000),
      lastCumulativeOutputOctets: BigInt(500000),
      lastCumulativeInputPackets: BigInt(1000),
      lastCumulativeOutputPackets: BigInt(500),
    };
    (prisma as any).radiusSession.findUnique.mockResolvedValue(existingSession);
    (prisma as any).radiusSession.update.mockResolvedValue(existingSession);
    (prisma as any).usageRecord.upsert.mockResolvedValue({});
    (prisma as any).subscription.findUnique.mockResolvedValue({
      ...buildActiveSubscription(),
      plan: { ...buildActiveSubscription().plan, dataAllowance: 10_000_000_000n },
    });
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    // Current octets: 2M input, 700K output
    // Previous (from DB): 1M input, 500K output
    // Delta should be: 1M input, 200K output
    await radiusService.handleAccountingRequest({ ...BASE_ACCOUNTING, inputOctets: 2000000, outputOctets: 700000 });

    expect((prisma as any).usageRecord.upsert).toHaveBeenCalledWith(
      expect.objectContaining({
        update: expect.objectContaining({
          inputOctets: { increment: 1000000 },
          outputOctets: { increment: 200000 },
        }),
      })
    );
  });

  it('should fall back to DB on Redis cache miss for cumulative octets', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash('plaintext-password', 12);
    (prisma as any).radiusConfig.findUnique.mockResolvedValue({
      ...buildRadiusConfig({ password: hash }),
      customer: {
        userId: 'user-001',
        customerId: 'cust-001',
        subscriptions: [buildActiveSubscription()],
      },
    });
    const existingSession = {
      id: 'rs-001', sessionId: 'sess-001',
      lastCumulativeInputOctets: '3000000',
      lastCumulativeOutputOctets: '1500000',
      lastCumulativeInputPackets: '3000',
      lastCumulativeOutputPackets: '1500',
    };
    (prisma as any).radiusSession.findUnique.mockResolvedValue(existingSession);
    (prisma as any).radiusSession.update.mockResolvedValue(existingSession);
    (prisma as any).usageRecord.upsert.mockResolvedValue({});
    (prisma as any).subscription.findUnique.mockResolvedValue({
      ...buildActiveSubscription(),
      plan: { ...buildActiveSubscription().plan, dataAllowance: 10_000_000_000n },
    });
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    await radiusService.handleAccountingRequest({ ...BASE_ACCOUNTING, inputOctets: 3000000, outputOctets: 1500000 });

    expect((prisma as any).usageRecord.upsert).toHaveBeenCalled();
  });

  it('should reject accounting with negative octets', async () => {
    await radiusService.handleAccountingRequest({ ...BASE_ACCOUNTING, inputOctets: -100 });

    expect((prisma as any).radiusConfig.findUnique).not.toHaveBeenCalled();
  });

  it('should reject accounting with unreasonably large octets', async () => {
    await radiusService.handleAccountingRequest({ ...BASE_ACCOUNTING, inputOctets: 2_000_000_000_000_000 });

    expect((prisma as any).radiusConfig.findUnique).not.toHaveBeenCalled();
  });
});

// ─── Disconnect Tests ──────────────────────────────────────────────────

describe('RADIUS - Disconnect', () => {
  beforeEach(() => resetMocks());

  it('should disconnect user and close all active sessions', async () => {
    (prisma as any).radiusSession.findMany.mockResolvedValue([
      { id: 'rs-001', sessionId: 'sess-001', nasIpAddress: '192.168.1.1', nasPortId: '1', status: 'ACTIVE' },
      { id: 'rs-002', sessionId: 'sess-002', nasIpAddress: '192.168.1.2', nasPortId: '2', status: 'ACTIVE' },
    ]);
    (prisma as any).radiusSession.update.mockResolvedValue({});
    (cache.del as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await radiusService.disconnectUser('cust_abc123');

    expect((prisma as any).radiusSession.update).toHaveBeenCalledTimes(2);
    expect((prisma as any).radiusSession.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          status: 'CLOSED',
          terminateCause: 'ADMIN_DISCONNECT',
        }),
      })
    );
    expect((cache.del as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('radius:user:cust_abc123');
  });

  it('should handle disconnect when no active sessions exist', async () => {
    (prisma as any).radiusSession.findMany.mockResolvedValue([]);
    (cache.del as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(radiusService.disconnectUser('cust_abc123')).resolves.not.toThrow();
  });
});

// ─── Cache Invalidation ─────────────────────────────────────────────────

describe('RADIUS - Cache Invalidation', () => {
  beforeEach(() => resetMocks());

  it('should invalidate cache for customer when subscription changes', async () => {
    (prisma as any).radiusConfig.findUnique.mockResolvedValue(buildRadiusConfig());
    (cache.del as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await radiusService.invalidateCacheForCustomer('cust-001');

    expect((cache.del as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('radius:user:cust_abc123');
  });

  it('should handle cache invalidation when no RADIUS config exists', async () => {
    (prisma as any).radiusConfig.findUnique.mockResolvedValue(null);

    await expect(radiusService.invalidateCacheForCustomer('cust-nonexistent')).resolves.not.toThrow();
    expect((cache.del as ReturnType<typeof vi.fn>)).not.toHaveBeenCalled();
  });
});
