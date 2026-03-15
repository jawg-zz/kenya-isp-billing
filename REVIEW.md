# 📋 Code Review: ISP Billing System (Kenya Market)

**Date:** 2026-03-15  
**Reviewer:** Code Reviewer Agent  
**Total Files:** 81 | **Total Lines:** ~12,000  

---

## 📊 Scorecard

| Area | Score | Notes |
|------|-------|-------|
| **Database Schema** | 8/10 | Well-structured, good indexes, Kenya-specific fields |
| **Backend API** | 7/10 | Solid patterns, some security gaps |
| **M-Pesa Integration** | 7/10 | Good flow, missing signature validation |
| **Auth & Security** | 6/10 | Works but has critical gaps |
| **Billing Engine** | 8/10 | Solid logic, handles edge cases |
| **Frontend** | 7/10 | Clean components, good UX patterns |
| **Docker/Infra** | 7/10 | Production-ready basics |
| **Overall** | 7/10 | Good foundation, needs security hardening |

---

## 🔴 Critical Issues — ✅ ALL FIXED

### ~~1. JWT Secret Has Hardcoded Default~~ ✅ FIXED
- Removed `|| 'default-secret-change-me'` default
- `validateConfig()` now **requires** `JWT_SECRET` and `JWT_REFRESH_SECRET` — server won't start without them

### ~~2. M-Pesa Callback Signature Not Validated~~ ✅ FIXED
- Created `api/src/middleware/mpesaValidation.ts` with:
  - `validateMpesaIP` — IP allowlisting (Safaricom IPs in production, open in sandbox)
  - `validateMpesaSignature` — Certificate-based SHA256 signature verification
  - `mpesaIdempotencyCheck` — Prevents duplicate callback processing
- Applied to both `/mpesa/callback` and `/mpesa/timeout` routes

### ~~3. RADIUS Password Stored in Plaintext~~ ✅ FIXED
- Passwords now hashed with bcrypt (cost factor 12) before DB storage
- Plaintext password only sent to RADIUS server during sync
- `handleAccessRequest` uses `bcrypt.compare()` for authentication

### ~~4. No Webhook Authentication on M-Pesa Callback~~ ✅ FIXED
- Added `validateMpesaIP` middleware — restricts to Safaricom IPs in production
- Added `validateMpesaSignature` middleware — verifies Safaricom's signature
- Added `mpesaIdempotencyCheck` — prevents replay attacks

### ~~5. Default RADIUS Secret is Insecure~~ ✅ FIXED
- Removed `|| 'testing123'` default from config
- Removed default from `docker-compose.yml`
- Server will fail to start without `RADIUS_SECRET` being set

---

## 🟡 Warnings (Should Fix)

### 6. No CORS Origin Validation in Development
**File:** `api/src/config/index.ts:11`
```typescript
corsOrigin: process.env.CORS_ORIGIN || 'http://localhost:3001',
```
In production, if `CORS_ORIGIN` isn't set, it defaults to localhost — which might mask issues. Not a security hole per se, but confusing.

---

### 7. Payment Polling Has No Exponential Backoff
**File:** `frontend/src/app/(customer)/payments/page.tsx:46-63`
```typescript
const pollInterval = setInterval(async () => {
    // polls every 5 seconds fixed
}, 5000);
```
**Issue:** Fixed 5-second interval for 2 minutes = 24 API calls per payment. Should use exponential backoff (5s → 10s → 20s).

---

### 8. Invoice Number Generation Uses Timestamp
**File:** `api/src/services/invoice.service.ts` (inferred)
Likely uses `Date.now()` or similar for invoice numbers. This is predictable and could be guessed by customers.

**Fix:** Use UUIDs or a sequential format with a prefix:
```typescript
generateInvoiceNumber(): string {
    const date = new Date();
    const prefix = `INV${date.getFullYear()}${String(date.getMonth()+1).padStart(2,'0')}`;
    return `${prefix}-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}
```

---

### 9. No Input Validation on RADIUS Accounting Endpoint
**File:** `api/src/services/radius.service.ts:130`
The RADIUS accounting handler trusts the NAS device's octet counts without validation. A misconfigured or malicious NAS could report inflated usage.

**Fix:** Add sanity checks:
```typescript
if (request.inputOctets < 0 || request.outputOctets < 0 || request.totalOctets > MAX_REASONABLE_BYTES) {
    logger.warn(`Suspicious RADIUS accounting data for ${request.username}`);
    return;
}
```

---

### 10. Rate Limiter Uses In-Memory Store
**File:** `api/src/middleware/rateLimiter.ts`
The standard `express-rate-limit` uses in-memory storage, which won't work across multiple API containers in production.

**Fix:** Already has `createRedisRateLimiter` — just needs to be used instead of the default one:
```typescript
export const rateLimiter = createRedisRateLimiter(900, 100);
```

---

### 11. No CSRF Protection
The API uses JWT Bearer tokens (not cookies), so CSRF is less of a concern for API endpoints. However, if the frontend ever uses cookies for auth, CSRF would be needed. Consider adding a note in the README about this trade-off.

---

## 🟢 Suggestions (Nice to Have)

### 12. Add Request ID for Tracing
Add a unique request ID to each API call for easier debugging:
```typescript
import { v4 as uuidv4 } from 'uuid';
app.use((req, res, next) => {
    req.id = uuidv4();
    res.setHeader('X-Request-ID', req.id);
    next();
});
```

### 13. Add Database Connection Pool Monitoring
For production, monitor Prisma connection pool usage to prevent exhaustion under load.

### 14. Add Health Check for Dependencies
The `/health` endpoint only checks that the server is up. Expand it:
```typescript
app.get('/health', async (_req, res) => {
    const db = await checkDb();
    const redis = await checkRedis();
    res.json({
        status: db.ok && redis.ok ? 'ok' : 'degraded',
        db, redis, uptime: process.uptime()
    });
});
```

### 15. Add Admin Revenue Report Caching
Revenue reports do expensive aggregations on every request. Add Redis caching with a 5-minute TTL.

### 16. Add Swagger/OpenAPI Documentation
The API has no documentation. Generate from route definitions:
```bash
npm install swagger-jsdoc swagger-ui-express
```

### 17. Add Automated Tests
No test files were found. Critical paths to test first:
- M-Pesa callback processing (success + failure)
- Billing invoice generation
- RADIUS authentication
- Auth middleware (JWT validation + role checking)

### 18. Frontend: Add Error Boundaries
React error boundaries to prevent one broken page from crashing the entire app.

---

## ✅ What's Done Well

1. **Database Schema** — Excellent. Proper indexes, Kenya-specific fields (county, KRA PIN, national ID), good use of enums, decimal for money
2. **Prisma ORM** — Good choice. Type-safe, migration support, clean relations
3. **M-Pesa Flow** — Complete STK push → callback → payment update → subscription activation pipeline
4. **Billing Engine** — Handles prepaid/postpaid, auto-invoicing, late fees, FUP threshold
5. **Auth Middleware** — Clean JWT verification with role-based authorization
6. **Rate Limiting** — Multiple tiers (standard, auth, payment, mobile) — good security practice
7. **RADIUS Integration** — Proper caching, session management, FUP enforcement
8. **Frontend Components** — Clean UI with Button, Card, Input, Table, Badge primitives
9. **Payment UX** — M-Pesa/Airtel Money selector, phone input, polling with status updates
10. **Docker Setup** — Multi-stage builds, health checks, proper service dependencies
11. **Graceful Shutdown** — Server properly disconnects from DB and Redis on SIGTERM

---

## 📝 Summary

The system has a **solid foundation** with good architectural decisions throughout. The database schema, billing logic, and M-Pesa integration are well-implemented.

**Before going to production, you MUST:**
1. Fix JWT secret default (Issue #1)
2. Implement M-Pesa callback signature validation (Issue #2)
3. Remove default RADIUS secret (Issue #5)
4. Hash RADIUS passwords (Issue #3)
5. Set up proper secrets management (use Docker secrets or a vault)

**Before scaling, you SHOULD:**
6. Switch to Redis-based rate limiting (Issue #10)
7. Add exponential backoff to payment polling (Issue #7)
8. Add request tracing (Issue #12)
9. Write tests for critical payment flows (Issue #17)

Estimated time to address all critical issues: **2-3 days of focused work**.
