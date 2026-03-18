import { vi } from 'vitest';

// ─── Mock Data Factories ───────────────────────────────────────────────

export function createMockUser(overrides: Record<string, any> = {}) {
  return {
    id: 'user-001',
    email: 'jane@example.com',
    password: '$2a$12$hashedpassword',
    firstName: 'Jane',
    lastName: 'Doe',
    phone: '+254712345678',
    role: 'CUSTOMER' as const,
    accountStatus: 'ACTIVE' as const,
    phoneVerified: true,
    emailVerified: true,
    lastLoginAt: new Date('2025-01-15'),
    createdAt: new Date('2025-01-01'),
    addressLine1: '123 Main St',
    city: 'Nairobi',
    county: 'Nairobi',
    postalCode: '00100',
    idNumber: '12345678',
    ...overrides,
  };
}

export function createMockCustomer(overrides: Record<string, any> = {}) {
  const user = overrides.user ?? createMockUser(overrides.userOverrides);
  return {
    id: 'cust-001',
    userId: user.id,
    customerCode: 'CUSTABC123DE',
    accountNumber: 'ACC1234ABCD',
    balance: 0,
    user,
    ...overrides,
  };
}

export function createMockPlan(overrides: Record<string, any> = {}) {
  return {
    id: 'plan-001',
    name: 'Home 10Mbps',
    code: 'HOME10',
    price: 2500,
    type: 'POSTPAID' as const,
    billingCycle: 'MONTHLY' as const,
    validityDays: 30,
    dataAllowance: 10_000_000_000n,
    speedLimit: 10,
    fupThreshold: 8_000_000_000n,
    fupSpeedLimit: 2,
    isActive: true,
    description: '10 Mbps unlimited',
    createdAt: new Date('2025-01-01'),
    ...overrides,
  };
}

export function createMockSubscription(overrides: Record<string, any> = {}) {
  const plan = overrides.plan ?? createMockPlan(overrides.planOverrides);
  const customer = overrides.customer ?? createMockCustomer(overrides.customerOverrides);
  return {
    id: 'sub-001',
    customerId: customer.id,
    planId: plan.id,
    status: 'ACTIVE' as const,
    type: plan.type,
    startDate: new Date('2025-01-01'),
    endDate: new Date('2025-02-01'),
    dataUsed: 0n,
    dataRemaining: plan.dataAllowance,
    voiceMinutesUsed: 0,
    smsUsed: 0,
    plan,
    customer,
    createdAt: new Date('2025-01-01'),
    ...overrides,
  };
}

export function createMockInvoice(overrides: Record<string, any> = {}) {
  return {
    id: 'inv-001',
    invoiceNumber: 'INV-ABCDEF01-1234',
    customerId: overrides.customerId ?? 'cust-001',
    subscriptionId: overrides.subscriptionId ?? 'sub-001',
    subtotal: 2500,
    taxRate: 0.16,
    taxAmount: 400,
    totalAmount: 2900,
    status: 'PENDING' as const,
    dueDate: new Date('2025-02-15'),
    paidAt: null as Date | null,
    metadata: { items: [] },
    createdAt: new Date('2025-01-15'),
    ...overrides,
  };
}

export function createMockPayment(overrides: Record<string, any> = {}) {
  return {
    id: 'pay-001',
    customerId: overrides.customerId ?? 'cust-001',
    invoiceId: overrides.invoiceId ?? 'inv-001',
    subscriptionId: overrides.subscriptionId ?? null,
    amount: overrides.amount ?? 1000,
    status: 'PENDING' as const,
    method: 'AIRTEL_MONEY' as const,
    reference: overrides.reference ?? 'AIR1710751234567ABCDEF01',
    resultCode: null as string | null,
    resultDesc: null as string | null,
    processedAt: null as Date | null,
    metadata: {},
    customer: overrides.customer ?? { userId: 'user-001' },
    createdAt: new Date('2025-01-15'),
    ...overrides,
  };
}

// ─── Prisma Mock Builder ────────────────────────────────────────────────

export function buildPrismaMocks() {
  const mocks: Record<string, ReturnType<typeof vi.fn>> = {};

  const methods = [
    'findUnique', 'findFirst', 'findMany', 'create', 'update', 'delete',
    'upsert', 'deleteMany', 'updateMany', 'aggregate', 'count', 'groupBy',
    '$queryRaw', '$executeRaw',
  ];

  const entities = [
    'user', 'customer', 'plan', 'subscription', 'invoice', 'payment',
    'notification', 'refreshToken', 'radiusConfig', 'radiusSession',
    'usageRecord', 'nas',
  ];

  for (const entity of entities) {
    mocks[entity] = {};
    for (const method of methods) {
      mocks[entity][method] = vi.fn();
    }
  }

  mocks['$transaction'] = vi.fn(async (cb: (tx: any) => Promise<any>) => {
    const tx = buildPrismaMocks();
    delete tx['$transaction'];
    return cb(tx);
  });

  return mocks as any;
}
