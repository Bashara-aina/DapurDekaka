---
title: "Critical Fix Roadmap — Priority 1 Bugs"
audit-date: "2026-05-23"
scope: "All CRITICAL severity issues found across 5 audit reports"
severity: "CRITICAL"
files-affected: "ALL CRITICAL BUG FILES"
---

# Critical Fix Roadmap — All Critical Bugs

**Date:** 2026-05-23
**Purpose:** Prioritized fix order for all CRITICAL severity bugs found across the 5 audit reports.

---

## CRITICAL BLOCKERS (Fix before any launch)

---

### 🔴 CRITICAL-1: Webhook Signature Verification Missing

**File:** `app/api/webhooks/midtrans/route.ts`

**What:** Midtrans webhook accepts payment notifications WITHOUT verifying the `x-midtrans-signature` SHA-512 hash. Anyone can POST fake payment notifications and make the system think orders were paid.

**Fix:**
```typescript
// FIRST line of webhook handler — before any processing
const signature = request.headers.get('x-midtrans-signature');
const rawBody = await request.text(); // Use raw body for signature
const expectedHash = crypto.createHash('sha512')
  .update(MIDTRANS_SERVER_KEY + rawBody)
  .digest('hex');

if (signature !== expectedHash) {
  console.error('[webhook/midtrans] Invalid signature');
  return Response.json({ error: 'Invalid signature' }, { status: 401 });
}

const body = JSON.parse(rawBody);
```

**Priority:** #1 — Payment fraud vulnerability

---

### 🔴 CRITICAL-2: Order `pointsEarned` Undefined in Net-30 Block

**File:** `app/api/checkout/initiate/route.ts` line ~611

**What:** B2B Net-30 orders crash when awarding loyalty points because `order` variable doesn't exist in the Net-30 handler block. Should be `created`.

**Fix:**
```typescript
// Change this:
if (userId && order.pointsEarned > 0) {
  const earnedPoints = order.pointsEarned;

// To this:
if (userId && created.pointsEarned > 0) {
  const earnedPoints = created.pointsEarned;
```

**Priority:** #2 — B2B Net-30 orders silently fail to award points

---

### 🔴 CRITICAL-3: Payment Retry Endpoint Does Not Exist

**File:** `app/api/checkout/retry/route.ts` — **FILE MISSING**

**What:** Customers cannot retry failed payments. Any retry attempt returns 404.

**Fix:** Create `app/api/checkout/retry/route.ts`:
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { eq } from 'drizzle-orm';
import { orders } from '@/lib/db/schema';
import { getMidtransOrderId } from '@/lib/services/midtrans';

const MAX_RETRIES = 3;

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const { orderNumber } = await req.json();

    if (!orderNumber) {
      return Response.json({ success: false, error: 'Order number required' }, { status: 400 });
    }

    const order = await db.query.orders.findFirst({
      where: eq(orders.orderNumber, orderNumber),
    });

    if (!order) {
      return Response.json({ success: false, error: 'Order not found' }, { status: 404 });
    }

    if (order.userId && session?.user?.id !== order.userId) {
      return Response.json({ success: false, error: 'Unauthorized' }, { status: 401 });
    }

    // Check retry count from midtransOrderId
    const retryMatch = order.midtransOrderId?.match(/retry-(\d+)$/);
    const retryCount = retryMatch ? parseInt(retryMatch[1]) : 0;

    if (retryCount >= MAX_RETRIES) {
      return Response.json({ success: false, error: 'Maximum retries exceeded' }, { status: 400 });
    }

    // Create new Midtrans order ID
    const newRetryCount = retryCount + 1;
    const newMidtransOrderId = getMidtransOrderId(order, newRetryCount);

    // Create new Midtrans transaction
    const midtransService = await import('@/lib/services/midtrans');
    const transaction = await midtransService.createTransaction({
      orderId: newMidtransOrderId,
      amount: order.totalAmount,
      customerName: order.recipientName,
      customerEmail: order.recipientEmail,
      customerPhone: order.recipientPhone,
    });

    // Update order with new snap token
    await db.update(orders)
      .set({
        midtransOrderId: newMidtransOrderId,
        snapToken: transaction.token,
        paymentExpiresAt: new Date(Date.now() + 15 * 60 * 1000),
      })
      .where(eq(orders.id, order.id));

    return Response.json({ success: true, data: { snapToken: transaction.token } });
  } catch (error) {
    console.error('[checkout/retry]', error);
    return Response.json({ success: false, error: 'Internal server error' }, { status: 500 });
  }
}
```

**Priority:** #3 — Payment retry completely missing

---

### 🔴 CRITICAL-4: Buy X Get Y Coupon — No Stock Validation for Free Items

**File:** `app/api/checkout/initiate/route.ts` lines 258-285

**What:** Free items from buy_x_get_y coupons are added to order WITHOUT checking if they're in stock. Stock could go negative.

**Fix:**
```typescript
// In the Buy X Get Y block, after filtering qualifying variants:
const selectedVariants = qualifyingVariants
  .filter(v => v.stock > 0) // ADD THIS
  .slice(0, getQty);

// ADD THIS check:
if (selectedVariants.length < getQty) {
  throw new ApiError(422, `Stok tidak mencukupi untuk item gratis. Hanya ${selectedVariants.length} item tersedia.`);
}
```

**Priority:** #4 — Negative stock possible with Buy X Get Y

---

### 🔴 CRITICAL-5: ProductDetailClient Entirely Hardcoded in Indonesian

**File:** `components/store/products/ProductDetailClient.tsx`

**What:** Every UI string on the product detail page is hardcoded Indonesian. Language toggle is non-functional for the most important conversion page.

**Fix:** Replace ALL hardcoded strings with translation keys. Example:
```tsx
// BEFORE:
<p>Pilih Varian</p>

// AFTER:
<p>{t('variant.select')}</p>
```

All strings must be moved to `i18n/messages/id.json` and `i18n/messages/en.json`.

**Priority:** #5 — i18n broken on conversion-critical page

---

### 🔴 CRITICAL-6: B2B Quote Send Email & Download PDF Buttons Disabled

**File:** `app/(admin)/admin/b2b-quotes/[id]/page.tsx`

**What:** Both "Kirim Quote via Email" and "Download PDF" buttons are permanently disabled with "Fitur dalam pengembangan" tooltip. The entire B2B sales workflow is non-functional.

**Fix options:**
1. **Quick fix:** Remove the disabled buttons from the UI to avoid confusion
2. **Proper fix:** Implement PDF generation and email sending

Until properly implemented, remove the buttons:
```tsx
// Remove or comment out:
<button disabled className="..." title="Fitur dalam pengembangan">
  Kirim Quote via Email
</button>
```

**Priority:** #6 — B2B workflow completely broken

---

### 🔴 CRITICAL-7: No Stock Reservation at Order Initiate

**File:** `app/api/checkout/initiate/route.ts`

**What:** Stock is validated but NOT reserved at initiate time. Only deducted on webhook after payment. This creates a race condition where two customers can confirm orders for the same stock.

**Fix:** Add stock reservation at initiate. This requires a larger change — either:
1. Add `reservedQty` column to `productVariants` and `stock_reservations` table
2. Or use a SELECT FOR UPDATE pattern in the transaction

**Temporary mitigation:** Ensure the webhook ALWAYS rolls back if affected rows = 0. This is already implemented via `result.length === 0` check.

**Priority:** #7 — Potential oversell, race condition

---

## QUICK FIX REFERENCE TABLE

| # | File | Line | Bug | Fix (1 sentence) |
|---|------|------|-----|------------------|
| C1 | `app/api/webhooks/midtrans/route.ts` | webhook entry | Missing signature verification | Add SHA-512 hash check against x-midtrans-signature header |
| C2 | `app/api/checkout/initiate/route.ts` | ~611 | `order` undefined in Net-30 | Change `order.pointsEarned` to `created.pointsEarned` |
| C3 | `app/api/checkout/retry/route.ts` | MISSING | Retry endpoint 404 | Create the retry route handler |
| C4 | `app/api/checkout/initiate/route.ts` | 258-285 | Buy X Get Y no stock check | Filter variants with `stock > 0` and add validation |
| C5 | `components/store/products/ProductDetailClient.tsx` | ALL | Hardcoded Indonesian | Replace all strings with `t()` from next-intl |
| C6 | `app/(admin)/admin/b2b-quotes/[id]/page.tsx` | disabled buttons | B2B workflow broken | Remove or implement PDF/email |
| C7 | `app/api/checkout/initiate/route.ts` | initiate | No stock reservation | Add reservation pattern or ensure rollback on 0 affected rows |

---

*End of Critical Fix Roadmap*