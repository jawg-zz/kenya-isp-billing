# ISP Billing System

A full-stack ISP billing management system built for Kenyan ISPs. Supports M-Pesa and Airtel Money payments, RADIUS authentication, prepaid/postpaid plans, invoicing, and usage tracking.

## Tech Stack

**Backend:**
- Node.js + Express + TypeScript
- PostgreSQL (via Prisma ORM)
- Redis (caching & token storage)
- JWT authentication with refresh token rotation
- M-Pesa Daraja API integration
- Airtel Money API integration
- Africa's Talking SMS gateway

**Frontend:**
- Next.js 14 (App Router)
- React 18 + TypeScript
- TailwindCSS (mobile-first)
- TanStack Query (data fetching)
- Zustand (state management)
- Recharts (analytics charts)
- Sonner (toast notifications)

**Infrastructure:**
- Docker & Docker Compose
- Nginx reverse proxy
- PostgreSQL 16
- Redis 7

## Features

### Customer Portal
- **Dashboard** — Account overview, active plan, recent activity, alerts
- **Usage Monitoring** — Real-time data usage, progress bar, history
- **Invoices** — View invoices, filter by status, download PDFs
- **Payments** — M-Pesa STK Push, Airtel Money, payment history
- **Profile** — Personal info, password management, address

### Admin Panel
- **Overview** — KPIs: customers, revenue, invoices, overdue alerts
- **Customer Management** — CRUD, search, suspend/activate, balance adjustment
- **Plan Management** — Create/edit/deactivate plans with pricing tiers
- **Invoice Management** — View all invoices, batch generation, status updates
- **Revenue Analytics** — Payment charts by day/method, transaction history

### Payment Integration
- **M-Pesa** — STK Push with automatic callback processing
- **Airtel Money** — Push payment with callback
- **Cash** — Manual cash payment recording (admin)

## Quick Start

### Prerequisites
- Docker & Docker Compose
- Node.js 20+ (for local development)

### 1. Environment Setup

```bash
# Copy and edit environment variables
cp api/.env.example api/.env
cp frontend/.env.local.example frontend/.env.local
```

Edit `api/.env` with your credentials:
- Database URL (defaults to Docker Compose postgres)
- JWT secrets (change in production!)
- M-Pesa API keys (Safaricom Daraja)
- Airtel Money API keys
- Africa's Talking SMS credentials

### 2. Run with Docker Compose

```bash
# Start all services
docker compose up -d

# Run database migrations & seed
docker compose exec api npx prisma migrate deploy
docker compose exec api npx prisma db seed

# Access the application
# Frontend: http://localhost
# API: http://localhost/api/v1
```

### 3. Local Development

```bash
# Install dependencies
cd api && npm install
cd ../frontend && npm install

# Start database services
docker compose up -d postgres redis

# Run migrations
cd api && npx prisma migrate dev

# Start development servers
# Terminal 1 - API
cd api && npm run dev

# Terminal 2 - Frontend
cd frontend && npm run dev
```

## Default Accounts (after seeding)

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@isp.co.ke | admin123 |
| Customer | customer@test.com | customer123 |

## API Endpoints

### Authentication
- `POST /api/v1/auth/register` — Register
- `POST /api/v1/auth/login` — Login
- `POST /api/v1/auth/refresh-token` — Refresh JWT
- `GET /api/v1/auth/profile` — Get profile
- `PUT /api/v1/auth/profile` — Update profile

### Plans
- `GET /api/v1/plans` — List active plans (public)
- `GET /api/v1/plans/:id` — Plan details
- `POST /api/v1/plans` — Create plan (admin)
- `PUT /api/v1/plans/:id` — Update plan (admin)
- `DELETE /api/v1/plans/:id` — Deactivate plan (admin)

### Subscriptions
- `GET /api/v1/subscriptions` — My subscriptions
- `POST /api/v1/subscriptions` — Subscribe to plan
- `POST /api/v1/subscriptions/renew` — Renew subscription
- `POST /api/v1/subscriptions/cancel` — Cancel subscription

### Invoices
- `GET /api/v1/invoices` — My invoices
- `GET /api/v1/invoices/:id` — Invoice details
- `GET /api/v1/invoices/admin/all` — All invoices (admin)
- `POST /api/v1/invoices/admin/generate` — Batch generate (admin)

### Payments
- `POST /api/v1/payments/mpesa/initiate` — M-Pesa STK Push
- `POST /api/v1/payments/airtel/initiate` — Airtel Money
- `GET /api/v1/payments/history` — Payment history
- `POST /api/v1/payments/mpesa/callback` — M-Pesa callback (webhook)
- `POST /api/v1/payments/airtel/callback` — Airtel callback (webhook)

### Usage
- `GET /api/v1/usage/summary` — Usage summary
- `GET /api/v1/usage/realtime` — Real-time stats
- `GET /api/v1/usage/history` — Usage history

### Customers (Admin)
- `GET /api/v1/customers` — List customers
- `POST /api/v1/customers` — Create customer
- `PUT /api/v1/customers/:id` — Update customer
- `GET /api/v1/customers/stats` — Customer statistics

## Project Structure

```
isp-billing-system/
├── api/                    # Backend API
│   ├── src/
│   │   ├── config/        # Database, Redis, config
│   │   ├── controllers/   # Route handlers
│   │   ├── middleware/    # Auth, validation, rate limiting
│   │   ├── routes/        # Express routes
│   │   ├── services/      # Business logic (M-Pesa, billing, etc.)
│   │   ├── validators/    # Zod schemas
│   │   └── server.ts      # Entry point
│   ├── prisma/
│   │   └── schema.prisma  # Database schema
│   └── Dockerfile
├── frontend/               # Next.js frontend
│   ├── src/
│   │   ├── app/
│   │   │   ├── (auth)/   # Login, register
│   │   │   ├── (customer)/ # Customer portal
│   │   │   └── (admin)/  # Admin dashboard
│   │   ├── components/
│   │   │   ├── ui/       # Reusable components
│   │   │   └── layout/   # Sidebar, TopBar
│   │   └── lib/          # API client, auth context
│   └── Dockerfile
├── database/
│   └── schema.prisma     # Shared schema reference
├── nginx/
│   └── nginx.conf        # Reverse proxy config
├── docker-compose.yml
└── README.md
```

## Currency & Localization

- Default currency: **KES** (Kenyan Shillings)
- Tax rate: **16% VAT** (Kenya standard)
- Timezone: **Africa/Nairobi (EAT, UTC+3)**
- Payment methods: M-Pesa, Airtel Money, Cash

## License

Proprietary — All rights reserved.
