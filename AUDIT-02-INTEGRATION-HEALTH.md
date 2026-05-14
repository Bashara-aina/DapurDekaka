# AUDIT 02 — INTEGRATION HEALTH

DapurDekaka.com — Third-Party Integration Audit: Midtrans, RajaOngkir, Resend, Cloudinary, Google OAuth, Minimax

**Date:** May 2026 | **Auditor:** Claude Code | **Scope:** API Keys, Webhooks, Error Handling, Timeouts, OAuth, AI

---

## LEGEND

| Symbol | Meaning |
|--------|---------|
| ✅ | Implemented & correct |
| ⚠️ | Partially implemented or has a bug |
| ❌ | Not implemented (stub / placeholder) |
| 🔴 | Critical — blocks real usage |
| 🟡 | Major — significant UX or business impact |
| 🟢 | Minor — nice-to-have improvement |

---

## 1. API KEY EXPOSURE

### Finding: All server-side keys are correctly protected

| Key | `.env.local` present | Prefixed `NEXT_PUBLIC_` | Used in code | Status |
|-----|---------------------|------------------------|--------------|--------|
| `MIDTRANS_SERVER_KEY` | ✅ | ❌ No | `lib/midtrans/client.ts:7`, `lib/midtrans/verify-webhook.ts:37` | ✅ |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | ✅ | ✅ Yes (correct) | `lib/midtrans/client.ts:8` | ✅ |
| `RAJAONGKIR_API_KEY` | ✅ | ❌ No | `lib/rajaongkir/client.ts:13,44` | ✅ |
| `RESEND_API_KEY` | ✅ | ❌ No | `lib/resend/client.ts:3` | ✅ |
| `CLOUDINARY_API_SECRET` | ✅ | ❌ No | `lib/cloudinary/upload.ts:60` | ✅ |
| `CLOUDINARY_API_KEY` | ✅ | ❌ No | `lib/cloudinary/upload.ts:67` | ✅ |
| `AUTH_GOOGLE_SECRET` | ✅ | ❌ No | `lib/auth/index.ts:15` | ✅ |
| `MINIMAX_API_KEY` | ✅ | ❌ No | `lib/services/minimax.ts:42` | ✅ |
| `DATABASE_URL` | ✅ | ❌ No | `lib/db/index.ts` | ✅ |

### 🟡 Minor: `MINIMAX_GROUP_ID` missing from `.env.local`

**File:** `.env.example:29` — `MINIMAX_GROUP_ID=your-minimax-group-id` is documented, but **`.env.local` has no `MINIMAX_GROUP_ID` entry**. The `getMinimaxGroupId()` function in `lib/services/minimax.ts:49–55` reads it from `process.env.MINIMAX_GROUP_ID` and will throw if not set. This will cause AI caption/blog generation to fail at runtime with a hard error rather than a graceful degradation.

**Fix:** Add `MINIMAX_GROUP_ID=<your-group-id>` to `.env.local`.

---

## 2. MIDTRANS WEBHOOK SIGNATURE

### Finding: SHA512 verification is correctly implemented

**File:** `lib/midtrans/verify-webhook.ts:7–20`

```typescript
export function verifyMidtransSignature(
  orderId: string,
  statusCode: string,
  grossAmount: string,
  serverKey: string,
  signatureKey: string
): boolean {
  const hash = crypto
    .createHash('sha512')
    .update(`${orderId}${statusCode}${grossAmount}${serverKey}`)
    .digest('hex');

  return hash === signatureKey;
}
```

**Usage in webhook:** `app/api/webhooks/midtrans/route.ts:36–49`

The webhook handler calls `verifyMidtransSignature()` with `order_id`, `status_code`, `gross_amount`, and `signature_key` from the request body against the server key. If verification fails, it returns `400 Bad Request` immediately. This is ✅ correct.

### 🟡 Minor: `gross_amount` is not cross-validated against order amount

The webhook signature verifies the signature key is correct, but does **not** verify that the `gross_amount` in the webhook payload matches the order's `totalAmount` in the database. A compromised Midtrans API key could theoretically send a settlement webhook for the correct order_id but with a modified `gross_amount`. While the order's `totalAmount` was set when the transaction was created, there is no re-validation at webhook time.

**Recommendation (non-critical):** Add amount cross-check before processing settlement:

```typescript
// After line 60 (order found), before line 68
const expectedAmount = order.totalAmount;
const webhookAmount = parseInt(gross_amount, 10);
if (webhookAmount !== expectedAmount) {
  console.error('[Webhook] Amount mismatch', { order_id, expectedAmount, webhookAmount });
  return NextResponse.json({ received: false }, { status: 400 });
}
```

---

## 3. WEBHOOK IDEMPOTENCY

### ⚠️ Partial: Settlement is idempotent, but cancellation is not

**File:** `app/api/webhooks/midtrans/route.ts:62–65`

```typescript
if (order.status === 'paid' && transaction_status === 'settlement') {
  return success({ received: true, note: 'already_processed' });
}
```

**Settlement (✅):** The check `order.status === 'paid'` combined with `transaction_status === 'settlement'` prevents double-processing. A second settlement webhook for an already-paid order returns early. ✅

**Cancellation (⚠️):** The cancel/deny/expire branch at line 236 has **no idempotency guard**. If Midtrans sends multiple `expire` webhooks for the same order:

1. First `expire` webhook: `order.status` changes from `pending_payment` → `cancelled`. Points and coupon are reversed.
2. Second `expire` webhook: Runs the same cancellation logic again. Points are restored a second time (double-refund), `usedCount` decremented twice (over-corrects coupon usage count).

**Fix:**

```typescript
// After line 65, add cancellation idempotency check
if (order.status === 'cancelled' && ['cancel', 'deny', 'expire'].includes(transaction_status)) {
  return success({ received: true, note: 'already_cancelled' });
}
```

---

## 4. ERROR HANDLING AT INTEGRATION BOUNDARIES

### RajaOngkir: ⚠️ No graceful fallback — silent failure when all couriers fail

**File:** `lib/rajaongkir/calculate-cost.ts:79–82`

```typescript
} catch {
  // If a courier fails, skip it and try others
  continue;
}
```

The per-courier loop gracefully skips individual courier failures ✅. However, if **all couriers fail** (e.g., full API outage or rate limit 429), the function returns `ShippingUnavailableResponse` with a WhatsApp fallback message ✅. This is acceptable UX.

The underlying `rajaOngkirPost` in `lib/rajaongkir/client.ts:43–76` throws on non-200 responses. Network errors are caught and re-thrown with context. ✅

### Midtrans: ✅ Timeout wrapper exists

**File:** `lib/midtrans/status.ts:24,33–52`

The `checkTransactionStatus` function wraps the core API call in `withTimeout` with a 15-second limit. `withTimeout` uses `AbortController` and throws `IntegrationError` with status 408 on timeout. ✅

### Resend: ✅ Non-blocking — errors are caught and logged

**File:** `lib/resend/send-email.ts:11–26`

```typescript
export async function sendEmail(params: SendEmailParams): Promise<void> {
  try {
    await resend.emails.send({ ... });
  } catch (error) {
    console.error('[Email] Failed to send email:', error);
    // Never throw — email failures are non-critical
  }
}
```

And in the webhook handler at `app/api/webhooks/midtrans/route.ts:174–206, 210–234, 267–301`, each email send is wrapped in its own try/catch block. The webhook returns `200 OK` immediately after the DB transaction regardless of email success. ✅ This is correct per the master rule "Send emails async — never block webhook or API response".

### Minimax: ⚠️ Errors propagate to client as 500

**File:** `lib/services/minimax.ts:117–150` and `app/api/ai/caption/route.ts:45–51`

```typescript
// lib/services/minimax.ts:136–140
if (!response.ok) {
  const errorText = await response.text();
  console.error('[Minimax API Error]', response.status, errorText);
  throw new Error(`Minimax API error: ${response.status}`);
}
```

```typescript
// app/api/ai/caption/route.ts:45–51
} catch (error) {
  console.error('[AI Caption POST]', error);
  return NextResponse.json(
    { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
    { status: 500 }
  );
}
```

Errors propagate upward and are caught at the route level. The user gets a generic `'Internal server error'` message. This is acceptable for a superadmin-only endpoint but could be improved with a typed `IntegrationError` check to return a more specific message (e.g., "AI service unavailable, please try again later").

---

## 5. TIMEOUT AND RETRY LOGIC

### Finding: Inconsistent timeout coverage

**Library of utilities:** `lib/utils/integration-helpers.ts`

- `withTimeout<T>(fn, ms, context)` — wraps with `AbortController`, throws `IntegrationError` with status 408 on timeout ✅
- `withRetry<T>(fn, options)` — exponential backoff with jitter, max 2 retries by default, retries on 408/429/500/502/503/504 ✅

**Where `withTimeout` IS used:**
| Location | Timeout |
|----------|---------|
| `lib/midtrans/status.ts:33` | 15 seconds |

**Where `withTimeout` IS NOT used (🔴):**

| File | Function | Issue |
|------|----------|-------|
| `lib/rajaongkir/client.ts:20–25` | `rajaOngkirGet` | No timeout. Fetch can hang indefinitely. |
| `lib/rajaongkir/client.ts:51–60` | `rajaOngkirPost` | No timeout. Fetch can hang indefinitely. |
| `lib/services/minimax.ts:117–134` | `generateProductCaption` | No timeout. Fetch can hang indefinitely. |
| `lib/services/minimax.ts:160–177` | `generateBlogContent` | No timeout. Fetch can hang indefinitely. |

**Note on RajaOngkir caching:** `rajaOngkirGet` at line 24 uses `next: { revalidate: 3600 }`, which is Next.js ISR caching. This helps for GET responses (cities, provinces) but does **not** apply to POST requests like `/cost`. The RajaOngkir starter plan allows 25 requests/second — the cost endpoint is unprotected without caching or rate limit awareness.

### 🔴 Fix for RajaOngkir client

**File:** `lib/rajaongkir/client.ts:12–41` — add timeout:

```typescript
export async function rajaOngkirGet<T>(endpoint: string): Promise<T> {
  const apiKey = process.env.RAJAONGKIR_API_KEY;
  if (!apiKey) {
    throw new Error('RAJAONGKIR_API_KEY is not set');
  }

  let res: Response;
  try {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 10_000);
    res = await fetch(`${RAJAONGKIR_BASE_URL}${endpoint}`, {
      headers: { key: apiKey },
      next: { revalidate: 3600 },
      signal: controller.signal,
    });
    clearTimeout(timer);
  } catch (err) {
    if ((err as Error).name === 'AbortError') {
      throw new Error('RajaOngkir API timeout after 10s');
    }
    throw new Error(`RajaOngkir network error: ${err instanceof Error ? err.message : String(err)}`);
  }

  if (!res.ok) {
    throw new Error(`RajaOngkir API error: ${res.status}`);
  }

  const data: RajaOngkirResponse<T> = await res.json();

  if (data.rajaongkir.status.code !== 200) {
    throw new Error(`RajaOngkir error: ${data.rajaongkir.status.description}`);
  }

  return data.rajaongkir.results;
}
```

Apply the same pattern to `rajaOngkirPost` at lines 43–76.

### 🔴 Fix for Minimax calls

**File:** `lib/services/minimax.ts:117–134` — add timeout and use `withRetry`:

```typescript
const controller = new AbortController();
const timer = setTimeout(() => controller.abort(), 30_000);
const response = await fetch(`${MINIMAX_API_URL}/text/chatcompletion_pro`, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${getMinimaxApiKey()}`,
  },
  body: JSON.stringify({ ... }),
  signal: controller.signal,
});
clearTimeout(timer);
```

Note: `minimax.ts` does not import from `integration-helpers.ts` — it could use `withRetry` and `withTimeout` helpers directly.

---

## 6. RESEND EMAIL FAILURES

### Finding: ✅ Correctly handled — non-blocking with try/catch per email

**File:** `lib/resend/send-email.ts:22–25`

```typescript
} catch (error) {
  console.error('[Email] Failed to send email:', error);
  // Never throw — email failures are non-critical
}
```

The `sendEmail` function catches all errors and never throws. Each email send in the webhook is independently wrapped in a try/catch, so a failure in the pickup invitation email does not affect the confirmation email or the webhook response. ✅

**Risk (🟡):** If `RESEND_API_KEY` is invalid or Resend is down, all confirmation emails silently fail. The `console.error` at line 205 in the webhook is the only signal. A monitoring alert should be added for email failures in production.

---

## 7. RAJAONGKIR RATE LIMITS

### Finding: ⚠️ RajaOngkir starter plan (25 req/s) is unprotected for cost calls

**RajaOngkir starter plan limits:** 25 requests/second. The `/cost` endpoint (POST) is not cached by Next.js ISR — every checkout shipping-rate request hits RajaOngkir directly.

**What exists:**
- Per-courier failure tolerance: the loop in `calculate-cost.ts:52–83` skips individual courier failures, so 1 failing courier doesn't block others. ✅
- ISR caching on GET endpoints (cities, provinces): `lib/rajaongkir/client.ts:24` ✅

**What's missing:**
- No caching on `/cost` POST results (cannot use `next: { revalidate }` on POST)
- No per-request retry with backoff for rate limit (429) responses
- `withRetry` from `lib/utils/integration-helpers.ts` exists but is **not used** by RajaOngkir functions

**Impact:** If a customer repeatedly tries checkout (e.g., debugging or malicious), RajaOngkir can rate-limit, causing `calculateShippingCost` to return `ShippingUnavailableResponse` with the WhatsApp fallback — blocking the customer's checkout.

**Fix:** Wrap `rajaOngkirPost` with `withRetry` using `retryableStatuses: [429, 503]` (rate limit is a retryable error):

```typescript
import { withRetry } from '@/lib/utils/integration-helpers';

// In calculateShippingCost, wrap the post call:
const results = await withRetry(
  () => rajaOngkirPost<RajaOngkirCostResult[]>('/cost', { ... }),
  { maxRetries: 2, retryableStatuses: [429, 503], context: 'RajaOngkir.calculateCost' }
);
```

---

## 8. CLOUDINARY UPLOAD FLOW

### Finding: ✅ Server-signed, role-protected, but client-side validation gap

**Authorization:** `app/api/upload/route.ts:16–27`

```typescript
const session = await auth();
if (!session?.user) return unauthorized(...);
const role = (session.user as { role?: string }).role;
if (!role || !['superadmin', 'owner'].includes(role)) return forbidden(...);
```

Only `superadmin` and `owner` roles can generate signed upload parameters. ✅

**Signing:** `lib/cloudinary/upload.ts:39–71`

```typescript
const signature = cloudinary.utils.api_sign_request(params, process.env.CLOUDINARY_API_SECRET!);
return { signature, timestamp, cloudName, apiKey, folder, publicId };
```

Uses `CLOUDINARY_API_SECRET` server-side to sign the request. The signature and timestamp are returned to the client for direct Cloudinary upload. ✅

**🟢 Minor: No file size/type validation in the signed params response**

The `generateSignedUploadParams` function returns upload parameters but does not include `max_file_size` or `allowed_formats` in the signature. Cloudinary's signed uploads can be constrained with these parameters — without them, a malicious admin could upload files larger than expected.

**Note:** This is a defense-in-depth gap. The bigger protection is that only trusted roles (superadmin, owner) can access this endpoint. The client-side Cloudinary widget should enforce file type/size limits independently.

---

## 9. OAUTH SESSION STRATEGY

### Finding: ✅ NextAuth database session strategy — middleware uses correct pattern

**NextAuth config:** `lib/auth/index.ts:47`

```typescript
session: { strategy: 'database' },
```

NextAuth v5 with `DrizzleAdapter` stores sessions in the database. `auth()` reads from the database session table. ✅

**Middleware:** `app/middleware.ts:5–7`

```typescript
const session = await auth();
```

Middleware calls `auth()` directly — no `getToken()` or JWT handling. This is ✅ correct for database sessions in NextAuth v5. The session object already contains `user.id` and `user.role` as set by the session callback at `lib/auth/index.ts:48–56`. ✅

**No JWT inconsistency:** Unlike NextAuth v4 which used JWT by default, NextAuth v5 with a database adapter does not use JWT for session storage. `getToken()` from `next-auth/jwt` would return `null` here. The codebase correctly uses `auth()` everywhere.

### 🟢 Minor: `getToken` import exists in worktree but not in main branch

The search found `getToken` referenced in worktree files, but the main branch `lib/auth/index.ts` and `app/middleware.ts` use `auth()` correctly. No action needed.

---

## 10. MINIMAX AI

### Finding: ✅ Superadmin role check, Zod input validation, but MINIMAX_GROUP_ID missing

**Role check:** `app/api/ai/caption/route.ts:15–20`

```typescript
if (session.user.role !== 'superadmin') {
  return NextResponse.json(
    { success: false, error: 'Forbidden - Superadmin only', code: 'FORBIDDEN' },
    { status: 403 }
  );
}
```

✅ Only `superadmin` can access AI generation.

**Input validation:** `app/api/ai/caption/route.ts:23–35`

```typescript
const schema = z.object({
  productName: z.string().min(1),
  productDescription: z.string().min(10),
  language: z.enum(['id', 'en']).default('id'),
  tone: z.enum(['professional', 'playful', 'luxurious', 'warm']).default('warm'),
});
```

User inputs are validated with Zod before being passed to the AI service. ✅

**🔴 Critical: `MINIMAX_GROUP_ID` is not in `.env.local`**

The code at `lib/services/minimax.ts:49–55` reads `process.env.MINIMAX_GROUP_ID`:

```typescript
function getMinimaxGroupId(): string {
  const groupId = process.env.MINIMAX_GROUP_ID;
  if (!groupId) {
    throw new Error('MINIMAX_GROUP_ID is not configured');
  }
  return groupId;
}
```

But `.env.local` does not contain `MINIMAX_GROUP_ID`. The call will throw at runtime when any admin tries to use AI caption generation. This is a **hard runtime failure**, not a graceful degradation.

---

## 11. ENVIRONMENT PARITY

### Finding: `.env.example` documents `MINIMAX_GROUP_ID` but `.env.local` is missing it

| Variable | `.env.example` | `.env.local` | Used in production code |
|----------|--------------|--------------|----------------------|
| `MINIMAX_GROUP_ID` | ✅ | ❌ Missing | `lib/services/minimax.ts:51` — will throw if called |

All other variables in `.env.local` match what is used in production code. ✅

**Note on real values in `.env.local`:** The `.env.local` file contains real API keys for Midtrans sandbox, RajaOngkir, Cloudinary, Resend, and Minimax. This is the development environment file and is correctly listed in `.gitignore`. No issue here — just noting that these are **not production keys**.

---

## SUMMARY TABLE

| Area | Status | Rating |
|------|--------|--------|
| API key exposure (server keys not NEXT_PUBLIC) | ✅ All correct | 🟢 |
| API key exposure (MINIMAX_GROUP_ID missing from .env.local) | 🔴 | Critical |
| Midtrans webhook SHA512 signature | ✅ Correct | 🟢 |
| Midtrans webhook idempotency (settlement) | ✅ Correct | 🟢 |
| Midtrans webhook idempotency (cancellation) | ⚠️ Missing | 🟡 Major |
| RajaOngkir no timeout on GET/POST | 🔴 | Critical |
| RajaOngkir no retry on rate limit | ⚠️ | Major |
| RajaOngkir no cost endpoint caching | ⚠️ | Major |
| Minimax no timeout on API calls | 🔴 | Critical |
| Minimax no retry on failure | ⚠️ | Major |
| Resend email non-blocking | ✅ Correct | 🟢 |
| Cloudinary server-signed upload | ✅ Correct | 🟢 |
| Cloudinary client-side file validation | 🟢 Gap | Minor |
| OAuth session: database strategy + middleware consistency | ✅ Correct | 🟢 |
| AI superadmin role check | ✅ Correct | 🟢 |
| AI Zod input validation | ✅ Correct | 🟢 |
| AI MINIMAX_GROUP_ID missing | 🔴 | Critical |
| Amount cross-check in Midtrans webhook | 🟢 Gap | Minor |
| RajaOngkir per-courier fault tolerance | ✅ Correct | 🟢 |

---

## ACTION ITEMS (Priority Order)

### 🔴 P0 — Must fix before production

1. **Add `MINIMAX_GROUP_ID`** to `.env.local` — the AI caption/blog endpoint will hard-crash without it
2. **Add timeouts to RajaOngkir** `rajaOngkirGet` and `rajaOngkirPost` (`lib/rajaongkir/client.ts`) — 10s timeout per call
3. **Add timeouts to Minimax** `generateProductCaption` and `generateBlogContent` (`lib/services/minimax.ts`) — 30s timeout per call

### 🟡 P1 — Should fix before production

4. **Add cancellation idempotency** to `app/api/webhooks/midtrans/route.ts` — prevent double-processing if Midtrans sends multiple cancel/deny/expire webhooks
5. **Wrap RajaOngkir cost calls with `withRetry`** using `retryableStatuses: [429, 503]` — prevent checkout blockage on rate limit
6. **Add `withRetry` to Minimax calls** — at minimum retry once on 429/5xx

### 🟢 P2 — Nice to have

7. **Add `max_file_size` and `allowed_formats` to Cloudinary signed upload params** — defense in depth
8. **Add webhook amount cross-check** in Midtrans settlement handler — validate `gross_amount === order.totalAmount` before processing
9. **Add email failure monitoring** — currently `console.error` is the only signal on Resend failures in production
10. **Add Minimax-specific error message** in `app/api/ai/caption/route.ts` — return `"AI service unavailable"` instead of generic 500