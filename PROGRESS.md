# ISP Billing System — Repo Status Tracker

> **Last Audited:** 2026-04-05 UTC  
> **Purpose:** verified repository status only — builds, tests, feature surface, and deployment readiness based on what was actually checked.

---

## Executive Summary

The repo is **feature-rich and actively buildable**, but it is **not yet fully verified for production**.

### Current call

| Area | Status | Notes |
|------|--------|-------|
| Feature surface | ✅ Broadly implemented | Core ISP billing flows, reports, RADIUS, notifications, settings, and hotspot purchase code are present |
| API build | ✅ Passing | `npm run build` succeeded in `api/` |
| Frontend build | ✅ Passing | `npm run build` succeeded in `frontend/` |
| Automated API tests | ⚠️ Partial | 66/78 passing, 12 failing across 3 suites |
| Deployment docs | ⚠️ Updated in this audit | Earlier docs overstated readiness and used stale setup steps |
| Production deployment | ❌ Unverified | No live deployment validation was performed in this audit |

---

## Verified During This Audit

### Repository state

- Branch: `main`
- Recent commits:
  - `3ffab67` — `fix: use InstanceType for PDFDocument helpers`
  - `ff0cd2c` — `fix: harden billing build and payment flows`
  - `47a2a3f` — `fix: use prisma db push instead of migrate deploy for schema setup`
  - `f832c3f` — `Add complete MikroTik RADIUS configuration script`
  - `c15b0b5` — `fix: disable WiFi commands for now`
- Working tree had **no code changes pending** before this documentation cleanup.

### Build verification

- **API:** `npm run build` ✅
- **Frontend:** `npm run build` ✅

### Code surface confirmed present

- Auth, customers, plans, subscriptions, invoices, payments, usage, settings, audit, reports, RADIUS, metrics, health, notifications SSE, admin routes
- Customer/admin frontend pages for dashboard, invoices, payments, plans, subscriptions, reports, network/radius, settings, profile, usage, auth flows
- CSV and PDF export for reports
- Request tracing middleware with `X-Request-ID`
- Redis-backed rate limiting with in-memory fallback
- Health endpoints: `/health`, `/health/detailed`, `/health/ready`, `/health/live`
- Hotspot purchase backend (`/api/v1/hotspot/*`) and `HotspotPurchase` Prisma model

---

## Automated Test Status

API tests exist and run, but the suite is **not green**.

### Current result

- **Total:** 78 tests
- **Passing:** 66
- **Failing:** 12
- **Passing files:**
  - `src/__tests__/airtel-callback.spec.ts`
  - `src/__tests__/auth.service.spec.ts`
  - one additional suite passed during the run
- **Failing files:**
  - `src/__tests__/billing.spec.ts`
  - `src/__tests__/mpesa-callback.spec.ts`
  - `src/__tests__/auth.spec.ts`

### Failure pattern

The current failures look like **test drift against newer implementation**, not proof that the runtime app is broken:

- `billing.spec.ts` expectations no longer match the current late-fee/invoice behavior
- `mpesa-callback.spec.ts` mocks do not provide `tx.$queryRaw`, which the implementation now uses inside a transaction
- `auth.spec.ts` expects an older error message shape for suspended/terminated accounts

That said, **production readiness should not be claimed while the test suite is red**.

---

## Data Model / Infrastructure Reality Check

### Schema

The Prisma schema currently defines **16 models**, not 14:

- `User`
- `RefreshToken`
- `Customer`
- `Plan`
- `PlanPrice`
- `Subscription`
- `Invoice`
- `Payment`
- `RadiusConfig`
- `Nas`
- `RadiusSession`
- `UsageRecord`
- `Notification`
- `SystemSetting`
- `AuditLog`
- `HotspotPurchase`

### Docker / runtime

`docker-compose.yml` currently defines these services:

- `postgres`
- `redis`
- `api`
- `freeradius`
- `frontend`

### Database setup reality

The repo currently has **schema.prisma but no migration files**. The active container entrypoint uses:

```bash
npx prisma db push --accept-data-loss --skip-generate
```

So any docs that say “run Prisma migrations” were stale for the current repo state.

---

## Known Gaps / Risks

1. **Automated tests are not fully passing**
2. **Production deployment remains unverified**
3. **Compose defaults are convenient for local/dev use, but insecure if left unchanged in production**
4. **Seed data includes demo credentials and placeholder/default-style settings that must not be treated as production-safe**
5. **Swagger docs are intentionally disabled in production**
6. **Hotspot support is clearly present in the API/backend, but this audit did not confirm a dedicated frontend hotspot purchase UI**

---

## Correct Status of the Repo

If we state it plainly:

- **Not** a blank/incomplete prototype
- **Not** a fully verified production deployment
- **Yes:** a substantial, buildable ISP billing platform with broad feature coverage
- **Yes:** close enough that the remaining work is mostly verification, test repair, env hardening, and deployment validation

### Best one-line status

> **Broadly feature-complete codebase with passing builds, partial failing tests, and unverified production deployment.**

---

## Recommended Next Steps

### Highest priority

1. Fix the 3 failing API test suites until the test run is green
2. Validate production env values and secrets against `.env.production.example`
3. Perform a deployment verification pass on Dokploy
4. Run smoke tests for login, subscription, invoice generation, payment callback, and RADIUS provisioning

### After that

5. Remove or harden any risky fallback defaults used only for local convenience
6. Decide whether hotspot purchase needs a first-class frontend flow
7. Add a short release checklist for future deployments
