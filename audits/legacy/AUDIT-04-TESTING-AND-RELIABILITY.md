# AUDIT 04 — TESTING AND RELIABILITY
DapurDekaka.com — Testing Coverage, Error Handling, and Operational Reliability Audit
Date: May 2026 | Auditor: Claude Code | Scope: Unit Tests, Integration Tests, Error Handling, Logging, Dead Code

---

## LEGEND

```
✅ Implemented & correct
⚠️ Partially implemented or has a bug
❌ Not implemented (stub / placeholder)
🔴 Critical — blocks real usage
🟡 Major — significant UX or business impact
🟢 Minor — nice-to-have improvement
```

---

## SECTION 1 — TESTING COVERAGE

### 1.1 Unit Test Gaps 🔴

**Finding:** Zero test files exist in the codebase. No `*.test.ts`, `*.spec.ts`, or any test directory.

```bash
$ find . -name "*.test.ts" -o -name "*.spec.ts" 2>/dev/null
# → No files found
```

**Critical business logic with ZERO unit tests:**

| Function | File | Risk if broken |
|---|---|---|
| `generateOrderNumber()` | `lib/utils/generate-order-number.ts:8` | Duplicate order numbers, payment failures |
| `getMidtransOrderId()` | `lib/utils/generate-order-number.ts:19` | Midtrans payment mismatch |
| `formatIDR()` | `lib/utils/format-currency.ts:5` | Price display corruption |
| `formatWIB()` | `lib/utils/format-date.ts:9` | Incorrect date display |
| Coupon validation logic | `app/api/coupons/validate/route.ts:39–70` | Incorrect discounts, over-redemption |
| Points calculation (2x B2B) | `app/api/webhooks/midtrans/route.ts:124` | Incorrect points awards |
| Stock deduction (`GREATEST`) | `app/api/webhooks/midtrans/route.ts:86` | Negative stock, overselling |
| `checkRateLimit()` | `lib/utils/rate-limit.ts:37` | Rate limit bypass |

**Severity:** 🔴 All of these are financial or security-critical. No safety net.

**Fix required — example test for `generateOrderNumber`:**

```typescript
// __tests__/generate-order-number.test.ts
import { describe, it, expect } from 'vitest';
import { generateOrderNumber } from '@/lib/utils/generate-order-number';

describe('generateOrderNumber', () => {
  it('formats with DDK prefix and 4-digit sequence', () => {
    const result = generateOrderNumber(47);
    expect(result).toMatch(/^DDK-\d{8}-0047$/);
  });

  it('pads sequences under 1000 with leading zeros', () => {
    expect(generateOrderNumber(1)).toBe('DDK-20260514-0001');
    expect(generateOrderNumber(999)).toBe('DDK-20260514-0999');
  });
});
```

### 1.2 Integration / E2E Test Gaps 🔴

**Finding:** No Playwright, Cypress, or any E2E test setup. No test infrastructure whatsoever.

**Critical flows not tested:**
1. **Checkout flow:** `cart → checkout/initiate → Midtrans Snap → webhook → confirmation`
   - No test for payment retry logic (`/api/checkout/retry`)
   - No test for webhook idempotency (double settlement protection)
2. **Coupon flow:** validate → apply → initiate → webhook settlement → points awarded
3. **Order cancellation flow:** cron → Midtrans check → cancel → stock restore → points reverse

**Required test coverage for financial flows:**
- Payment settlement must NEVER double-award points
- Stock must NEVER go negative
- Coupon used_count must be accurate
- Points expiration must calculate correctly

### 1.3 Coverage Tool Configuration 🟡

**Finding:** No coverage tool configured. `package.json` has no `vitest`, `jest`, or coverage script.

```json
// package.json devDependencies — missing:
"@vitest/coverage-v8": "^2.0.0",
"vitest": "^2.0.0",
```

**Recommendation:** Install Vitest, configure `coverage.providers: ['v8']`, set threshold at 70% for critical paths (checkout, webhook, points).

### 1.4 Test Fixtures 🟡

**Finding:** No shared test fixtures. All test data is inline magic values.

**Impact:** Tests will duplicate complex setup (mock DB responses, order objects, variant objects), making them brittle and hard to maintain.

**Recommendation:** Create `tests/fixtures/` with:
- `mock-order.ts` — standard order with items
- `mock-cart-items.ts` — valid cart items
- `mock-user.ts` — user with/without B2B role
- `mock-db.ts` — Jest/Drizzle mock helper

---

## SECTION 2 — ERROR HANDLING

### 2.1 Try/Catch Coverage ⚠️

**Good news:** 61 of ~120 API routes use `try/catch`. The core financial routes (`checkout/initiate`, `webhooks/midtrans`, `coupons/validate`) all have proper try/catch with `serverError()` fallback.

**Routes missing try/catch entirely:**

```
app/api/admin/field/orders/[id]/route.ts — PATCH handler has no try/catch
app/api/admin/field/tracking-queue/route.ts — GET has no try/catch
app/api/admin/field/inventory/route.ts — GET has no try/catch
app/api/admin/field/inventory/adjust/route.ts — POST has no try/catch
app/api/admin/field/inventory/restock/route.ts — POST has no try/catch
app/api/admin/field/pickup-queue/route.ts — GET has no try/catch
app/api/admin/field/packing-queue/route.ts — GET has no try/catch
app/api/admin/field/worker-activity/route.ts — GET has no try/catch
app/api/admin/field/today-summary/route.ts — GET has no try/catch
app/api/orders/[orderNumber]/receipt/route.ts — GET has no try/catch
```

**Example — missing try/catch at `app/api/admin/field/orders/[id]/route.ts:42`:**

```typescript
// PATCH handler — no try/catch wrapping DB operations
export async function PATCH(req: NextRequest, { params }: { params: Promise<...> }) {
  const { id } = await params;
  const body = await req.json();
  // ❌ No try/catch — if DB fails, raw 500 from Next.js
  await db.update(orders).set({ ... }).where(eq(orders.id, id));
  return success({ updated: true });
}
```

**Fix:**

```typescript
export async function PATCH(req: NextRequest, { params }: { params: Promise<...> }) {
  try {
    const { id } = await params;
    const body = await req.json();
    await db.update(orders).set({ ... }).where(eq(orders.id, id));
    return success({ updated: true });
  } catch (error) {
    console.error('[Admin/Field/Orders PATCH]', error);
    return serverError(error);
  }
}
```

### 2.2 Error Response Consistency ⚠️

**Finding:** Most routes return `{ success: false, error: string, code: string }` but many manually construct `NextResponse.json(...)` instead of using helpers from `@/lib/utils/api-response`.

**Routes using manual NextResponse instead of api-response helpers:**

| File | Line | Issue |
|---|---|---|
| `app/api/admin/carousel/route.ts` | 11–14, 17–20, 30–33 | Manual `NextResponse.json` with `{ success, error, code }` pattern — consistent but not using helper |
| `app/api/admin/carousel/[id]/route.ts` | Multiple | Same as above |
| `app/api/ai/caption/route.ts` | 10–13, 16–19, 47–49 | Manual raw NextResponse |
| `app/api/admin/coupons/[id]/route.ts` | Multiple | Manual construction |

**The api-response helpers exist but are inconsistently imported.** Of 120 route files, only ~54 import from `@/lib/utils/api-response`. The rest manually construct responses.

**Severity:** 🟡 — The responses are consistent in format, but manual construction is error-prone and harder to maintain. If the error format needs to change (e.g., add `requestId`), every manual site must be updated.

### 2.3 Stack Trace Exposure ✅→🟡

**Finding:** Routes using `serverError()` from api-response are safe — they log full error server-side but return only `"Internal server error"` to client.

```typescript
// lib/utils/api-response.ts:59–65 — SAFE
export function serverError(error: unknown) {
  console.error('[API Error]', error);  // Full stack logged server-side
  return NextResponse.json(
    { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}
```

**Routes manually handling errors without `serverError()` may expose details if they return `error.message` directly.** Quick scan shows most manual error handlers also return generic messages, but no systematic enforcement.

**Recommendation:** Enforce via ESLint rule — no raw `error` or `error.message` in client-facing responses.

### 2.4 404 Handling 🟡

**Finding:** Store has `app/(store)/error.tsx` with user-friendly Indonesian message ("Ups, ada yang tidak beres"). Admin route groups have targeted error pages (`admin/team-dashboard/error.tsx`, `admin/field/error.tsx`).

**Missing error.tsx pages:**
- `app/error.tsx` (root) — no fallback for unhandled errors
- `app/(admin)/error.tsx` — admin layout group has no error boundary
- `app/(b2b)/error.tsx` — b2b layout group has no error boundary

**Current store error.tsx (`app/(store)/error.tsx:5–13`):**

```typescript
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <EmptyState
      variant="error"
      title="Ups, ada yang tidak beres"
      description="Tim kami sedang memperbaikinya. Coba lagi sebentar ya!"
      action={{ label: '🔄 Coba Lagi', onClick: reset }}
    />
  );
}
```

**Gap:** The `error.tsx` inside `(store)` only covers the store route group. If an error occurs in a shared component or at a higher boundary, it falls through to Next.js default.

### 2.5 500 Handling 🟡

**Missing custom error.tsx pages:**
- `app/error.tsx` — NOT PRESENT (root, all unhandled errors)
- `app/(admin)/error.tsx` — NOT PRESENT
- `app/(b2b)/error.tsx` — NOT PRESENT

**Present:**
- `app/(store)/error.tsx` ✅
- `app/(admin)/admin/team-dashboard/error.tsx` ✅
- `app/(admin)/admin/field/error.tsx` ✅

**Impact:** Unhandled errors in non-store routes (admin, b2b, API) will show generic Next.js error page or raw stack in development.

---

## SECTION 3 — OPERATIONAL RELIABILITY

### 3.1 Health Check Endpoint 🔴

**Finding:** No `/api/health` endpoint exists.

**What's needed:** A health check that verifies:
1. Database connectivity (Neon PostgreSQL)
2. Environment variables are loaded
3. Critical service status (Midtrans, RajaOngkir connectivity)

**Without this:** No way to distinguish between "app is up but DB is down" vs "app is down" in monitoring. Kubernetes/load balancer health checks have no endpoint to query.

**Required implementation:**

```typescript
// app/api/health/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';

export async function GET(req: NextRequest) {
  const checks = {
    database: { status: 'unknown' as 'ok' | 'error', latency: null as number | null },
    timestamp: new Date().toISOString(),
  };

  try {
    const start = Date.now();
    await db.query.users.findFirst({ columns: { id: true }, limit: 1 });
    checks.database = { status: 'ok', latency: Date.now() - start };
  } catch (error) {
    checks.database = { status: 'error', latency: null };
    return NextResponse.json({ status: 'unhealthy', checks }, { status: 503 });
  }

  return NextResponse.json({ status: 'healthy', checks }, { status: 200 });
}
```

### 3.2 Logging Strategy 🟡

**Finding:** `console.log` is used in production code for several cron jobs and the Midtrans webhook. While the messages are structured and include context (order numbers, user IDs), `console.log` is not a proper logger.

**Files with `console.log` in production code:**

```
app/api/cron/expire-points/route.ts — lines 96, 106
app/api/cron/cancel-expired-orders/route.ts — lines 51, 129, 137
app/api/cron/points-expiry-warning/route.ts — lines 24, 27
app/api/b2b/inquiry/route.ts — lines 111
app/api/webhooks/midtrans/route.ts — line 171, 264
```

**All are for CRON jobs or webhooks** — server-side operations where `console.log` is somewhat acceptable, but not ideal:
- No log levels (ERROR, WARN, INFO, DEBUG)
- No structured metadata (JSON objects are harder to parse than a proper logger)
- No log rotation or retention policy
- Cannot easily suppress in tests

**The rule says:** `console.log` in production code → use a proper logger.

**Recommendation:** Replace with a simple logger utility or install `pino` / `winston`. At minimum, create:

```typescript
// lib/utils/logger.ts
const LOG = (level: 'info' | 'warn' | 'error', ctx: string, data: Record<string, unknown>) => {
  console.log(JSON.stringify({ level, ctx, timestamp: new Date().toISOString(), ...data }));
};
```

### 3.3 Dead Code 🟢

**Finding:** Minimal dead code found. No `TODO`, `FIXME`, or placeholder stubs in production code.

**One note:** `app/api/b2b/inquiry/route.ts` uses `TODO` comment only as a code organization marker (not a stub):

```typescript
// app/api/b2b/inquiry/route.ts:22
// Validates input...
```

Only one file shows a placeholder pattern: `.claude/worktrees/focused-ride-1caafe/app/api/b2b/inquiry/route.ts` — which is in a worktree (ignored).

**Overall:** Clean codebase on dead code front.

### 3.4 Env Var Validation 🟡

**Finding:** No startup validation of required environment variables. The app starts even if critical vars are missing — failures happen at first use with obscure errors.

**Critical env vars that should be validated on startup:**
- `DATABASE_URL` — without this, all DB operations fail
- `AUTH_SECRET` — without this, NextAuth fails
- `MIDTRANS_SERVER_KEY` — without this, payments fail
- `RAJAONGKIR_API_KEY` — without this, shipping rates fail

**Middleware reads `process.env` directly without checking:**

```typescript
// app/middleware.ts:7 — no env validation
const session = await auth(); // Will fail with cryptic error if AUTH_SECRET missing
```

**Recommendation:** Add startup validation in a singleton that runs on first API route hit:

```typescript
// lib/config/validate-env.ts
const REQUIRED = ['DATABASE_URL', 'AUTH_SECRET', 'MIDTRANS_SERVER_KEY', 'RAJAONGKIR_API_KEY'] as const;

export function validateEnv() {
  const missing = REQUIRED.filter(k => !process.env[k]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(', ')}`);
  }
}

// Call once in a global:
if (process.env.NODE_ENV !== 'test') {
  validateEnv();
}
```

### 3.5 Build Warnings ✅

**Finding:** `npm run type-check` passes with zero TypeScript errors. `npm run lint` passes with zero ESLint errors.

```bash
$ npm run type-check
✔ No TypeScript errors

$ npm run lint
✔ No ESLint warnings or errors
```

**Note:** This was run on the current state of the workspace. If staged changes (from git status) are applied, re-run before deployment.

---

## SECTION 4 — CRITICAL GAP SUMMARY

| # | Finding | Severity | File(s) | Fix Effort |
|---|---|---|---|---|
| 1 | Zero unit tests | 🔴 | All critical business logic | High — needs full test suite |
| 2 | Zero E2E / integration tests | 🔴 | Checkout, webhook, cron flows | High — needs Playwright setup |
| 3 | No health check endpoint | 🔴 | Missing `app/api/health/route.ts` | Low — simple fix |
| 4 | 10+ API routes without try/catch | 🟡 | Field worker routes | Medium — wrap each handler |
| 5 | Inconsistent api-response helper usage | 🟡 | 66 routes manually construct | Medium — migrate to helpers |
| 6 | Missing error.tsx in 3 route groups | 🟡 | Root, admin, b2b | Low — create 3 files |
| 7 | No coverage tool configured | 🟡 | package.json | Low — install vitest |
| 8 | console.log in production cron jobs | 🟡 | 5 cron/webhook files | Low — replace with logger |
| 9 | No env var validation on startup | 🟡 | lib/config | Low — add validation |
| 10 | No test fixtures | 🟡 | tests/fixtures/ | Medium — create shared fixtures |

---

## SECTION 5 — PRIORITY REMEDIATION PLAN

### Immediate (before any payment load)

1. **`app/api/health/route.ts`** — 30 lines, blocks monitoring/deployment
2. **`app/error.tsx`**, **`(admin)/error.tsx`**, **`(b2b)/error.tsx`** — 15 lines each, prevents raw error exposure
3. **Fix try/catch gaps** in `app/api/admin/field/*` routes — these handle warehouse operations

### Short-term (this week)

4. **Install Vitest + coverage config** — 2 hours setup, enables unit testing
5. **Write first unit tests** for: `generateOrderNumber`, `formatIDR`, coupon validation logic
6. **Write integration test** for checkout flow: initiate → webhook → confirm points awarded

### Medium-term (before launch)

7. **Migrate all manual NextResponse error construction** to `api-response` helpers
8. **Create test fixtures** directory
9. **Replace console.log** in cron/webhook files with structured logger
10. **Add env var startup validation**

---

## APPENDIX A — FILES AUDITED

**API Routes (sampled):**
- `app/api/checkout/initiate/route.ts` ✅ try/catch + api-response
- `app/api/webhooks/midtrans/route.ts` ✅ try/catch + api-response
- `app/api/coupons/validate/route.ts` ✅ try/catch + api-response
- `app/api/orders/[orderNumber]/route.ts` ✅ try/catch + api-response
- `app/api/cron/expire-points/route.ts` ✅ try/catch + console.log (cron acceptable)
- `app/api/cron/cancel-expired-orders/route.ts` ✅ try/catch + console.log
- `app/api/b2b/inquiry/route.ts` ✅ try/catch + console.log
- `app/api/shipping/cost/route.ts` ⚠️ try/catch but manual NextResponse
- `app/api/admin/carousel/route.ts` ⚠️ try/catch but manual NextResponse
- `app/api/ai/caption/route.ts` ⚠️ try/catch but manual NextResponse
- `app/api/admin/field/orders/[id]/route.ts` ❌ PATCH without try/catch
- `app/api/admin/field/inventory/route.ts` ❌ GET without try/catch

**Utilities:**
- `lib/utils/api-response.ts` ✅ — good helpers, used inconsistently
- `lib/utils/format-currency.ts` ✅ — no tests
- `lib/utils/format-date.ts` ✅ — no tests
- `lib/utils/generate-order-number.ts` ✅ — no tests
- `lib/utils/rate-limit.ts` ✅ — no tests

**Error pages:**
- `app/(store)/error.tsx` ✅ present
- `app/(admin)/admin/team-dashboard/error.tsx` ✅ present
- `app/(admin)/admin/field/error.tsx` ✅ present
- `app/error.tsx` ❌ missing
- `app/(admin)/error.tsx` ❌ missing
- `app/(b2b)/error.tsx` ❌ missing

---

## APPENDIX B — TEST COVERAGE TARGET

Suggested coverage thresholds once Vitest is configured:

```
lib/utils/**: 80% (critical math/formatters)
lib/services/midtrans/**: 90% (payment correctness)
app/api/checkout/**: 90%
app/api/webhooks/**: 90%
app/api/coupons/**: 80%
lib/utils/rate-limit.ts: 80%
```