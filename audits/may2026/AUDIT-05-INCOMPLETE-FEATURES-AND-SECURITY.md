# AUDIT-05 — Incomplete Features & Security Gaps
**Date:** 2026-05-16  
**Scope:** PRD vs implemented features, missing pages/routes, security, auth, B2B portal gaps  
**Severity legend:** 🔴 Critical · 🟠 High · 🟡 Medium · 🟢 Low

---

## SECTION A — Missing Pages (PRD-required, currently 404)

### A-01 🔴 `/account/orders/[orderNumber]` — Account order detail page does not exist

**PRD reference:** Section 3.1 — `/account/orders/[orderNumber] ... Order detail`

**Current state:**  
`app/(store)/account/orders/page.tsx` renders an order list where each order is a clickable row. Clicking a row navigates to `/account/orders/${order.orderNumber}`. But there is **no `[orderNumber]` subdirectory** under `app/(store)/account/orders/`. Every click goes to a 404.

The PUBLIC order tracking page exists at `app/(store)/orders/[orderNumber]/page.tsx` — but this requires email verification for non-logged-in users and has a minimal UI. It is not the full account order detail.

**What the page should show:**
- Full order summary (items, prices, addresses)
- Order status timeline with history
- Download PDF receipt button
- Tracking information (if shipped)
- "Pay Now" button (if still pending_payment)
- Option to contact support

**Fix:** Create `app/(store)/account/orders/[orderNumber]/page.tsx`:

```tsx
import { auth } from '@/lib/auth';
import { redirect, notFound } from 'next/navigation';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';

interface Props {
  params: Promise<{ orderNumber: string }>;
}

export default async function AccountOrderDetailPage({ params }: Props) {
  const { orderNumber } = await params;
  const session = await auth();
  if (!session?.user?.id) redirect('/login');

  const order = await db.query.orders.findFirst({
    where: and(
      eq(orders.orderNumber, orderNumber),
      eq(orders.userId, session.user.id),  // user can only see own orders
    ),
    with: { items: true, statusHistory: true },
  });

  if (!order) notFound();

  return (
    // Render order detail UI — reuse OrderItemsList, OrderTimeline, TrackingInfo components
    // that already exist in components/store/orders/
    <div>...</div>
  );
}
```

---

### A-02 🟠 `/admin/customers/[id]` — Customer detail page does not exist

**PRD reference:** Section 3.3 — `/admin/customers/[id] ... Customer detail`

**Current state:**  
`app/(admin)/admin/customers/page.tsx` exists and shows a customer list. The PRD lists a detail page but `app/(admin)/admin/customers/[id]/` directory does not exist. Any "View" or "Detail" link from the customers list goes to 404.

**What the page should show:**
- User profile (name, email, phone, role, created date)
- Points balance and history
- Order history with status
- B2B profile (if applicable)
- Admin actions: adjust points, deactivate account

**Fix:** Create `app/(admin)/admin/customers/[id]/page.tsx` with server-side auth (superadmin/owner only) and the above data.

---

### A-03 🟠 `/api/orders/[orderNumber]/receipt` — PDF receipt endpoint missing or unverified

**PRD reference:** Section 3.4 — `/api/orders/[orderNumber]/receipt ... PDF receipt download`

**Current state:**  
The success page links to `/api/orders/${orderNumber}/receipt` (line 89):
```tsx
<a href={`/api/orders/${orderNumber}/receipt`}>Unduh Struk PDF</a>
```

But there is **no `receipt` route** in `app/api/orders/[orderNumber]/`. The file listing shows only:
```
app/api/orders/[orderNumber]/route.ts  ← order data API
```

No `receipt/route.ts`. Clicking "Download PDF Receipt" returns a 404.

**What exists:**  
- `components/email/OrderReceiptPDF.tsx` — a React PDF component likely using `@react-pdf/renderer`
- `components/pdf/B2BQuotePDF.tsx` — B2B PDF generation

**Fix:** Create `app/api/orders/[orderNumber]/receipt/route.ts`:

```ts
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { and, eq } from 'drizzle-orm';
import { renderToBuffer } from '@react-pdf/renderer';
import { OrderReceiptPDF } from '@/components/email/OrderReceiptPDF';
import React from 'react';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ orderNumber: string }> }
) {
  const { orderNumber } = await params;

  // Verify by email (for guests) or session (for logged-in)
  const emailParam = req.nextUrl.searchParams.get('email');

  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, orderNumber),
    with: { items: true },
  });

  if (!order) return NextResponse.json({ error: 'Not found' }, { status: 404 });

  // Auth: either email matches or user is logged in and owns the order
  if (emailParam && order.recipientEmail.toLowerCase() !== emailParam.toLowerCase()) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const pdf = await renderToBuffer(
    React.createElement(OrderReceiptPDF, { order })
  );

  return new NextResponse(pdf, {
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="receipt-${orderNumber}.pdf"`,
    },
  });
}
```

---

### A-04 🟠 B2B portal sub-pages missing

**PRD reference:** Section 3.2 — `/b2b/account/orders`, `/b2b/account/quotes`

**Current state:**  
`app/(b2b)/b2b/account/page.tsx` exists and shows links to:
- `/b2b/account/orders` — `href` is wired
- `/b2b/account/quotes` — `href` is wired

But the subdirectories `app/(b2b)/b2b/account/orders/` and `app/(b2b)/b2b/account/quotes/` do not exist in the file listing. These links 404.

The API routes exist (`/api/b2b/orders` and `/api/b2b/quotes`) but the UI pages are not built.

**Fix:** Create:
1. `app/(b2b)/b2b/account/orders/page.tsx` — B2B order history, calls `/api/b2b/orders`
2. `app/(b2b)/b2b/account/quotes/page.tsx` — B2B quote history, calls `/api/b2b/quotes`

These should be simple client components that `useQuery` from their respective endpoints and render a table.

---

### A-05 🟡 `/admin/b2b-inquiries/[id]` detail page — needs verification

**PRD reference:** Section 3.3 — `/admin/b2b-inquiries ... B2B inquiry inbox`

**Current state:**  
The inquiries list page has a "Detail" link:
```tsx
<Link href={`/admin/b2b-inquiries/${inquiry.id}`}>Detail</Link>
```

But the file listing does not show `app/(admin)/admin/b2b-inquiries/[id]/page.tsx`. Need to verify if this page exists (it may have been missed by the `find` command due to line limits). If it doesn't exist, the Detail link 404s.

**What the page should show:**
- Full inquiry details (company, contact, message, estimated volume)
- Current status with history
- Admin notes field (editable)
- Quick action: "Create Quote" button that pre-fills quote form with inquiry data
- "Mark as Handled" / status transitions

**Fix:** Create `app/(admin)/admin/b2b-inquiries/[id]/page.tsx` if it doesn't exist.

---

## SECTION B — Security Vulnerabilities

### B-01 🔴 B2B portal has no server-side auth — client-side `useEffect` redirect is insufficient

**File:** `app/(b2b)/b2b/account/page.tsx`  
**Lines:** 96–104

**Root cause:**
```ts
useEffect(() => {
  if (status === 'authenticated') {
    if (session?.user?.role !== 'b2b' && session?.user?.role !== 'superadmin') {
      router.push('/b2b');
    }
  } else if (status === 'unauthenticated') {
    router.push('/login?callbackUrl=/b2b/account');
  }
}, [status, session, router]);
```

This is a client-side redirect only. Before `status` resolves from `'loading'` to `'unauthenticated'`, the page renders its full content (briefly). An attacker can scrape the HTML or examine the initial render before the redirect fires.

More critically: the `useQuery` calls for B2B profile, orders, and points happen immediately on mount with `enabled: !!session?.user`. If `session` is truthy (even for a non-B2B user), those API requests fire. The APIs themselves have auth checks, but the UX exposes the page structure.

**Fix:** Add server-side auth to the B2B layout or page:

```tsx
// In app/(b2b)/layout.tsx or app/(b2b)/b2b/account/layout.tsx:
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';

export default async function B2BLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/login?callbackUrl=/b2b/account');
  }
  
  if (session.user.role !== 'b2b' && session.user.role !== 'superadmin') {
    redirect('/b2b');
  }
  
  return <>{children}</>;
}
```

---

### B-02 🟠 `admin/users/invite` — owner can create owner accounts

**File:** `app/api/admin/users/invite/route.ts`  
**Lines:** 13–17, 27–29

**Root cause:**
```ts
const inviteSchema = z.object({
  role: z.enum(['warehouse', 'owner', 'b2b', 'customer']),
  // ↑ includes 'owner' — an owner can invite another owner
});

// Auth allows owner to call this:
if (!role || !['superadmin', 'owner'].includes(role)) {
  return forbidden('...');
}
```

Per PRD Section 2.2: "Only role that can create/edit/delete admin accounts: Superadmin". An `owner` should not be able to create another `owner` or escalate privileges.

**Fix:**
```ts
// Option A: restrict entire endpoint to superadmin
if (role !== 'superadmin') {
  return forbidden('Hanya superadmin yang dapat mengundang pengguna');
}

// Option B: keep owner access but restrict roles they can assign
const allowedRolesByInviter: Record<string, string[]> = {
  superadmin: ['warehouse', 'owner', 'b2b', 'customer'],
  owner:      ['warehouse', 'b2b', 'customer'],  // owner cannot create owner
};
const allowedRoles = allowedRolesByInviter[role] ?? [];

const inviteSchema = z.object({
  role: z.enum(allowedRoles as [string, ...string[]]),
  name: z.string().min(2),
  email: z.string().email(),
});
```

---

### B-03 🟡 Forgot-password user enumeration via timing side-channel

**File:** `app/api/auth/forgot-password/route.ts`  
**Lines:** 29–57

**Root cause:**
```ts
const user = await db.query.users.findFirst({
  where: eq(users.email, email.toLowerCase()),
});

if (user) {
  // Only runs if user exists
  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = await bcrypt.hash(token, 10);  // ← bcrypt.hash takes ~100ms
  await db.insert(passwordResetTokens)...
  await sendEmail(...)...
}

return success({ message: 'Link reset password telah dikirim ke email kamu' });
```

The endpoint returns the same message for both registered and unregistered emails (good), but the RESPONSE TIME is very different:
- Non-existent email: returns in ~5ms (just a DB query)
- Existing email: returns in ~200ms+ (bcrypt hash + DB inserts + email API call)

An attacker can enumerate valid emails by measuring response times.

**Fix:** Add a constant-time baseline for the non-user path:

```ts
const user = await db.query.users.findFirst({
  where: eq(users.email, email.toLowerCase()),
});

if (user) {
  const token = crypto.randomBytes(32).toString('hex');
  const tokenPrefix = token.slice(0, 8);
  const hashedToken = await bcrypt.hash(token, 10);
  // ... rest of the flow
} else {
  // Constant-time baseline to prevent enumeration
  await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
}

return success({ message: 'Link reset password telah dikirim ke email kamu' });
```

---

### B-04 🟡 `admin/settings` GET allows `owner` role — secrets may be exposed

**File:** `app/api/admin/settings/route.ts`  
**Lines:** 17–19

**Current state:**
```ts
if (!role || !['superadmin', 'owner'].includes(role)) {
  return forbidden('Anda tidak memiliki akses');
}
```

The GET endpoint for system settings allows BOTH `superadmin` and `owner` to read ALL settings. If `systemSettings` contains sensitive keys (API keys, webhook secrets, payment gateway keys), an owner can read them.

The PATCH endpoint correctly restricts to `superadmin` only.

**Recommendation:** Either:
1. Filter which settings keys the `owner` can read (only non-sensitive ones), OR
2. Restrict GET to `superadmin` only (same as PATCH)

---

## SECTION C — Incomplete but Partially Built Features

### C-01 🟠 Admin orders `[id]` page — status transitions from UI need warehouse restriction enforcement

**File:** `app/(admin)/admin/orders/[id]/page.tsx` (modified, confirmed exists)

**Issue:**  
The admin order detail page likely renders a status update dropdown for all roles. The warehouse restriction (warehouse can only set `shipped`) is enforced at the API level. But the UI probably shows all possible status options to warehouse users, which is confusing.

**Fix:** On the order detail page, read the user's role (via `auth()` server-side) and render only valid status options:
```tsx
const validTransitions = role === 'warehouse'
  ? (order.status === 'packed' ? ['shipped'] : [])
  : VALID_TRANSITIONS[order.status] ?? [];
```

---

### C-02 🟠 B2B portal — B2B users can access `/b2b/account` even when NOT approved

**File:** `app/(b2b)/b2b/account/page.tsx`  
**Lines:** 142–166

**Current state:**  
The page renders B2B profile information including "Pending Approval" status. This is correct UX — users should see they're pending. However, the B2B product catalog (`/b2b/products`) and quote request (`/b2b/quote`) pages may be accessible to unapproved B2B users.

**Fix:** In the B2B products and quote pages, check `b2bProfile.isApproved` before rendering:
```tsx
if (b2bProfile && !b2bProfile.isApproved) {
  return <PendingApprovalState />;  // "Your account is pending approval" message
}
```

---

### C-03 🟡 No `account/orders/[orderNumber]` — `PayNowButton` and `TrackingInfo` components are orphaned

**Files:**  
- `components/store/orders/PayNowButton.tsx`  
- `components/store/orders/TrackingInfo.tsx`  
- `components/store/orders/OrderItemsList.tsx`

These components exist but are not rendered anywhere in the current store (no account order detail page). They were built in anticipation of the order detail page. They're dead code until `account/orders/[orderNumber]/page.tsx` is created (see A-01).

**Fix:** Implement A-01 (account order detail page) using these components.

---

### C-04 🟡 Admin `settings/page.tsx` — UI exists but PATCH may not work for all key types

**File:** `app/(admin)/admin/settings/page.tsx` (unread but exists per file listing)

**Issue:**  
The settings API `PATCH` handler converts all values to strings (`String(item.value)`) before storing. When reading back, the `type` column in `systemSettings` indicates the original type (`'boolean'`, `'number'`, `'string'`). If the settings UI sends a boolean `false` as `String(false) = "false"`, and then reads it back and parses it as a boolean, `Boolean("false") === true` (truthy non-empty string).

**Fix:** In the settings page UI, explicitly convert back based on type:
```ts
function parseSettingValue(value: string, type: string): string | number | boolean {
  if (type === 'boolean') return value === 'true';
  if (type === 'number') return Number(value);
  return value;
}
```

---

### C-05 🟡 Admin `products/[id]` edit page — product images uploaded to Cloudinary but deletion not handled

**File:** `app/(admin)/admin/products/[id]/page.tsx` (confirmed exists via git status)  
**File:** `app/api/admin/upload/route.ts`

**Issue:**  
When editing a product and replacing images, the old Cloudinary images are likely left as orphaned assets. The upload API creates new Cloudinary resources but the delete flow for `productImages` rows may not also call Cloudinary's destroy API.

**Fix:** In the product images DELETE handler, also call Cloudinary's destroy:
```ts
import cloudinary from '@/lib/cloudinary/client';

// When deleting a product image:
const deletedImage = await db.delete(productImages)
  .where(eq(productImages.id, imageId))
  .returning({ publicId: productImages.cloudinaryPublicId });

if (deletedImage[0]?.publicId) {
  await cloudinary.uploader.destroy(deletedImage[0].publicId);
}
```

---

### C-06 🟢 `BottomNav` uses `useTranslations` but i18n is incomplete

**File:** `components/store/layout/BottomNav.tsx`

**Issue:**  
`useTranslations` is imported from `next-intl` but the i18n system is only partially configured. Product pages always show Indonesian regardless of the language toggle. The `LanguageSwitcher` component exists but the actual message catalogs may be incomplete.

**PRD reference:** Section 4.1 — "Language toggle (ID/EN) — P1"

**Fix:** Either:
1. Complete the i18n setup (add EN message catalog for all components), or
2. Remove `useTranslations` from `BottomNav` and hardcode Indonesian strings until i18n is properly implemented

---

## SECTION D — Missing API Endpoints (PRD-listed but not implemented)

| PRD Route | Status | Notes |
|-----------|--------|-------|
| `POST /api/b2b/quotes/[id]/accept` | ❓ Need to verify | B2B user accepting a quote |
| `POST /api/b2b/quotes/[id]/reject` | ❓ Need to verify | B2B user rejecting a quote |
| `GET /api/orders/[orderNumber]/receipt` | ❌ Missing | PDF download (see A-03) |
| `GET /api/admin/customers/[id]` | ❌ Likely missing | Customer detail for admin |
| `GET /api/b2b/inquiries` | ❓ Need to verify | B2B side of inquiry management |

---

## Summary Table

| Item | Type | Severity | Fix Complexity |
|------|------|----------|----------------|
| A-01: `/account/orders/[orderNumber]` page | Missing page | 🔴 Critical | Medium (2–3h) |
| A-02: `/admin/customers/[id]` page | Missing page | 🟠 High | Medium (2h) |
| A-03: PDF receipt endpoint | Missing route | 🟠 High | High (3–4h, needs @react-pdf) |
| A-04: B2B orders/quotes sub-pages | Missing pages | 🟠 High | Low (1h each) |
| A-05: B2B inquiry `[id]` detail page | Unverified | 🟡 Medium | Medium (2h) |
| B-01: B2B portal no server-side auth | Security | 🔴 Critical | Low (30min) |
| B-02: Owner can invite owner | Security | 🟠 High | Low (5min) |
| B-03: Forgot-password timing enumeration | Security | 🟡 Medium | Low (15min) |
| B-04: Settings GET exposes sensitive keys | Security | 🟡 Medium | Low (30min) |
| C-01: Admin orders UI shows wrong options to warehouse | UX | 🟠 High | Low (30min) |
| C-02: Unapproved B2B users access products/quote | Business logic | 🟠 High | Low (30min) |
| C-03: PayNowButton/TrackingInfo orphaned | Dead code | 🟡 Medium | Resolved by A-01 |
| C-04: Settings boolean type coercion | Bug | 🟡 Medium | Low (30min) |
| C-05: Cloudinary orphaned images | Ops | 🟡 Medium | Low (1h) |
| C-06: i18n incomplete | Feature | 🟢 Low | High (ongoing) |
