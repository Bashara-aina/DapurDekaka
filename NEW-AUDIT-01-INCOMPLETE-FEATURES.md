# NEW AUDIT 01 — Incomplete & Missing Features
# DapurDekaka.com — PRD Intent vs. Actual Implementation
**Date:** May 2026 | **Scope:** Everything the PRD promised that isn't fully built

---

## LEGEND
- ✅ Complete and working
- ⚠️ Partially implemented — has functional stub but missing critical parts
- ❌ Not built — page/component/API doesn't exist or is hardcoded placeholder
- 🔴 Blocks launch
- 🟡 Major UX regression
- 🟢 Minor gap / polish

---

## 1. CHECKOUT FLOW — INCOMPLETE ELEMENTS

### 1.1 Order Notes Field — No UI
**Status:** ❌ 🟡  
**PRD Reference:** Section 5.1 — "Customer can write order notes"  
**File:** `app/(store)/checkout/page.tsx`

`customerNote` exists in the `CheckoutFormData` type (line 65) and is passed to the API (line 366), but there is **zero UI element** rendering a textarea or input for it. A customer cannot write any order note. The field state is hardcoded to empty string (line 99: `customerNote: ''`).

**Fix Required:**
```tsx
// Add to Step 5 (Order Review) in checkout/page.tsx, before the "Bayar Sekarang" button:
<div className="space-y-2">
  <label className="text-sm font-medium text-text-primary">
    Catatan Pesanan <span className="text-text-secondary font-normal">(opsional)</span>
  </label>
  <textarea
    {...register('customerNote')}
    placeholder="Misal: Tolong dikemas rapi, hadiah ulang tahun"
    rows={3}
    className="w-full px-3 py-2 border border-border rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-brand-red/20"
    maxLength={500}
  />
</div>
```

---

### 1.2 "Coba Lagi" Button Logic on Failed Page
**Status:** ⚠️ 🟡  
**PRD Reference:** Section 5.4 — "Show 'Coba Lagi' button that creates a new order with same items"  
**File:** `app/(store)/checkout/failed/page.tsx`

The page renders a "Coba Lagi" button but it simply links to `/checkout`. It does NOT restore cart items from the failed order. Since stock was never deducted on failure, the cart items should still be valid.

**Current behavior:** User lands on `/checkout/failed` with an empty cart (Midtrans failure clears localStorage cart in `MidtransPayment.tsx`). The "Coba Lagi" button sends them to an empty checkout page.

**Fix Required:** Read the failed order number from search params, fetch order items from `/api/orders/[orderNumber]`, then restore cart via `useCartStore`. Alternatively, do NOT clear cart on `onPending`/`onError` callbacks in `MidtransPayment.tsx` — only clear on `onSuccess`.

```tsx
// MidtransPayment.tsx — only clear cart on SUCCESS, not on error/close
onSuccess: (result) => {
  clearCart(); // ← correct, clear here
  router.push(`/checkout/success?order=${orderNumber}`);
},
onPending: (result) => {
  // Do NOT clear cart here — user might want to retry
  router.push(`/checkout/pending?order=${orderNumber}`);
},
onError: (result) => {
  // Do NOT clear cart here
  router.push(`/checkout/failed?order=${orderNumber}`);
},
```

---

### 1.3 Pre-fill Identity Form from Session
**Status:** ❌ 🟡  
**PRD Reference:** Section 5.2 Step 1 — "If not logged in: collect fields. Logged-in: pre-fill from session"  
**File:** `app/(store)/checkout/page.tsx`

Logged-in users still see an empty identity form. `session.user.name`, `session.user.email` are available but not used to seed `defaultValues`.

**Fix Required:**
```tsx
// In checkout/page.tsx, useEffect or defaultValues:
const { data: session } = useSession();

const form = useForm<CheckoutFormData>({
  defaultValues: {
    recipientName: session?.user?.name ?? '',
    recipientEmail: session?.user?.email ?? '',
    recipientPhone: '',  // phone not in session, fetch from /api/account/profile
    customerNote: '',
    // ...rest
  }
});

// Or in a useEffect after session loads:
useEffect(() => {
  if (session?.user) {
    form.setValue('recipientName', session.user.name ?? '');
    form.setValue('recipientEmail', session.user.email ?? '');
  }
}, [session]);
```

---

### 1.4 "Sudah Punya Akun?" Prompt on Identity Step
**Status:** ❌ 🟢  
**PRD Reference:** Section 5.2 Step 1 — "Show optional login/register prompt (non-blocking)"  
**File:** `app/(store)/checkout/page.tsx`

No login prompt appears for guests on the identity form step. PRD requires a subtle "Already have an account? Sign in" nudge to encourage account creation without blocking the flow.

---

### 1.5 Pickup Step Flow — Stepper Shows Wrong Count
**Status:** ⚠️ 🟡  
**PRD Reference:** Section 5.2 — "Pickup skips shipping step"  
**File:** `app/(store)/checkout/page.tsx`

When pickup is selected, the courier/shipping step is skipped but the `CheckoutStepper` still shows 4 or 5 steps. The step count in the visual progress indicator should dynamically reflect the actual flow (3 steps for pickup, 5 for delivery).

**Fix Required:** Pass a `totalSteps` prop to `CheckoutStepper` that is computed based on `deliveryMethod`.

---

### 1.6 Store Address Info on Pickup Selection
**Status:** ❌ 🟡  
**PRD Reference:** Section 5.6 — "Show store address, opening hours, map embed when user picks pickup"  
**File:** `components/store/checkout/DeliveryMethodToggle.tsx`

When "Ambil Sendiri" is selected, there is no inline display of:
- Store address: Jl. Sinom V no. 7, Turangga, Bandung
- Opening hours (from `system_settings`)
- Google Maps embed link

**Fix Required:** Read `store_address` and `store_hours` from `system_settings` in the checkout page server action and pass down to `DeliveryMethodToggle`, which should conditionally show this info when `deliveryMethod === 'pickup'`.

---

## 2. PRODUCT MANAGEMENT — ADMIN GAPS

### 2.1 Product Create/Edit — Missing Form Submission Wiring
**Status:** ⚠️ 🟡  
**File:** `app/(admin)/admin/products/new/page.tsx`, `app/(admin)/admin/products/[id]/page.tsx`

`ProductForm` component exists and the API routes (`POST /api/admin/products`, `PATCH /api/admin/products/[id]`) exist. However, the `new/page.tsx` uses a **server action pattern** (`async function handleSubmit() { 'use server' }`) that may conflict with the client-side `ProductForm` component expecting a regular async function.

**Check Required:**
```tsx
// new/page.tsx — this pattern may silently fail if ProductForm is 'use client'
async function handleSubmit(data: ProductFormData) {
  'use server';  // ← Cannot call server actions from client components this way in Next.js 14
  // ...
}
```

The correct approach: either use a `<form action={serverAction}>` pattern (App Router) OR keep ProductForm as client and have it call `/api/admin/products` via `fetch`. Mixing `'use server'` inline in page components that pass to client components is a known Next.js 14 gotcha.

**Fix Required:** Convert the product create/edit pages to use `fetch('/api/admin/products', ...)` in the client `ProductForm` component rather than server actions.

---

### 2.2 Product Image Upload Flow
**Status:** ⚠️ 🟡  
**Files:** `app/api/admin/upload/route.ts`, `app/api/admin/products/[id]/images/route.ts`

The Cloudinary upload utility (`lib/cloudinary/upload.ts`) uses signed uploads but the implementation reads a file from disk via `fs.readFile`. This won't work in production Vercel (no filesystem access). The `/api/admin/upload` route must handle `FormData` multipart file upload directly and stream to Cloudinary.

**Fix Required:** Use Cloudinary's `upload_stream` with a Buffer from `file.arrayBuffer()`:
```typescript
// lib/cloudinary/upload.ts — server-side streaming approach
import { Readable } from 'stream';

export async function uploadBufferToCloudinary(buffer: Buffer, folder: string) {
  return new Promise((resolve, reject) => {
    const uploadStream = cloudinary.uploader.upload_stream(
      { folder: CLOUDINARY_FOLDERS[folder as CloudinaryFolder] },
      (error, result) => { if (error) reject(error); else resolve(result); }
    );
    Readable.from(buffer).pipe(uploadStream);
  });
}
```

---

## 3. B2B SYSTEM — LARGELY STUB

### 3.1 B2B Quotes Page — Data Not Loaded
**Status:** ⚠️ 🟡  
**File:** `app/(b2b)/b2b/account/quotes/page.tsx`

The page is a client component that checks authentication but shows a static "empty" message with no data fetching. There is no call to `/api/b2b/quotes` or any data loading. Even if quotes exist in the database, a B2B customer will always see an empty quotes list.

**Fix Required:** Add a `useQuery` to fetch quotes from `/api/b2b/quotes` (the route already exists and returns the user's quotes based on their B2B profile ID).

---

### 3.2 B2B Orders Page — Data Not Loaded  
**Status:** ⚠️ 🟡  
**File:** `app/(b2b)/b2b/account/orders/page.tsx`

Same issue as quotes page — no data fetching, static empty state shown regardless of actual order history.

**Fix Required:** Fetch from `/api/admin/orders?b2bUserId={userId}` or create a dedicated `/api/b2b/orders` endpoint that filters by the authenticated B2B user.

---

### 3.3 B2B Checkout Flow — Entirely Missing
**Status:** ❌ 🟡  
**PRD Reference:** Section 4.1, B2B portal features  

B2B customers can browse the `/b2b/products` catalog with B2B pricing displayed, but there is no path for them to actually place an order. There is no "Add to Cart" on B2B product cards, no B2B-specific checkout with Net-30 terms, no B2B order creation.

**Gap:** B2B customers who want to order must use the regular B2C checkout which will apply B2C prices, not B2B prices.

---

### 3.4 B2B PDF Quote Generation
**Status:** ❌ 🟢  
**PRD Reference:** Section 4.2 — "B2B quote builder + PDF"  
**Schema:** `b2b_quotes.pdf_url` exists  

Admin can create quotes via `/api/admin/b2b-quotes`, but there is no PDF generation step. The `pdf_url` column is always null. When a quote is `sent` to a B2B customer, they cannot download it as a PDF.

---

### 3.5 B2B Account Role Enforcement (Client-Side Gap)
**Status:** ⚠️ 🟡  
**File:** `app/(b2b)/b2b/account/page.tsx` (line 25–31)

The page only checks `status === 'unauthenticated'` but NOT whether the logged-in user actually has the `b2b` role. Any customer with a regular account who knows the URL can access the B2B account dashboard client-side. The middleware does protect this at the server level, but the client component should also validate role for defense-in-depth.

**Fix Required:**
```tsx
useEffect(() => {
  if (status === 'unauthenticated') {
    router.push('/login?callbackUrl=/b2b/account');
  }
  // ADD THIS:
  if (status === 'authenticated' && session?.user?.role !== 'b2b' && session?.user?.role !== 'superadmin') {
    router.push('/b2b'); // Redirect to B2B landing
  }
}, [status, session, router]);
```

---

## 4. INTERNATIONALIZATION — PARTIALLY WIRED

### 4.1 Translation Keys Not Used in Components
**Status:** ⚠️ 🟡  
**Files:** `i18n/messages/en.json`, `i18n/messages/id.json`, all store components

The `next-intl` library is configured (`i18n/routing.ts`, `i18n/request.ts`), message files exist, and `next.config.ts` wraps with `createNextIntlPlugin`. However, no store-facing components appear to call `useTranslations()` or `getTranslations()`. All UI strings are hardcoded in Indonesian/English simultaneously as JSX.

**Impact:** The language toggle (if it exists) does nothing. `users.languagePreference` is stored in DB but never applied.

**Verification Required:** Check if `en.json` and `id.json` have actual translation keys or are empty. Run:
```bash
cat i18n/messages/en.json | wc -l
cat i18n/messages/id.json | wc -l
```
If < 50 lines each, the translation system is only scaffolded, not implemented.

---

### 4.2 Language Switcher Component
**Status:** ⚠️ 🟢  
**File:** `components/store/layout/LanguageSwitcher.tsx`

Component exists but may not call `router.push()` with the locale prefix or update `users.languagePreference`. Needs end-to-end testing.

---

## 5. CUSTOMER ACCOUNT FEATURES

### 5.1 Account Profile Page — No Phone Pre-fill
**Status:** ⚠️ 🟢  
**File:** `app/(store)/account/profile/page.tsx`

Page fetches profile from `/api/account/profile` and renders a form with `name`, `phone`, `languagePreference`. However, if the user registered via Google OAuth, `phone` will be null. The form should handle this gracefully with a placeholder message explaining why phone is empty.

---

### 5.2 Vouchers Page — Only Shows Public Coupons
**Status:** ⚠️ 🟢  
**File:** `app/api/account/vouchers/route.ts`

The vouchers API returns `isPublic = true` coupons. But personal coupons (private codes sent to specific customers) will never appear here. The PRD intent is to show coupons relevant to the user, but there is no user-specific coupon targeting system implemented.

---

### 5.3 Points History Pagination
**Status:** ⚠️ 🟢  
**File:** `app/api/account/points/route.ts`

Returns last 50 points history records (hardcoded `limit: 50`). For power users with many transactions this will truncate history. Add proper pagination with `page` + `limit` query params.

---

## 6. ADMIN FEATURES

### 6.1 Admin Users Management — No Create Endpoint
**Status:** ❌ 🟡  
**File:** `app/api/admin/users/route.ts`

`GET /api/admin/users` exists. `PATCH /api/admin/users/[id]` exists for role changes. But **`POST /api/admin/users`** does not exist. To add a new warehouse staff member:
1. They must register via the public `/register` page (gets `customer` role)
2. Superadmin must then PATCH their role to `warehouse`

There is no way to directly create a user with a non-customer role from the admin panel.

**Fix Required:** Add `POST /api/admin/users/route.ts` that creates a user with a specified role, bypassing the public registration flow.

---

### 6.2 Admin Customers — No Paginated List API
**Status:** ⚠️ 🟡  
**File:** `app/(admin)/admin/customers/page.tsx`

The customers page directly queries the DB (`db.query.users.findMany({ limit: 100 })`) as a server component. There is no `/api/admin/customers` list route (the `[id]` route exists but not the collection route). This means:
- No client-side search or filter on customers
- Limit hardcoded to 100 (breaks at scale)
- No export-friendly API layer

**Fix Required:** Create `app/api/admin/customers/route.ts` with pagination, search by name/email, and filterable by `isActive`, `role`, date range.

---

### 6.3 Admin Settings Page — System Settings Write
**Status:** ⚠️ 🟢  
**File:** `app/(admin)/admin/settings/page.tsx`

The settings page (`GET /api/admin/settings`) exists to read settings. `PUT /api/admin/settings/[key]` exists to update individual settings. But if the settings page only shows read-only values without inline edit fields, superadmin cannot update settings via the UI.

**Verify:** Does the settings page render editable inputs with save buttons, or is it read-only?

---

### 6.4 Admin Revenue Chart — Missing 30-Day Chart
**Status:** ❌ 🟢  
**PRD Reference:** Section 4.2 — "Revenue chart (last 30 days)" (P1 feature)

The dashboard shows KPI cards and various widgets, but no time-series revenue chart. The `recharts` library is installed. No API endpoint exists for `GET /api/admin/dashboard/revenue-chart` that returns daily revenue for the last 30 days.

---

## 7. BLOG CMS

### 7.1 Blog Pages — Data Fetching Not Verified
**Status:** ⚠️ 🟢  
**Files:** `app/(store)/blog/page.tsx`, `app/(store)/blog/[slug]/page.tsx`

Blog pages exist but need verification that they fetch from the `blog_posts` table, filter by `isPublished = true`, and handle empty state (no published posts on fresh install).

---

### 7.2 Blog Admin — TipTap Editor Image Upload
**Status:** ⚠️ 🟢  
**File:** `components/admin/blog/TiptapEditor.tsx`

TipTap editor has an image extension installed. But there needs to be a custom upload handler that calls `/api/admin/upload` to upload images to Cloudinary before inserting the URL. Without this, the editor's image insert either doesn't work or accepts external URLs only (which violates CSP `img-src` policy).

---

## 8. HOMEPAGE — MINOR GAPS

### 8.1 Instagram Feed — Static Placeholders
**Status:** ⚠️ 🟢  
**File:** `components/store/home/InstagramFeed.tsx`

Shows 6 hardcoded Cloudinary placeholder URLs, not a real Instagram feed. This is explicitly "Out of Scope V1" per PRD Section 10, so it's acceptable but should be documented for the admin: "these images need to be manually updated in the component."

---

### 8.2 Featured Products — Empty State
**Status:** ❌ 🟢  
If no products have `isFeatured = true`, the FeaturedProducts section renders a blank container. Add an empty state message or conditionally hide the section.

---

### 8.3 Testimonials — Empty State
**Status:** ❌ 🟢  
Same issue as above for the Testimonials section when no testimonials are seeded.

---

## 9. EMAIL SYSTEM — MISSING TEMPLATES

### 9.1 Cancellation Email Never Sent
**Status:** ❌ 🟡  
**PRD Reference:** Section 8.5 — "Any → cancelled: Email Pesanan dibatalkan"

The `OrderCancellationEmail` template exists but is **never called**. When an admin cancels an order via `PUT /api/admin/orders/[id]/status` with `status: cancelled`, no email is sent. The webhook does send cancellation emails on Midtrans cancel/deny, but admin-initiated cancellations are silent.

**File:** `app/api/admin/orders/[id]/status/route.ts` (line ~233)

**Fix Required:** Add non-blocking email send after status update to `cancelled`:
```typescript
if (newStatus === 'cancelled') {
  sendEmail({
    to: order.recipientEmail,
    subject: `Pesanan ${order.orderNumber} Dibatalkan`,
    react: OrderCancellationEmail({ order }),
  }).catch(err => console.error('[Email] Cancellation email failed:', err));
}
```

---

### 9.2 B2B Inquiry — No Admin Notification Email
**Status:** ❌ 🟢  
**File:** `app/api/b2b/inquiry/route.ts`

When a B2B inquiry is submitted, it saves to `b2b_inquiries` and returns success but does NOT send a notification email to admin. Superadmin would only know about new inquiries by checking the `/admin/b2b-inquiries` dashboard.

**Fix Required:** After successful insert, send a `B2BInquiryNotification` email to `RESEND_FROM_EMAIL` (or a configurable admin email in `system_settings`).

---

## 10. TRACKING & DELIVERY LINKS

### 10.1 Deep-link Courier Tracking
**Status:** ❌ 🟢  
**PRD Reference:** Section 8.4 — Courier-specific deep-link URLs

When an order is shipped, the tracking number is stored. But the customer-facing order tracking page and emails may not include a clickable deep-link to the courier's tracking page. PRD specifies:
- SiCepat: `https://www.sicepat.com/checkAwb?awb=[trackingNumber]`
- JNE: `https://www.jne.co.id/id/tracking/trace/[trackingNumber]`
- AnterAja: `https://anteraja.id/tracking/[trackingNumber]`

**Verify:** Does `components/store/orders/TrackingInfo.tsx` generate courier-specific URLs or just display the raw tracking number?

---

## SUMMARY — PRIORITIZED INCOMPLETE FEATURES

| Priority | Feature | File(s) to Fix | Est. Complexity |
|----------|---------|---------------|----------------|
| 🔴 P0 | Order notes textarea at checkout | `checkout/page.tsx` | 30 min |
| 🔴 P0 | Cancellation email on admin cancel | `admin/orders/[id]/status/route.ts` | 30 min |
| 🟡 P1 | Pre-fill identity form from session | `checkout/page.tsx` | 1 hr |
| 🟡 P1 | "Coba Lagi" preserves cart on failure | `checkout/failed/page.tsx`, `MidtransPayment.tsx` | 2 hrs |
| 🟡 P1 | B2B account pages fetch real data | `b2b/account/quotes/page.tsx`, `b2b/account/orders/page.tsx` | 2 hrs |
| 🟡 P1 | Admin users — POST create endpoint | `api/admin/users/route.ts` | 1 hr |
| 🟡 P1 | Admin customers — paginated list API | `api/admin/customers/route.ts` | 2 hrs |
| 🟡 P1 | B2B account role enforcement (client) | `b2b/account/page.tsx` | 30 min |
| 🟢 P2 | Store address info on pickup selection | `DeliveryMethodToggle.tsx` | 1 hr |
| 🟢 P2 | B2B inquiry admin notification email | `api/b2b/inquiry/route.ts` | 30 min |
| 🟢 P2 | Revenue 30-day chart in dashboard | new API + dashboard component | 4 hrs |
| 🟢 P3 | i18n translation keys in components | All store components | 8 hrs |
| 🟢 P3 | B2B PDF quote generation | `api/admin/b2b-quotes/[id]/route.ts` | 4 hrs |
