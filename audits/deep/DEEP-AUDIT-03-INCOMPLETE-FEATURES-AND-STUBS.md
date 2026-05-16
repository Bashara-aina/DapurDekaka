# DEEP AUDIT 03 — Incomplete Features & Broken Stubs
> Generated: 2026-05-14 | Features that exist in UI/schema but aren't fully implemented.

---

## SEVERITY LEGEND
- 🔴 **BROKEN** — Feature exists in UI, user can click it, but it doesn't work
- 🟠 **STUB** — Feature is partially built, some parts work, some silently fail
- 🟡 **MISSING** — Feature was planned but not built at all
- 🟢 **POLISH** — Feature works but is incomplete or rough

---

## 🔴 BROKEN — B2B Account: Orders Page (404 API)

**Frontend:** `app/(b2b)/b2b/account/orders/page.tsx:16`
```ts
const res = await fetch('/api/b2b/orders');  // 404 — route doesn't exist
```

**File list check:** `app/api/b2b/inquiry/route.ts`, `app/api/b2b/quotes/route.ts` — no `b2b/orders` route.

Every B2B user who opens their order history sees the empty state "Belum Ada Pesanan" regardless of how many orders they have. There is no error handling — the query silently returns `[]` on 404.

**What needs to be built:**
```ts
// app/api/b2b/orders/route.ts
export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return unauthorized();
  if (session.user.role !== 'b2b') return forbidden();
  
  const userOrders = await db.query.orders.findMany({
    where: and(
      eq(orders.userId, session.user.id),
      eq(orders.isB2b, true)
    ),
    with: { items: true },
    orderBy: [desc(orders.createdAt)],
  });
  
  return success(userOrders);
}
```

---

## 🔴 BROKEN — B2B Account: Quotes Page (Missing API)

**Frontend:** `app/(b2b)/b2b/account/quotes/page.tsx` — Need to check what API it calls.

The quotes page exists in the B2B account section, and the schema has `b2bQuotes` with a `b2bProfileId` FK. However, there's no API that returns quotes for a specific B2B user profile. The `app/api/b2b/quotes/route.ts` likely only handles POST (inquiry submission), not GET (quote listing).

**What needs to be built:**
```ts
// GET /api/b2b/quotes — returns quotes for the logged-in B2B profile
```

---

## 🔴 BROKEN — Field Dashboard: Inventory Adjust Sends Wrong Parameter

**Frontend:** `app/(admin)/admin/field/page.tsx:176-180`
```ts
async function adjustInventory(data: { variantId: string; newQuantity: number; reason: string }) {
  body: JSON.stringify(data),  // sends { variantId, newQuantity, reason }
```

**API:** `app/api/admin/field/inventory/adjust/route.ts:9-14`
```ts
const adjustSchema = z.object({
  variantId: z.string().uuid(),
  delta: z.number().int(),      // expects "delta", not "newQuantity"
  reason: z.string().min(1),
});
```

Zod validation rejects every request with `VALIDATION_ERROR`. The "Koreksi Stok" button in the warehouse field dashboard is completely non-functional.

**Fix the API to accept `newQuantity`:**
```ts
const adjustSchema = z.object({
  variantId: z.string().uuid(),
  newQuantity: z.number().int().min(0),
  reason: z.string().min(1),
  note: z.string().optional(),
});
// Then compute: delta = newQuantity - currentStock
```

---

## 🔴 BROKEN — Pickup Code: Never Generated, Verification Always Passes

**Schema:** `lib/db/schema.ts:270` — `pickupCode` column exists.

**Order creation:** `app/api/checkout/initiate/route.ts:400-433` — `pickupCode` never set in INSERT.

**Field dashboard:** `app/(admin)/admin/field/page.tsx:615-620`
```ts
if (selectedOrder.pickupCode && inputCode.trim().toUpperCase() !== selectedOrder.pickupCode.toUpperCase()) {
  setCodeError('Kode tidak cocok.');
}
```

Since `pickupCode` is always `null`, the condition `selectedOrder.pickupCode` is always falsy, and the verification is silently skipped. **Any staff member can "deliver" any pickup order without the customer showing up**, simply by clicking the confirm button with a blank code input.

**The PickupInvitation email** at `lib/resend/templates/PickupInvitation.tsx` receives `pickupCode: order.orderNumber` (the webhook uses the order number as the code), but the webhook's `pickupCode` is `order.orderNumber` (line 255 of webhook route). Meanwhile the DB column stays null.

**Fix:**
1. In `initiate/route.ts`, generate a 6-char uppercase alphanumeric code:
   ```ts
   const pickupCode = Math.random().toString(36).substring(2, 8).toUpperCase();
   ```
2. Store it in `orders.pickupCode` during INSERT.
3. The field dashboard and PickupInvitation email will then both use the same code.

---

## 🔴 BROKEN — Product Thumbnail Gallery: Clicking Doesn't Change Image

**File:** `components/store/products/ProductDetailClient.tsx:109-124`

```tsx
{product.images.length > 1 && (
  <div className="flex gap-2 p-4 overflow-x-auto">
    {product.images.map((img, i) => (
      <button
        key={img.id}
        className={cn(
          'w-16 h-16 ...',
          i === 0 ? 'border-brand-red' : 'border-transparent'  // always index 0
        )}
        aria-label={`Lihat foto ${i + 1}`}
        // ← NO onClick handler!
      >
```

There's no state for `selectedImageIndex`, no `onClick` handler on the thumbnails, and the main image always shows `product.images[0]`. The thumbnail gallery renders but clicking does nothing. Products with multiple images only ever show the first image.

**Fix:** Add `selectedImageIndex` state and wire up `onClick`:
```tsx
const [selectedImageIndex, setSelectedImageIndex] = useState(0);
// In the main image:
src={product.images[selectedImageIndex]?.cloudinaryUrl}
// On each thumbnail:
onClick={() => setSelectedImageIndex(i)}
className={cn('...', i === selectedImageIndex ? 'border-brand-red' : 'border-transparent')}
```

---

## 🔴 BROKEN — Checkout Saved Addresses Never Populate

**File:** `app/(store)/checkout/page.tsx:139-143`

```ts
// This is React useState called with a callback, not useEffect
// The callback runs once as an initializer, result is discarded
// savedAddresses is ALWAYS []
useState(() => {
  if (addressesData) {
    setSavedAddresses(addressesData as SavedAddress[]);
  }
});
```

The `useState()` hook is being misused as a side effect runner. This is not `useEffect()`. As a result:
- `savedAddresses` is always an empty array `[]`
- Logged-in users with saved addresses always see the address form, not the saved address picker
- The `SavedAddressPicker` component is never shown

**Fix:**
```ts
useEffect(() => {
  if (addressesData) {
    setSavedAddresses(addressesData as SavedAddress[]);
  }
}, [addressesData]);
```

---

## 🟠 STUB — i18n: Messages Exist But Routing Is Not Integrated

**File:** `i18n/routing.ts`
```ts
export const routing = defineRouting({
  locales: ['id', 'en'],
  defaultLocale: 'id',
  localePrefix: 'never'  // ← no locale in URL, e.g. /products not /id/products
});
```

**File:** `i18n/messages/en.json`, `i18n/messages/id.json` — Translation keys exist.

**File:** `components/store/layout/BottomNav.tsx:9`
```ts
const t = useTranslations('nav');  // uses next-intl
```

The i18n system is partially set up:
- `next-intl` is installed and `BottomNav` uses `useTranslations`
- Translation messages exist for both `id` and `en`
- BUT: the `LanguageSwitcher` component at `components/store/layout/LanguageSwitcher.tsx` presumably switches locale, but with `localePrefix: 'never'`, locale detection is cookie-based

**Missing pieces:**
1. No `instrumentation.ts` or `i18n/request.ts` middleware integration verified
2. Product names are stored as `nameId`/`nameEn` in DB but product pages always show `nameId` — locale switching has no effect on product content
3. The checkout flow is entirely in Indonesian, no English translation
4. B2B pages have no translations at all
5. The `LanguageSwitcher` component exists but if it doesn't properly set the `NEXT_LOCALE` cookie, switching doesn't work

**What full i18n would require:**
- `useLocale()` hook in product pages to show correct language
- Server component locale detection in `i18n/request.ts`
- All user-facing text (checkout labels, error messages) in both message files

---

## 🟠 STUB — Admin Customers: Cannot Filter By Multiple Criteria Simultaneously

**File:** `app/api/admin/customers/route.ts:23-33`

```ts
let whereClause;
if (search) {
  whereClause = or(like(users.name, ...), like(users.email, ...));
} else if (roleFilter) {
  whereClause = eq(users.role, roleFilter);
} else if (isActiveFilter !== null) {
  whereClause = eq(users.isActive, isActiveFilter === 'true');
}
```

The `else if` chain means only ONE filter can be applied at a time. You cannot search by name AND filter by role simultaneously. More importantly, there's a **count query bug**:

```ts
db.select({ count: sql`count(*)` })
  .from(users)
  .where(whereClause ?? eq(users.role, 'customer')),  // ← when no filter, only counts customers!
```

When no filter is applied, the count query counts only `customer` role users, but the data query returns ALL users (no whereClause → no filter). The total count in the UI would be wrong.

**Fix:**
```ts
// Use AND to combine all active filters
const conditions = [];
if (search) conditions.push(or(like(users.name, ...), like(users.email, ...)));
if (roleFilter) conditions.push(eq(users.role, roleFilter));
if (isActiveFilter != null) conditions.push(eq(users.isActive, isActiveFilter === 'true'));
const whereClause = conditions.length > 0 ? and(...conditions) : undefined;

// Use consistent whereClause for both queries
```

---

## 🟠 STUB — Free Shipping Coupon Type: Schema and Validate Route Support It, Checkout Ignores It

**Schema:** `coupons.freeShipping: boolean` column exists.  
**Validate API:** Returns `freeShipping: coupon.freeShipping` in response.  
**Checkout initiate:** Never reads `freeShipping` from coupon validation response.  
**Checkout page:** `CouponInput` component shows coupon success but no free shipping applied.

A coupon with `type = 'free_shipping'` would pass validation with `discountAmount = 0` (since `type` isn't handled in the validate route's discount calculation). The cart total would not be reduced, and shipping would still be charged.

**Fix:** In checkout initiate route, after coupon validation:
```ts
if (coupon.type === 'free_shipping' || coupon.freeShipping) {
  shippingCost = 0;
}
```
And in the checkout page, display "GRATIS ONGKIR" when the coupon applies.

---

## 🟠 STUB — Admin Order Export: Exists But May Be Incomplete

**Files:** `app/api/admin/export/orders/route.ts`, `app/api/admin/export/customers/route.ts`, `app/api/admin/export/inventory/route.ts`

These export routes exist but the admin dashboard UI at `app/(admin)/admin/orders/page.tsx` doesn't appear to have export buttons based on the code structure. The exports are API-only without UI triggers.

**What's missing:** Export buttons in the admin orders/customers/inventory list pages.

---

## 🟠 STUB — Admin Dashboard: AI Caption Feature Stub

**File:** `app/(admin)/admin/ai-content/page.tsx` and `app/api/ai/caption/route.ts`

The AI content page exists but `lib/services/minimax.ts` appears to contain a Minimax AI integration that may be incomplete or require API keys not in `validate-env.ts`.

**Missing:** `MINIMAX_API_KEY` validation. If the AI feature is shown in the admin sidebar but the key isn't set, the page throws on use.

---

## 🟡 MISSING — Cancellation Email in Admin Status Route: Missing `refundAmount`

**File:** `app/api/admin/orders/[id]/status/route.ts:244-271`

```ts
const cancellationEmailHtml = OrderCancellationEmail({
  ...
  reason,
  cancelledAt: formatWIB(new Date()),
  // ← NO refundAmount, NO refundInfo
});
```

The `OrderCancellationEmail` template at `lib/resend/templates/OrderCancellation.tsx` accepts `refundAmount` and `refundInfo` props (based on the webhook route which passes them). But the admin status route doesn't pass these. Customers who have paid and then get admin-cancelled orders receive a cancellation email with no refund information.

**Fix:** Pass `refundAmount: order.totalAmount` and appropriate `refundInfo` when the cancelled order was previously paid.

---

## 🟡 MISSING — Points Expiry Email: Sent But Expiry Cron Not Verified

**Files:** `lib/resend/templates/PointsExpiring.tsx`, `app/api/cron/points-expiry-warning/route.ts`, `app/api/admin/points/expiry-reminders/route.ts`

Multiple expiry reminder implementations exist. The cron job at `/api/cron/points-expiry-warning` sends expiry warnings automatically. But `app/api/admin/points/expiry-reminders/route.ts` appears to be a manual trigger. Having two systems for the same task is confusing and may send duplicate emails if both are triggered.

**Fix:** Consolidate — keep only the cron-based approach and remove the manual admin trigger, or make the admin trigger clearly distinct (e.g., "Send to specific user").

---

## 🟡 MISSING — No Order Notes UI in Admin Order List

The `orders.customerNote` column is stored in the DB and displayed in the field dashboard. However, looking at the admin orders list (`app/(admin)/admin/orders/page.tsx` and `app/(admin)/admin/orders/[id]/page.tsx`), there's no visible display of `customerNote` in the admin order detail view (based on what the admin page fetches).

**Fix:** Ensure `customerNote` is displayed prominently in the admin order detail page.

---

## 🟡 MISSING — Address Form Not Saving to Account

When a logged-in user enters a new address during checkout, the address data is used for the order but NOT saved back to their `addresses` table. The user must re-enter the same address every checkout unless they explicitly go to `/account/addresses` and add it there.

**Expected behavior:** Offer "Save this address to my account" checkbox during checkout.

**Fix:** After successful order creation, optionally save the address:
```ts
if (saveToAccount && userId && addressData.addressLine) {
  await db.insert(addresses).values({ userId, ...addressData });
}
```

---

## 🟡 MISSING — No Email Verification Flow for Registration

**File:** `app/api/auth/register/route.ts`

Users register with email + password and are immediately active with `isActive: true`. There is no email verification step. This means:
1. Bots can register with fake emails
2. Points/coupons could be abused across fake accounts
3. Password reset emails sent to unverified addresses may bounce

The schema has `emailVerified: timestamp('email_verified')` in the `users` table (for NextAuth v5 compatibility) but it's never set for credential registrations.

**Fix:** After registration, send a verification link (using `verificationTokens` table which already exists in schema), and set `emailVerified` when the link is clicked.

---

## 🟡 MISSING — B2B Account Profile Page Shows No Profile Data

**File:** `app/(b2b)/b2b/account/page.tsx`

The B2B account page shows the user's name/email and two menu links. It does NOT show the B2B profile data (company name, approval status, PIC info, monthly volume estimate). A B2B user cannot see whether their account is approved or pending.

**Fix:** Fetch and display `b2bProfiles` data for the logged-in user:
- Company name
- Approval status (`isApproved`, `isNet30Approved`)
- PIC contact info
- Assigned WA contact (if any)

---

## 🟢 POLISH — Order Status Displayed as Raw Enum String in B2B Orders

**File:** `app/(b2b)/b2b/account/orders/page.tsx:62-69`

```tsx
<span className={...}>{order.status}</span>  // shows "pending_payment" not "Menunggu Pembayaran"
```

The raw `order_status_enum` value is displayed to B2B users. `pending_payment` is shown instead of "Menunggu Pembayaran" or "Waiting for Payment".

**Fix:** Add a `STATUS_LABELS` map:
```ts
const STATUS_LABELS: Record<string, string> = {
  pending_payment: 'Menunggu Pembayaran',
  paid: 'Dibayar',
  processing: 'Diproses',
  packed: 'Dikemas',
  shipped: 'Dikirim',
  delivered: 'Diterima',
  cancelled: 'Dibatalkan',
};
```

---

## 🟢 POLISH — Checkout Page: No "Save to Account" Address Flow

During checkout, when the delivery address step shows `AddressForm`, there's no checkbox to save the address. After checkout, the address is lost. On the next checkout, the user must re-enter everything.

---

## 🟢 POLISH — Account Points Page Doesn't Show Expiring Points Warning

**File:** `app/(store)/account/points/page.tsx`

The account points page should prominently warn users about points expiring in the next 30 days. The data is already available (`pointsData.expiringCount` from `api/account/points`). The warning banner might not be rendered.

---

## 🟢 POLISH — Product Search Component Needs Debounce Verification

**File:** `components/store/products/ProductSearch.tsx`

The product search is client-side (filtering already-loaded products) so debounce is not critical for network calls. But if it triggers re-renders on every keystroke in a large product catalog, it could cause jank on mobile.
