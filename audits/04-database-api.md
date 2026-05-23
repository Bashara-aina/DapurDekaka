# AUDIT 04 — DATABASE SCHEMA & API LAYER
**Project:** DapurDekaka.com
**Date:** May 22, 2026
**Scope:** `lib/db/schema.ts`, `lib/db/index.ts`, `app/api/` (all routes), `lib/services/`
**Severity Scale:** 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW

---

## 🔴 CRITICAL

### C-01: `lib/services/inventory.service.ts` — Read-Then-Write Race Conditions

**File:** `lib/services/inventory.service.ts` lines 5–77

```typescript
// deductStock: lines 5-29
export async function deductStock(variantId: string, quantity: number) {
 const variant = await db.select().from(productVariants).where(...); // READ
 const newStock = Math.max(variant.stock - quantity, 0); // COMPUTE
 await db.update(productVariants).set({ stock: newStock }).where(...); // WRITE
}
```

**Issue:** Classic read-then-write race condition. Two concurrent deductions both read `stock = 5`, both compute `5 - 3 = 2`, both write `stock = 2`. Expected result: `stock = 2`. Actual result: `stock = -1` (if `Math.max` not applied). Even with `Math.max`, the second request's computed value overwrites the first's. This is NOT atomic. Under 100 concurrent users placing orders, stock will go inconsistent.

The same pattern in `restoreStock` (line 59) and `adjustStock` (line 96).

**CRITICAL FIX:** Replace all read-then-write patterns with atomic SQL expressions inside transactions:

```typescript
// CORRECT pattern (used in webhook, but NOT in inventory.service.ts):
await tx
 .update(productVariants)
 .set({ stock: sql`GREATEST(stock - ${qty}, 0)` })
 .where(and(eq(productVariants.id, variantId), gte(productVariants.stock, qty)))
 .returning({ newStock: productVariants.stock });

if (result.length === 0) throw new Error('Insufficient stock');
```

**Action:** Rewrite `deductStock`, `restoreStock`, `adjustStock` to use atomic SQL with `GREATEST` and affected row checks inside transactions. Remove the read-then-write pattern entirely.

---

### C-02: `lib/services/points.service.ts` — `redeemPoints()` Takes `tx: any` — No Type Safety

**File:** `lib/services/points.service.ts` lines 89–118

```typescript
export async function redeemPoints(tx: any, userId: string, orderId: string, pointsToRedeem: number) {
```

**Issue:** `tx: any` bypasses all TypeScript transaction typing. The function is designed to be called within a transaction but callers could pass a non-transaction object silently. Also, the function modifies `pointsHistory` after order creation — if a crash happens between order insert and redeem record creation, points are deducted with no record of what they were used for.

**Fix:** Type `tx` properly using the Drizzle transaction type, or remove this function and keep redemption logic inline in the checkout transaction where types are enforced.

---

### C-03: RajaOngkir Starter Tier — Origin City Mismatch (also in Audit 03, repeated here)

**File:** `lib/services/shipping.service.ts` lines 9–12

Duplicate of Audit 03 C-01. Listed here for completeness of the DB/API audit.

---

### C-04: Settlement Webhook — Continues Awarding Points on Stock Failure

**File:** `app/api/webhooks/midtrans/route.ts` lines 137–145

```typescript
if (!updated) {
 logger.error('Stock deduction failed', { variantId: item.variantId });
}
// Code continues — order status updated, points awarded
await tx.update(orders).set({ status: 'paid', paidAt: new Date() }).where(...);
await tx.insert(pointsHistory).values({...}); // Points still awarded!
```

**Issue:** After the stock deduction "failure" log, execution continues. The order is marked `paid`, loyalty points are awarded, email is queued — all for an order where stock deduction may have failed silently. Customer gets charged for an order with potentially incomplete inventory.

**CRITICAL FIX:** Throw an exception when stock deduction fails to force transaction rollback:

```typescript
if (!updated) {
 throw new Error(`Settlement failed: insufficient stock for variant ${item.variantId}`);
}
```

---

## 🟠 HIGH

### H-01: Schema Missing Composite Index — `productVariants(productId, isActive)`

**File:** `lib/db/schema.ts` lines 208–225

**Issue:** Product listing queries filter by `productId + isActive` frequently. Without a composite index, listing queries on `productVariants` will do sequential scans as the product catalog grows.

**Fix:** Add composite index:
```sql
CREATE INDEX idx_product_variants_product_active ON product_variants(product_id, is_active);
```

---

### H-02: Schema Missing Index on `orders(recipientEmail)`

**File:** `lib/db/schema.ts` lines 255–310

**Issue:** Guest order tracking by email performs a lookup on `recipientEmail`. No index exists — on large order tables this is a full table scan.

**Fix:** Add index `CREATE INDEX idx_orders_recipient_email ON orders(recipient_email);`

---

### H-03: Schema Missing Index on `pointsHistory(referencedEarnId)`

**File:** `lib/db/schema.ts` lines 392–412

**Issue:** FIFO reversal queries filter on `referencedEarnId IS NOT NULL`. No index — the cancel/expire flows will slow down significantly at scale.

**Fix:** Add index `CREATE INDEX idx_points_history_referenced_earn ON points_history(referenced_earn_id) WHERE referenced_earn_id IS NOT NULL;`

---

### H-04: 14+ API Routes Use Raw `NextResponse.json` Instead of Helpers

**Files:** `app/api/admin/blog/[id]/route.ts`, `app/api/admin/orders/[id]/status/route.ts`, `app/api/ai/caption/route.ts`, `app/api/cron/expire-points/route.ts`, `app/api/cron/cancel-expired-orders/route.ts`, and more

**Issue:** All API routes should use `success()`, `unauthorized()`, `forbidden()`, `validationError()`, `serverError()` from `@/lib/utils/api-response`. 14+ routes return raw `{ success: false, error: ..., code: ... }` objects instead. This breaks the client-side error handling contract.

**Fix:** Audit each route and replace raw `NextResponse.json` with the appropriate helper function.

**Action:** Run a grep to find all `NextResponse.json({ success:` patterns and fix each one.

---

### H-05: `validateEnv()` Exists But Is Never Called in API Routes

**File:** `lib/config/validate-env.ts`

```typescript
const REQUIRED = ['DATABASE_URL', 'AUTH_SECRET', 'MIDTRANS_SERVER_KEY', ...] as const;
// validateEnv() function exists but...
// grep across all API routes: ZERO calls to requireEnv() or validateEnv()
```

**Issue:** Missing env vars cause cryptic errors from whichever library first uses them. A missing `RAJAONGKIR_API_KEY` will fail silently in shipping cost queries.

**Fix:** Call `requireEnv()` at the start of each API route that needs env vars, or at minimum in a shared middleware.

---

### H-06: `RAJAONGKIR_API_KEY` Not in Required Env Vars

**File:** `lib/config/validate-env.ts` line 1–11

**Issue:** `RAJAONGKIR_API_KEY` is missing from the `REQUIRED` array but is used in shipping queries.

**Fix:** Add `'RAJAONGKIR_API_KEY'` to the `REQUIRED` array.

---

### H-07: `validateCoupon()` in coupon.service.ts is Dead Code — API Route Duplicates Logic

**File:** `lib/services/coupon.service.ts` lines 20–91

**Issue:** `lib/services/coupon.service.ts` has a full `validateCoupon()` function implementing all 9 coupon rules. It is **never called** by any API route. The API route at `app/api/coupons/validate/route.ts` re-implements the same 9 rules inline. Two places to maintain coupon business logic = bugs.

**Fix:** Either call `validateCoupon()` from the API route, or delete the function from `coupon.service.ts` and consolidate in the route.

---

### H-08: Checkout Initiate Uses Custom FIFO Instead of `redeemPoints()` from Service

**File:** `app/api/checkout/initiate/route.ts` lines 461–522

**Issue:** FIFO redemption logic is implemented inline in `checkout/initiate` rather than being delegated to `lib/services/points.service.ts`. The `redeemPoints()` function exists but is not used by checkout. Duplicate FIFO implementation in two places.

**Fix:** Delegate to `redeemPoints()` from points.service.ts, or remove the service function if the inline implementation is more correct.

---

### H-09: Blog API — `categoryId` vs `blogCategoryId` Field Mismatch

**File:** `app/api/admin/blog/route.ts` line 21

**Issue:** CreatePostSchema uses `categoryId`, but the client (`BlogNewClient.tsx` line 90) sends `blogCategoryId`. The API silently ignores the misnamed field. Admins cannot set blog categories.

**Fix:** Align field names across schema and client.

---

### H-10: `i18n/messages/id.json` and `en.json` Nearly Empty — Only 37 Lines

**File:** `i18n/messages/id.json`, `i18n/messages/en.json`

**Issue:** Both files have only `common`, `nav`, `product`, `cart`, `checkout` top-level keys. There are **no translations for:**
- Order status strings ("Menunggu Pembayaran", "Diproses", etc.)
- Admin UI strings
- API error messages ("Kupon tidak ditemukan", "Stok tidak mencukupi")
- Email template strings
- Any page beyond the 5 covered categories

All error messages in API routes are hardcoded Bahasa Indonesia strings.

**Fix:** Expand `id.json` and `en.json` to cover all user-facing strings. Prioritize: order status labels, error messages, admin labels, then page content.

---

### H-11: Rate Limiting Falls Back to In-Memory (No-Op) in Serverless Production

**File:** `lib/utils/rate-limit.ts` lines 106–108

```typescript
// Dev fallback — in-memory (not effective in serverless production)
const windowMs = window === '1 m' ? 60000 : ...
return checkInMemory(identifier, windowMs, requests);
```

**Issue:** When Upstash Redis env vars are absent (not configured in production), every rate limit check returns `success: true`. Auth routes (`/api/auth/[...nextauth]`, `/api/auth/register`) have unlimited login attempts in production.

**Fix:** Ensure `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are set in Vercel production environment variables. Add a startup check that fails fast if Redis is not configured and rate limiting is required.

---

## 🟡 MEDIUM

### M-01: `shipping/cost/route.ts` — No Format Validation on `destination` Parameter

**File:** `app/api/shipping/cost/route.ts` lines 31–32

**Issue:** `destination: z.string()` — no format validation. Malformed city IDs passed to RajaOngkir cause cryptic API errors.

**Fix:** Add `z.string().min(1)` or validate against known RajaOngkir city ID format.

---

### M-02: Coupon `applicableProductIds` / `applicableCategoryIds` — UI Gap

**File:** `components/admin/coupons/CouponForm.tsx` (schema lines 45–64)

**Issue:** Coupon validation rules support product/category restrictions, but the admin CRUD form has no UI to set them. Admins can only create global coupons.

**Action:** Add product/category multi-select UI to `CouponForm`. Flag as known gap.

---

### M-03: Coupon `discountValue` Percentage — No Max 100 Cap

**File:** `components/admin/coupons/CouponForm.tsx` line 52

**Issue:** `z.number().int().nonnegative().optional()` allows `discountValue: 150` for percentage type.

**Fix:** Add `superRefine` to enforce 1–100 for percentage coupons.

---

### M-04: `app/api/checkout/retry/route.ts` — No `orderNumber` UUID Validation

**File:** `app/api/checkout/retry/route.ts` lines 20–21

**Issue:** Schema has no `orderNumber` format validation beyond `.min(1)`.

**Fix:** Add regex validation for `orderNumber` format (`DDK-YYYYMMDD-NNNN`).

---

### M-05: Auth Check Pattern Inconsistent in `orders/[orderNumber]/route.ts`

**File:** `app/api/orders/[orderNumber]/route.ts` lines 24–40

**Issue:** Manual session check instead of using `auth()` helper or `requireRole()`. Deviates from the standard pattern used in other API routes.

**Fix:** Standardize to use the `auth()` helper from `@/lib/auth`.

---

### M-06: Cron Auth Uses Simple Header Check — `CRON_SECRET`

**File:** `lib/utils/cron-auth.ts` (referenced in all cron routes)

**Issue:** Cron auth is a simple `Authorization: Bearer <CRON_SECRET>` header check. If this secret leaks, attackers can trigger cron jobs. Should use Vercel Cron's built-in verification.

**Fix:** Ensure `CRON_SECRET` is a strong random value, rotate periodically, and document in `CURSOR_RULES.md`.

---

### M-07: No `health` Route Audit for Sensitive Data Exposure

**File:** `app/api/health/route.ts` (referenced as existing)

**Issue:** Need to verify health check doesn't expose system internals (version numbers, env var names, file paths).

**Fix:** Audit health route — ensure it only returns `{ status: 'ok' }` or minimal non-sensitive data.

---

### M-08: `app/api/orders/[orderNumber]/route.ts` — GET Has No Schema for `email` Param

**File:** `app/api/orders/[orderNumber]/route.ts` line 21

**Issue:** `email: z.string()` — no format validation. Should validate email format before DB query.

**Fix:** Add `z.string().email()` to the GET schema.

---

### M-09: Blog API PUT — No Zod Schema for Request Body

**File:** `app/api/admin/blog/[id]/route.ts` lines 70–88

**Issue:** Body is validated only by checking `if (field === undefined)`, not a Zod schema. Invalid types pass silently.

**Fix:** Add a `BlogUpdateSchema` and use `.parse()` with proper error handling via `validationError()`.

---

### M-10: Blog API PUT — Tracking Number Validation Bypassed

**File:** `app/api/admin/orders/[id]/status/route.ts` lines 60–72

**Issue:** Zod validation uses `.safeParse()` but returns raw `NextResponse.json` for validation errors instead of `validationError()`. The refinement requiring tracking number for `shipped` status is bypassed.

**Fix:** Use `validationError(parsed.error)` for Zod failures.

---

## 🟢 LOW

### L-01: `app/api/cart/validate/route.ts` — GET Uses Query Param Length Limit

**File:** `app/api/cart/validate/route.ts` lines 36–37

**Issue:** Comma-separated `variantIds` as query param has URL length limits for large carts.

**Fix:** Consider a POST variant with JSON body for large cart validation.

### L-02: `midtrans/create-transaction.ts` — No `itemDetails` Sum Validation

**Issue:** The `createMidtransTransaction` function doesn't validate that `itemDetails` sum equals `grossAmount`. A calculation bug would pass silently and cause Midtrans to reject the transaction with a non-obvious error.

### L-03: `coupons/validate/route.ts` — Missing Rate Limiting

**Issue:** Public coupon validation endpoint has no rate limiting. An attacker could hammer this endpoint to enumerate valid coupon codes.

---

## SUMMARY

| ID | Severity | File | Issue | Fix Action |
|----|----------|------|-------|------------|
| C-01 | 🔴 CRITICAL | `inventory.service.ts:5` | Read-then-write race conditions in deductStock/restoreStock | Rewrite with atomic SQL + GREATEST |
| C-02 | 🔴 CRITICAL | `points.service.ts:89` | redeemPoints takes `tx: any`, no type safety | Type properly or remove function |
| C-03 | 🔴 CRITICAL | `shipping.service.ts:9` | RajaOngkir Starter origin mismatch | (See Audit 03) |
| C-04 | 🔴 CRITICAL | `webhooks/midtrans/route.ts:137` | Points awarded even when stock deduction fails | Throw on stock failure to rollback |
| H-01 | 🟠 HIGH | `schema.ts:208` | Missing index on productVariants(productId, isActive) | Add composite index |
| H-02 | 🟠 HIGH | `schema.ts:255` | Missing index on orders(recipientEmail) | Add index |
| H-03 | 🟠 HIGH | `schema.ts:392` | Missing index on pointsHistory(referencedEarnId) | Add partial index |
| H-04 | 🟠 HIGH | 14+ route files | Raw NextResponse.json instead of api-response helpers | Audit and fix all routes |
| H-05 | 🟠 HIGH | `validate-env.ts` | validateEnv() never called | Add requireEnv() to API routes |
| H-06 | 🟠 HIGH | `validate-env.ts` | RAJAONGKIR_API_KEY missing from REQUIRED | Add to REQUIRED array |
| H-07 | 🟠 HIGH | `coupon.service.ts:20` | validateCoupon() dead code, logic duplicated in route | Consolidate into one place |
| H-08 | 🟠 HIGH | `checkout/initiate/route.ts:461` | Custom FIFO instead of redeemPoints() service | Delegate to service function |
| H-09 | 🟠 HIGH | `admin/blog/route.ts:21` | categoryId vs blogCategoryId mismatch | Align field names |
| H-10 | 🟠 HIGH | `i18n/messages/*.json` | Only 37 lines, most UI text missing | Expand translation files |
| H-11 | 🟠 HIGH | `rate-limit.ts:106` | In-memory fallback = no rate limiting in serverless | Configure Upstash Redis in prod |
| M-01 | 🟡 MEDIUM | `shipping/cost/route.ts:31` | No format validation on destination | Add min length validation |
| M-02 | 🟡 MEDIUM | `CouponForm.tsx:45` | Missing applicableProductIds/categoryIds UI | Add product/category selector |
| M-03 | 🟡 MEDIUM | `CouponForm.tsx:52` | No max cap on percentage discount | Add superRefine for 1-100 |
| M-04 | 🟡 MEDIUM | `checkout/retry/route.ts:20` | No orderNumber format validation | Add regex validation |
| M-05 | 🟡 MEDIUM | `orders/[orderNumber]/route.ts:24` | Inconsistent auth check pattern | Use auth() helper |
| M-06 | 🟡 MEDIUM | `cron-auth.ts` | Simple header check for cron auth | Strengthen + document |
| M-07 | 🟡 MEDIUM | `app/api/health/route.ts` | Need audit for sensitive data exposure | Audit and fix |
| M-08 | 🟡 MEDIUM | `orders/[orderNumber]/route.ts:21` | GET email param no format validation | Add email format validation |
| M-09 | 🟡 MEDIUM | `admin/blog/[id]/route.ts:70` | PUT has no Zod schema | Add BlogUpdateSchema |
| M-10 | 🟡 MEDIUM | `admin/orders/[id]/status/route.ts:60` | safeParse + raw JSON instead of validationError() | Fix error handling |
| L-01 | 🟢 LOW | `cart/validate/route.ts:36` | Query param length limit for large carts | Consider POST variant |
| L-02 | 🟢 LOW | `create-transaction.ts` | No itemDetails sum validation | Add sum check |
| L-03 | 🟢 LOW | `coupons/validate/route.ts` | No rate limiting on public endpoint | Add rate limit |

**Total: 4 CRITICAL · 11 HIGH · 10 MEDIUM · 3 LOW**