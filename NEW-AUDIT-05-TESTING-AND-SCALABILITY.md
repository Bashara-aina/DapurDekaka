# NEW AUDIT 05 — Testing, Scalability & Production Readiness
# DapurDekaka.com — Zero Test Coverage, Performance Bottlenecks, Infrastructure Gaps
**Date:** May 2026 | **Scope:** Test suite, database performance, Vercel limits, monitoring, scaling

---

## LEGEND
- ✅ In place and sufficient
- ⚠️ Partially addressed or not verified
- ❌ Not implemented
- 🔴 Will cause production incident under load
- 🟡 Degraded performance at scale
- 🟢 Improvement for long-term health

---

## 1. TESTING — ZERO COVERAGE

### 1.1 No Test Files Exist
**Status:** ❌ 🔴  
**Directory:** `tests/`

The `tests/` directory contains ONLY fixture files:
```
tests/fixtures/mock-cart-items.ts
tests/fixtures/mock-db.ts
tests/fixtures/mock-order.ts
tests/fixtures/mock-user.ts
```

There are **zero `.test.ts` or `.spec.ts` files**. Running `npm run test` will pass immediately with 0 tests, giving false confidence. The `vitest.config.ts` sets coverage thresholds at 70% — but with 0 tests, coverage is 0%.

**Impact:** Any regression in checkout flow, payment processing, or points deduction will not be caught before production.

---

### 1.2 What To Test First (Priority Order)

#### Priority 1 — Checkout & Payment (Business-Critical)

**File to create:** `tests/api/checkout/initiate.test.ts`

```typescript
import { describe, it, expect, beforeEach, vi } from 'vitest';

describe('POST /api/checkout/initiate', () => {
  it('creates order with correct total', async () => {
    // Mock: 2 variants × quantity
    // Assert: subtotal = sum of (price × qty)
  });

  it('validates stock before creating order', async () => {
    // Mock: variant with stock = 0
    // Assert: returns 400 with INSUFFICIENT_STOCK error
  });

  it('applies percentage coupon correctly', async () => {
    // Mock: 10% coupon, subtotal 100k
    // Assert: discountAmount = 10000
  });

  it('applies fixed coupon correctly', async () => {
    // Mock: 20k fixed coupon, subtotal 100k
    // Assert: discountAmount = 20000, not more than subtotal
  });

  it('applies free_shipping coupon correctly', async () => {
    // Mock: free_shipping coupon
    // Assert: shippingCost = 0 in Midtrans item_details
  });

  it('deducts points FIFO from oldest earn records', async () => {
    // Mock: 3 earn records (oldest 200pts, middle 300pts, newest 500pts)
    // Redeem 250 pts
    // Assert: oldest 200 fully consumed, middle 50 consumed, newest untouched
  });

  it('does not allow points redemption exceeding 50% of subtotal', async () => {
    // Mock: subtotal 100k, user requests 60k points redemption
    // Assert: capped at 50k
  });

  it('creates order_status_history for initial pending_payment status', async () => {
    // Assert: status_history row exists with toStatus='pending_payment' after initiate
  });
  
  it('handles idempotent re-submission within 5 min', async () => {
    // Mock: existing pending order from same user, created 2 min ago
    // Assert: returns existing snapToken, no second order created
  });
});
```

---

#### Priority 2 — Midtrans Webhook (Revenue-Critical)

**File to create:** `tests/api/webhooks/midtrans.test.ts`

```typescript
describe('POST /api/webhooks/midtrans', () => {
  it('rejects webhook with invalid signature', async () => {
    // Assert: returns 403, does not update order
  });

  it('marks order as paid on settlement', async () => {
    // Mock: valid settlement webhook
    // Assert: order.status = 'paid', order.paidAt set
  });

  it('deducts stock on settlement', async () => {
    // Mock: order with 2 items (variantA qty 3, variantB qty 1)
    // Assert: variantA.stock -= 3, variantB.stock -= 1
  });

  it('is idempotent for duplicate settlement webhooks', async () => {
    // Mock: order already 'paid', second settlement webhook
    // Assert: stock deducted only once, points awarded only once
  });

  it('awards points on settlement (1pt per 1000 IDR)', async () => {
    // Mock: subtotal = 150000
    // Assert: user.pointsBalance += 150
  });

  it('awards double points for B2B users', async () => {
    // Mock: B2B user, subtotal = 100000
    // Assert: user.pointsBalance += 200 (2x)
  });

  it('reverses points on cancellation', async () => {
    // Mock: order with 200 pts used, then cancel webhook
    // Assert: consumed earn records set consumedAt = null, balance restored
  });

  it('decrements coupon used_count on cancellation', async () => {
    // Mock: coupon usedCount = 5, cancel webhook
    // Assert: usedCount = 4
  });

  it('handles stock already at zero gracefully', async () => {
    // Mock: two concurrent settlements, last unit already gone
    // Assert: no negative stock, oversell event logged
  });
});
```

---

#### Priority 3 — Points & Coupon Validation

**File to create:** `tests/api/coupons/validate.test.ts`

```typescript
describe('POST /api/coupons/validate', () => {
  it('rejects expired coupon', () => {});
  it('rejects inactive coupon', () => {});
  it('rejects coupon below min_order', () => {});
  it('rejects coupon at max global uses', () => {});
  it('rejects coupon at max per-user uses', () => {});
  it('accepts valid percentage coupon and calculates discount', () => {});
  it('caps percentage discount at maxDiscountAmount', () => {});
});
```

---

#### Priority 4 — Auth & Registration

**File to create:** `tests/api/auth/register.test.ts`

```typescript
describe('POST /api/auth/register', () => {
  it('creates user with hashed password', () => {});
  it('rejects duplicate email', () => {});
  it('rejects weak password (< 8 chars)', () => {});
  it('rejects invalid phone format', () => {});
  it('creates user with role = customer', () => {});
});
```

---

### 1.3 Integration Test Setup Needed

The `mock-db.ts` fixture exists but needs to be wired to Vitest. Use **Drizzle + an in-memory SQLite** for integration tests or mock the DB adapter:

```typescript
// tests/setup.ts
import { vi } from 'vitest';
vi.mock('@/lib/db', () => ({ db: createMockDb() }));
```

Or use Neon's branching feature for isolated test databases:
```bash
# .env.test
DATABASE_URL=postgresql://user:password@test-branch.neon.tech/dapurdekaka
```

---

## 2. DATABASE PERFORMANCE

### 2.1 N+1 Query — Admin Dashboard
**Status:** ⚠️ 🟡  
**File:** `app/api/admin/dashboard/live-feed/route.ts`

If the live feed fetches recent orders and then fetches `order_items` for each order in separate queries, this is an N+1 pattern. For 20 recent orders this is 21 DB round-trips.

**Fix:** Use Drizzle's `with` (eager loading) to fetch items alongside orders:
```typescript
const recentOrders = await db.query.orders.findMany({
  limit: 10,
  with: {
    items: { with: { variant: { with: { product: { columns: { nameId: true } } } } } }
  },
  orderBy: [desc(orders.createdAt)],
});
```

---

### 2.2 Missing Index — `coupon_usages` Per-User Lookup
**Status:** ⚠️ 🟡  
**File:** `lib/db/schema.ts`

The coupon validation does:
```sql
SELECT COUNT(*) FROM coupon_usages WHERE couponId = ? AND userId = ?
```

No composite index exists on `(coupon_id, user_id)`. At scale with thousands of coupon usages, this becomes a full table scan.

**Fix — Add migration:**
```sql
CREATE INDEX idx_coupon_usages_coupon_user ON coupon_usages(coupon_id, user_id);
```

---

### 2.3 Missing Index — `order_status_history` by Order
**Status:** ⚠️ 🟡  

The order timeline component fetches `order_status_history WHERE orderId = ?`. No index on `order_id`.

**Fix:**
```sql
CREATE INDEX idx_order_status_history_order_id ON order_status_history(order_id);
```

---

### 2.4 Missing Index — `admin_activity_logs` by Entity
**Status:** ⚠️ 🟢  

Admin audit log queries by `entityType + entityId` for per-order or per-product audit trails. No composite index.

**Fix:**
```sql
CREATE INDEX idx_admin_activity_entity ON admin_activity_logs(entity_type, entity_id);
```

---

### 2.5 Missing Index — `b2b_inquiries` by Status
**Status:** ⚠️ 🟢  

Admin B2B inquiry inbox filters by `status = 'new'`. No index on `status`.

---

### 2.6 Neon Serverless — HTTP vs WebSocket Driver
**Status:** ⚠️ 🟡  
**File:** `lib/db/index.ts`

Using `@neondatabase/serverless` with the HTTP driver (neon-http). This is correct for Vercel serverless. However, Drizzle transactions (`db.transaction()`) require the WebSocket driver (`neon-ws`) for true serializable isolation on Neon.

**Verify:** Does `app/api/checkout/initiate/route.ts` call `db.transaction()`? If so, and you're using the HTTP driver, the "transaction" may not be truly atomic — Neon HTTP driver doesn't support multi-statement transactions.

**Fix if needed:** Use `neon-ws` for transaction-heavy routes:
```typescript
// lib/db/index.ts
import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;
const pool = new Pool({ connectionString: process.env.DATABASE_URL });
export const db = drizzle(pool, { schema });
```

This is critical for checkout and webhook handlers where partial failures must rollback.

---

## 3. VERCEL LIMITS & SERVERLESS CONSTRAINTS

### 3.1 Function Timeout — Checkout & Webhook
**Status:** ✅  
**File:** `vercel.json`

`maxDuration: 30` is set for:
- `app/api/webhooks/midtrans/route.ts` ✅
- `app/api/checkout/initiate/route.ts` ✅

The default is 10 seconds. The 30-second cap is correct for these endpoints which call Midtrans + Resend.

**Recommendation:** Also add 30-second duration for:
- `app/api/admin/export/orders/route.ts` (large exports)
- `app/api/ai/caption/route.ts` (AI response can be slow)

---

### 3.2 Image Optimization — `sharp` Memory Usage
**Status:** ⚠️ 🟢  

`sharp` is installed for Next.js image optimization. On Vercel Pro, image optimization is serverless and memory-bound. Large product images (>2MB) can exceed the 256MB default Lambda memory. Ensure Cloudinary images are pre-optimized before storage (use Cloudinary transformation URLs, not raw uploads).

---

### 3.3 Cold Start Latency — Neon DB Connection
**Status:** ⚠️ 🟡  

Neon serverless HTTP connections are stateless — each cold-start Lambda re-establishes its connection. For checkout flow, the sequence is:
1. Cold start (~200ms)
2. DNS + TLS to Neon (~150ms)
3. Query execution (~50ms)
4. Midtrans API call (~300ms)
5. Resend email (~200ms)

Total: ~900ms minimum on cold start. Warm starts are ~200ms. This is acceptable but should be monitored.

**Mitigation:** Add Next.js `export const dynamic = 'force-dynamic'` to checkout routes and ensure DB queries are batched (not serial).

---

### 3.4 Rate Limiter — Production Replacement
**Status:** ❌ 🔴 (Repeat from Security Audit — action required)

In-memory rate limiting is non-functional on Vercel. Must be replaced with Upstash Redis before production launch. (See Audit 03, Section 1.1 for full fix.)

---

## 4. MONITORING & OBSERVABILITY

### 4.1 Error Tracking — No Sentry or Similar
**Status:** ❌ 🟡  

`console.error()` is used throughout the codebase but no structured error tracking service is configured. In production, errors will only appear in Vercel function logs, which:
- Are not alertable
- Are not searchable across time
- Have no grouping or de-duplication
- Are deleted after 1–7 days

**Fix:** Add Sentry (free tier is sufficient):
```bash
npm install @sentry/nextjs
npx @sentry/wizard@latest -i nextjs
```

At minimum, track:
- Midtrans webhook errors (payment processing failures)
- Checkout initiate errors
- Email send failures
- DB query errors

---

### 4.2 Structured Logging
**Status:** ⚠️ 🟢  
**File:** `lib/utils/logger.ts`

A logger utility exists. Verify it outputs structured JSON (not just `console.log`) so Vercel log drains and external tools (Axiom, Logtail) can parse and query logs. If it's just a `console.log` wrapper, it's not structured.

**Fix:**
```typescript
// lib/utils/logger.ts
export const logger = {
  info: (msg: string, data?: object) => console.log(JSON.stringify({ level: 'info', msg, ...data, ts: Date.now() })),
  error: (msg: string, error?: unknown, data?: object) => console.error(JSON.stringify({ level: 'error', msg, error: String(error), ...data, ts: Date.now() })),
};
```

---

### 4.3 Health Check — Integration Pings
**Status:** ⚠️ 🟢  
**File:** `app/api/health/route.ts`

Health check endpoint exists. Verify it actively tests:
- DB connection (SELECT 1)
- Not just a static `{ status: 'ok' }` response

A health check that doesn't test the DB will pass even when the database is down.

---

### 4.4 Payment Reconciliation — No Automated Check
**Status:** ❌ 🟡  

There is no automated daily reconciliation between:
- Orders with status `paid` in local DB
- Midtrans transaction status for the same `midtransOrderId`

Discrepancies can occur from late webhooks, webhook delivery failures, or the cron-vs-webhook race condition (see Audit 02, Section 7.3).

**Fix:** Create `app/api/cron/reconcile-payments/route.ts` that:
1. Finds orders with `status = 'pending_payment'` older than 30 minutes
2. Queries Midtrans status API for each
3. If Midtrans says `settlement` but local is `pending_payment`: triggers payment confirmation
4. If Midtrans says `cancel` but local is `pending_payment`: cancels order
5. Logs all reconciliations to `admin_activity_logs`

---

## 5. SCALABILITY AT 1000+ ORDERS/MONTH

### 5.1 Admin Orders Page — Full Table Scan Risk
**Status:** ⚠️ 🟡  

At 1000 orders/month, the orders table will have 12,000+ rows per year. Any admin query without proper WHERE + LIMIT + index will become slow:
- `GET /api/admin/orders?status=paid` — uses `idx_orders_status` ✅
- `GET /api/admin/orders?search=DDK-20260512` — searches `orderNumber` LIKE — verify index on `order_number`
- Date range queries — verify `created_at` index

**Verify:** Add `CREATE INDEX idx_orders_order_number ON orders(order_number)` if not present in schema.

---

### 5.2 Points History — Unbounded Growth
**Status:** ⚠️ 🟢  

Each order generates 2 `points_history` rows (earn + redeem). Each coupon use generates 1 coupon_usage. For 12,000 orders/year, that's 24,000+ rows in `points_history`. This is manageable but the `account/points` endpoint should paginate (currently hardcoded to 50 records).

---

### 5.3 Admin Activity Logs — No Retention Policy
**Status:** ⚠️ 🟢  

`admin_activity_logs` stores every admin action including `before_state` and `after_state` as JSONB. For 500 admin actions/month, this grows to 6,000 rows/year with large JSONB payloads. Implement a retention policy: delete logs older than 365 days.

**Add to cron jobs:**
```typescript
// api/cron/cleanup-audit-logs/route.ts
await db.delete(adminActivityLogs)
  .where(lt(adminActivityLogs.createdAt, new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)));
```

---

### 5.4 `order_daily_counters` — Cleanup Old Dates
**Status:** ⚠️ 🟢  

`order_daily_counters` accumulates one row per calendar day forever. After 1 year, 365 rows exist. While negligible, add a cron to delete rows older than 90 days.

---

## 6. BUILD & DEPLOYMENT

### 6.1 TypeScript Strict Mode
**Status:** ⚠️ 🟡  
**File:** `tsconfig.json`

Verify `"strict": true` is enabled in `tsconfig.json`. Without strict mode, TypeScript allows many implicit `any` types, nullability bypasses, and unsafe property accesses that would otherwise be caught at build time.

```json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true
  }
}
```

---

### 6.2 `next.config.ts` — Two Config Files
**Status:** ⚠️ 🟡  

There are **two Next.js config files**:
- `next.config.ts` (TypeScript)
- `next.config.js` (JavaScript)

Next.js uses only one. Verify which one is active (usually `next.config.js` takes precedence over `next.config.ts` in Next.js 14). If `next.config.ts` has security headers and `next.config.js` is empty, the security headers are silently dropped.

**Fix:** Delete the empty/outdated one. Keep only `next.config.ts`.

---

### 6.3 Build — TypeScript Errors in Production
**Status:** ⚠️ 🟡  

Run `npm run type-check` and fix all TypeScript errors before production. The `@ts-expect-error` in `lib/auth/index.ts` and the `(session.user as { role?: string })` casts across 20+ routes indicate accumulated type debt that can hide real bugs.

---

### 6.4 ESLint — Verify No Disabled Rules
**Status:** ⚠️ 🟢  

Check if any routes have `// eslint-disable-next-line` or `/* eslint-disable */` comments that hide issues:
```bash
grep -r "eslint-disable" app/ lib/ --include="*.ts" --include="*.tsx"
```

---

## 7. DATA BACKUP & RECOVERY

### 7.1 Neon Database Backups
**Status:** ⚠️ 🟡  

Neon free tier provides point-in-time recovery for 7 days on the Pro plan. Verify:
1. What Neon plan is being used (Free vs Pro)?
2. Is backup recovery tested (can you actually restore from a backup)?
3. Are database exports part of the weekly operations runbook?

Neon Free tier has NO automated backups. If on Free tier, implement weekly exports:
```bash
# Add to operations runbook:
pg_dump $DATABASE_URL_UNPOOLED > backup_$(date +%Y%m%d).sql
```

---

### 7.2 Critical Data — No Soft-Delete on Orders
**Status:** ⚠️ 🟢  
**File:** `lib/db/schema.ts`

`orders` table has no `deletedAt` column. If an admin accidentally deletes an order row (there is no delete API, but direct DB access could), the record is permanently gone. All order-related data (items, status history, points awarded) would become orphaned. Consider adding `deletedAt` to orders for safety.

---

## 8. PERFORMANCE — LIGHTHOUSE TARGETS

### 8.1 Target Metrics (PRD Section 1.5)
**PRD Goal:** "Website loads under 3 seconds on mobile (3G connection)"

Key optimizations to verify:

| Optimization | File | Status |
|-------------|------|--------|
| Next.js Image component | All product images | ✅ installed |
| `priority` on above-fold images | `HeroCarousel.tsx` | ⚠️ Verify |
| Font `display: swap` | `app/layout.tsx` | ✅ set in font config |
| Dynamic imports for Midtrans Snap | `MidtransPayment.tsx` | ✅ `ssr: false` |
| Dynamic imports for Recharts | Dashboard pages | ⚠️ Verify |
| `loading="lazy"` below-fold images | Product catalog | ⚠️ Verify |
| Static generation for product pages | `products/[slug]/page.tsx` | ⚠️ Should use `generateStaticParams` |

---

### 8.2 Static Generation for Product Pages
**Status:** ⚠️ 🟡  

Product pages (`/products/[slug]`) should use `generateStaticParams()` to pre-render at build time:
```typescript
export async function generateStaticParams() {
  const products = await db.query.products.findMany({
    columns: { slug: true },
    where: eq(products.isActive, true),
  });
  return products.map(p => ({ slug: p.slug }));
}

export const revalidate = 3600; // Revalidate every hour
```

Without this, every product page is server-rendered on demand, adding DB latency to every page view.

---

## SUMMARY — ACTIONS BY PRIORITY

### Immediate (Before Launch)
| Item | File | Time |
|------|------|------|
| Write checkout + webhook tests | `tests/api/checkout/*.test.ts` | 4 hrs |
| Replace in-memory rate limiter | `lib/utils/rate-limit.ts` | 2 hrs |
| Fix two next.config files | Delete `next.config.js` | 15 min |
| Verify Neon transaction driver | `lib/db/index.ts` | 1 hr |
| Add Sentry error tracking | `sentry.*.config.ts` | 1 hr |

### First Week Post-Launch
| Item | File | Time |
|------|------|------|
| Add missing DB indexes | New migration file | 1 hr |
| Add static generation for products | `products/[slug]/page.tsx` | 1 hr |
| Add payment reconciliation cron | `api/cron/reconcile-payments/route.ts` | 3 hrs |
| Structured logging setup | `lib/utils/logger.ts` | 1 hr |

### First Month
| Item | File | Time |
|------|------|------|
| Full test coverage (target 70%) | `tests/**/*.test.ts` | 8 hrs |
| Audit log retention cron | `api/cron/cleanup-audit-logs/route.ts` | 1 hr |
| Verify TypeScript strict mode | `tsconfig.json` | 2 hrs |
| Load test checkout flow | k6 or similar | 2 hrs |
