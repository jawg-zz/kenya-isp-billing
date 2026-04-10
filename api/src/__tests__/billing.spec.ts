import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mocks (all hoisted by vitest) ─────────────────────────────────────

const mockInvoiceCreate = vi.fn();
const mockInvoiceFindUnique = vi.fn();
const mockInvoiceFindFirst = vi.fn();
const mockInvoiceFindMany = vi.fn();
const mockInvoiceUpdate = vi.fn();
const mockInvoiceAggregate = vi.fn();
const mockInvoiceUpdateMany = vi.fn();
const mockCustomerFindUnique = vi.fn();
const mockCustomerUpdate = vi.fn();
const mockSubFindUnique = vi.fn();
const mockSubFindMany = vi.fn();
const mockNotificationCreate = vi.fn();
const mockPaymentCreate = vi.fn();
const mockPaymentAggregate = vi.fn();
const mockTransaction = vi.fn();
const mockExecuteRaw = vi.fn();

vi.mock('../config/database', () => ({
  prisma: {
    invoice: {
      create: (...a: any[]) => mockInvoiceCreate(...a),
      findUnique: (...a: any[]) => mockInvoiceFindUnique(...a),
      findFirst: (...a: any[]) => mockInvoiceFindFirst(...a),
      findMany: (...a: any[]) => mockInvoiceFindMany(...a),
      update: (...a: any[]) => mockInvoiceUpdate(...a),
      aggregate: (...a: any[]) => mockInvoiceAggregate(...a),
      updateMany: (...a: any[]) => mockInvoiceUpdateMany(...a),
    },
    customer: {
      findUnique: (...a: any[]) => mockCustomerFindUnique(...a),
      update: (...a: any[]) => mockCustomerUpdate(...a),
    },
    subscription: {
      findUnique: (...a: any[]) => mockSubFindUnique(...a),
      findMany: (...a: any[]) => mockSubFindMany(...a),
    },
    payment: {
      create: (...a: any[]) => mockPaymentCreate(...a),
      aggregate: (...a: any[]) => mockPaymentAggregate(...a),
    },
    notification: {
      create: (...a: any[]) => mockNotificationCreate(...a),
    },
    $transaction: (...a: any[]) => mockTransaction(...a),
    $executeRaw: (...a: any[]) => mockExecuteRaw(...a),
  },
}));

vi.mock('../config', () => ({
  default: {
    business: { taxRate: 0.16, gracePeriodDays: 3 },
    invoice: {
      companyName: 'Test ISP',
      companyAddress: 'P.O. Box 1, Nairobi',
      companyPhone: '+254700000000',
      companyEmail: 'test@test.com',
      companyKraPin: 'P000000000A',
    },
  },
}));

vi.mock('../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('pdfkit', () => ({
  default: vi.fn().mockImplementation(() => ({
    pipe: vi.fn(), fontSize: vi.fn().mockReturnThis(), font: vi.fn().mockReturnThis(),
    text: vi.fn().mockReturnThis(), moveDown: vi.fn().mockReturnThis(),
    moveTo: vi.fn().mockReturnThis(), lineTo: vi.fn().mockReturnThis(),
    stroke: vi.fn().mockReturnThis(), rect: vi.fn().mockReturnThis(),
    fill: vi.fn().mockReturnThis(), fillColor: vi.fn().mockReturnThis(),
    save: vi.fn().mockReturnThis(), opacity: vi.fn().mockReturnThis(),
    rotate: vi.fn().mockReturnThis(), restore: vi.fn().mockReturnThis(),
    end: vi.fn(), page: { height: 842 },
  })),
}));

vi.mock('fs', async (importOriginal) => {
  const actual = await importOriginal<typeof import('fs')>();
  return {
    ...actual,
    existsSync: vi.fn(() => true),
    mkdirSync: vi.fn(),
    createWriteStream: vi.fn(() => ({
      on: vi.fn((event: string, cb: () => void) => {
        if (event === 'finish') setTimeout(cb, 0);
      }),
    })),
  };
});

vi.mock('../services/sms.service', () => ({
  smsService: {
    sendInvoiceNotification: vi.fn().mockResolvedValue(undefined),
  },
}));

vi.mock('../config/redis', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    del: vi.fn(),
  },
}));

// Import services after mocks
import { invoiceService } from '../services/invoice.service';
import { billingService } from '../services/billing.service';

// ─── Helpers ────────────────────────────────────────────────────────────

function resetMocks() {
  for (const m of [mockInvoiceCreate, mockInvoiceFindUnique, mockInvoiceFindFirst, mockInvoiceFindMany,
    mockInvoiceUpdate, mockInvoiceAggregate, mockInvoiceUpdateMany, mockCustomerFindUnique,
    mockCustomerUpdate, mockSubFindUnique, mockSubFindMany, mockNotificationCreate,
    mockPaymentCreate, mockPaymentAggregate, mockTransaction, mockExecuteRaw]) {
    m.mockReset();
  }
}

function buildSubscription(type: 'PREPAID' | 'POSTPAID' = 'POSTPAID') {
  return {
    id: 'sub-001', customerId: 'cust-001', status: 'ACTIVE', type,
    startDate: new Date('2025-01-01'), endDate: new Date('2025-02-01'),
    dataUsed: 0, dataRemaining: 10_000_000_000n,
    plan: {
      id: 'plan-001', name: type === 'PREPAID' ? '5GB Bundle' : 'Home 10Mbps',
      price: type === 'PREPAID' ? 1500 : 2500, type,
      billingCycle: type === 'POSTPAID' ? 'MONTHLY' : null,
      validityDays: 30, dataAllowance: 10_000_000_000n,
    },
    customer: {
      id: 'cust-001', userId: 'user-001',
      user: { firstName: 'Jane', lastName: 'Doe', phone: '+254712345678', email: 'jane@example.com' },
    },
  };
}

// ─── Tests ──────────────────────────────────────────────────────────────

describe('Invoice number generation', () => {
  beforeEach(() => resetMocks());

  it('should generate invoice numbers matching the format INV-XXXXXXXX-XXXX', async () => {
    mockInvoiceFindUnique.mockResolvedValue(null);
    const number = await invoiceService.generateInvoiceNumber();
    expect(number).toMatch(/^INV-[A-Z0-9]{8}-[A-Z0-9]{4}$/);
  });

  it('should generate unique invoice numbers on repeated calls', async () => {
    const seen = new Set<string>();
    mockInvoiceFindUnique.mockImplementation(async ({ where }: any) => {
      if (seen.has(where.invoiceNumber)) return { invoiceNumber: where.invoiceNumber };
      seen.add(where.invoiceNumber);
      return null;
    });

    const numbers = await Promise.all(Array.from({ length: 10 }, () => invoiceService.generateInvoiceNumber()));
    expect(new Set(numbers).size).toBe(10);
  });
});

describe('Invoice creation for a subscription', () => {
  beforeEach(() => resetMocks());

  it('should create an invoice with correct tax calculation', async () => {
    const sub = buildSubscription();
    mockSubFindUnique.mockResolvedValue(sub);
    mockInvoiceFindFirst.mockResolvedValue(null);
    mockInvoiceFindUnique.mockResolvedValue(null);
    mockNotificationCreate.mockResolvedValue({});

    const createdInvoice = {
      id: 'inv-001', invoiceNumber: 'INV-ABCDEF01-1234',
      customerId: 'cust-001', subscriptionId: 'sub-001',
      subtotal: 2500, taxRate: 0.16, taxAmount: 400, totalAmount: 2900, status: 'PENDING',
    };
    mockInvoiceCreate.mockResolvedValue(createdInvoice);

    const result = await billingService.generateSubscriptionInvoice('sub-001');

    expect(result.subtotal).toBe(2500);
    expect(result.taxAmount).toBe(400);
    expect(result.totalAmount).toBe(2900);
    expect(result.invoiceNumber).toMatch(/^INV-/);
  });

  it('should not create duplicate invoices for the same billing period', async () => {
    const sub = buildSubscription();
    mockSubFindUnique.mockResolvedValue(sub);
    mockInvoiceFindFirst.mockResolvedValue({ id: 'existing-inv', invoiceNumber: 'INV-EXISTING-0001' });

    const result = await billingService.generateSubscriptionInvoice('sub-001');

    expect(result.invoiceNumber).toBe('INV-EXISTING-0001');
    expect(mockInvoiceCreate).not.toHaveBeenCalled();
  });

  it('should throw NotFoundError for non-existent subscription', async () => {
    mockSubFindUnique.mockResolvedValue(null);

    await expect(billingService.generateSubscriptionInvoice('sub-nonexistent')).rejects.toThrow('Subscription not found');
  });
});

describe('Late fee calculation', () => {
  beforeEach(() => resetMocks());

  it('should apply 2% per week overdue', async () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() - 14); // 2 weeks overdue

    mockInvoiceFindMany.mockResolvedValue([{
      id: 'inv-overdue', status: 'OVERDUE', totalAmount: 2900, dueDate, metadata: {},
      customer: { id: 'cust-001' },
    }]);
    mockInvoiceUpdate.mockResolvedValue({});

    const result = await billingService.applyLateFees();

    expect(result.processed).toBe(1);
    const expectedLateFee = 2900 * 0.02 * 2; // 116
    expect(mockInvoiceUpdate).toHaveBeenCalledWith({
      where: { id: 'inv-overdue' },
      data: expect.objectContaining({
        subtotal: expectedLateFee,
        taxAmount: expectedLateFee * 0.16,
        totalAmount: expectedLateFee * 1.16,
        metadata: expect.objectContaining({
          lateFee: expect.objectContaining({ amount: expectedLateFee, weeksOverdue: 2 }),
          items: expect.arrayContaining([
            expect.objectContaining({
              description: expect.stringContaining('Late Fee'),
              amount: expectedLateFee,
              quantity: 1,
              unitPrice: expectedLateFee,
            }),
          ]),
        }),
      }),
    });
  });

  it('should round weeks overdue up (partial week counts)', async () => {
    const dueDate = new Date();
    dueDate.setDate(dueDate.getDate() - 10); // 10 days = 2 weeks (ceil)

    mockInvoiceFindMany.mockResolvedValue([{
      id: 'inv-partial', status: 'OVERDUE', totalAmount: 1000, dueDate, metadata: {},
      customer: { id: 'cust-001' },
    }]);
    mockInvoiceUpdate.mockResolvedValue({});

    await billingService.applyLateFees();

    const expectedLateFee = 1000 * 0.02 * 2; // 40
    expect(mockInvoiceUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          subtotal: expectedLateFee,
          taxAmount: expectedLateFee * 0.16,
          totalAmount: expectedLateFee * 1.16,
        }),
      })
    );
  });

  it('should return 0 processed if no overdue invoices', async () => {
    mockInvoiceFindMany.mockResolvedValue([]);
    const result = await billingService.applyLateFees();
    expect(result.processed).toBe(0);
  });
});

describe('Prepaid vs postpaid billing', () => {
  beforeEach(() => resetMocks());

  it('should use "Data Bundle" description for prepaid plans', async () => {
    const sub = buildSubscription('PREPAID');
    mockSubFindUnique.mockResolvedValue(sub);
    mockInvoiceFindFirst.mockResolvedValue(null);
    mockInvoiceFindUnique.mockResolvedValue(null);
    mockNotificationCreate.mockResolvedValue({});
    mockInvoiceCreate.mockResolvedValue({ id: 'inv-p', invoiceNumber: 'INV-PRE-0001' });

    await billingService.generateSubscriptionInvoice('sub-001');

    const createCall = mockInvoiceCreate.mock.calls[0][0];
    const items = createCall.data.metadata.items;
    expect(items[0].description).toContain('Data Bundle');
    expect(items[0].description).not.toContain('Monthly Subscription');
  });

  it('should use "Monthly Subscription" description for postpaid plans', async () => {
    const sub = buildSubscription('POSTPAID');
    mockSubFindUnique.mockResolvedValue(sub);
    mockInvoiceFindFirst.mockResolvedValue(null);
    mockInvoiceFindUnique.mockResolvedValue(null);
    mockNotificationCreate.mockResolvedValue({});
    mockInvoiceCreate.mockResolvedValue({ id: 'inv-pst', invoiceNumber: 'INV-PST-0001' });

    await billingService.generateSubscriptionInvoice('sub-001');

    const createCall = mockInvoiceCreate.mock.calls[0][0];
    const items = createCall.data.metadata.items;
    expect(items[0].description).toContain('Monthly Subscription');
  });
});
