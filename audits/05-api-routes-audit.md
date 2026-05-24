# AUDIT 05 — API Routes: Completeness & Data Integrity

**Project:** DapurDekaka.com
**Date:** May 24, 2026

---

## EXECUTIVE SUMMARY

The API layer is well-engineered with strong transactional integrity, consistent response formatting, and thorough Zod validation. Strong patterns: atomic stock operations, optimistic locking, FIFO points redemption, idempotency everywhere, and proper webhook signature verification. Issues are minor: one non-standard response format in health endpoint, one incomplete coupon validation (also in Audit 02), and one hardcoded expiry duration.

---

## HEALTH CHECK (`app/api/health/route.ts`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — Non-Standard Response Format:**

```typescript
return NextResponse.json({ status: 'ok', checks, timestamp });
```

Returns `{ status, checks, timestamp }` instead of project standard `{ success, data?, error? }`. This is a public endpoint used by load balancers/monitoring, so breaking convention here is **acceptable** — but inconsistent with the rest of the codebase. Document this exception.

---

## CHECKOUT INITIATE (`app/api/checkout/initiate/route.ts`)

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

All 18 checks passed — full details in Audit 02.

---

## CHECKOUT VALIDATE COUPON (`app/api/checkout/validate-coupon/route.ts`)

| Status | 🟠 INCOMPLETE |
|--------|--------------|
| Severity | **HIGH** |

**CRITICAL: Missing Rules 8 and 9 (also documented in Audit 02)**
- Rule 8: `applicable_product_ids` check — MISSING
- Rule 9: `applicable_category_ids` check — MISSING

See Audit 02 for detailed fix instructions.

---

## MIDTRANS WEBHOOK (`app/api/webhooks/midtrans/route.ts`)

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

All 15 checks passed — full details in Audit 02.

---

## UPLOAD ROUTE (`app/api/upload/route.ts`)

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

- Auth required + role check (superadmin or owner) ✅
- Zod validates folder enum (only allowed: products, blog, carousel, avatars, gallery, sauces) ✅
- Returns Cloudinary signed upload params (no secret exposed) ✅
- File type/size enforced by Cloudinary signed params ✅
- `serverError(error)` on catch ✅
- Note: `console.error` on line 46 — should use `logger.error`

---

## AI CAPTION ROUTE (`app/api/ai/caption/route.ts`)

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

- Auth required + role check (superadmin only) ✅
- Zod validates `AICaptionSchema` with productName, productDescription, language, tone ✅
- `validationError(parsed.error)` on invalid input ✅
- `IntegrationError` caught and converted to friendly serverError ✅
- Calls `generateProductCaption()` from `lib/services/minimax.ts` ✅

---

## CHECKOUT RETRY (`app/api/checkout/retry/route.ts`)

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | **MEDIUM** |

Full details in Audit 02. Documented FIFO race condition not critical.

---

## SHIPPING COST (`app/api/shipping/cost/route.ts`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — Non-Standard Response Format (lines 66-70, 115-119):**

```typescript
return NextResponse.json({ services: [], message, whatsappUrl });
```

Should be:
```typescript
return success({ services: [], message, whatsappUrl });
```

Error paths return non-standard format. See Audit 02 for details.

---

## COUPONS PUBLIC VALIDATE (`app/api/coupons/validate/route.ts`)

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

All 9 coupon validation rules implemented correctly. This is the reference implementation that the checkout validate-coupon route should mirror.

---

## CRON JOBS

### `app/api/cron/expire-points/route.ts`

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

- `verifyCronAuth()` applied ✅
- Groups expiring records by user (single transaction per user) ✅
- `GREATEST(points_balance - totalPoints, 0)` guard prevents negative ✅
- `pointsHistory` record written for expiration ✅
- `isExpired: true` set on expired records ✅
- Errors collected and reported — individual failures don't stop the job ✅

### `app/api/cron/cancel-expired-orders/route.ts`

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

- `verifyCronAuth()` applied ✅
- Double-checks with Midtrans before cancelling ✅
- Conditional update (`status = 'pending_payment'` in WHERE) ✅
- Transaction: status update + inventory logs + points restore + coupon decrement ✅
- `checkTransactionStatus()` handles Midtrans failures gracefully ✅

### `app/api/cron/reconcile-payments/route.ts`

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

- `verifyCronAuth()` applied ✅
- Finds pending orders > 30 minutes old ✅
- Checks Midtrans status for each ✅
- Conditional update (`WHERE status = 'pending_payment'`) prevents race with webhook ✅
- Recovery path: marks order paid, awards points (FIFO), increments coupon ✅
- Cancellation path: restores stock + points + coupon ✅
- `ORDER_ALREADY_PROCESSED` error caught and skipped ✅
- Email sent async after reconciliation ✅

---

## SERVICE FILES

### `lib/midtrans/create-transaction.ts`

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | LOW |

- `getMidtransOrderId()` used for retry-safe order IDs ✅
- Expiry hardcoded to 15 minutes (should use `getSetting`) — see Audit 02

### `lib/midtrans/client.ts`

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

Server key never exposed as `NEXT_PUBLIC` ✅

### `lib/midtrans/status.ts`

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

Both `checkTransactionStatus()` and `refundTransaction()` properly typed ✅

### `lib/cloudinary/upload.ts`

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

- `generateSignedUploadParams()` returns signed params to client (no secret exposed) ✅
- Allowed formats: `['jpg', 'jpeg', 'png', 'webp']` ✅
- Max file size 5MB ✅
- `uploadBuffer()` for in-memory uploads ✅
- `serverSideUpload()` for file path uploads ✅

### `lib/services/minimax.ts`

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

- API key and group ID validated and throw if missing ✅
- 30s timeout per request with `AbortController` ✅
- `withRetry` wrapper for 429, 500, 502, 503, 504 ✅
- System prompts differ for id vs en language ✅
- `logger.error` on API failure ✅

### `lib/resend/send-email.ts`

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

- Returns `boolean` — callers check and log on failure ✅
- Error handling logs with `{ error, to, subject }` context ✅

---

## UTILITY FILES

### `lib/utils/api-response.ts`

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

All helpers present and consistent ✅

### `lib/utils/format-currency.ts`

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

`formatIDR(120000)` → `"Rp 120.000"` ✅

### `lib/utils/generate-order-number.ts`

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

All three functions correct ✅

### `lib/utils/cron-auth.ts`

| Status | ✅ COMPLETE |
|--------|------------|
| Severity | N/A |

- Bearer token check against `CRON_SECRET` ✅
- Skips verification in development ✅

---

## POSITIVE PATTERNS FOUND

The following patterns are exemplary and should be maintained across all new code:

| Pattern | Where Used |
|---------|-----------|
| Atomic stock: `GREATEST(stock - qty, 0)` + `returning({ newStock })` check | checkout/initiate, webhook, admin/orders |
| Optimistic locking: `WHERE id = X AND status = Y` | admin/orders/[id]/status, cron/cancel-expired-orders |
| Snapshot on order_items: name/price/weight snapshotted at creation | checkout/initiate |
| Idempotency on all payment flows | checkout/initiate (dedup), webhook (transaction_id), cron (conditional update) |
| Points FIFO: `referencedEarnId` + `consumedAt` tracking | webhook settlement, cron/reconcile |
| Email non-blocking: `.catch()` or fire-and-forget | All email sends |
| Webhook signature first | Midtrans webhook |
| Zod on both client and server | All critical routes |
| Transaction wrapping for multi-table mutations | checkout/initiate, webhook, admin/orders, cron jobs |
| Rate limiting on sensitive routes | checkout/initiate, validate-coupon, shipping/cost |

---

## CONSOLIDATED ISSUES

| Severity | Count | Issues |
|---|---|---|
| **HIGH** | 1 | validate-coupon missing Rules 8 & 9 (also in Audit 02) |
| **MEDIUM** | 2 | health check non-standard format; shipping cost non-standard error responses |
| **LOW** | 1 | create-transaction expiry hardcoded |

---

## PRIORITY FIX LIST

### 🟠 HIGH
1. **`app/api/checkout/validate-coupon/route.ts`** — Add Rules 8 & 9 (from Audit 02)

### 🟡 MEDIUM
2. **`app/api/health/route.ts`** — Document why non-standard format is acceptable; add comment
3. **`app/api/shipping/cost/route.ts`** — Wrap all return values in `success()` helper

### 🟢 LOW
4. **`lib/midtrans/create-transaction.ts`** — Replace hardcoded 15-minute expiry with `getSetting('payment_expiry_minutes')`