import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import jwt from 'jsonwebtoken';
import type { Response, NextFunction } from 'express';
import type { AuthenticatedRequest } from '../types';

// ─── Mocks (all hoisted by vitest) ─────────────────────────────────────

vi.mock('../config', () => ({
  default: {
    jwt: {
      secret: 'test-secret-key',
      expiresIn: '7d',
      refreshSecret: 'test-refresh-secret',
      refreshExpiresIn: '30d',
    },
  },
}));

const mockFindUnique = vi.fn();
vi.mock('../config/database', () => ({
  prisma: {
    user: {
      findUnique: (...args: any[]) => mockFindUnique(...args),
    },
  },
}));

vi.mock('../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

// Import after mocks — authenticate uses the mocked modules
import { authenticate, authorize } from '../middleware/auth';

const JWT_SECRET = 'test-secret-key';

function createMockReqRes() {
  const req = { headers: {}, user: undefined } as unknown as AuthenticatedRequest;
  const res = { status: vi.fn().mockReturnThis(), json: vi.fn().mockReturnThis() } as unknown as Response;
  const next = vi.fn() as NextFunction;
  return { req, res, next };
}

function genToken(payload: Record<string, any>, opts?: jwt.SignOptions) {
  return jwt.sign(payload, JWT_SECRET, opts);
}

const ACTIVE = { id: 'user-001', email: 'jane@example.com', role: 'CUSTOMER', accountStatus: 'ACTIVE' };
const ADMIN = { id: 'admin-001', email: 'admin@example.com', role: 'ADMIN', accountStatus: 'ACTIVE' };

// ─── Tests ──────────────────────────────────────────────────────────────

describe('Auth middleware', () => {
  beforeEach(() => mockFindUnique.mockReset());
  afterEach(() => vi.restoreAllMocks());

  // 1. Valid JWT
  it('should allow request with valid JWT token', async () => {
    const { req, res, next } = createMockReqRes();
    req.headers.authorization = `Bearer ${genToken({ id: ACTIVE.id, email: ACTIVE.email, role: ACTIVE.role })}`;
    mockFindUnique.mockResolvedValue(ACTIVE);

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith();
    expect(req.user).toEqual(expect.objectContaining({ id: ACTIVE.id, email: ACTIVE.email, role: ACTIVE.role }));
  });

  // 2. Expired token
  it('should reject expired tokens', async () => {
    const { req, res, next } = createMockReqRes();
    req.headers.authorization = `Bearer ${genToken({ id: ACTIVE.id, email: ACTIVE.email, role: ACTIVE.role }, { expiresIn: '-1s' })}`;

    await authenticate(req, res, next);

    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Token expired' }));
    expect(req.user).toBeUndefined();
  });

  // 3. Role-based authorization
  it('should allow access when user has required role', () => {
    const { req, res, next } = createMockReqRes();
    req.user = { id: ADMIN.id, email: ADMIN.email, role: 'ADMIN' };

    authorize('ADMIN', 'SUPPORT')(req, res, next);
    expect(next).toHaveBeenCalledWith();
  });

  it('should deny access when user lacks required role', () => {
    const { req, res, next } = createMockReqRes();
    req.user = { id: ACTIVE.id, email: ACTIVE.email, role: 'CUSTOMER' };

    authorize('ADMIN')(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Insufficient permissions' }));
  });

  it('should deny access when user is not authenticated', () => {
    const { req, res, next } = createMockReqRes();

    authorize('ADMIN')(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: expect.any(String) }));
  });

  // 4. Missing / bad token
  it('should reject request with no Authorization header', async () => {
    const { req, res, next } = createMockReqRes();

    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'No token provided' }));
  });

  it('should reject Authorization header without Bearer prefix', async () => {
    const { req, res, next } = createMockReqRes();
    req.headers.authorization = 'Basic abc123';

    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'No token provided' }));
  });

  it('should reject malformed token', async () => {
    const { req, res, next } = createMockReqRes();
    req.headers.authorization = 'Bearer not-a-real-jwt';

    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Invalid token' }));
  });

  // 5. Account status
  it('should reject token for non-existent user', async () => {
    const { req, res, next } = createMockReqRes();
    req.headers.authorization = `Bearer ${genToken({ id: 'ghost', email: 'x@x.com', role: 'CUSTOMER' })}`;
    mockFindUnique.mockResolvedValue(null);

    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'User not found' }));
  });

  it('should reject token for suspended account', async () => {
    const { req, res, next } = createMockReqRes();
    req.headers.authorization = `Bearer ${genToken({ id: ACTIVE.id, email: ACTIVE.email, role: ACTIVE.role })}`;
    mockFindUnique.mockResolvedValue({ ...ACTIVE, accountStatus: 'SUSPENDED' });

    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Account is suspended, terminated, or not verified' }));
  });

  it('should reject token for terminated account', async () => {
    const { req, res, next } = createMockReqRes();
    req.headers.authorization = `Bearer ${genToken({ id: ACTIVE.id, email: ACTIVE.email, role: ACTIVE.role })}`;
    mockFindUnique.mockResolvedValue({ ...ACTIVE, accountStatus: 'TERMINATED' });

    await authenticate(req, res, next);
    expect(next).toHaveBeenCalledWith(expect.objectContaining({ message: 'Account is suspended, terminated, or not verified' }));
  });
});
