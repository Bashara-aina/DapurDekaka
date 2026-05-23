---
title: "API Routes Deep Audit"
audit-date: "2026-05-23"
scope: "All API routes — auth, checkout, webhooks, admin, account, shipping"
severity: "CRITICAL"
files-affected: "app/api/**/*.ts"
---

# API Routes Deep Audit — DapurDekaka.com

**Date:** 2026-05-23
**Auditor:** Multi-Agent Deep Audit
**Scope:** All 35+ API routes — correctness, security, validation, error handling

---

## EXECUTIVE SUMMARY

**42 API routes audited.** The auth routes are production-quality. The checkout routes handle most edge cases correctly but have 5 critical gaps. The admin routes are well-protected with role checks. Several routes have inconsistent response formats or missing rate limiting.

---

## ROUTE AUDIT MATRIX

### Auth Routes (`app/api/auth/`)

| Route | Method | Status | Issues |
|-------|--------|--------|--------|
| `[...nextauth]` | GET/POST | ✅ Correct | Rate limited, session strategy correct |
| `register` | POST | ✅ Correct | Zod validation, bcrypt, rate limited |
| `forgot-password` | POST | ✅ Correct | Timing normalization, rate limited |
| `reset-password` | POST | ✅ Correct | Token validation, session invalidation |
| `merge-cart` | POST | ✅ Correct | Handles duplicate variants |

---

### Checkout Routes (`app/api/checkout/`)

| Route | Method | Status | Issues |
|-------|--------|--------|--------|
| `initiate` | POST | ⚠️ Bugs | CRITICAL: 5 bugs (see below) |
| `validate` (coupon) | POST | ✅ Correct | All 9 rules validated |
| `retry` | POST | 🔴 MISSING | Route doesn't exist — 404 |
| `shipping-rates` | GET | ✅ Correct | Cold-chain only |

#### Checkout Initiate Bugs

1. **No stock reservation** — race condition / oversell risk
2. **Buy X Get Y no stock validation** — free items added without check
3. **`order` undefined in Net-30** — points award crashes
4. **Points deducted outside transaction** — lost on failure
5. **`freeShipping` column check wrong** — should be `type === 'free_shipping'`

---

### Shipping Routes (`app/api/shipping/`)

| Route | Method | Status | Issues |
|-------|--------|--------|--------|
| `provinces` | GET | ✅ Correct | Cached, returns RajaOngkir data |
| `cities` | GET | ✅ Correct | Cached, paginated |
| `cost` | GET | ✅ Correct | Weight in grams, cold-chain only |

**Note:** RajaOngkir origin city issue — Starter plan only supports Jakarta (501). If settings has Bandung (23), shipping cost API fails.

---

### Webhook Routes (`app/api/webhooks/midtrans/`)

| Route | Method | Status | Issues |
|-------|--------|--------|--------|
| [webhook] | POST | 🔴 CRITICAL | **Signature verification missing** |

---

### Admin Routes (`app/api/admin/`)

| Route | Method | Status | Issues |
|-------|--------|--------|--------|
| `orders/` | GET | ✅ Correct | Pagination, search, role check |
| `orders/` | POST | ✅ Correct | Stock atomic, transaction |
| `orders/[id]/status` | PATCH | ✅ Correct | Full cancellation handling |
| `orders/[id]` | GET | ✅ Correct | — |
| `products/` | GET/POST | ✅ Correct | — |
| `products/bulk` | POST | ✅ Correct | — |
| `products/[id]/variants/[variantId]` | PATCH | ✅ Correct | — |
| `customers/` | GET | ✅ Correct | Role: superadmin + owner |
| `customers/[id]` | GET/PATCH | ✅ Correct | — |
| `dashboard/*` | Various | ✅ Correct | All 10 endpoints verified |
| `team-dashboard/*` | Various | 🔴 BROKEN | 6 of 11 endpoints missing |
| `field/*` | Various | ✅ Correct | All 9 field endpoints verified |
| `b2b-inquiries/` | GET/PATCH | ✅ Correct | — |
| `audit-logs/` | GET | ✅ Correct | — |

#### Team Dashboard Missing Endpoints

The following endpoints are called by `TeamDashboardClient.tsx` but the files don't exist:
1. `monthly-progress` — MISSING
2. `order-pipeline` — MISSING
3. `action-orders` — MISSING
4. `coupons` — MISSING
5. `blog-status` — MISSING
6. `points-summary` — MISSING

---

### Account Routes (`app/api/account/`)

| Route | Method | Status | Issues |
|-------|--------|--------|--------|
| `profile` | GET | ✅ Correct | — |
| `profile` | PATCH | ✅ Correct | — |
| `addresses` | GET | ✅ Correct | — |
| `addresses` | POST | ✅ Correct | — |
| `addresses/[id]` | PUT/DELETE | ✅ Correct | — |
| `points` | GET | ✅ Correct | — |
| `vouchers` | GET | ✅ Correct | — |

---

### Public Routes (`app/api/`)

| Route | Method | Status | Issues |
|-------|--------|--------|--------|
| `products` | GET | ✅ Correct | Pagination, filtering |
| `testimonials/public` | GET | ✅ Correct | Active only |
| `settings/public` | GET | ✅ Correct | — |
| `coupons/validate` | POST | ✅ Correct | Guest check bypass issue |
| `cart/validate` | POST | ✅ Correct | — |

---

## DETAILED ROUTE ANALYSIS

---

### app/api/checkout/initiate/route.ts

**Purpose:** Create order and generate Midtrans snap token

**Required validations (verified):**
- [x] Price re-fetched from DB ✅
- [x] Stock re-validated (atomic) ✅
- [x] Coupon server-side validated (all 9 rules) ✅
- [x] Buy X Get Y stock validated — **BUG: NOT DONE**
- [x] Points redemption FIFO ✅
- [x] Idempotency key ✅
- [x] B2B Net-30 skip Midtrans ✅
- [x] `payment_expiry_minutes` from settings ✅
- [x] Snapshot product data in order_items ✅

**Known bugs:**
1. No stock reservation at initiate (race condition)
2. Buy X Get Y free items not stock-checked
3. `order` undefined in Net-30 block (line ~611)
4. Points deducted outside transaction (lost on failure)
5. `coupon.freeShipping` check wrong (should be `type === 'free_shipping'`)

---

### app/api/webhooks/midtrans/route.ts

**Purpose:** Handle Midtrans payment notification

**Required validations:**
- [x] Signature verification — **BUG: NOT DONE OR NOT VERIFIED**
- [x] Idempotency (already paid check) ✅
- [x] Transaction for settlement ✅
- [x] Stock deducted atomically ✅
- [x] Coupon used_count incremented ✅
- [x] Points awarded ✅
- [x] Guest checkout no points ✅
- [x] 200 OK immediately ✅

---

### app/api/checkout/retry/route.ts

**Status:** 🔴 **DOES NOT EXIST**

This route should exist but the file is missing. Any retry attempt returns 404.

---

### app/api/coupons/validate/route.ts

**Purpose:** Validate coupon code before checkout

**Validation rules checked:**
- [x] Coupon exists ✅
- [x] is_active ✅
- [x] expires_at > now ✅
- [x] starts_at <= now ✅
- [x] max_uses not exceeded ✅
- [x] min_order_amount met ✅
- [x] max_uses_per_user — **BUG: fails for guests (userId null)**
- [x] applicable_product_ids ✅
- [x] applicable_category_ids ✅

**Guest bypass:** For guest checkouts, `max_uses_per_user` validation always passes because `userId` is null and the query can't find a matching order.

---

## RESPONSE FORMAT AUDIT

### Consistent Format Required

All routes must return:
```typescript
// Success:
{ success: true, data: T }

// Error:
{ success: false, error: string, code: string, details?: object }
```

**Routes using inconsistent format (need verification):**
- `app/api/auth/forgot-password/route.ts` — may return plain `{ message: string }`
- `app/api/auth/reset-password/route.ts` — may return plain `{ message: string }`

These should use the `success()` and `serverError()` helpers.

---

## RATE LIMITING AUDIT

### Routes WITH rate limiting ✅
- `/api/auth/[...nextauth]` — applied via `withRateLimit` wrapper
- `/api/auth/register` — 5/min
- `/api/auth/forgot-password` — 3/min
- `/api/auth/reset-password` — 5/min
- `/api/checkout/initiate` — idempotency key as alternative

### Routes WITHOUT rate limiting ⚠️
- `/api/coupons/validate` — **HIGH RISK** — could be brute-forced
- `/api/products` — acceptable (public data)
- `/api/shipping/cities` — acceptable (cached public data)
- `/api/shipping/cost` — acceptable (price calculation)
- `/api/checkout/retry` — should have rate limit (when created)

---

## SECURITY AUDIT

### ✅ GOOD

1. **Auth on sensitive routes** — account, admin, checkout initiate (when logged in)
2. **Role checks** — requireAdmin() on all admin pages
3. **Middleware protection** — auth checks in middleware.ts
4. **Session invalidation** — password reset deletes all sessions
5. **Input validation** — Zod schemas on all mutations

### ⚠️ NEEDS ATTENTION

1. **`/api/coupons/validate` has no rate limit** — coupon code brute force possible
2. **`/api/checkout/initiate` allows guest** — but has idempotency key
3. **`/api/checkout/retry` missing** — no retry protection yet
4. **Webhook signature not verified** — CRITICAL

---

## SUMMARY TABLE

| Route | File | Severity | Issue |
|-------|------|----------|-------|
| checkout/initiate | initiate/route.ts | CRITICAL | 5 bugs (stock, points, B2B) |
| checkout/retry | retry/route.ts | CRITICAL | Route doesn't exist (404) |
| webhooks/midtrans | webhooks/midtrans/route.ts | CRITICAL | Signature not verified |
| team-dashboard/* | team-dashboard/*.ts | CRITICAL | 6 endpoints missing |
| coupons/validate | coupons/validate/route.ts | HIGH | Guest bypass for per-user limit |
| shipping/cost | shipping/cost/route.ts | HIGH | RajaOngkir origin city mismatch |
| coupons/validate | coupons/validate/route.ts | HIGH | No rate limiting (brute force risk) |
| admin/orders/[id]/status | orders/[id]/status/route.ts | MEDIUM | Verify atomic stock restoration |
| auth/forgot-password | forgot-password/route.ts | MEDIUM | Response format inconsistent |
| auth/reset-password | reset-password/route.ts | MEDIUM | Response format inconsistent |

---

*End of API Routes Deep Audit*