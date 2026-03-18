import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock dependencies (factory functions are hoisted correctly) ────────

vi.mock('../config/database', () => {
  const mockTx = {
    $queryRaw: vi.fn(),
    payment: { findFirst: vi.fn(), update: vi.fn(), findUnique: vi.fn() },
    customer: { update: vi.fn() },
    invoice: { update: vi.fn() },
    subscription: { findUnique: vi.fn(), update: vi.fn() },
    notification: { create: vi.fn() },
  };
  return {
    prisma: {
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<void>) => cb(mockTx)),
      payment: { findFirst: mockTx.payment.findFirst },
      __mockTx: mockTx,
    },
  };
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
    airtel: { environment: 'sandbox', clientId: 'test', clientSecret: 'test' },
    business: { gracePeriodDays: 3, taxRate: 0.16 },
  },
}));

vi.mock('../config/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
    debug: vi.fn(),
  },
}));

vi.mock('../services/radius.service', () => ({
  radiusService: {
    invalidateCacheForCustomer: vi.fn().mockResolvedValue(undefined),
  },
}));

import { airtelService } from '../services/airtel.service';
import { prisma } from '../config/database';
import { cache } from '../config/redis';
import type { AirtelCallback } from '../types';

// ─── Helpers ────────────────────────────────────────────────────────────

function buildCallback(
  overrides: Partial<AirtelCallback['transaction']> = {}
): AirtelCallback {
  return {
    transaction: {
      id: 'txn-001',
      reference: 'AIR1710751234567ABCDEF01',
      status: 'SUCCESS',
      amount: { value: 1000, currency: 'KES' },
      subscriber: { country: 'KE', msisdn: '254712345678' },
      ...overrides,
    },
  };
}

function buildMockPayment(overrides: Record<string, any> = {}) {
  return {
    id: 'pay-001',
    status: 'PENDING',
    amount: 1000,
    customerId: 'cust-001',
    invoiceId: 'inv-001',
    subscriptionId: 'sub-001',
    metadata: {},
    customer: { userId: 'user-001' },
    ...overrides,
  };
}

function buildMockSubscription(overrides: Record<string, any> = {}) {
  return {
    id: 'sub-001',
    status: 'PENDING_PAYMENT',
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-02-01'),
    plan: {
      id: 'plan-001',
      name: 'Home 10Mbps',
      price: 2500,
      validityDays: 30,
      dataAllowance: 10_000_000_000n,
    },
    ...overrides,
  };
}

// Access the mock transaction object
function getTxMock() {
  return (prisma as any).__mockTx;
}

function resetMocks() {
  const txMock = getTxMock();
  for (const m of [
    txMock.$queryRaw, txMock.payment.findFirst, txMock.payment.update,
    txMock.payment.findUnique, txMock.customer.update, txMock.invoice.update,
    txMock.subscription.findUnique, txMock.subscription.update, txMock.notification.create,
  ]) {
    m.mockReset();
  }
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (cb: (tx: unknown) => Promise<void>) => cb(txMock)
  );
  (cache.get as ReturnType<typeof vi.fn>).mockReset();
  (cache.set as ReturnType<typeof vi.fn>).mockReset();
  (cache.del as ReturnType<typeof vi.fn>).mockReset();
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('Airtel payment callback', () => {
  beforeEach(() => resetMocks());

  // ── 1. Successful callback processing ───────────────────────────────

  it('should process a successful callback and credit customer balance', async () => {
    const txMock = getTxMock();
    const payment = buildMockPayment();
    txMock.$queryRaw.mockResolvedValue([payment]);
    txMock.payment.findUnique.mockResolvedValue({
      ...payment,
      subscription: buildMockSubscription(),
    });
    txMock.payment.update.mockResolvedValue({});
    txMock.customer.update.mockResolvedValue({});
    txMock.invoice.update.mockResolvedValue({});
    txMock.subscription.update.mockResolvedValue({});
    txMock.notification.create.mockResolvedValue({});
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    const callback = buildCallback();
    await airtelService.processCallback(callback);

    expect(txMock.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-001' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        processedAt: expect.any(Date),
      }),
    });

    expect(txMock.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust-001' },
      data: { balance: { increment: 1000 } },
    });

    expect(txMock.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-001' },
      data: { status: 'PAID', paidAt: expect.any(Date) },
    });

    expect((cache.set as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      'airtel:callback:txn-001',
      expect.any(Object),
      86400
    );
  });

  // ── 2. Idempotency ─────────────────────────────────────────────────

  it('should not double-credit on duplicate callback (idempotency)', async () => {
    const txMock = getTxMock();
    const payment = buildMockPayment({ status: 'COMPLETED' });
    txMock.$queryRaw.mockResolvedValue([payment]);
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    await airtelService.processCallback(buildCallback());

    expect(txMock.payment.update).not.toHaveBeenCalled();
    expect(txMock.customer.update).not.toHaveBeenCalled();
  });

  // ── 3. FOR UPDATE lock ──────────────────────────────────────────────

  it('should lock payment row with FOR UPDATE to prevent race conditions', async () => {
    const txMock = getTxMock();
    const payment = buildMockPayment();
    txMock.$queryRaw.mockResolvedValue([payment]);
    txMock.payment.findUnique.mockResolvedValue({
      ...payment,
      subscription: buildMockSubscription(),
    });
    txMock.payment.update.mockResolvedValue({});
    txMock.customer.update.mockResolvedValue({});
    txMock.invoice.update.mockResolvedValue({});
    txMock.subscription.update.mockResolvedValue({});
    txMock.notification.create.mockResolvedValue({});
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    await airtelService.processCallback(buildCallback());

    expect(txMock.$queryRaw).toHaveBeenCalled();
  });

  // ── 4. Malformed payload rejection ──────────────────────────────────

  it('should reject callback with missing transaction.id', async () => {
    const invalid = { transaction: {} } as unknown as AirtelCallback;
    await expect(airtelService.processCallback(invalid)).rejects.toThrow(
      'Invalid callback: missing transaction.id'
    );
  });

  it('should reject callback with missing transaction.reference', async () => {
    const invalid = {
      transaction: { id: 'txn-001' },
    } as unknown as AirtelCallback;
    await expect(airtelService.processCallback(invalid)).rejects.toThrow(
      'Invalid callback: missing transaction.reference'
    );
  });

  it('should reject callback with missing transaction.status', async () => {
    const invalid = {
      transaction: { id: 'txn-001', reference: 'REF-001' },
    } as unknown as AirtelCallback;
    await expect(airtelService.processCallback(invalid)).rejects.toThrow(
      'Invalid callback: missing transaction.status'
    );
  });

  // ── 5. Payment not found ────────────────────────────────────────────

  it('should handle callback for unknown payment gracefully', async () => {
    const txMock = getTxMock();
    txMock.$queryRaw.mockResolvedValue([]);
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    await expect(airtelService.processCallback(buildCallback())).resolves.not.toThrow();
    expect(txMock.payment.update).not.toHaveBeenCalled();
  });

  // ── 6. Subscription status guard ────────────────────────────────────

  it('should NOT activate a TERMINATED subscription on payment', async () => {
    const txMock = getTxMock();
    const payment = buildMockPayment();
    const terminatedSub = { id: 'sub-001', status: 'TERMINATED', plan: { id: 'plan-001', name: 'Home 10Mbps', validityDays: 30, dataAllowance: 10_000_000_000n } };
    txMock.$queryRaw.mockResolvedValue([payment]);
    txMock.payment.findUnique.mockResolvedValue({ ...payment, subscription: terminatedSub });
    txMock.payment.update.mockResolvedValue({});
    txMock.customer.update.mockResolvedValue({});
    txMock.invoice.update.mockResolvedValue({});
    txMock.subscription.findUnique.mockResolvedValue(terminatedSub);
    txMock.notification.create.mockResolvedValue({});
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    await airtelService.processCallback(buildCallback());

    // Payment should be marked COMPLETED
    expect(txMock.payment.update).toHaveBeenCalled();
    // Subscription should NOT be reactivated
    expect(txMock.subscription.update).not.toHaveBeenCalled();
    // A notification about non-reactivation should exist
    const calls = txMock.notification.create.mock.calls;
    expect(calls.some((c: any[]) => c[0]?.data?.message?.includes('cannot be reactivated'))).toBe(true);
  });

  it('should NOT activate an EXPIRED subscription on payment', async () => {
    const txMock = getTxMock();
    const payment = buildMockPayment();
    const expiredSub = { id: 'sub-001', status: 'EXPIRED', plan: { id: 'plan-001', name: 'Home 10Mbps', validityDays: 30, dataAllowance: 10_000_000_000n } };
    txMock.$queryRaw.mockResolvedValue([payment]);
    txMock.payment.findUnique.mockResolvedValue({ ...payment, subscription: expiredSub });
    txMock.payment.update.mockResolvedValue({});
    txMock.customer.update.mockResolvedValue({});
    txMock.invoice.update.mockResolvedValue({});
    txMock.subscription.findUnique.mockResolvedValue(expiredSub);
    txMock.notification.create.mockResolvedValue({});
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    await airtelService.processCallback(buildCallback());

    expect(txMock.subscription.update).not.toHaveBeenCalled();
  });

  // ── 7. Subscription activation on success ───────────────────────────

  it('should activate a PENDING_PAYMENT subscription on success', async () => {
    const txMock = getTxMock();
    const payment = buildMockPayment();
    const pendingSub = { id: 'sub-001', status: 'PENDING_PAYMENT', startDate: new Date('2025-01-01'), endDate: new Date('2025-02-01'), plan: { id: 'plan-001', name: 'Home 10Mbps', price: 2500, validityDays: 30, dataAllowance: 10_000_000_000n } };
    txMock.$queryRaw.mockResolvedValue([payment]);
    txMock.payment.findUnique.mockResolvedValue({ ...payment, subscription: pendingSub });
    txMock.payment.update.mockResolvedValue({});
    txMock.customer.update.mockResolvedValue({});
    txMock.invoice.update.mockResolvedValue({});
    txMock.subscription.findUnique.mockResolvedValue(pendingSub);
    txMock.subscription.update.mockResolvedValue({});
    txMock.notification.create.mockResolvedValue({});
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    await airtelService.processCallback(buildCallback());

    expect(txMock.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-001' },
      data: expect.objectContaining({
        status: 'ACTIVE',
        startDate: expect.any(Date),
        endDate: expect.any(Date),
      }),
    });
  });

  // ── 8. Usage reset on renewal ───────────────────────────────────────

  it('should reset data usage when renewing an ACTIVE subscription', async () => {
    const txMock = getTxMock();
    const payment = buildMockPayment();
    const activeSub = { id: 'sub-001', status: 'ACTIVE', dataUsed: 5_000_000_000n, startDate: new Date('2025-01-01'), endDate: new Date('2025-02-01'), plan: { id: 'plan-001', name: 'Home 10Mbps', price: 2500, validityDays: 30, dataAllowance: 10_000_000_000n } };
    txMock.$queryRaw.mockResolvedValue([payment]);
    txMock.payment.findUnique.mockResolvedValue({ ...payment, subscription: activeSub });
    txMock.payment.update.mockResolvedValue({});
    txMock.customer.update.mockResolvedValue({});
    txMock.invoice.update.mockResolvedValue({});
    txMock.subscription.findUnique.mockResolvedValue(activeSub);
    txMock.subscription.update.mockResolvedValue({});
    txMock.notification.create.mockResolvedValue({});
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    await airtelService.processCallback(buildCallback());

    expect(txMock.subscription.update).toHaveBeenCalledWith({
      where: { id: 'sub-001' },
      data: expect.objectContaining({
        status: 'ACTIVE',
        dataUsed: 0,
        dataRemaining: 10_000_000_000n,
      }),
    });
  });

  // ── 9. Failed transaction ───────────────────────────────────────────

  it('should mark payment FAILED and notify customer on FAILED callback', async () => {
    const txMock = getTxMock();
    const payment = buildMockPayment();
    txMock.$queryRaw.mockResolvedValue([payment]);
    txMock.payment.findUnique.mockResolvedValue(payment);
    txMock.payment.update.mockResolvedValue({});
    txMock.notification.create.mockResolvedValue({});
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    await airtelService.processCallback(buildCallback({ status: 'FAILED' }));

    expect(txMock.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-001' },
      data: expect.objectContaining({ status: 'FAILED' }),
    });

    expect(txMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-001',
        type: 'PAYMENT_FAILED',
      }),
    });
  });
});
