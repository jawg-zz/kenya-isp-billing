import { describe, it, expect, vi, beforeEach } from 'vitest';
import { mpesaService } from '../services/mpesa.service';
import type { MpesaCallback } from '../types';

// Mock the dependencies at module level so they're isolated per test file
vi.mock('../config/database', () => {
  const mockTx = {
    payment: {
      findFirst: vi.fn(),
      update: vi.fn(),
    },
    customer: {
      update: vi.fn(),
    },
    invoice: {
      update: vi.fn(),
    },
    subscription: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    notification: {
      create: vi.fn(),
    },
  };

  return {
    prisma: {
      $transaction: vi.fn(async (cb: (tx: unknown) => Promise<void>) => cb(mockTx)),
      payment: { findFirst: mockTx.payment.findFirst },
    },
  };
});

vi.mock('../config', () => ({
  default: {
    mpesa: { shortcode: '174379', callbackUrl: 'http://test/callback' },
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

// Helper to build a valid M-Pesa callback
function buildCallback(overrides: Partial<MpesaCallback['Body']['stkCallback']> = {}): MpesaCallback {
  return {
    Body: {
      stkCallback: {
        MerchantRequestID: 'merchant-001',
        CheckoutRequestID: 'checkout-001',
        ResultCode: 0,
        ResultDesc: 'The service request is processed successfully.',
        CallbackMetadata: {
          Item: [
            { Name: 'Amount', Value: 1000 },
            { Name: 'MpesaReceiptNumber', Value: 'QKZ5RXYZ12' },
            { Name: 'TransactionDate', Value: '20250317103000' },
            { Name: 'PhoneNumber', Value: '254712345678' },
          ],
        },
        ...overrides,
      },
    },
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('M-Pesa callback', () => {
  let prismaMock: typeof import('../config/database')['prisma'];
  let txMock: any;

  beforeEach(async () => {
    vi.restoreAllMocks();
    const dbModule = await import('../config/database');
    prismaMock = dbModule.prisma;
    txMock = {
      payment: { findFirst: vi.fn(), update: vi.fn() },
      customer: { update: vi.fn() },
      invoice: { update: vi.fn() },
      subscription: { findUnique: vi.fn(), update: vi.fn() },
      notification: { create: vi.fn() },
    };
    (prismaMock.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
      async (cb: (tx: unknown) => Promise<void>) => cb(txMock)
    );
  });

  // ── 1. Successful callback processing ───────────────────────────────

  it('should process a successful STK callback and record payment', async () => {
    const mockPayment = {
      id: 'pay-001',
      status: 'PENDING',
      amount: 1000,
      customerId: 'cust-001',
      invoiceId: 'inv-001',
      subscriptionId: null,
      metadata: {},
      customer: { userId: 'user-001' },
    };
    txMock.payment.findFirst.mockResolvedValue(mockPayment);
    txMock.payment.update.mockResolvedValue({});
    txMock.customer.update.mockResolvedValue({});
    txMock.invoice.update.mockResolvedValue({});
    txMock.notification.create.mockResolvedValue({});

    const callback = buildCallback();
    await mpesaService.processCallback(callback);

    // Verify payment was updated to COMPLETED
    expect(txMock.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-001' },
      data: expect.objectContaining({
        status: 'COMPLETED',
        reference: 'QKZ5RXYZ12',
        resultCode: '0',
      }),
    });

    // Verify customer balance was incremented
    expect(txMock.customer.update).toHaveBeenCalledWith({
      where: { id: 'cust-001' },
      data: { balance: { increment: 1000 } },
    });

    // Verify invoice was marked PAID
    expect(txMock.invoice.update).toHaveBeenCalledWith({
      where: { id: 'inv-001' },
      data: { status: 'PAID', paidAt: expect.any(Date) },
    });

    // Verify notification was created
    expect(txMock.notification.create).toHaveBeenCalled();
  });

  // ── 2. Double-credit prevention ────────────────────────────────────

  it('should not process the same callback twice (idempotency)', async () => {
    const mockPayment = {
      id: 'pay-001',
      status: 'COMPLETED', // already processed
      amount: 1000,
      customerId: 'cust-001',
      invoiceId: null,
      subscriptionId: null,
      metadata: {},
      customer: { userId: 'user-001' },
    };
    txMock.payment.findFirst.mockResolvedValue(mockPayment);

    const callback = buildCallback();
    await mpesaService.processCallback(callback);

    // Payment update should NOT be called again for a completed payment
    expect(txMock.payment.update).not.toHaveBeenCalled();
    expect(txMock.customer.update).not.toHaveBeenCalled();
  });

  it('should not process a FAILED payment callback twice', async () => {
    const mockPayment = {
      id: 'pay-002',
      status: 'FAILED',
      amount: 500,
      customerId: 'cust-001',
      invoiceId: null,
      subscriptionId: null,
      metadata: {},
      customer: { userId: 'user-001' },
    };
    txMock.payment.findFirst.mockResolvedValue(mockPayment);

    const callback = buildCallback({ ResultCode: 1, ResultDesc: 'Insufficient funds' });
    await mpesaService.processCallback(callback);

    expect(txMock.payment.update).not.toHaveBeenCalled();
  });

  // ── 3. Timeout / failed callback ───────────────────────────────────

  it('should mark payment as FAILED when ResultCode is non-zero', async () => {
    const mockPayment = {
      id: 'pay-003',
      status: 'PENDING',
      amount: 500,
      customerId: 'cust-001',
      invoiceId: null,
      subscriptionId: null,
      metadata: {},
      customer: { userId: 'user-001' },
    };
    txMock.payment.findFirst.mockResolvedValue(mockPayment);
    txMock.payment.update.mockResolvedValue({});
    txMock.notification.create.mockResolvedValue({});

    const callback = buildCallback({ ResultCode: 1, ResultDesc: 'Request cancelled by user' });
    await mpesaService.processCallback(callback);

    expect(txMock.payment.update).toHaveBeenCalledWith({
      where: { id: 'pay-003' },
      data: expect.objectContaining({
        status: 'FAILED',
        resultCode: '1',
        resultDesc: 'Request cancelled by user',
      }),
    });

    // Should create failure notification
    expect(txMock.notification.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-001',
        type: 'PAYMENT_FAILED',
      }),
    });
  });

  // ── 4. Invalid / missing data ──────────────────────────────────────

  it('should reject callback with missing Body.stkCallback', () => {
    const invalid = { Body: {} } as unknown as MpesaCallback;
    expect(mpesaService.validateCallback(invalid)).toBe(false);
  });

  it('should reject callback with missing required fields', () => {
    const invalid = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'm1',
          // missing CheckoutRequestID, ResultCode, ResultDesc
        },
      },
    } as unknown as MpesaCallback;
    expect(mpesaService.validateCallback(invalid)).toBe(false);
  });

  it('should reject callback with non-number ResultCode', () => {
    const invalid = {
      Body: {
        stkCallback: {
          MerchantRequestID: 'm1',
          CheckoutRequestID: 'c1',
          ResultCode: '0',
          ResultDesc: 'ok',
        },
      },
    } as unknown as MpesaCallback;
    expect(mpesaService.validateCallback(invalid)).toBe(false);
  });

  it('should reject completely empty body', () => {
    expect(mpesaService.validateCallback({} as MpesaCallback)).toBe(false);
    expect(mpesaService.validateCallback(undefined as unknown as MpesaCallback)).toBe(false);
  });

  it('should accept a valid callback', () => {
    const valid = buildCallback();
    expect(mpesaService.validateCallback(valid)).toBe(true);
  });

  // ── 5. Payment not found ──────────────────────────────────────────

  it('should gracefully handle callback for unknown payment', async () => {
    txMock.payment.findFirst.mockResolvedValue(null);

    const callback = buildCallback();
    // Should not throw
    await expect(mpesaService.processCallback(callback)).resolves.not.toThrow();

    expect(txMock.payment.update).not.toHaveBeenCalled();
  });
});
