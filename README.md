# ISP Billing System

A full-stack ISP billing and customer management platform built for Kenyan ISPs. Supports M-Pesa and Airtel Money payments, RADIUS authentication, prepaid/postpaid plans, automated invoicing, usage tracking, reporting, and real-time notifications.

> **Current repo status (audited 2026-04-05):** broad feature coverage with passing API/frontend builds, partial failing API tests, and unverified production deployment.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | Express + TypeScript |
| **Frontend** | Next.js 14 (App Router) + React 18 + TailwindCSS |
| **Database** | PostgreSQL 16 via Prisma ORM |
| **Cache** | Redis 7 |
| **Auth** | JWT (access + refresh token rotation) |
| **Payments** | M-Pesa Daraja API (STK Push) + Airtel Money |
| **SMS** | Africa's Talking |
| **Email** | Nodemailer (SMTP) |
| **Network** | RADIUS (RFC 2865) + CoA |
| **PDF** | pdfkit |
| **Charts** | Recharts |
| **Deploy** | Docker Compose / Dokploy |

## What’s in the Repo

### Customer-facing flows
- Dashboard
- Plan browsing and subscription
- Usage tracking
- Invoice list and invoice detail
- Payment history and payment initiation
- Notifications
- Profile management
- Login / register / forgot password / reset password / verify email

### Admin flows
- Customers
- Plans
- Subscriptions
- Invoices
- Payments
- Reports
- Revenue
- Network / RADIUS views
- Settings
- Audit logs

### Backend capabilities
- Auth and role-based access control
- Billing and invoice generation
- M-Pesa and Airtel callbacks
- RADIUS integration and session handling
- Usage tracking
- Reporting with CSV/PDF export
- Notification SSE stream
- Health, readiness, liveness, and metrics endpoints
- Request tracing with `X-Request-ID`
- Redis-backed rate limiting with graceful fallback
- Hotspot purchase backend routes

## Verified Status

The following was verified during the 2026-04-05 audit:

- `api/` build passes
- `frontend/` production build passes
- API test suite exists and runs
- API tests are **not fully green yet**
- Repo had no pending code changes before documentation cleanup

If you want the exact current status, read:

- **[PROGRESS.md](./PROGRESS.md)** — audited repo status tracker
- **[REVIEW.md](./REVIEW.md)** — updated review snapshot

## Quick Start (Local / Docker Compose)

### 1. Clone and configure

```bash
git clone <your-repo-url>
cd isp-billing-system
cp .env.production.example .env
```

Then edit `.env` for your environment.

### 2. Start services

```bash
docker compose up -d
```

Current compose services:
- `postgres`
- `redis`
- `api`
- `freeradius`
- `frontend`

### 3. Database setup

The current API container entrypoint uses **Prisma db push**, not tracked migration files.

For local/manual setup, use the repo’s current approach:

```bash
cd api
npx prisma db push
node dist/utils/seed.js
```

If you are running from source instead of built output:

```bash
cd api
npx prisma db push
npx tsx src/utils/seed.ts
```

### 4. Access

| Service | URL |
|---------|-----|
| **Frontend** | `http://your-server` |
| **API** | `http://your-server/api/v1` |
| **Health** | `http://your-server/health` |
| **Readiness** | `http://your-server/health/ready` |
| **Liveness** | `http://your-server/health/live` |
| **Swagger (non-production only)** | `http://your-server/api/docs` |

## Local Development

### API

```bash
cd api
npm install
npm run build
npm run dev
```

### Frontend

```bash
cd frontend
npm install
npm run build
npm run dev
```

### Database services only

```bash
docker compose up -d postgres redis
```

## Production Deployment Notes

This repo is designed to be deployable with Dokploy, but this audit did **not** verify a live production deployment.

### Use with care

- Set strong real secrets
- Do **not** keep demo/default credentials
- Verify all payment callback URLs
- Verify RADIUS shared secrets and NAS settings
- Run smoke tests after deployment

### Important reality check

The repo currently does **not** include Prisma migration files. The live container entrypoint runs:

```bash
npx prisma db push --accept-data-loss --skip-generate
```

So older instructions that said “run Prisma migrations” were stale for the current state of the repo.

## Environment Files Present

- `.env.production.example`
- `api/.env.example`
- `frontend/.env.example`
- `frontend/.env.local.example`

## API / Feature Notes

### Reports
Customer, usage, and payment reports exist with CSV and PDF export paths.

### Health endpoints
- `/health`
- `/health/detailed` (non-production)
- `/health/ready`
- `/health/live`

### Hotspot support
The backend includes hotspot package purchase routes and a `HotspotPurchase` model. This README does not claim a complete dedicated frontend hotspot flow without further UI validation.

## RADIUS / MikroTik

The repo includes:

- `freeradius/` configuration and Docker setup
- MikroTik scripts:
  - `mikrotik-radius-setup.rsc`
  - `mikrotik-radius-modify.rsc`
- `radius-users-seed.sql`

Use these with real shared secrets and production-safe NAS/IP configuration.

## Data Model

The current Prisma schema defines **16 models**:

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

## Documentation

- **[PRD.md](./PRD.md)** — product requirements / intended scope
- **[PROGRESS.md](./PROGRESS.md)** — audited current repo status
- **[REVIEW.md](./REVIEW.md)** — updated repo review snapshot

## Currency & Localization

- Default currency: **KES**
- Tax rate: **16% VAT**
- Timezone: **Africa/Nairobi (EAT, UTC+3)**
- Phone format: `+254XXXXXXXXX`

## License

Proprietary — All rights reserved.
