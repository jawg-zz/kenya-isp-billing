# ISP Billing System

A full-stack ISP billing and customer management platform built for Kenyan ISPs. Supports M-Pesa and Airtel Money payments, RADIUS authentication, prepaid/postpaid plans, automated invoicing, usage tracking, and real-time notifications.

## Tech Stack

| Layer | Technology |
|-------|-----------|
| **Backend** | NestJS/Express + TypeScript |
| **Frontend** | Next.js 14 (App Router) + React 18 + TailwindCSS |
| **Database** | PostgreSQL 16 via Prisma ORM |
| **Cache** | Redis 7 (sessions, rate limiting, settings) |
| **Auth** | JWT (access + refresh token rotation) |
| **Payments** | M-Pesa Daraja API (STK Push) + Airtel Money |
| **SMS** | Africa's Talking |
| **Email** | Nodemailer (SMTP) |
| **Network** | RADIUS (RFC 2865) + CoA |
| **PDF** | pdfkit (invoices, reports) |
| **Charts** | Recharts |
| **Deploy** | Docker Compose |

## Features

### Customer Portal
- **Dashboard** — Account overview, active plan, balance, alerts
- **Subscribe** — Browse plans, select billing cycle, pay via M-Pesa/Airtel
- **Usage** — Real-time data consumption, session history, FUP status
- **Invoices** — View, filter, download PDF, pay outstanding
- **Payments** — Payment history, M-Pesa STK push, Airtel Money
- **Notifications** — Real-time SSE notifications, notification center
- **Profile** — Personal info, password, email/phone verification

### Admin Dashboard
- **Overview** — KPIs: revenue, customers, overdue invoices, activity feed
- **Customers** — CRUD, search, suspend/activate, balance adjustment, edit
- **Plans** — Create/edit/deactivate plans with multi-cycle pricing
- **Subscriptions** — Table view, search, filter, suspend/activate/cancel
- **Invoices** — All invoices, batch generation, PDF download, status updates
- **Payments** — Full payment history, manual recording
- **Reports** — Customer, usage, and payment analytics with charts + CSV/PDF export
- **Network** — Active RADIUS sessions, session management
- **Settings** — Company, payment, billing, branding, operations, API/RADIUS config
- **Audit Log** — Admin action tracking with old/new values

### Payment Integration
- **M-Pesa** — STK Push with automatic callback processing, idempotency
- **Airtel Money** — Push payment with IP allowlist + token validation
- **Cash/Bank** — Manual recording by admin

### Network Integration (RADIUS)
- **Authentication** — PPPoE and Hotspot support
- **Session Tracking** — Active sessions, bandwidth, data usage
- **CoA (RFC 2865)** — Dynamic speed changes, disconnect, re-enable
- **Auto-provisioning** — Service activate/deactivate on payment events
- **Fair Usage Policy** — Threshold-based speed reduction

### Automated Billing
- **Invoice Generation** — Daily at 01:00 AM (cron)
- **Late Fees** — Daily at 01:30 AM (cron)
- **Auto-Suspension** — Daily at 02:00 AM for overdue accounts (cron)
- **Usage Reset** — Daily at midnight (cron)

## Prerequisites

- Docker & Docker Compose
- Node.js 20+ (for local development only)

## Quick Start (Docker Compose)

### 1. Clone and Configure

```bash
git clone <your-repo-url>
cd isp-billing-system

# Create .env file with your secrets
cp .env.example .env
```

Edit `.env` with your values:

```env
# REQUIRED — Generate with: openssl rand -base64 48
POSTGRES_PASSWORD=your_strong_db_password
JWT_SECRET=your_64_char_random_string
JWT_REFRESH_SECRET=another_64_char_random_string
RADIUS_SECRET=your_radius_secret

# REQUIRED for production
CORS_ORIGIN=https://isp.yourdomain.com

# Optional — payments, SMS, email (features won't work without these)
MPESA_CONSUMER_KEY=
MPESA_CONSUMER_SECRET=
MPESA_PASSKEY=
MPESA_SHORTCODE=
MPESA_ENVIRONMENT=production
AT_API_KEY=
AT_USERNAME=
SMTP_HOST=
SMTP_USER=
SMTP_PASS=
```

### 2. Start All Services

```bash
docker compose up -d
```

This starts 4 containers:
- `isp_billing_postgres` — PostgreSQL database
- `isp_billing_redis` — Redis cache
- `isp_billing_api` — Backend API (port 3000 internally)
- `isp_billing_frontend` — Next.js frontend (port 3000 internally)

### 3. Run Migrations & Seed

```bash
# Apply database migrations
docker compose exec api npx prisma migrate deploy

# Seed default data (admin user, plans, settings)
docker compose exec api npx prisma db seed
```

### 4. Access

| Service | URL |
|---------|-----|
| **Frontend** | `http://your-server` |
| **API** | `http://your-server/api/v1` |
| **Swagger Docs** | `http://your-server/api/docs` |
| **Health Check** | `http://your-server/health` |

## Default Accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | `admin@isp-kenya.co.ke` | `Admin@123456` |
| Customer | (created via seed) | `Customer@123` |

⚠️ **Change these passwords immediately after first login.**

## Local Development

### Setup

```bash
# Start only database services
docker compose up -d postgres redis

# Install dependencies
cd api && npm install
cd ../frontend && npm install

# Run migrations
cd api && npx prisma migrate dev

# Start dev servers
# Terminal 1 — API
cd api && npm run dev      # http://localhost:3001

# Terminal 2 — Frontend
cd frontend && npm run dev # http://localhost:3000
```

### Environment (Local)

```env
NODE_ENV=development
DATABASE_URL=postgresql://isp_billing:isp_billing_password@localhost:5432/isp_billing
REDIS_URL=redis://localhost:6379
CORS_ORIGIN=http://localhost:3000
```

## Production Deployment (Dokploy)

This project is designed for [Dokploy](https://dokploy.com) deployment.

### Setup

1. **Push to GitHub** (already done: `github.com/jawg-zz/kenya-isp-billing`)
2. **Create Dokploy project** pointing to the repo
3. **Add environment variables** in Dokploy UI (see `.env.production.example`):
   - `POSTGRES_PASSWORD` — strong DB password
   - `JWT_SECRET` — 48+ char random string
   - `JWT_REFRESH_SECRET` — 48+ char random string
   - `RADIUS_SECRET` — random hex string
   - `CORS_ORIGIN` — your production domain
   - Payment/SMS/SMTP credentials as needed
4. **Deploy** — Dokploy builds and starts via `docker-compose.yml`

### Required Env Vars for Production

| Variable | Required | Notes |
|----------|----------|-------|
| `POSTGRES_PASSWORD` | ✅ | Database password |
| `JWT_SECRET` | ✅ | 48+ characters |
| `JWT_REFRESH_SECRET` | ✅ | 48+ characters |
| `RADIUS_SECRET` | ✅ | Shared RADIUS secret |
| `CORS_ORIGIN` | ✅ | Production domain |
| `NODE_ENV` | ✅ | Auto-set to `production` |
| `MPESA_*` | ⚠️ | Required for M-Pesa payments |
| `AIRTEL_*` | ⚠️ | Required for Airtel payments |
| `AT_*` | ⚠️ | Required for SMS |
| `SMTP_*` | ⚠️ | Required for emails |

### Generate Secrets

```bash
openssl rand -base64 48   # JWT_SECRET, JWT_REFRESH_SECRET
openssl rand -hex 16      # RADIUS_SECRET, POSTGRES_PASSWORD
```

## API Documentation

Full Swagger docs available at `/api/docs` when running. Major endpoints:

| Category | Endpoints |
|----------|-----------|
| **Auth** | Register, login, refresh token, verify email/phone, password reset |
| **Plans** | CRUD, multi-cycle pricing, featured plans |
| **Subscriptions** | Subscribe, renew, cancel, admin manage |
| **Invoices** | List, detail, PDF download, batch generate, admin management |
| **Payments** | M-Pesa STK push, Airtel Money, manual recording, history |
| **Customers** | CRUD, search, filter, balance adjustment, stats |
| **Usage** | Summary, realtime, history, session tracking |
| **Reports** | Customer trends, usage analytics, payment reports, CSV/PDF export |
| **Notifications** | In-app, SSE stream, read/unread |
| **Settings** | Get/update system settings (6 categories) |
| **RADIUS** | Session list, config management |
| **Audit** | Admin action log |

## Project Structure

```
isp-billing-system/
├── .env.production.example    # Production env reference
├── PRD.md                     # Product requirements document
├── PROGRESS.md                # Development progress tracker
├── docker-compose.yml         # All services definition
├── api/                       # Backend
│   ├── src/
│   │   ├── config/           # Database, Redis, app config
│   │   ├── controllers/      # Route handlers
│   │   ├── middleware/        # Auth, validation, rate limiting, audit
│   │   ├── routes/           # Express routes (20+ route files)
│   │   ├── services/         # Business logic (billing, M-Pesa, RADIUS, etc.)
│   │   ├── validators/       # Zod validation schemas
│   │   ├── workers/          # Cron workers (invoice, suspend, fees, usage)
│   │   ├── templates/        # PDF templates (invoice, reports)
│   │   └── server.ts         # Entry point
│   ├── prisma/
│   │   ├── schema.prisma     # 14 models, full relations
│   │   └── seed.ts           # Default data
│   ├── __tests__/            # Test suites
│   └── Dockerfile
├── frontend/                  # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/      # Login, register, forgot/reset password, verify
│   │   │   ├── (admin)/     # Dashboard, customers, plans, invoices, subscriptions, reports, settings
│   │   │   ├── (customer)/  # Dashboard, subscribe, usage, invoices, payments, profile
│   │   │   └── notifications/
│   │   ├── components/
│   │   │   ├── ui/          # Input, Button, Card, Table, Badge, etc.
│   │   │   ├── layout/      # Sidebar, navigation
│   │   │   ├── charts/      # Revenue, analytics charts
│   │   │   └── widgets/     # Stat cards, activity feed
│   │   └── lib/
│   │       ├── api.ts       # API client
│   │       ├── auth.tsx     # Auth context + provider
│   │       ├── validation.ts # Form validation utils
│   │       ├── api-errors.ts # Error handling
│   │       └── hooks/       # useFormValidation, useNotificationSSE
│   └── Dockerfile
└── README.md
```

## Database Schema

14 models covering the full system: `User`, `Customer`, `Plan`, `PlanPrice`, `Subscription`, `Invoice`, `Payment`, `RadiusConfig`, `RadiusSession`, `UsageRecord`, `Notification`, `SystemSetting`, `AuditLog`, `RefreshToken`.

See `api/prisma/schema.prisma` for the complete schema.

## Documentation

- **[PRD.md](./PRD.md)** — Full product requirements (17 sections)
- **[PROGRESS.md](./PROGRESS.md)** — Development progress tracker (90% complete)
- **Swagger** — Interactive API docs at `/api/docs`

## Currency & Localization

- Default currency: **KES** (Kenyan Shillings)
- Tax rate: **16% VAT** (Kenya Revenue Authority standard)
- Timezone: **Africa/Nairobi (EAT, UTC+3)**
- Counties: All 47 Kenyan counties supported
- Phone format: `+254XXXXXXXXX` (normalized automatically)

## License

Proprietary — All rights reserved.
