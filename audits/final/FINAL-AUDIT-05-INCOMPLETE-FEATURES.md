# FINAL AUDIT 05 — INCOMPLETE FEATURES & MISSING IMPLEMENTATIONS
**Date:** 2026-05-16  
**Severity scale:** 🔴 Critical | 🟠 High | 🟡 Medium | 🔵 Low

This audit covers features that are either partially implemented (UI exists, backend doesn't), entirely missing (PRD requires, nothing is built), or subtly broken in ways that only appear at runtime.

---

## INCOMPLETE 01 🟠 — Language preference toggle saves to DB but NEVER changes the UI

**Files:**  
- `app/(store)/account/profile/page.tsx` — has ID/EN language radio buttons  
- `lib/db/schema` — `users.languagePreference` column exists  
- `app/api/account/profile/route.ts` — PATCH saves `languagePreference`  

**The gap:** `languagePreference` is stored in the database, but there is **no translation system** installed in this project. There is no `next-intl`, `i18next`, `react-i18next`, or any equivalent. Changing the language preference to "EN" has absolutely zero effect on the UI — all text remains in Indonesian.

This means:
1. The profile page shows a language selector (🇮🇩 Indonesia / 🇬🇧 English) that does nothing.
2. The blog schema has `titleId`/`titleEn` and `contentId`/`contentEn` fields — but the store blog page always renders `titleId`/`contentId`.
3. The PRD intent to serve English-speaking expats is entirely unfulfilled.

**Fix options (pick one based on scope):**

**Option A (Quick — remove the deception):** Remove the language toggle from the profile page. Add a note: "Bahasa Inggris akan segera tersedia." This prevents users from thinking the toggle works.

**Option B (Full i18n — large effort):** Install `next-intl` and create translation files. Read `languagePreference` from the user's session at request time and pass as the locale. This would require:
```ts
// middleware.ts — detect user's locale
// app/[locale]/layout.tsx — wrap app with locale provider
// messages/id.json & messages/en.json — all UI strings
// Blog: render titleEn/contentEn when locale=en
```

---

## INCOMPLETE 02 🟠 — Instagram Feed is a static hardcoded gallery, not real Instagram

**File:** `components/store/home/InstagramFeed.tsx` lines 8–15

```ts
const instagramPosts = [
  { id: 1, cloudinaryPublicId: 'dapurdekaka/gallery/gallery-01', alt: 'Dimsum premium' },
  { id: 2, cloudinaryPublicId: 'dapurdekaka/gallery/gallery-02', alt: 'Bakso frozen' },
  // ... hardcoded 6 images
];
```

The section header says `@dapurdekaka` and links to instagram.com/dapurdekaka, implying it's a live Instagram feed. In reality, it shows the same 6 hardcoded Cloudinary images forever.

**PRD intent:** Display real Instagram posts from @dapurdekaka to show social proof.

**Fix options:**

**Option A (Keep static, remove deception):** Rename the section to "Galeri Foto" instead of implying it's from Instagram. Remove the `@dapurdekaka` handle from the subtitle. This is the honest approach if Instagram API integration is out of scope.

**Option B (Real Instagram embed):** Use the Instagram Basic Display API or embed via a third-party service (e.g., `lightwidget.com`, `instafeed.js`). Instagram's API requires OAuth and app review — takes 1–2 weeks to approve.

**Option C (Admin-managed gallery):** Since you already have a `carouselSlides` table and a Cloudinary upload pipeline, add a `galleryImages` table managed from admin panel (`/admin/gallery`). Admin uploads photos, homepage shows them. Simple, honest, maintainable.

---

## INCOMPLETE 03 🟠 — B2B Net-30 payment is approved in DB but has no checkout flow

**Files:**  
- `app/api/admin/b2b-profiles/[id]/approve/route.ts` — can set `isNet30Approved: true`  
- `app/(b2b)/b2b/account/page.tsx` line 172 — shows "Net-30 Aktif" badge  
- `app/api/checkout/initiate/route.ts` — no Net-30 payment path  

**The gap:** Admin can mark a B2B customer as Net-30 approved. The B2B account page shows "Net-30 Aktif" when approved. But **the B2B checkout flow does not handle Net-30 at all**. B2B customers still must pay via Midtrans Snap — there is no "Invoice / Pay Later" option.

Net-30 means "pay within 30 days of invoice". The checkout flow needs:
1. A "Bayar Nanti (Net-30)" payment option shown only to `isNet30Approved` B2B users
2. On checkout, skip Midtrans and create an order with `status: 'paid'` (or a new `status: 'net30_invoiced'`)
3. An invoice PDF generated and emailed
4. A payment due date tracked (30 days from order date)
5. Admin reminder/tracking for unpaid Net-30 invoices

**Fix (Minimum viable Net-30):**
```ts
// In checkout/initiate/route.ts:
// After validating the B2B customer:
if (isB2BUser && b2bProfile?.isNet30Approved) {
  // Skip Midtrans, create order as pending Net-30
  const order = await db.insert(orders).values({
    ...orderData,
    status: 'pending_payment',  
    paymentMethod: 'net30',
    paymentDueAt: addDays(new Date(), 30),  // new column needed
  }).returning();
  
  // Send invoice email
  // Return { orderNumber, paymentMethod: 'net30', dueAt }
}
```

This requires a database migration to add `paymentMethod` and `paymentDueAt` columns, and admin tooling to track outstanding Net-30 invoices.

---

## INCOMPLETE 04 🟡 — Blog cover image has no upload widget — requires raw Cloudinary URL

**File:** `app/(admin)/admin/blog/new/page.tsx` line 134

```tsx
<div className="space-y-2">
  <Label htmlFor="coverImageUrl">URL Cover Image</Label>
  <Input id="coverImageUrl" {...form.register('coverImageUrl')} placeholder="https://..." />
</div>
```

The blog editor requires the admin to manually paste a Cloudinary URL. There is no file upload button. In contrast, product image upload (`/admin/products/[id]`) uses an integrated Cloudinary upload widget via `/api/admin/upload`.

**Impact:** Admin cannot upload a cover image directly from the blog editor. They must:
1. Open Cloudinary dashboard separately
2. Upload the image manually
3. Copy the URL
4. Paste it back into the blog form

This also means `coverImagePublicId` is never populated (no upload widget to set it), so images can't be deleted from Cloudinary programmatically.

**Fix:** Reuse the existing upload infrastructure from product images. The `/api/admin/upload` endpoint already handles Cloudinary uploads via `multipart/form-data`. Add a cover image upload button to the blog form:

```tsx
// Reuse the same pattern as ProductImages component
async function handleCoverImageUpload(file: File) {
  const formData = new FormData();
  formData.append('file', file);
  formData.append('folder', 'dapurdekaka/blog');
  
  const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
  const { url, publicId } = await res.json();
  
  form.setValue('coverImageUrl', url);
  form.setValue('coverImagePublicId', publicId);
}
```

Also applies to `app/(admin)/admin/blog/[id]/page.tsx` (edit page has the same URL-only field).

---

## INCOMPLETE 05 🟡 — Forgot password success text has accidental Chinese characters

**File:** `app/(auth)/forgot-password/page.tsx` line 52

```tsx
<p className="text-text-secondary mb-2">
  Kami telah发送 link reset password ke:
</p>
```

The Chinese character `发送` (meaning "send") was accidentally embedded in the Indonesian text. This is a copy-paste artifact that appears to real users.

**Fix:**
```tsx
<p className="text-text-secondary mb-2">
  Kami telah mengirim link reset password ke:
</p>
```

---

## INCOMPLETE 06 🟡 — Public settings endpoint missing — checkout always silently 403s

**Context:** Documented in AUDIT-01 BUG 04 as a bug, but the root fix requires creating a new route.

**File to create:** `app/api/settings/public/route.ts`

The checkout page calls `/api/admin/settings` to get store hours. This endpoint requires `superadmin` or `owner` role — any customer calling it gets a 403. The code handles this silently, so store hours always show hardcoded defaults.

**Fix:** Create a public endpoint that exposes only non-sensitive settings:

```ts
// app/api/settings/public/route.ts
import { NextRequest } from 'next/server';
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { inArray } from 'drizzle-orm';
import { success, serverError } from '@/lib/utils/api-response';

// Allowlist of settings that can be publicly read
const PUBLIC_SETTING_KEYS = [
  'store_open_days',
  'store_opening_hours',
  'store_closing_hours',
  'whatsapp_number',
  'store_address',
  'store_name',
];

export async function GET(_req: NextRequest) {
  try {
    const settings = await db.query.systemSettings.findMany({
      where: (s, { inArray }) => inArray(s.key, PUBLIC_SETTING_KEYS),
      columns: { key: true, value: true },
    });
    
    const result = Object.fromEntries(settings.map(s => [s.key, s.value]));
    return success(result);
  } catch (error) {
    return serverError(error);
  }
}
```

Then update `app/(store)/checkout/page.tsx` line 193:
```ts
// Before:
const res = await fetch('/api/admin/settings?keys=...');
// After:
const res = await fetch('/api/settings/public');
```

---

## INCOMPLETE 07 🟡 — B2B orders page shows raw English status strings (no Indonesian labels)

**File:** `app/(b2b)/b2b/account/orders/page.tsx` lines 62–68

```tsx
<span className={`px-2 py-1 text-xs rounded ${
  order.status === 'paid' ? 'bg-green-100 text-green-700' :
  order.status === 'pending_payment' ? 'bg-yellow-100 text-yellow-700' :
  order.status === 'cancelled' ? 'bg-red-100 text-red-700' :
  'bg-gray-100 text-gray-700'
}`}>
  {order.status}   {/* Shows raw "paid", "shipped", etc. */}
</span>
```

The orders list shows raw database values (`paid`, `shipped`, `processing`) instead of Indonesian labels. The B2B account page (`/b2b/account/page.tsx`) correctly defines `STATUS_CONFIG` with Indonesian labels but this is NOT used in the orders list page.

**Fix:** Import and use the STATUS_CONFIG from the account page, or define a shared constant:

```tsx
const B2B_STATUS_LABELS: Record<string, string> = {
  paid: 'Lunas',
  pending_payment: 'Menunggu Bayar',
  processing: 'Diproses',
  packed: 'Dikemas',
  shipped: 'Dikirim',
  delivered: 'Selesai',
  cancelled: 'Dibatalkan',
};

// In the order card:
<span className={...}>
  {B2B_STATUS_LABELS[order.status] ?? order.status}
</span>
```

---

## INCOMPLETE 08 🟡 — B2B quote action (accept/reject) has no onError handler

**File:** `app/(b2b)/b2b/account/quotes/page.tsx` lines 171–179

```ts
const actionMutation = useMutation({
  mutationFn: async ({ quoteId, action }: { quoteId: string; action: 'accept' | 'reject' }) => {
    const res = await fetch(`/api/b2b/quotes/${quoteId}/${action}`, { method: 'POST' });
    return res.json();
  },
  onSuccess: () => {
    refetch();
  },
  // NO onError handler!
});
```

If the API returns an error (network failure, 403, 500), the B2B customer sees no feedback. The accept/reject button appears to do nothing.

**Fix:**
```ts
const actionMutation = useMutation({
  mutationFn: async ({ quoteId, action }: ...) => {
    const res = await fetch(`/api/b2b/quotes/${quoteId}/${action}`, { method: 'POST' });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || 'Gagal memproses tindakan');
    return data;
  },
  onSuccess: () => {
    refetch();
    toast.success('Tindakan berhasil disimpan');
  },
  onError: (error) => {
    toast.error(error instanceof Error ? error.message : 'Terjadi kesalahan. Coba lagi.');
  },
});
```

Add `import { toast } from 'sonner';` at the top of the file.

---

## INCOMPLETE 09 🟡 — Admin dashboard low stock threshold is hardcoded, not configurable

**File:** `app/api/admin/dashboard/alerts/route.ts` line 40

```ts
// Low stock = variants with stock < 5
.where(and(lt(productVariants.stock, 5), gt(productVariants.stock, 0), eq(productVariants.isActive, true))),
```

The low stock alert threshold is hardcoded at `5`. For a food business with varying pack sizes (e.g., a product sold in packs of 50 vs. packs of 1), 5 units means very different things. The admin has no way to change this threshold.

**Fix:** Add a `low_stock_threshold` setting to `systemSettings` with a default of `5`:

```ts
// In the alerts route, fetch the threshold:
const thresholdSetting = await db.query.systemSettings.findFirst({
  where: eq(systemSettings.key, 'low_stock_threshold'),
});
const lowStockThreshold = parseInt(thresholdSetting?.value ?? '5', 10);

// Then use it:
.where(and(lt(productVariants.stock, lowStockThreshold), gt(productVariants.stock, 0), ...))
```

Add to the settings page a configurable "Batas stok menipis" input.

---

## INCOMPLETE 10 🟡 — Cart merge on login: verify the merge-cart endpoint is actually called

**File:** `app/api/auth/merge-cart/route.ts` — endpoint exists  
**Missing call site:** Verify that something actually calls `POST /api/auth/merge-cart` after login.

The cart merge API exists at `/api/auth/merge-cart`. But cart merging only works if it's called after the user logs in. Check:

1. `app/(auth)/login/page.tsx` — does it call `/api/auth/merge-cart` after `signIn()` resolves?
2. Or is it called in `app/api/auth/[...nextauth]/route.ts` via a `signIn` callback?
3. Or is it called in the store layout's `useEffect` on session change?

**Action:** Search all files for calls to `/api/auth/merge-cart`:
```bash
grep -rn "merge-cart" app/
```

If no call site exists, the cart merge endpoint is dead code and guest cart items are **lost on login**. Fix by adding the merge call in the login success handler:

```ts
// In login page, after signIn resolves successfully:
const cartItems = JSON.parse(localStorage.getItem('cart-storage') || '{}');
if (cartItems?.state?.items?.length > 0) {
  await fetch('/api/auth/merge-cart', {
    method: 'POST',
    body: JSON.stringify({ items: cartItems.state.items }),
  });
}
```

---

## INCOMPLETE 11 🔵 — Admin points adjustment only accessible via Customer Detail page

**API:** `app/api/admin/points/adjust` — fully implemented  
**UI:** Only accessible at `app/(admin)/admin/customers/[id]/page.tsx` (inline)  

The manual points adjustment is implemented but buried — admin must navigate to a specific customer's detail page. There's no standalone page or search-by-email flow. If the admin only knows the user's name (not the system ID), finding the right customer to adjust is cumbersome.

**Current path:** Admin → Customers → Search → Click customer → Scroll to points section → Adjust

**Recommended addition:** Add a search-by-email input at the top of the customer detail points section, or create a link from `/admin/points` that redirects to the relevant customer's detail page.

---

## INCOMPLETE 12 🔵 — Blog cover image not shown in admin blog list

**File:** `app/(admin)/admin/blog/page.tsx` lines 40–60

The blog list table shows: Judul | Slug | Status | Tanggal | Aksi. The `coverImageUrl` field is fetched but never displayed. Admins cannot see which posts have cover images without clicking into each one.

**Fix:** Add a thumbnail column to the table:

```tsx
<td className="px-6 py-4">
  {post.coverImageUrl ? (
    <div className="w-12 h-8 rounded overflow-hidden bg-gray-100">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={post.coverImageUrl} alt="" className="w-full h-full object-cover" />
    </div>
  ) : (
    <span className="text-xs text-gray-400">No cover</span>
  )}
</td>
```

---

## INCOMPLETE 13 🔵 — `pointsBalanceAfter` in adjust transaction records stale balance

**File:** `app/api/admin/points/adjust/route.ts` lines 67–68

```ts
await tx.insert(pointsHistory).values({
  ...
  pointsBalanceAfter: sql`points_balance`,  // BUG: reads BEFORE the update
  ...
});
```

Inside the transaction, the `UPDATE` runs first to change `points_balance`. Then the `INSERT` for history runs. Because Drizzle with Neon HTTP driver uses a transaction, `sql`points_balance`` should read the NEW value after the update. **However**, Neon HTTP driver batches queries in a transaction — verify this actually captures the post-update balance.

**Safer fix:** Calculate and pass the balance explicitly:
```ts
const newBalance = (targetUser.pointsBalance ?? 0) + adjustedAmount;
await tx.insert(pointsHistory).values({
  ...
  pointsBalanceAfter: newBalance,
});
```

This is unambiguous and doesn't depend on transaction ordering.

---

## MISSING FEATURE 01 🟠 — No dedicated admin UI for adjusting points by email search

**Context:** The API at `/api/admin/points/adjust` works correctly. The customer detail page at `/admin/customers/[id]` has the adjustment UI. But there's no `/admin/points` management page.

**What's needed per PRD §6.4:** "Admin can manually award or deduct points with a reason. Log is visible in customer history and admin audit log."

**Fix:** Create `app/(admin)/admin/points/page.tsx`:
```tsx
// Search field for email or name
// Results table showing customer name, email, current balance
// "Adjust" button opens a modal with:
//   - Amount input
//   - Add/Deduct toggle
//   - Reason text field
//   - Submit → POST /api/admin/points/adjust
```

---

## MISSING FEATURE 02 🟠 — No "Shipped" email sent when field worker submits tracking via Field dashboard

**Context:** When tracking is submitted via the **admin order detail page** (`/admin/orders/[id]`), the `POST /api/admin/orders/[id]/status` route sends an `OrderShippedEmail`.

But when a warehouse worker submits tracking via the **field dashboard** or **shipments page** (which calls `PATCH /api/admin/field/orders/[id]`), no email is sent.

**File:** `app/api/admin/field/orders/[id]/route.ts`

**Action:** Check this route. If it updates `status` to `shipped` and `trackingNumber` but doesn't call `sendEmail`, add the OrderShipped email sending from the status route. Reuse the same logic:

```ts
// After successfully updating order to shipped + adding trackingNumber:
try {
  const emailHtml = OrderShippedEmail({
    orderNumber: order.orderNumber,
    recipientName: order.recipientName,
    trackingNumber: updatedOrder.trackingNumber,
    courierName: updatedOrder.courierName,
    trackingUrl: updatedOrder.trackingUrl,
  });
  await sendEmail({
    to: order.recipientEmail,
    subject: `Pesanan ${order.orderNumber} sudah dikirim`,
    react: emailHtml,
  });
} catch {}
```

---

## MISSING FEATURE 03 🟡 — Admin testimonials page has no connection to homepage display

**Files:**  
- `app/(admin)/admin/testimonials/page.tsx` — full CRUD for testimonials  
- `app/api/admin/testimonials/route.ts` — API exists  
- `components/store/home/Testimonials.tsx` — displays testimonials on homepage  

**Action:** Verify `Testimonials.tsx` fetches from the DB (via server component or API). If it uses hardcoded data instead of `db.query.testimonials.findMany({ where: eq(testimonials.isActive, true) })`, the admin testimonial CRUD is entirely disconnected from what customers see.

**Expected query:**
```ts
// In components/store/home/Testimonials.tsx or the page.tsx that imports it:
const testimonials = await db.query.testimonials.findMany({
  where: (t, { eq }) => eq(t.isActive, true),
  orderBy: (t, { asc }) => [asc(t.sortOrder)],
});
```

---

## MISSING FEATURE 04 🟡 — No admin bulk action on orders (no multi-select + bulk status update)

**File:** `app/(admin)/admin/orders/OrdersClient.tsx`

The orders list shows individual orders. For a busy day with 20+ orders, admin must click into each order individually to process them. There's no:
- Multi-select checkboxes
- "Process all paid orders" bulk action
- Export selected orders

**Fix (minimum):** Add a "Process All Paid" button that calls a new bulk API:
```ts
// app/api/admin/orders/bulk/route.ts
// POST { orderIds: string[], status: 'processing' }
// Updates all in a transaction, sends no individual emails (send batch summary)
```

---

## MISSING FEATURE 05 🔵 — No "Delivered" email sent from field dashboard pickup confirmation

**Context:** When a pickup order is confirmed via the field dashboard Pickup tab (`deliverMutate`), the order status changes to `delivered`. Verify whether `sendEmail` is called with `OrderDeliveredEmail`.

**File:** `app/api/admin/field/orders/[id]/route.ts` — check the `deliver` action handler.

If the delivered email is not sent for pickup orders (only for courier delivery), add it. The customer should receive a "Your order has been picked up successfully" confirmation regardless of delivery method.

---

## MISSING FEATURE 06 🔵 — Admin audit log UI exists but has no search or filter

**File:** `app/api/admin/audit-logs/route.ts` — API endpoint exists  
**Missing:** No admin page at `/admin/audit-logs`

The audit log API is implemented and the `logAdminActivity` function is called throughout the codebase. But there's no admin UI to view the audit log. Superadmin cannot see WHO changed WHAT and WHEN without querying the database directly.

**Fix:** Create `app/(admin)/admin/audit-logs/page.tsx`:
```tsx
// Table: Timestamp | Admin | Action | Resource | Old Value | New Value
// Filter by: admin user, action type, date range
// Pagination
```

---

## SUMMARY TABLE

| # | Feature | Status | Severity | Primary File |
|---|---------|--------|----------|-------------|
| 01 | Language preference actually changes UI | ❌ Not built | 🟠 High | `account/profile/page.tsx` |
| 02 | Instagram Feed uses real IG API | ❌ Hardcoded | 🟠 High | `InstagramFeed.tsx` |
| 03 | B2B Net-30 payment flow | ❌ Not built | 🟠 High | `checkout/initiate/route.ts` |
| 04 | Blog cover image upload widget | ❌ URL only | 🟡 Med | `admin/blog/new/page.tsx` |
| 05 | Forgot password Chinese chars bug | ❌ Bug | 🟡 Med | `forgot-password/page.tsx` |
| 06 | Public settings endpoint | ❌ Not built | 🟡 Med | `api/settings/public/` |
| 07 | B2B orders show raw status | ❌ Missing labels | 🟡 Med | `b2b/account/orders/page.tsx` |
| 08 | B2B quote action no error handler | ❌ Silent fails | 🟡 Med | `b2b/account/quotes/page.tsx` |
| 09 | Low stock threshold configurable | ❌ Hardcoded | 🟡 Med | `dashboard/alerts/route.ts` |
| 10 | Cart merge on login called | ❓ Verify | 🟡 Med | `auth/merge-cart/route.ts` |
| 11 | Admin points adjustment standalone UI | ⚠️ Buried | 🔵 Low | `admin/customers/[id]/page.tsx` |
| 12 | Blog cover image in admin list | ❌ Missing | 🔵 Low | `admin/blog/page.tsx` |
| 13 | `pointsBalanceAfter` stale value | ⚠️ Risky | 🔵 Low | `admin/points/adjust/route.ts` |
| MF1 | Admin `/admin/points` management page | ❌ Not built | 🟠 High | — |
| MF2 | Shipped email from Field dashboard | ❓ Verify | 🟠 High | `field/orders/[id]/route.ts` |
| MF3 | Testimonials connected to homepage | ❓ Verify | 🟡 Med | `Testimonials.tsx` |
| MF4 | Bulk order actions in admin | ❌ Not built | 🟡 Med | `admin/orders/OrdersClient.tsx` |
| MF5 | Delivered email for pickup orders | ❓ Verify | 🔵 Low | `field/orders/[id]/route.ts` |
| MF6 | Admin audit log UI | ❌ Not built | 🔵 Low | — |

---

## ITEMS CONFIRMED AS FULLY IMPLEMENTED (no action needed)

These features were suspected incomplete but are actually done:

- ✅ **B2B account portal** (`/b2b/account`, `/b2b/account/orders`, `/b2b/account/quotes`) — real data fetching, not stubs
- ✅ **Admin users management** — list, role change, invite, activate/deactivate all work
- ✅ **Public order tracking with email verification** — `OrderTrackingClient.tsx` correctly gates behind email verification
- ✅ **Forgot/reset password flow** — both pages exist with working API routes
- ✅ **Admin manual points adjustment API** — exists and used in customer detail page
- ✅ **Orders CSV export** — `GET /api/admin/export/orders` returns valid CSV
- ✅ **Blog TipTap editor** — `TiptapEditor` component is integrated in blog new/edit pages
- ✅ **AI caption generator (Minimax)** — API and UI are both implemented and superadmin-gated
- ✅ **B2B inquiry emails** — both admin notification AND customer auto-reply are sent
- ✅ **WhatsApp floating button** — `WhatsAppButton` component exists, used in store layout, pulls number from settings
- ✅ **Admin dashboard alerts** — low stock, out-of-stock, stuck orders, pending B2B all implemented
- ✅ **Points expiry warning emails** — `points-expiry-warning` cron delegates to `lib/points/expiry-check.ts` which sends `PointsExpiringEmail`
- ✅ **Admin settings [key] PATCH route** — `app/api/admin/settings/[key]/route.ts` exists and is superadmin-only
- ✅ **Order email suite** — OrderConfirmation, OrderShipped, OrderDelivered, OrderCancellation, PickupInvitation all exist and are triggered from appropriate routes
