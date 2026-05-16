# AUDIT 05 — Incomplete Features, Missing Emails & Dead-End UIs

> Everything that was designed but only half-built: TODOs, missing email notifications, dead-end UI elements that look interactive but do nothing, and stub implementations.

---

## INCOMPLETE 01 — Points balance NOT fetched at checkout (hardcoded TODO)
**File:** `app/(store)/checkout/page.tsx`  
**Approx lines:** ~186–197 (TODO comment in the points section)

The checkout page has a marked TODO: "Fetch points balance from DB for logged-in users." Currently, `pointsBalance` is either hardcoded to 0 or read from a stale local state. Logged-in users cannot redeem points during checkout because the available balance is not shown correctly.

**What's needed:**
1. Add a `useEffect` (or server-side prop) to fetch `/api/account/points` for logged-in users
2. Use the returned `currentBalance` to populate the `pointsBalance` state
3. The `PointsRedeemer` component should receive the real balance

```ts
useEffect(() => {
  if (session?.user) {
    fetch('/api/account/points')
      .then(r => r.json())
      .then(data => setPointsBalance(data.data.currentBalance ?? 0));
  }
}, [session?.user?.id]);
```

---

## INCOMPLETE 02 — No email notification to admin when a B2B inquiry is submitted
**File:** `app/api/b2b/inquiry/route.ts`  
**TODO comment:** Line explicitly marks this as missing

When a business submits the B2B inquiry form, no email is sent to the DapurDekaka admin team. The admin must manually check the admin panel.

**What's needed:**
1. After saving the inquiry to the DB, send an email using Resend:
```ts
import { sendEmail } from '@/lib/resend';
import { B2BInquiryNotification } from '@/components/email/B2BInquiryNotification';

await sendEmail({
  to: process.env.RESEND_FROM_EMAIL!,
  subject: `Inquiry B2B Baru: ${parsed.data.companyName}`,
  react: B2BInquiryNotification({ inquiry: savedInquiry }),
});
```
2. Also send an auto-reply to the submitter (the `B2BInquiryAutoReply` email component already exists).

---

## INCOMPLETE 03 — No email to B2B customer when a quote is created
**File:** `app/api/b2b/quotes/route.ts` (POST handler)  
**Approx line:** ~100

When an admin creates and sends a B2B quote (`status: 'sent'`), no email is sent to the customer's `picEmail`. The customer only discovers the quote exists if they log into the portal.

**What's needed:**
```ts
// After quote is inserted:
if (quoteData.status === 'sent') {
  await sendEmail({
    to: b2bProfile.picEmail,
    subject: `Penawaran Harga dari DapurDekaka — ${quote.quoteNumber}`,
    react: B2BQuoteEmail({ quote, profile: b2bProfile }),
  });
}
```

---

## INCOMPLETE 04 — No email or admin notification when a B2B quote is accepted/rejected
**File:** `app/api/b2b/quotes/[id]/[action]/route.ts`

When a B2B customer accepts or rejects a quote, neither the admin nor the customer receives an email confirmation. The admin must poll the quotes list.

**What's needed:**
- On `accept`: email admin + send confirmation to customer
- On `reject`: email admin with reason (if captured)

---

## INCOMPLETE 05 — No email when pickup order is ready for collection (admin-triggered)
**File:** `app/api/admin/orders/[id]/status/route.ts`  
**Approx lines:** ~199–223

When an admin transitions a pickup order to `processing` (or `packed`), no "Your order is ready for pickup" email is sent. The `PickupInvitationEmail` component exists but is only triggered from the Midtrans payment webhook (`paid` → send pickup details). If the order skips that path (e.g., manual payment confirmation), no email fires.

**What's needed:** Add a pickup notification email send when status changes to `processing` for pickup-method orders:
```ts
if (newStatus === 'processing' && order.deliveryMethod === 'pickup') {
  await sendPickupReadyEmail(order);
}
```

---

## INCOMPLETE 06 — `loadFromDb` in cart store is a no-op stub
**File:** `store/cart.store.ts`  
**Approx line:** ~123

```ts
loadFromDb: async () => {
  // placeholder — actual DB sync happens via /api/auth/merge-cart in login flow
},
```

This method is exported in the `CartStore` interface and called by `use-cart-merge.ts` after login. Since it does nothing, the cart is always empty after login (covered in AUDIT-01 BUG 10 — this entry documents the TODO aspect).

**What's needed:** Implement `loadFromDb` to fetch the user's server-side cart and populate the store. Requires either a new `GET /api/cart` endpoint or reusing the merge endpoint response.

---

## INCOMPLETE 07 — B2B order detail page does not exist
**Files:**  
- `app/(b2b)/b2b/account/orders/page.tsx` — lists orders with unclickable rows  
- No `app/(b2b)/b2b/account/orders/[orderNumber]/page.tsx` exists

B2B customers can see their order list but cannot view any order details. There are no item breakdowns, tracking info, or status history for B2B orders.

**What's needed:** Create `app/(b2b)/b2b/account/orders/[orderNumber]/page.tsx`. This can reuse:
- `OrderItemsList` component
- `OrderTimeline` component  
- `TrackingInfo` component
- The same data shape as the store order detail page

Role check: allow `b2b` + `superadmin`/`owner`.

---

## INCOMPLETE 08 — Products edit page does not exist
**File:** `app/(admin)/admin/products/page.tsx`  
**Approx line:** ~92

Every "Edit" button in the products table links to `/admin/products/${product.id}`. There is only a `new/page.tsx` — no `[id]/page.tsx` edit route. Every edit button leads to a 404.

**What's needed:** Create `app/(admin)/admin/products/[id]/page.tsx` that:
1. Fetches the product by ID (including variants, images, category)
2. Renders `<ProductForm>` pre-filled with existing data
3. `handleSubmit` calls `PATCH /api/admin/products/[id]`

---

## INCOMPLETE 09 — Admin coupon management has no usage analytics
**File:** `app/(admin)/admin/coupons/page.tsx` (assumed)

The `coupons` table has `usedCount` and `couponUsages` relation, but the admin coupon list likely only shows name/code/discount without showing usage percentage, top users, or revenue impact.

**What's needed:** Add to the coupon list:
- Usage rate: `usedCount / maxUses * 100%`
- Link to drill into which orders used this coupon
- Revenue attributed (sum of order totals using the coupon)

---

## INCOMPLETE 10 — Admin field dashboard: `workerActivity` likely not auto-refreshing
**File:** `app/(admin)/admin/field/page.tsx` (assumed) + `app/api/admin/field/worker-activity/route.ts`

The field dashboard appears to have a live feed concept, but without websockets or polling, `workerActivity` data is stale as soon as the page loads.

**What's needed:** Add a polling interval to the React Query fetch:
```ts
const { data } = useQuery({
  queryKey: ['workerActivity'],
  queryFn: fetchWorkerActivity,
  refetchInterval: 30_000,  // poll every 30 seconds
});
```

---

## INCOMPLETE 11 — Order receipt PDF exists but no download link in customer account
**File:** `app/api/orders/[orderNumber]/receipt/route.ts` exists  
**Missing:** No download button in `app/(store)/account/orders/[orderNumber]/page.tsx`

The receipt PDF endpoint is implemented but there is no UI element linking to it in the order detail page.

**What's needed:** Add a download button to the order detail page:
```tsx
<a href={`/api/orders/${order.orderNumber}/receipt`} target="_blank">
  <Button variant="outline">Download Faktur PDF</Button>
</a>
```

---

## INCOMPLETE 12 — `OrderTimeline` component imported but never rendered
**File:** `app/(store)/account/orders/[orderNumber]/page.tsx`  
**Approx line:** ~8

`OrderTimeline` is imported but the JSX renders a simple status badge instead. Customers see no visual history of their order's journey.

**What's needed:** Replace the status badge section with the timeline component:
```tsx
import { OrderTimeline } from '@/components/store/orders/OrderTimeline';
// In JSX:
<OrderTimeline order={order} statusHistory={order.statusHistory} />
```
Verify the component's props interface and ensure `statusHistory` is included in the data query.

---

## INCOMPLETE 13 — Admin testimonials management: no way to feature/unfeature
**File:** `app/(admin)/admin/testimonials/page.tsx` (assumed)

The `testimonials` table likely has an `isFeatured` or `isActive` boolean. The homepage testimonials carousel shows featured testimonials. If there's no toggle in the admin UI, all testimonials are either always shown or never shown.

**What's needed:** Verify the admin testimonials page has a toggle for `isFeatured` and that the homepage query filters by it.

---

## INCOMPLETE 14 — `dismissedActions` in admin dashboard are not persisted
**File:** `app/(admin)/admin/dashboard/page.tsx`  
**Approx lines:** ~163, ~504–509

Action queue dismissals are stored in React state only. They reappear on every page refresh. Operators who dismiss stale actions repeatedly see them come back.

**What's needed:** Persist dismissed actions to localStorage or to a DB preference table:
```ts
const [dismissedActions, setDismissedActions] = useState<string[]>(() => {
  if (typeof window === 'undefined') return [];
  return JSON.parse(localStorage.getItem('dismissed_actions') ?? '[]');
});

const dismissAction = (id: string) => {
  const updated = [...dismissedActions, id];
  setDismissedActions(updated);
  localStorage.setItem('dismissed_actions', JSON.stringify(updated));
};
```

---

## INCOMPLETE 15 — Cron job: `expire-points` marks points expired but doesn't send warning email first
**File:** `app/api/cron/expire-points/route.ts` + `app/api/cron/points-expiry-warning/route.ts`

Two separate cron routes exist: one for expiry warnings and one for actually expiring points. The warning cron should run X days before expiry and the expiry cron on the expiry date. 

**Verify:** Confirm the Vercel cron schedule in `vercel.json` has:
- `points-expiry-warning` running N days before `expire-points`
- The order of operations is correct so users always get a warning before points vanish
- The warning email uses `PointsExpiringEmail` component (which already exists)

---

## INCOMPLETE 16 — AI caption generator exists but is not integrated into product image upload
**File:** `app/(admin)/admin/ai-content/page.tsx` + `app/api/ai/caption/route.ts`

The AI caption generation (via Minimax API) exists as a standalone admin page. But when uploading product images in the product form, there is no "Generate Caption" button that calls this API inline.

**What's needed:** Add a "Generate AI Caption" button next to each product image upload in `ProductForm.tsx` that:
1. Sends the uploaded image URL to `/api/ai/caption`
2. Auto-fills the `altText` field with the result

---

## INCOMPLETE 17 — B2B quote PDF: no download link in customer quote detail
**File:** `components/pdf/B2BQuotePDF.tsx` exists  
**Missing:** B2B customer quote detail page may not show a PDF download button

The B2B quote PDF renderer exists. Verify that `app/(b2b)/b2b/account/quotes/page.tsx` (or a detail sub-page) includes a "Download PDF" button linking to the stored `pdfUrl` field on the quote record.

---

## INCOMPLETE 18 — Points expiry display in customer account shows wrong field name
**File:** `app/(store)/account/points/page.tsx` (assumed)  
**Related:** `customers/[id]/page.tsx` bug with `ph.note`

The `pointsHistory` table stores `descriptionId` and `descriptionEn`, not a `note` field. Any points history display using `ph.note` will always show `-`. 

**Audit all files that display points history** and replace `ph.note` with:
```tsx
{locale === 'id' ? ph.descriptionId : ph.descriptionEn ?? ph.descriptionId ?? '-'}
```

---

## INCOMPLETE 19 — Settings: `payment_expiry_minutes` setting exists but Midtrans ignores it
**File:** `lib/midtrans/create-transaction.ts`  
**Related:** AUDIT-01 BUG 12

The `payment_expiry_minutes` system setting is read and stored in the DB but never passed to the Midtrans API call. The payment window in Midtrans is always 15 minutes.

**What's needed:** Pass the setting to `createMidtransTransaction()`:
```ts
// In initiate route:
const expiryMinutes = parseInt(await getSetting('payment_expiry_minutes') ?? '15', 10);
const snapToken = await createMidtransTransaction(transactionData, { expiryMinutes });

// In create-transaction.ts:
expiry: { unit: 'minute', duration: expiryMinutes }
```

---

## INCOMPLETE 20 — No SMS / WhatsApp notification for order status changes
**Current state:** Email notifications exist for most order events. WhatsApp button is a static contact link. No programmatic WhatsApp/SMS messages are sent.

**Missing events where notifications would be expected:**
- Order placed confirmation → only email, no WhatsApp
- Payment confirmed → only email
- Order shipped with tracking number → no SMS/WhatsApp

**What's needed (future):** Integrate WhatsApp Business API (e.g., via Wati, Fonnte, or Zenziva) for the key order events. At minimum, ensure the WhatsApp number in `NEXT_PUBLIC_WHATSAPP_NUMBER` is used to generate pre-filled message links for order confirmations so customers can easily contact support.
