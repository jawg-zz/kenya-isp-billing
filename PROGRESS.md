# ISP Billing System — Progress Tracker

> **Last Updated:** 2026-03-17 19:34 UTC  
> **Linked to:** [PRD.md](./PRD.md)  
> **Legend:** ✅ Complete | 🚧 In Progress | 🔲 Not Started | 🐛 Has Known Issues

---

## Overall Progress: **90%** (15/17 sections complete)

| Section | Status | Notes |
|---------|--------|-------|
| 1. Product Overview | ✅ | — |
| 2. User Roles & Personas | ✅ | — |
| 3. Authentication & Account Management | ✅ | — |
| 4. Subscription Plans & Pricing | ✅ | — |
| 5. Billing & Invoicing | ✅ | — |
| 6. Payments | ✅ | — |
| 7. Network Management (RADIUS) | ✅ | — |
| 8. Usage Tracking & FUP | ✅ | — |
| 9. Notifications | ✅ | — |
| 10. Admin Dashboard & Tools | ✅ | — |
| 11. Customer Portal | ✅ | — |
| 12. Reporting & Analytics | ✅ | |
| 13. Security & Compliance | ✅ | — |
| 14. Infrastructure & Deployment | ✅ | Not yet deployed to production |
| 15. API Design | ✅ | — |
| 16. Data Model | ✅ | — |
| 17. Future Roadmap | 🔲 | All items pending |

---

## Detailed Breakdown

### 3. Authentication & Account Management — ✅

- [x] Registration with KYC fields
- [x] Email verification (link, Redis-cached token, 24h expiry)
- [x] Phone verification (6-digit SMS, 15-min expiry)
- [x] Login with JWT (access + refresh tokens)
- [x] Refresh token rotation
- [x] Login attempt tracking (5 failures → 15min lockout)
- [x] Password reset (email link + SMS code)
- [x] JWT secret validation (fails hard in prod)

### 4. Subscription Plans & Pricing — ✅

- [x] Plan CRUD (create, edit, activate/deactivate, delete)
- [x] Prepaid & Postpaid plan types
- [x] Data types (DATA, VOICE, SMS, BUNDLE)
- [x] Speed limits, data allowances, FUP thresholds
- [x] Multi-cycle pricing (PlanPrice model)
- [x] Plan display ordering (sort order, featured)
- [x] Admin plan management page (`/plans`)

### 5. Billing & Invoicing — ✅

- [x] Automated invoice generation (cron at 1AM)
- [x] Invoice structure (subtotal, VAT, tax, total)
- [x] Invoice statuses (DRAFT → PENDING → PAID/OVERDUE/etc)
- [x] Late fee processing (cron at 1:30AM)
- [x] Auto-suspension (cron at 2AM)
- [x] Invoice PDF generation (pdfkit)
- [x] Manual invoice creation
- [x] Invoice detail pages (admin + customer)
- [x] Admin invoice management (`/invoices/management`)

### 6. Payments — ✅

- [x] M-Pesa STK Push integration
- [x] M-Pesa callback validation & processing
- [x] Airtel Money integration
- [x] Airtel callback security (IP allowlist, auth token, idempotency)
- [x] Cash & bank transfer (manual recording)
- [x] Payment statuses & reconciliation
- [x] Balance management (credit/debit)
- [x] Admin balance adjustments
- [x] Payment history pages (admin + customer)

### 7. Network Management (RADIUS) — ✅

- [x] RADIUS authentication (PPPoE + Hotspot)
- [x] RADIUS config per customer (username/password/NAS)
- [x] Session tracking (start/stop, octets, packets)
- [x] CoA implementation (RFC 2865)
- [x] Speed upgrade/downgrade via CoA
- [x] Disconnect via CoA (suspend/terminate)
- [x] Auto-provisioning on payment/subscription events
- [x] Admin network overview page (`/network`)

### 8. Usage Tracking & FUP — ✅

- [x] Usage records from RADIUS accounting
- [x] Fair usage policy (threshold + reduced speed)
- [x] FUP speed reduction via CoA
- [x] Usage reset (cron at midnight)
- [x] Customer usage dashboard
- [x] Usage history page (`/usage`)

### 9. Notifications — ✅

- [x] All 10 notification types implemented
- [x] In-app notifications (database model)
- [x] SMS notifications
- [x] Email notifications
- [x] SSE real-time push (fixed: query param auth, correct path)
- [x] NotificationListener component (frontend, newly added)
- [x] Notification center page (`/notifications`)
- [x] Mark as read / mark all read

### 10. Admin Dashboard & Tools — ✅

- [x] Dashboard with widgets (revenue, customers, overdue, activity feed)
- [x] Customer management (list, search, filter, create, edit)
- [x] Subscription management (list, search, filter, actions)
- [x] Plan management (CRUD, pricing, ordering)
- [x] Invoice management
- [x] Settings (6 sections: Company, Payment, Billing, Branding, Operations, API/RADIUS)
- [x] Audit log viewer
- [x] Admin sidebar navigation
- [x] Settings page (fixed: force-dynamic, data parsing, save format)

### 11. Customer Portal — ✅

- [x] Customer dashboard
- [x] Plan browsing & subscription
- [x] Payment flow (M-Pesa STK push)
- [x] Invoice list + detail + PDF download
- [x] Payment history
- [x] Usage monitoring
- [x] Profile management
- [x] Cancel subscription (with confirmation)
- [x] Email verification page
- [x] Phone verification component
- [x] Reset password page

### 12. Reporting & Analytics — ✅

- [x] Revenue dashboard with charts (daily/monthly/quarterly)
- [x] Recharts integration
- [x] Customer reports (registration trends, churn analysis, geographic distribution, status breakdown)
- [x] Usage reports (bandwidth trends, top users, peak hours, usage by plan)
- [x] Payment reports (collection rate, days-to-payment, method breakdown, revenue vs outstanding)
- [x] CSV export for all report types
- [x] PDF export for all report types
- [x] Date range filters and period toggles
- [x] Reports section in admin sidebar

### 13. Security & Compliance — ✅

- [x] Password hashing (bcrypt)
- [x] JWT with refresh token rotation
- [x] Login attempt limiting
- [x] JWT secret validation
- [x] M-Pesa callback validation
- [x] Airtel callback security (IP allowlist, auth token)
- [x] Idempotent payment processing
- [x] Role-based access (ADMIN, SUPPORT, CUSTOMER)
- [x] Request validation
- [x] Audit logging
- [x] Error handling with request tracing
- [x] Rate limiting (configurable, disabled in dev)
- [x] VAT 16% (Kenya compliance)

### 14. Infrastructure & Deployment — 🚧

- [x] NestJS/Express API
- [x] Next.js 14 frontend (App Router)
- [x] PostgreSQL + Prisma
- [x] Redis (cache, sessions)
- [x] Docker setup for both services
- [x] Swagger/OpenAPI docs
- [x] Health check endpoint
- [x] Cron workers (4 scheduled jobs)
- [x] Seed data (default admin, plans, settings)
- [ ] **Production deployment** — ready, pending George's Dokploy deploy
- [ ] **Production env vars configured** (JWT_SECRET, DB, etc.)
- [ ] **Prisma migrations run in production**

### 15. API Design — ✅

- [x] REST API conventions (JSON, pagination, error structure)
- [x] Bearer token auth
- [x] Request validation via validators
- [x] Swagger documentation (`/api/docs`)
- [x] 39 documented endpoints
- [x] 21 documented schemas

### 16. Data Model — ✅

- [x] All 14 Prisma models implemented
- [x] Proper indexes and relations
- [x] Enums for all status fields
- [x] JSON metadata fields for extensibility

---

## Bug & Fix Log

| Date | Area | Issue | Status |
|------|------|-------|--------|
| 2026-03-17 | Settings | Missing `force-dynamic` on settings page | ✅ Fixed |
| 2026-03-17 | Settings | Data parsing mismatch (nested vs flat) | ✅ Fixed |
| 2026-03-17 | Settings | Save format mismatch (array vs object) | ✅ Fixed |
| 2026-03-17 | Notifications | SSE path mismatch (`/subscribe` vs `/stream/subscribe`) | ✅ Fixed |
| 2026-03-17 | Notifications | SSE auth — EventSource can't send headers | ✅ Fixed (query param) |
| 2026-03-17 | Auth | Email verification never sent on registration | ✅ Fixed |

---

## What's Left (Priority Order)

### 🔴 Must Do Before Production

1. **Deploy to production** — run Prisma migrations, configure env vars, verify services
2. **Production security check** — ensure JWT_SECRET, DB creds, rate limiting all configured
3. **Expand test coverage** — subscription lifecycle, invoice generation, RADIUS provisioning

### 🟡 Should Have Soon

4. **Customer reports** — registration trends, churn analysis, geographic distribution
5. **Usage reports** — bandwidth analytics, top users, peak times
6. **Payment reports** — collection rate, days-to-payment, method breakdown
7. **Report export** — CSV/PDF download for admin reports

### 🟢 Nice to Have

8. **Card payments** — Stripe/Pesapal integration
9. **SMS/USSD** — customer self-service via USSD
10. **Equipment tracking** — physical device management
11. **Support ticket system**
12. **Mobile app** (React Native/Flutter)
13. **Multi-tenancy** — multiple ISPs on one platform

---

*Update this file as work progresses. Check items off, move statuses, and log new bugs as they're found.*
