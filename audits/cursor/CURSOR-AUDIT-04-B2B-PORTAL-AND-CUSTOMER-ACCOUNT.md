# CURSOR AUDIT 04 — B2B Portal & Customer Account Features
**Project:** DapurDekaka.com  
**Date:** 2026-05-15  
**Scope:** B2B portal end-to-end, customer account pages, points history, addresses, profile

---

## Overview

The B2B portal has most pieces in place but the PDF quote generation is unimplemented (the most valuable B2B feature per the PRD). The customer account is functional but has UX gaps that harm repeat purchase behavior (points expiry warnings not visible, address management needs polish). All pages exist and render — the issues are functional gaps within the pages.

---

## B2B PORTAL

### BUG 01 — B2B Quote PDF Generation Not Implemented

**Severity:** High — this is the #1 B2B conversion feature per PRD  
**Files:**  
- `app/(b2b)/b2b/account/quotes/page.tsx` (shows "Download PDF" button)  
- `app/(admin)/admin/b2b-quotes/[id]/page.tsx` (admin creates quotes)  
- `lib/db/schema.ts:b2bQuotes.pdfUrl` (always null)  

### What's broken

The B2B quote list in the customer portal shows a "Download PDF" button, but `quote.pdfUrl` is always `null` because no code ever generates or uploads a PDF:

```tsx
// app/(b2b)/b2b/account/quotes/page.tsx
{quote.pdfUrl && (
  <a href={quote.pdfUrl} target="_blank" className="...">
    <Download className="w-4 h-4" />
    Download PDF
  </a>
)}
// ← button never shows because pdfUrl is always null
```

The admin quote creation page has no PDF generation trigger either.

### What to build

Three options for PDF generation:
- **Option A (Recommended for V1):** Generate PDF client-side using `@react-pdf/renderer` when admin clicks "Kirim ke Customer". Upload to Cloudinary, save URL to `b2bQuotes.pdfUrl`.
- **Option B:** Use a headless browser (Puppeteer/Playwright) via a dedicated API route.
- **Option C:** Use an HTML-to-PDF service like jspdf.

For V1 simplicity, Option A is best:

```ts
// app/api/admin/b2b-quotes/[id]/generate-pdf/route.ts (new file)
import { renderToBuffer } from '@react-pdf/renderer';
import { B2BQuotePDF } from '@/components/pdf/B2BQuotePDF';
// ... generate, upload to Cloudinary, update b2bQuotes.pdfUrl
```

```tsx
// components/pdf/B2BQuotePDF.tsx (new file)
import { Document, Page, Text, View, StyleSheet } from '@react-pdf/renderer';
// Quote layout: company header, quote number, line items, totals, payment terms, expiry
```

---

### BUG 02 — B2B Points: Earn Rate Applied Twice (4x Instead of 2x)

**Severity:** High — B2B customers earn 4x points instead of the intended 2x  
**Files:**  
- `app/api/checkout/initiate/route.ts:238-240` (calculates 2x during order creation)  
- `app/api/webhooks/midtrans/route.ts:122-128` (doubles again when awarding)  

### What's broken

During checkout initiate:
```ts
// app/api/checkout/initiate/route.ts:238-240
const pointsEarnedBase = Math.floor(totalAmount / 1000) * POINTS_EARN_RATE;
const pointsEarned = isB2bOrder ? pointsEarnedBase * 2 : pointsEarnedBase;
// ← pointsEarned saved to orders.pointsEarned ALREADY includes 2x
```

During webhook settlement, when awarding:
```ts
// app/api/webhooks/midtrans/route.ts:122-128
const userRecord = await tx.query.users.findFirst({...columns: { role: true }});
const isB2B = userRecord?.role === 'b2b';
const earnedPoints = isB2B ? order.pointsEarned * 2 : order.pointsEarned;
// ← doubles order.pointsEarned AGAIN → B2B gets 4x
```

`order.pointsEarned` already contains the 2x multiplied value. The webhook multiplies it again.

### Fix

The webhook should trust `order.pointsEarned` as the final value (already calculated correctly by initiate). Remove the 2x multiplication in the webhook:

```ts
// app/api/webhooks/midtrans/route.ts — replace lines 122-128 with:
const earnedPoints = order.pointsEarned; // already includes 2x for B2B (set at checkout)
```

Remove the `userRecord` fetch for `role` entirely from this block — it's no longer needed.

---

### INCOMPLETE FEATURE 01 — B2B Products Page: Doesn't Show B2B Pricing

**Severity:** Medium — B2B customers see regular prices, defeating the bulk pricing value prop  
**File:** `app/(b2b)/b2b/products/page.tsx`

### What to verify / fix

Check if `app/(b2b)/b2b/products/page.tsx` fetches `productVariants.b2bPrice` and shows it instead of regular price. The query should include variants with `b2bPrice`, and only show products where `products.isB2bAvailable = true`.

If the page shows regular prices, update the product query:

```ts
// In the B2B products page, ensure query returns b2bPrice:
const products = await db.query.products.findMany({
  where: and(
    eq(products.isActive, true),
    eq(products.isB2bAvailable, true),  // ← B2B only
    isNull(products.deletedAt)
  ),
  with: {
    variants: {
      where: eq(productVariants.isActive, true),
    },
    images: { limit: 1 },
  },
});

// In the product card, show b2bPrice:
const displayPrice = variant.b2bPrice ?? variant.price;
// Also show "Harga B2B" badge to make it clear
```

---

### INCOMPLETE FEATURE 02 — B2B Account Page Missing Points Balance

**Severity:** Low — B2B customers earn double points but can't see their balance  
**File:** `app/(b2b)/b2b/account/page.tsx`

The B2B account page exists. Verify it shows:
- Points balance (fetch from `/api/b2b/points` if it exists, or `/api/account/points`)
- Link to full points history

The route `app/api/b2b/points/route.ts` exists — check if it's wired up in the account page.

---

### INCOMPLETE FEATURE 03 — B2B Inquiry Form: No Auto-Reply Confirmation Email

**Severity:** Low — B2B leads don't get confirmation they'll be contacted  
**File:** `app/api/b2b/inquiry/route.ts`

Verify that after a B2B inquiry is submitted, both:
1. `B2BInquiryNotification.tsx` email fires to admin (notify Bashara)
2. `B2BInquiryAutoReply.tsx` email fires to the submitter (confirm receipt)

Templates exist in `lib/resend/templates/`. Check if the inquiry route sends both.

---

## CUSTOMER ACCOUNT

### BUG 03 — Account Orders Page: Uses Inefficient In-Memory Pagination

**Severity:** Medium — fetches ALL orders then slices in JS, will be slow at scale  
**File:** `app/(store)/account/orders/page.tsx:28-39`

```ts
// CURRENT (WRONG):
const allOrders = await db.query.orders.findMany({
  where: (orders, { eq }) => eq(orders.userId, session.user.id!),
  // ← fetches ALL orders, no limit
  orderBy: (orders, { desc }) => [desc(orders.createdAt)],
});
const totalOrders = allOrders.length;
const orders = allOrders.slice(offset, offset + perPage);  // in-memory slice
```

### Fix

Use database-level pagination:

```ts
// app/(store)/account/orders/page.tsx
import { count, desc, eq } from 'drizzle-orm';

const [orderRows, countResult] = await Promise.all([
  db.query.orders.findMany({
    where: (o, { eq }) => eq(o.userId, session.user.id!),
    with: { items: true },
    orderBy: (o, { desc }) => [desc(o.createdAt)],
    limit: perPage,
    offset,
  }),
  db.select({ total: count() }).from(orders)
    .where(eq(orders.userId, session.user.id!)),
]);

const totalOrders = countResult[0]?.total ?? 0;
```

---

### BUG 04 — Account Dashboard Shows Wrong "Total Pesanan" Count

**Severity:** Low — shows count of last 5 orders, not total orders  
**File:** `app/(store)/account/page.tsx:28-35`

```ts
// CURRENT (WRONG):
const recentOrders = await db.query.orders.findMany({
  where: ...,
  limit: 5,   // ← fetches 5, but UI shows count as if it's total
});

// Later in JSX:
<p className="text-2xl font-bold">{recentOrders.length || 0}</p>
// ← shows max 5, not actual total
```

### Fix

```ts
// Add separate count query:
const [recentOrders, totalOrderCount] = await Promise.all([
  db.query.orders.findMany({ ... limit: 5 }),
  db.select({ count: count() }).from(orders)
    .where(eq(orders.userId, session.user.id!)),
]);
const totalOrders = totalOrderCount[0]?.count ?? 0;

// In JSX:
<p className="text-2xl font-bold">{totalOrders}</p>
```

---

### INCOMPLETE FEATURE 04 — Points Page: Expiry Warning Not Prominent

**Severity:** Medium — customers don't know about expiring points, reduces repeat purchase motivation  
**File:** `app/(store)/account/points/page.tsx`

Verify the points page:
1. Shows a red/yellow banner if any points expire within 30 days
2. Shows each points transaction with its expiry date
3. Shows the FIFO consumption order (oldest points used first)
4. Shows `expire` type transactions as "Kedaluwarsa" in red

The API `GET /api/account/points` should return `expiringCount` and `expiringAmount`. Check if the frontend uses these fields to show a warning.

---

### INCOMPLETE FEATURE 05 — Profile Page: Phone Number Not Saved to DB

**Severity:** Medium — without phone number, checkout always requires re-entering phone  
**File:** `app/(store)/account/profile/page.tsx`

Verify:
1. The profile form includes a phone number field
2. Saving calls `PATCH /api/account/profile` with the phone number
3. The profile API at `app/api/account/profile/route.ts` saves `users.phone`
4. After saving, the checkout page uses the saved phone (requires Audit 01 BUG 04 fix)

---

### INCOMPLETE FEATURE 06 — Vouchers Page: Shows Generic Empty State

**Severity:** Low — customers can't see available coupons for their account  
**File:** `app/(store)/account/vouchers/page.tsx`

The vouchers page calls `GET /api/account/vouchers`. This route at `app/api/account/vouchers/route.ts` should return:
- Public coupons (`isPublic = true`) that the user hasn't used yet and haven't expired
- Any personalized coupons assigned to this user

Check if the vouchers API returns data and the page renders it. If the API returns an empty array (because no `isPublic` coupons are seeded), the page shows "Tidak ada voucher" which is technically correct but misleading.

---

### INCOMPLETE FEATURE 07 — Order Detail in Account: No PDF Receipt Download Button

**Severity:** Medium — P0 requirement per PRD: "Customer can download PDF receipts"  
**File:** `app/(store)/account/orders/[orderNumber]/page.tsx`

The account order detail page should show a "Download Bukti Pembayaran" button that links to:
```
/api/orders/{orderNumber}/receipt
```

The receipt API exists at `app/api/orders/[orderNumber]/receipt/route.ts`. Verify the button exists in the account order detail page.

---

## B2B QUOTE REQUEST FLOW (end-to-end trace)

```
Customer visits /b2b/quote
    ↓
Fills form (QuoteForm component)
    ↓
POST /api/b2b/inquiry (if anonymous) OR request to be contacted
    ↓
Admin sees inquiry in /admin/b2b-inquiries
    ↓
Admin creates quote in /admin/b2b-quotes/new
    ↓
Admin sends quote (status: draft → sent)
    ↓
Customer sees quote in /b2b/account/quotes
    ↓
Customer accepts/rejects via PATCH /api/b2b/quotes/[id]/[action]
    ↓
If accepted: Admin manually processes order
```

**Gap:** The quote acceptance doesn't automatically create an order. When a B2B customer accepts a quote, they get a status change but no way to actually pay. This is an explicit V2 gap per PRD Section 10, but the flow should at minimum redirect to WhatsApp or show payment instructions after acceptance.

---

## CHECKLIST FOR CURSOR

- [ ] Remove B2B points 2x multiplier from `app/api/webhooks/midtrans/route.ts` (already multiplied in initiate)
- [ ] Create `app/api/admin/b2b-quotes/[id]/generate-pdf/route.ts` and `components/pdf/B2BQuotePDF.tsx`
- [ ] Verify `app/(b2b)/b2b/products/page.tsx` shows `b2bPrice` and filters by `isB2bAvailable`
- [ ] Fix account orders pagination in `app/(store)/account/orders/page.tsx` (use DB limit/offset)
- [ ] Fix account dashboard total orders count in `app/(store)/account/page.tsx`
- [ ] Verify points page shows expiry warnings and individual expiry dates
- [ ] Verify profile page saves phone number and API updates `users.phone`
- [ ] Add PDF receipt download button to account order detail page
- [ ] Verify B2B inquiry route sends both admin notification and customer auto-reply emails
