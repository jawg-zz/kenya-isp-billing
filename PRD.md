# ISP Billing System — Product Requirements Document

> **Version:** 1.0  
> **Last Updated:** 2026-03-17  
> **Status:** In Development (Production-ready, pre-deployment)  
> **Target Market:** Kenya — ISPs serving residential and business customers  
> **Stack:** NestJS/Express API · Next.js 14 (App Router) · PostgreSQL · Prisma · Redis

---

## Table of Contents

1. [Product Overview](#1-product-overview)
2. [User Roles & Personas](#2-user-roles--personas)
3. [Authentication & Account Management](#3-authentication--account-management)
4. [Subscription Plans & Pricing](#4-subscription-plans--pricing)
5. [Billing & Invoicing](#5-billing--invoicing)
6. [Payments](#6-payments)
7. [Network Management (RADIUS)](#7-network-management-radius)
8. [Usage Tracking & Fair Use Policy](#8-usage-tracking--fair-use-policy)
9. [Notifications](#9-notifications)
10. [Admin Dashboard & Tools](#10-admin-dashboard--tools)
11. [Customer Portal](#11-customer-portal)
12. [Reporting & Analytics](#12-reporting--analytics)
13. [Security & Compliance](#13-security--compliance)
14. [Infrastructure & Deployment](#14-infrastructure--deployment)
15. [API Design](#15-api-design)
16. [Data Model](#16-data-model)
17. [Future Roadmap](#17-future-roadmap)

---

## 1. Product Overview

### 1.1 Purpose

A full-stack ISP billing and customer management platform tailored for Kenyan Internet Service Providers. Handles the complete customer lifecycle from registration through subscription management, payment collection via mobile money (M-Pesa, Airtel Money), automated billing, and network access control via RADIUS.

### 1.2 Key Objectives

- Automate recurring billing and reduce manual intervention
- Support mobile-first payment methods dominant in the Kenyan market (M-Pesa, Airtel Money)
- Integrate directly with network infrastructure (RADIUS) for real-time service provisioning
- Provide self-service capabilities to reduce support overhead
- Give administrators full visibility into revenue, customers, and network usage

### 1.3 Target Users

| User | Description |
|------|-------------|
| **ISP Admin** | Full system access — manages plans, customers, payments, network config |
| **Support Staff** | Limited admin — can view/manage customers, handle payment issues |
| **Customers** | Self-service — view invoices, make payments, manage subscriptions, monitor usage |

---

## 2. User Roles & Personas

### 2.1 Roles

| Role | Access Level |
|------|-------------|
| `ADMIN` | Full system access — all CRUD operations, settings, reports, network config |
| `SUPPORT` | Customer-facing operations — view customers, invoices, payments; limited edits |
| `CUSTOMER` | Self-service portal only — own profile, invoices, payments, usage, subscription |

### 2.2 Account Statuses

| Status | Description |
|--------|-------------|
| `ACTIVE` | Fully operational — can log in, use service |
| `SUSPENDED` | Service suspended (payment overdue) — can log in but no network access |
| `TERMINATED` | Account closed — cannot log in |
| `PENDING_VERIFICATION` | Registered but not yet verified (email/phone) — limited access |

**Lifecycle:** `PENDING_VERIFICATION` → `ACTIVE` → `SUSPENDED` → `TERMINATED`  
(Admin can manually reinstate suspended accounts)

---

## 3. Authentication & Account Management

### 3.1 Registration

- **Fields required:** Email, phone, password, first name, last name
- **Optional KYC:** Address line 1 & 2, city, county (Kenyan counties), postal code, national ID, KRA PIN
- **Verification flow:**
  1. On registration: account created with `PENDING_VERIFICATION`
  2. SMS welcome message sent immediately
  3. Email verification link sent (Redis-cached token, 24h expiry)
  4. Phone verification code sent (6-digit, 15-min expiry, 60s cooldown between resends)
  5. Both verifications completed → account status set to `ACTIVE`

### 3.2 Login

- **Authentication:** Email + password → JWT access token + refresh token
- **Refresh token rotation:** Old refresh token invalidated on use; single-device or multi-device policy
- **Rate limiting:** Lock account after 5 failed attempts for 15 minutes
- **Session tracking:** Last login timestamp recorded

### 3.3 Password Reset

- **Flow:** User requests reset → chooses email or SMS
  - **Email:** Secure link with token (e.g., `https://domain/reset-password?token=xxx`)
  - **SMS:** 6-digit code
- **Token validity:** 1 hour, single-use, stored in Redis
- **Reset page:** Frontend page at `/reset-password` validates token, allows new password entry

### 3.4 JWT Configuration

- **Access token:** Short-lived (15-30 min), contains user ID, role, email
- **Refresh token:** Long-lived (7 days), stored in database, rotatable
- **Secret validation:** Must be set in production; dev fallback with random secret + warning
- **Algorithm:** HS256

---

## 4. Subscription Plans & Pricing

### 4.1 Plan Types

| Type | Description | Billing |
|------|-------------|---------|
| `PREPAID` | Customer pays upfront for a bundle (data, voice, SMS) | One-time, validity-based |
| `POSTPAID` | Customer billed on a recurring cycle | Monthly, Weekly, Quarterly, Yearly |

### 4.2 Plan Data Types

| Type | Description |
|------|-------------|
| `DATA` | Internet data plans (broadband/ISP core) |
| `VOICE` | Voice minute bundles |
| `SMS` | SMS bundles |
| `BUNDLE` | Combined data + voice + SMS |

### 4.3 Plan Attributes

| Attribute | Type | Description |
|-----------|------|-------------|
| `name` | String | Display name (e.g., "Home Starter 10Mbps") |
| `code` | String | Unique internal code (e.g., `HOME_10M`) |
| `price` | Decimal | Base price in KES |
| `dataAllowance` | BigInt (bytes) | Total data included; `null` = unlimited |
| `voiceMinutes` | Int | Voice minutes included; `null` = none |
| `smsAllowance` | Int | SMS included; `null` = none |
| `speedLimit` | Int (Mbps) | Max speed; `null` = uncapped |
| `validityDays` | Int | How long the bundle lasts (prepaid); default 30 |
| `fupThreshold` | BigInt (bytes) | Fair usage policy threshold; `null` = no FUP |
| `fupSpeedLimit` | Int (Mbps) | Reduced speed after FUP threshold |
| `isActive` | Boolean | Whether plan is available for new subscriptions |
| `isFeatured` | Boolean | Highlight in customer-facing plan selection |

### 4.4 Plan Pricing (Multi-Cycle)

Plans can have different prices per billing cycle via `PlanPrice`:

| Cycle | Example |
|-------|---------|
| `WEEKLY` | Short-term, higher per-week rate |
| `MONTHLY` | Standard recurring |
| `QUARTERLY` | Discount incentive |
| `YEARLY` | Best rate, commitment |

### 4.5 Admin Requirements

- CRUD for plans (create, edit, activate/deactivate, delete)
- Manage per-cycle pricing
- Reorder plans for display (sort order)
- Feature/unfeature plans on customer portal

---

## 5. Billing & Invoicing

### 5.1 Automated Invoice Generation

- **Schedule:** Daily at 01:00 AM (cron worker `invoiceGenerator`)
- **Logic:**
  - For each active postpaid subscription, check if billing cycle is due
  - Generate invoice with: plan price + applicable taxes
  - Invoice number format: unique, sequential (e.g., `INV-2026-001234`)
  - Status: `PENDING` by default, `DRAFT` for admin-created

### 5.2 Invoice Structure

| Field | Description |
|-------|-------------|
| `invoiceNumber` | Unique identifier (sequential) |
| `customerId` | Associated customer |
| `subscriptionId` | Link to subscription (optional for manual invoices) |
| `subtotal` | Amount before tax |
| `taxRate` | VAT rate (default 16% per Kenya Revenue Authority) |
| `taxAmount` | Computed tax |
| `totalAmount` | Subtotal + tax |
| `currency` | KES (Kenyan Shilling) |
| `dueDate` | Payment deadline |
| `status` | DRAFT → PENDING → PAID / OVERDUE / CANCELLED / REFUNDED |

### 5.3 Invoice Statuses

| Status | Description |
|--------|-------------|
| `DRAFT` | Created by admin, not yet sent to customer |
| `PENDING` | Sent, awaiting payment |
| `PAID` | Payment received and matched |
| `OVERDUE` | Past due date, unpaid — triggers late fees / suspension |
| `CANCELLED` | Voided by admin |
| `REFUNDED` | Payment was refunded |

### 5.4 Late Fee Processing

- **Schedule:** Daily at 01:30 AM (cron worker `lateFees`)
- **Logic:** For each overdue invoice past grace period → apply late fee % (configurable in settings)
- Late fees added as new line items or additional invoice

### 5.5 Auto-Suspension

- **Schedule:** Daily at 02:00 AM (cron worker `autoSuspend`)
- **Logic:** For customers with overdue invoices past suspension threshold:
  1. Change subscription status to `SUSPENDED`
  2. Change account status to `SUSPENDED`
  3. Send RADIUS CoA-Request to disconnect active session
  4. Notify customer via SMS + email + in-app notification

### 5.6 Invoice PDF Generation

- **Template:** Professional PDF with company header, logo, line items, tax breakdown, payment instructions
- **Technology:** pdfkit (Node.js PDF generation)
- **Content:**
  - Company info (from system settings)
  - Customer info (name, account number, email)
  - Invoice number, date, due date
  - Line items (subscription, add-ons, late fees)
  - Subtotal, tax breakdown, total
  - Payment methods accepted (M-Pesa till, bank details)
- **Access:** Downloadable by customer from portal; admin can generate on demand

### 5.7 Manual Billing

- Admin can create manual invoices for ad-hoc charges (installation fees, equipment, etc.)
- Admin can issue credits/debits to customer balance

---

## 6. Payments

### 6.1 Supported Payment Methods

| Method | Type | Integration |
|--------|------|-------------|
| `MPESA` | Mobile money (Safaricom) | STK Push + C2B Callback |
| `AIRTEL_MONEY` | Mobile money (Airtel) | API callback |
| `CASH` | Manual | Admin records cash payment |
| `BANK_TRANSFER` | Manual | Admin records + verifies |
| `CARD` | Future | Placeholder in data model |

### 6.2 M-Pesa Integration (Safaricom)

**Flow:**
1. Customer initiates payment on portal
2. Backend calls M-Pesa STK Push API → customer's phone prompts for M-Pesa PIN
3. Customer enters PIN → payment processed
4. M-Pesa sends C2B callback to configured URL
5. Backend validates callback, updates payment status
6. If linked to invoice → mark invoice as `PAID`
7. Update customer balance, send confirmation

**Security:**
- Validate M-Pesa callback signatures
- Idempotency: duplicate callbacks handled gracefully (already-paid invoices skipped)
- Store: `checkoutRequestId`, `merchantRequestId`, `reference`, `resultCode`, `resultDesc`

### 6.3 Airtel Money Integration

**Flow:**
1. Backend initiates payment request via Airtel API
2. Airtel sends callback on completion
3. Backend validates and processes

**Security (critical):**
- IP allowlist — only accept callbacks from Airtel's verified IPs
- Auth token validation on incoming requests
- Idempotency — prevent duplicate processing

### 6.4 Payment Reconciliation

- Every payment linked to: customer, invoice (optional), subscription (optional)
- Payment statuses: `PENDING` → `COMPLETED` / `FAILED` / `CANCELLED` / `REFUNDED` / `TIMEOUT`
- Admin can view all payments, filter by status/method/date
- Failed payments logged with provider error codes for debugging

### 6.5 Balance Management

- Customer has `balance` (Decimal, can be negative = owe money, positive = credit)
- `creditLimit` — max negative balance before service suspension
- Admin can manually credit/debit balances
- Payments automatically update balance on completion

---

## 7. Network Management (RADIUS)

### 7.1 RADIUS Authentication

**Supported protocols:**
- **PPPoE** — Point-to-Point Protocol over Ethernet (common for fixed wireless/fiber)
- **Hotspot** — Captive portal authentication (common for public WiFi)

**Integration:**
- RADIUS server authenticates users against `RadiusConfig` table (username/password)
- Each customer has a unique RADIUS config linked to their account
- On successful auth → create `RadiusSession` record

### 7.2 RADIUS Configuration Per Customer

| Field | Description |
|-------|-------------|
| `username` | Unique RADIUS username (often same as account number or phone) |
| `password` | RADIUS password (can differ from account password) |
| `nasIpAddress` | NAS device IP (Mikrotik, etc.) |
| `nasPortId` | Port identifier on NAS |
| `poolName` | IP pool name for assignment |
| `isActive` | Whether RADIUS access is enabled |

### 7.3 RADIUS Session Tracking

When a customer connects:
- `RadiusSession` created with: session ID, NAS IP, framed IP, protocol, start time
- Track: input/output octets, packets
- On disconnect: record stop time, terminate cause, total usage
- Sessions linked to subscription for usage billing

### 7.4 Change of Authorization (CoA)

**RFC 2865 CoA support** — dynamically modify a customer's session without requiring reconnection:

| CoA Action | Use Case |
|------------|----------|
| **Speed upgrade** | Customer upgrades plan → send CoA with new speed limit |
| **Speed downgrade** | After FUP threshold reached → CoA to reduced speed |
| **Disconnect** | Account suspended or subscription cancelled → CoA-Request with Disconnect |
| **Re-enable** | Payment received → remove restrictions |

**Implementation:**
- `CoA-Request` packet to NAS with new session parameters
- `Disconnect-Request` to terminate active session
- Triggered automatically by: payment events, FUP breaches, admin actions

### 7.5 Auto-Provisioning

| Event | Action |
|-------|--------|
| Subscription activated | Enable RADIUS access, set speed/data limits |
| Payment received (suspended account) | Re-enable RADIUS, send CoA with active parameters |
| Subscription suspended | Send CoA-Disconnect, disable RADIUS |
| Plan changed | Update RADIUS attributes, send CoA |
| Account terminated | Disable RADIUS permanently |

---

## 8. Usage Tracking & Fair Use Policy

### 8.1 Usage Records

- Captured from RADIUS accounting (Access-Accept / Accounting-Request)
- Each record: user ID, customer ID, subscription ID, session ID, timestamp, octets (in/out), packets (in/out), NAS IP, client IP
- Aggregated per subscription for billing/monitoring

### 8.2 Fair Usage Policy (FUP)

- Plans can define `fupThreshold` (bytes) and `fupSpeedLimit` (Mbps after threshold)
- **Flow:**
  1. Monitor cumulative usage per subscription
  2. When usage exceeds `fupThreshold` → trigger CoA to apply `fupSpeedLimit`
  3. Notify customer: "You've reached your fair usage limit. Speed reduced to X Mbps."
  4. Reset on new billing cycle

### 8.3 Usage Reset

- **Schedule:** Daily at midnight (cron worker `usageReset`)
- Resets daily usage counters; cumulative usage resets at billing cycle boundaries
- Updates `subscription.dataUsed` field

### 8.4 Customer Usage Dashboard

- Real-time usage display: data consumed, remaining allowance, current speed
- Historical usage charts (daily/weekly/monthly)
- Session history with duration and data usage

---

## 9. Notifications

### 9.1 Notification Types

| Type | Trigger | Channels |
|------|---------|----------|
| `PAYMENT_RECEIVED` | Payment completed | In-app, SMS |
| `PAYMENT_FAILED` | Payment failed/timeout | In-app, SMS, Email |
| `INVOICE_GENERATED` | New invoice created | In-app, Email |
| `SUBSCRIPTION_EXPIRING` | Subscription ending soon | In-app, SMS |
| `SUBSCRIPTION_EXPIRED` | Subscription expired | In-app, SMS |
| `SUBSCRIPTION_ACTIVATED` | New/renewed subscription | In-app, SMS |
| `FUP_THRESHOLD` | Fair usage limit reached | In-app, SMS |
| `ACCOUNT_SUSPENDED` | Account suspended (overdue) | In-app, SMS, Email |
| `ACCOUNT_REINSTATED` | Account reinstated after payment | In-app, SMS |
| `WELCOME` | New registration | SMS |

### 9.2 Delivery Channels

| Channel | Implementation |
|---------|----------------|
| **In-app** | Database `Notification` model + SSE real-time push |
| **SMS** | SMS service (configured provider for Kenyan networks) |
| **Email** | Nodemailer with HTML templates |

### 9.3 Real-Time Notifications (SSE)

- **Endpoint:** `GET /api/v1/notifications/stream?token=<jwt>`
- Server-Sent Events push new notifications to connected clients
- Frontend `NotificationListener` component shows toast notifications
- Graceful reconnection on network interruption
- **Note:** EventSource API doesn't support custom headers — token passed via query parameter

### 9.4 Notification Center

- Page at `/notifications` — lists all notifications for the logged-in user
- Mark as read / mark all as read
- Filter by type, read/unread status
- Pagination

---

## 10. Admin Dashboard & Tools

### 10.1 Admin Dashboard (`/`)

**Widgets:**
- Total revenue (today/month/all-time)
- Active customers count
- Overdue invoices count
- Recent activity feed (payments, registrations, suspensions)
- Quick actions (create invoice, add customer, etc.)

### 10.2 Customer Management

| Page | Features |
|------|----------|
| `/customers` | List, search, filter by status/county/plan, bulk actions |
| `/customers/new` | Create customer account with full form |
| `/customers/[id]` | Customer detail + edit: toggle edit mode, update all fields |

**Customer actions:**
- Suspend / reinstate / terminate account
- Manually adjust balance (credit/debit)
- View invoices, payments, subscriptions, usage
- Edit RADIUS credentials
- Reset password

### 10.3 Subscription Management (`/subscriptions`)

- Table view with search and filters (status, plan type, billing cycle)
- Actions: suspend, activate, cancel subscription
- View subscription details: plan, usage, billing history

### 10.4 Invoice Management (`/invoices/management`)

- All invoices with search, filters (status, date range, customer)
- Actions: send, cancel, refund, download PDF
- Create manual invoices

### 10.5 Plan Management (`/plans`)

- Create, edit, activate/deactivate plans
- Manage per-cycle pricing
- Set FUP thresholds and speed limits
- Reorder display sequence

### 10.6 Revenue Reports (`/revenue`)

- Revenue charts (daily, weekly, monthly, quarterly)
- Payment method breakdown
- Outstanding vs collected
- Charts built with Recharts

### 10.7 Network Overview (`/network`)

- Active RADIUS sessions list
- Session details: user, NAS, IP, duration, data usage
- Disconnect sessions manually

### 10.8 Settings (`/settings`)

**Six configuration sections:**

| Section | Settings |
|---------|----------|
| **Company** | Company name, email, phone, address, tax ID, logo |
| **Payment** | M-Pesa till number, Airtel config, payment instructions |
| **Billing** | VAT rate, late fee %, grace period days, auto-suspend delay |
| **Branding** | Primary/secondary colors, favicon, app name |
| **Operations** | Default account status, session timeout, maintenance mode |
| **API / RADIUS** | RADIUS server config, NAS devices, CoA settings |

- Bulk update support (update multiple settings in one request)
- All settings stored in `SystemSetting` model (key-value pairs by category)

### 10.9 Audit Log (`/audit`)

- View all admin actions: who, what, when, old/new values
- Filter by action type, entity, user, date range

---

## 11. Customer Portal

### 11.1 Customer Dashboard (`/dashboard`)

- Current subscription summary
- Balance overview
- Recent invoices (unpaid count + amounts)
- Recent payments
- Quick pay button
- Usage meters (data consumed vs allowance)

### 11.2 Subscribe to Plan (`/subscribe`)

- Browse available plans (featured plans highlighted)
- View plan details: speed, data allowance, FUP, pricing per cycle
- Select plan + billing cycle
- Payment flow (M-Pesa STK push or Airtel Money)
- Plan activation on payment confirmation

### 11.3 My Invoices (`/invoices`)

- List of all invoices with status badges
- Invoice detail page: line items, tax breakdown, payment status
- Download PDF
- Pay outstanding invoice button

### 11.4 My Payments (`/payments`)

- Payment history with status, method, reference
- Payment detail page

### 11.5 Usage (`/usage`)

- Current cycle usage: data consumed, remaining, percentage
- Session history with timestamps and data per session
- Historical usage charts

### 11.6 Profile (`/profile`)

- View/edit personal info
- Change password
- Complete phone/email verification
- View account status

### 11.7 Cancel Subscription

- Button on subscription page with confirmation dialog
- Subscription status → `CANCELLED`
- Triggers RADIUS disconnect + notification

---

## 12. Reporting & Analytics

### 12.1 Revenue Reports

- **Time periods:** Daily, weekly, monthly, quarterly, yearly
- **Metrics:** Total revenue, collected vs outstanding, payment method breakdown
- **Charts:** Bar charts, line trends (Recharts)

### 12.2 Customer Reports

- New registrations over time
- Active vs suspended vs terminated breakdown
- Customers by county (geographic distribution)
- Churn rate

### 12.3 Usage Reports

- Total bandwidth consumed across all customers
- Top users by data consumption
- Peak usage times

### 12.4 Payment Reports

- Collection rate (% of invoices paid)
- Average days to payment
- Failed payment rate
- M-Pesa vs Airtel vs other method split

---

## 13. Security & Compliance

### 13.1 Authentication Security

- Passwords hashed with bcrypt (salt rounds: 12)
- JWT with short-lived access tokens + refresh token rotation
- Login attempt limiting (5 attempts → 15-minute lockout)
- JWT secret validation — fails hard in production if not set

### 13.2 Payment Security

- M-Pesa callback signature validation
- Airtel callback: IP allowlist + auth token
- Idempotency on all payment processing (duplicate callbacks safe)
- No sensitive payment data stored (tokens/references only)

### 13.3 API Security

- Role-based middleware (ADMIN, SUPPORT, CUSTOMER)
- Request validation via validators
- Audit logging for all state-changing operations
- Error handling with request tracing (correlation IDs)
- Rate limiting on sensitive endpoints (configurable, disabled in dev)

### 13.4 Data Protection

- Passwords never returned in API responses
- PII (ID number, KRA PIN) only visible to admins
- Refresh tokens stored hashed
- CORS configured for production

### 13.5 Kenya Compliance

- **VAT:** 16% default (Kenya Revenue Authority standard rate)
- **Invoice format:** Kenyan tax-compliant with TIN, KRA references
- **Data residency:** All data stored locally (PostgreSQL)
- **County support:** Kenyan county field in customer profile

---

## 14. Infrastructure & Deployment

### 14.1 Architecture

```
┌─────────────────────────────────────┐
│           Next.js Frontend          │
│     (App Router, React 18, Tailwind)│
└──────────────┬──────────────────────┘
               │ API calls
┌──────────────▼──────────────────────┐
│          NestJS/Express API         │
│   (REST, middleware, services)      │
├──────────────┬──────────────────────┤
│  PostgreSQL  │       Redis          │
│  (Prisma)    │  (cache, sessions,   │
│              │   rate limiting)     │
└──────────────┴──────────────────────┘
```

### 14.2 Deployment

- **Platform:** Dokploy (containerized)
- **Services:** API (port 3001), Frontend (port 3000)
- **Domain:** ISP-specific (e.g., `isp.spidmax.win`)
- **SSL:** Via Dokploy/traefik

### 14.3 Scheduled Jobs (Cron Workers)

| Worker | Schedule | Action |
|--------|----------|--------|
| `invoiceGenerator` | 01:00 AM daily | Generate invoices for due postpaid subscriptions |
| `lateFees` | 01:30 AM daily | Apply late fees to overdue invoices |
| `autoSuspend` | 02:00 AM daily | Suspend accounts with overdue invoices past grace period |
| `usageReset` | Midnight daily | Reset daily usage counters |

### 14.4 Required Environment Variables

**API:**
```
DATABASE_URL          # PostgreSQL connection
REDIS_URL             # Redis connection
JWT_SECRET            # JWT signing secret (MUST be set in production)
MPESA_CONSUMER_KEY    # Safaricom API
MPESA_CONSUMER_SECRET # Safaricom API
MPESA_SHORT_CODE      # Till/Paybill number
MPESA_PASSKEY         # M-Pesa API passkey
AIRTEL_CLIENT_ID      # Airtel Money API
AIRTEL_CLIENT_SECRET  # Airtel Money API
AIRTEL_CALLBACK_URL   # Airtel webhook URL
SMS_API_KEY           # SMS provider
RADIUS_SECRET         # Shared secret for RADIUS
NODE_ENV              # development | production
PORT                  # API port (default 3001)
```

**Frontend:**
```
NEXT_PUBLIC_API_URL   # API base URL
```

### 14.5 Database

- **Provider:** PostgreSQL (via Prisma ORM)
- **Migrations:** Prisma migrate
- **Seeding:** `api/src/utils/seed.ts` — default admin, sample plans, system settings

---

## 15. API Design

### 15.1 Conventions

- **Base URL:** `/api/v1`
- **Auth:** Bearer token in Authorization header
- **Response format:** JSON with consistent error structure
- **Pagination:** Offset-based with `page` and `limit` query params
- **Validation:** Request body validation via dedicated validator files
- **Documentation:** Swagger/OpenAPI at `/api/docs`

### 15.2 Route Structure

| Prefix | Description |
|--------|-------------|
| `/api/v1/auth` | Login, register, verify, password reset |
| `/api/v1/customers` | Customer CRUD (admin) |
| `/api/v1/plans` | Plan CRUD |
| `/api/v1/subscriptions` | Subscription management |
| `/api/v1/invoices` | Invoice management |
| `/api/v1/payments` | Payment processing + history |
| `/api/v1/usage` | Usage records + statistics |
| `/api/v1/notifications` | Notifications + SSE stream |
| `/api/v1/settings` | System settings (admin) |
| `/api/v1/audit` | Audit logs (admin) |
| `/api/v1/admin` | Admin dashboard data |
| `/health` | Health check (DB + Redis + status) |

---

## 16. Data Model

### 16.1 Entity Relationship Summary

```
User (1) ──→ (1) Customer ──→ (many) Subscription
                                  ├── Plan
                                  ├── Invoice ──→ Payment
                                  ├── RadiusSession
                                  └── UsageRecord
User (1) ──→ (many) RadiusConfig (RADIUS credentials)
User (1) ──→ (many) Notification
User (1) ──→ (many) RefreshToken
Plan (1) ──→ (many) PlanPrice (per billing cycle)
SystemSetting (standalone key-value)
AuditLog (standalone, linked to User)
```

### 16.2 Key Models

See full Prisma schema at `api/prisma/schema.prisma` — includes all 14 models with indexes, relations, and enums.

---

## 17. Future Roadmap

### Phase 2 (Post-Launch)

- [ ] **Card payments** — integrate Stripe/Pesapal for card payments
- [ ] **Customer self-service RADIUS** — allow customers to change their RADIUS password
- [ ] **SMS/USSD integration** — let customers check balance/subscribe via USSD
- [ ] **Multi-tenancy** — support multiple ISPs on one platform
- [ ] **Equipment tracking** — link customer accounts to physical equipment (routers, CPEs)
- [ ] **Ticket/support system** — customer support ticketing within the platform
- [ ] **Mobile app** — React Native or Flutter customer app

### Phase 3 (Growth)

- [ ] **Reseller program** — sub-agents who manage their own customer segments
- [ ] **API marketplace** — public API for third-party integrations
- [ ] **Advanced analytics** — churn prediction, revenue forecasting
- [ ] **Multi-currency** — support for other East African currencies (UGX, TZS)
- [ ] **White-label** — customizable branding per ISP tenant

---

## Appendix

### A. Technology Stack

| Layer | Technology |
|-------|-----------|
| Frontend | Next.js 14 (App Router), React 18, Tailwind CSS, Recharts |
| Backend | NestJS/Express (TypeScript) |
| Database | PostgreSQL via Prisma ORM |
| Cache | Redis (sessions, rate limiting, settings cache) |
| PDF | pdfkit |
| Email | Nodemailer |
| SMS | Configurable provider (Kenyan network APIs) |
| Auth | JWT (access + refresh tokens, bcrypt) |
| M-Pesa | Safaricom Daraja API (STK Push + C2B) |
| Airtel | Airtel Money API |
| RADIUS | RFC 2865 (Auth + CoA + Accounting) |
| Deployment | Dokploy (Docker) |
| API Docs | Swagger/OpenAPI |

### B. Test Coverage

- M-Pesa callback tests (`mpesa-callback.spec.ts`)
- Billing logic tests (`billing.spec.ts`)
- Authentication tests (`auth.spec.ts`)
- **Target:** Expand to cover subscription lifecycle, invoice generation, RADIUS provisioning

### C. Key File References

| Purpose | Path |
|---------|------|
| Prisma schema | `api/prisma/schema.prisma` |
| API entry | `api/src/server.ts` |
| Frontend layout | `frontend/src/app/layout.tsx` |
| Auth provider | `frontend/src/lib/auth.tsx` |
| API client | `frontend/src/lib/api.ts` |
| Seed data | `api/src/utils/seed.ts` |
| Cron scheduler | `api/src/workers/scheduler.ts` |
| Swagger config | `api/src/config/swagger.ts` |

---

*This document is the source of truth for the ISP billing system. Update it as features are added, modified, or deprecated.*
