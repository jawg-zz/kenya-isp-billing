import { describe, it, expect, vi, beforeEach } from 'vitest';

// ─── Mock dependencies ─────────────────────────────────────────────────

vi.mock('../config/database', () => {
  const mockPrisma = {
    user: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
      create: vi.fn(),
      update: vi.fn(),
    },
    customer: { create: vi.fn() },
    notification: { create: vi.fn() },
    refreshToken: {
      create: vi.fn(),
      findFirst: vi.fn(),
      findMany: vi.fn(),
      delete: vi.fn(),
      deleteMany: vi.fn(),
    },
  };
  return {
    prisma: {
      ...mockPrisma,
      $transaction: vi.fn(async (cb: (tx: any) => Promise<any>) => {
        const tx = {
          user: { create: mockPrisma.user.create },
          customer: { create: mockPrisma.customer.create },
        };
        return cb(tx);
      }),
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
    jwt: {
      secret: 'test-secret',
      expiresIn: '7d',
      refreshSecret: 'test-refresh-secret',
      refreshExpiresIn: '30d',
    },
  },
}));

vi.mock('../config/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

vi.mock('../services/sms.service', () => ({
  smsService: { send: vi.fn().mockResolvedValue(undefined) },
}));

vi.mock('../services/email.service', () => ({
  emailService: {
    sendVerificationEmail: vi.fn().mockResolvedValue(undefined),
    sendPasswordResetEmail: vi.fn().mockResolvedValue(undefined),
  },
}));

import { authService } from '../services/auth.service';
import { prisma } from '../config/database';
import { cache } from '../config/redis';

// ─── Helpers ────────────────────────────────────────────────────────────

function resetMocks() {
  const p = prisma as any;
  for (const m of [
    p.user.findFirst, p.user.findUnique, p.user.create, p.user.update,
    p.customer.create, p.notification.create,
    p.refreshToken.create, p.refreshToken.findFirst,
    p.refreshToken.findMany, p.refreshToken.delete, p.refreshToken.deleteMany,
  ]) {
    m.mockReset();
  }
  (prisma.$transaction as ReturnType<typeof vi.fn>).mockImplementation(
    async (cb: (tx: any) => Promise<any>) => {
      const tx = {
        user: { create: (prisma as any).user.create },
        customer: { create: (prisma as any).customer.create },
      };
      return cb(tx);
    }
  );
  (cache.get as ReturnType<typeof vi.fn>).mockReset();
  (cache.set as ReturnType<typeof vi.fn>).mockReset();
  (cache.del as ReturnType<typeof vi.fn>).mockReset();
}

const VALID_REGISTER = {
  email: 'jane@example.com',
  password: 'SecurePass123!',
  firstName: 'Jane',
  lastName: 'Doe',
  phone: '+254712345678',
};

// ─── Registration ───────────────────────────────────────────────────────

describe('AuthService - Registration', () => {
  beforeEach(() => resetMocks());

  it('should register a new user successfully', async () => {
    const p = prisma as any;
    p.user.findFirst.mockResolvedValue(null);
    p.user.create.mockResolvedValue({
      id: 'user-001', email: 'jane@example.com', firstName: 'Jane',
      lastName: 'Doe', phone: '+254712345678', role: 'CUSTOMER', accountStatus: 'ACTIVE', createdAt: new Date(),
    });
    p.customer.create.mockResolvedValue({ id: 'cust-001' });
    p.notification.create.mockResolvedValue({});
    p.refreshToken.create.mockResolvedValue({});
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    const result = await authService.register(VALID_REGISTER);

    expect(result.user).toHaveProperty('email', 'jane@example.com');
    expect(result.tokens).toHaveProperty('accessToken');
    expect(result.tokens).toHaveProperty('refreshToken');
  });

  it('should reject registration with duplicate email', async () => {
    (prisma as any).user.findFirst.mockResolvedValue({ id: 'user-existing', email: 'jane@example.com', phone: '+254712345679' });

    await expect(authService.register(VALID_REGISTER)).rejects.toThrow('Email already registered');
  });

  it('should reject registration with duplicate phone', async () => {
    (prisma as any).user.findFirst.mockResolvedValue({ id: 'user-existing', email: 'other@example.com', phone: '+254712345678' });

    await expect(authService.register(VALID_REGISTER)).rejects.toThrow('Phone number already registered');
  });
});

// ─── Login ──────────────────────────────────────────────────────────────

describe('AuthService - Login', () => {
  beforeEach(() => resetMocks());

  const VALID_PASSWORD = 'SecurePass123!';

  it('should login with valid credentials', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash(VALID_PASSWORD, 12);
    const p = prisma as any;

    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null); // Not locked
    p.user.findUnique.mockResolvedValue({
      id: 'user-001', email: 'jane@example.com', password: hash,
      firstName: 'Jane', lastName: 'Doe', phone: '+254712345678',
      role: 'CUSTOMER', accountStatus: 'ACTIVE',
    });
    (cache.del as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);
    p.user.update.mockResolvedValue({});
    p.refreshToken.create.mockResolvedValue({});

    const result = await authService.login('jane@example.com', VALID_PASSWORD);

    expect(result.user).not.toHaveProperty('password');
    expect(result.user).toHaveProperty('email', 'jane@example.com');
    expect(result.tokens).toHaveProperty('accessToken');
  });

  it('should reject login with wrong password', async () => {
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma as any).user.findUnique.mockResolvedValue({
      id: 'user-001', email: 'jane@example.com', password: '$2a$12$totallywronghashvalue',
      firstName: 'Jane', lastName: 'Doe', phone: '+254712345678',
      role: 'CUSTOMER', accountStatus: 'ACTIVE',
    });

    await expect(authService.login('jane@example.com', 'WrongPassword')).rejects.toThrow('Invalid email or password');
  });

  it('should reject login for suspended account', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash(VALID_PASSWORD, 12);

    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    (prisma as any).user.findUnique.mockResolvedValue({
      id: 'user-001', email: 'jane@example.com', password: hash,
      firstName: 'Jane', lastName: 'Doe', phone: '+254712345678',
      role: 'CUSTOMER', accountStatus: 'SUSPENDED',
    });

    await expect(authService.login('jane@example.com', VALID_PASSWORD)).rejects.toThrow('suspended or terminated');
  });

  it('should reject login for locked account', async () => {
    (cache.get as ReturnType<typeof vi.fn>).mockImplementation(async (key: string) => {
      if (key === 'loginLock:jane@example.com') return true;
      return null;
    });

    await expect(authService.login('jane@example.com', VALID_PASSWORD)).rejects.toThrow('Account temporarily locked');
  });

  it('should lock account after 5 failed attempts', async () => {
    const bcrypt = await import('bcryptjs');
    const hash = await bcrypt.hash(VALID_PASSWORD, 12);

    let failCount = 0;
    (cache.get as ReturnType<typeof vi.fn>).mockImplementation(async (key: string) => {
      if (key.startsWith('loginFail:')) return failCount;
      return null;
    });
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    (prisma as any).user.findUnique.mockResolvedValue({
      id: 'user-001', email: 'jane@example.com', password: hash,
      firstName: 'Jane', lastName: 'Doe', phone: '+254712345678',
      role: 'CUSTOMER', accountStatus: 'ACTIVE',
    });

    failCount = 4; // Will become 5 after increment

    await expect(authService.login('jane@example.com', 'WrongPass')).rejects.toThrow('Invalid email or password');

    expect((cache.set as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith(
      'loginLock:jane@example.com',
      true,
      expect.any(Number)
    );
  });
});

// ─── Password Reset ─────────────────────────────────────────────────────

describe('AuthService - Password Reset', () => {
  beforeEach(() => resetMocks());

  it('should request password reset for existing user', async () => {
    (prisma as any).user.findUnique.mockResolvedValue({
      id: 'user-001', email: 'jane@example.com', phone: '+254712345678', firstName: 'Jane',
    });
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    await expect(authService.forgotPassword('jane@example.com')).resolves.not.toThrow();
    expect((cache.set as ReturnType<typeof vi.fn>)).toHaveBeenCalled();
  });

  it('should silently succeed for non-existent user (prevent enumeration)', async () => {
    (prisma as any).user.findUnique.mockResolvedValue(null);

    await expect(authService.forgotPassword('nobody@example.com')).resolves.not.toThrow();
  });

  it('should reset password with valid token', async () => {
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue('user-001');
    (prisma as any).user.update.mockResolvedValue({});
    (prisma as any).refreshToken.deleteMany.mockResolvedValue({});
    (cache.del as ReturnType<typeof vi.fn>).mockResolvedValue(undefined);

    await expect(authService.resetPassword('valid-reset-token', 'NewPass123!')).resolves.not.toThrow();
    expect((prisma as any).user.update).toHaveBeenCalledWith({
      where: { id: 'user-001' },
      data: { password: expect.any(String) },
    });
    expect((cache.del as ReturnType<typeof vi.fn>)).toHaveBeenCalledWith('passwordReset:valid-reset-token');
  });

  it('should reject password reset with expired/invalid token', async () => {
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);

    await expect(authService.resetPassword('expired-token', 'NewPass123!')).rejects.toThrow('Invalid or expired reset token');
  });
});

// ─── Token Refresh ──────────────────────────────────────────────────────

describe('AuthService - Token Refresh', () => {
  beforeEach(() => resetMocks());

  it('should refresh tokens with valid refresh token', async () => {
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null); // Not revoked
    const jwt = await import('jsonwebtoken');
    const { default: config } = await import('../config');
    const token = jwt.sign(
      { id: 'user-001', email: 'jane@example.com', role: 'CUSTOMER', jti: 'jti-001' },
      config.jwt.refreshSecret,
      { expiresIn: '30d' }
    );

    const bcrypt = await import('bcryptjs');
    const hashedToken = await bcrypt.hash(token, 8);

    (prisma as any).refreshToken.findFirst.mockResolvedValue({
      id: 'jti-001', token: hashedToken, userId: 'user-001',
      expiresAt: new Date(Date.now() + 86400000),
      user: { id: 'user-001', email: 'jane@example.com', role: 'CUSTOMER', firstName: 'Jane', lastName: 'Doe', phone: '+254712345678', accountStatus: 'ACTIVE' },
    });
    (prisma as any).refreshToken.delete.mockResolvedValue({});
    (prisma as any).refreshToken.create.mockResolvedValue({});
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    const result = await authService.refreshToken(token);
    expect(result).toHaveProperty('accessToken');
    expect(result).toHaveProperty('refreshToken');
  });

  it('should reject revoked refresh token', async () => {
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(true); // Token is revoked

    await expect(authService.refreshToken('revoked-token')).rejects.toThrow('Token has been revoked');
  });

  it('should reject expired refresh token', async () => {
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const jwt = await import('jsonwebtoken');
    const { default: config } = await import('../config');
    const expiredToken = jwt.sign(
      { id: 'user-001', email: 'jane@example.com', role: 'CUSTOMER', jti: 'jti-001' },
      config.jwt.refreshSecret,
      { expiresIn: '-1s' }
    );

    await expect(authService.refreshToken(expiredToken)).rejects.toThrow('Invalid refresh token');
  });

  it('should reject refresh token not found in database', async () => {
    (cache.get as ReturnType<typeof vi.fn>).mockResolvedValue(null);
    const jwt = await import('jsonwebtoken');
    const { default: config } = await import('../config');
    const token = jwt.sign(
      { id: 'user-001', email: 'jane@example.com', role: 'CUSTOMER', jti: 'jti-nonexistent' },
      config.jwt.refreshSecret,
      { expiresIn: '30d' }
    );

    (prisma as any).refreshToken.findFirst.mockResolvedValue(null);

    await expect(authService.refreshToken(token)).rejects.toThrow('Invalid or expired refresh token');
  });
});

// ─── Logout ─────────────────────────────────────────────────────────────

describe('AuthService - Logout', () => {
  beforeEach(() => resetMocks());

  it('should logout and revoke all tokens when no refresh token provided', async () => {
    (prisma as any).refreshToken.deleteMany.mockResolvedValue({});

    await expect(authService.logout('user-001')).resolves.not.toThrow();
    expect((prisma as any).refreshToken.deleteMany).toHaveBeenCalledWith({ where: { userId: 'user-001' } });
  });

  it('should revoke specific refresh token when provided', async () => {
    const bcrypt = await import('bcryptjs');
    const hashed = await bcrypt.hash('refresh-token-123', 8);
    (prisma as any).refreshToken.findMany.mockResolvedValue([
      { id: 'rt-001', token: hashed },
    ]);
    (prisma as any).refreshToken.delete.mockResolvedValue({});
    (cache.set as ReturnType<typeof vi.fn>).mockResolvedValue('OK');

    await expect(authService.logout('user-001', 'refresh-token-123')).resolves.not.toThrow();
    expect((prisma as any).refreshToken.delete).toHaveBeenCalledWith({ where: { id: 'rt-001' } });
  });
});
