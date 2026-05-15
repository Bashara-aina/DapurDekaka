# AUDIT 03 — Account Pages, Auth & Security Bugs

> Bugs in customer account pages, authentication flows, session handling, cart merge, and security vulnerabilities.

---

## BUG 01 — CRITICAL: `account/orders/page.tsx` crashes — wrong variable name
**File:** `app/(store)/account/orders/page.tsx`  
**Approx lines:** ~65, ~86

The file imports `orders` from the Drizzle schema at the top (e.g. `import { orders } from '@/lib/db/schema'`), and the query result is stored in a different variable (e.g. `ordersResult`). But the JSX uses `orders` (the schema table object, not the query result):

```tsx
{orders.length === 0 && <EmptyState />}  // ← orders is a Drizzle table object, not an array
{orders.map((order) => ...)}             // ← will crash: cannot iterate a table object
```

**Result:** The empty state never shows (object is always truthy), and the `.map()` throws a runtime crash.

**Fix:** Rename all JSX references from `orders` to `ordersResult` (or whatever the query variable is named). Or rename the schema import to avoid collision:
```ts
import { orders as ordersTable } from '@/lib/db/schema';
```

---

## BUG 02 — CRITICAL: `account/page.tsx` missing imports — crashes on load
**File:** `app/(store)/account/page.tsx`  
**Approx lines:** ~29–30

The page uses `count()`, `eq()`, and `orders` (schema) directly but never imports them:
```ts
const [result] = await db.select({ count: count() }).from(orders).where(eq(orders.userId, ...))
```

`count`, `eq`, and `orders` are all `undefined` at runtime → `ReferenceError` crashes the page for every authenticated customer visiting their account.

**Fix:** Add the missing imports:
```ts
import { count, eq } from 'drizzle-orm';
import { orders } from '@/lib/db/schema';
```

---

## BUG 03 — CRITICAL: Checkout success page: points earned never display
**File:** `app/(store)/checkout/success/page.tsx`  
**Approx lines:** ~32, ~54

The API (`/api/orders/[orderNumber]`) returns `{ order: {...}, verified: true }`. The page does:
```ts
const orderData = json.data;
// ...
orderData?.pointsEarned  // ← undefined — should be json.data.order.pointsEarned
```

The "Anda mendapatkan X poin!" banner is never shown for any logged-in customer after a successful order.

Additionally, the IDR value formula at line ~61:
```ts
orderData.pointsEarned * 10  // ← wrong multiplier
```
`POINTS_VALUE_IDR = 1000`, so 1 point = Rp 1000. The correct formula is `pointsEarned * (1000 / POINTS_PER_RUPIAH_SPENT)`, not `* 10`.

**Fix:**
```ts
const orderData = json.data.order;  // ← unwrap the nested object
// And fix the points display:
const pointsValueIDR = (orderData.pointsEarned / POINTS_PER_RUPIAH_SPENT) * POINTS_VALUE_IDR;
```

---

## BUG 04 — CRITICAL: `account/page.tsx` fetches `pointsHistory` that is never rendered
**File:** `app/(store)/account/page.tsx`  
**Approx lines:** ~33–37

10 `pointsHistory` records are queried on every account page load, but the data is never rendered in the JSX (the points history is on the separate `/account/points` page). This is a wasted DB query on every page load.

**Fix:** Remove the `pointsHistory` query from this page entirely.

---

## BUG 05 — HIGH: Open redirect vulnerability via `callbackUrl`
**File:** `app/(auth)/login/page.tsx`  
**Approx lines:** ~22, ~43

```ts
const callbackUrl = searchParams.get('callbackUrl') || '/account';
router.push(callbackUrl);  // ← unvalidated external URL
```

An attacker can craft: `https://dapur-dekaka.com/login?callbackUrl=https://evil.com`

After login, the user is redirected to the external site. This is a classic open redirect for phishing.

**Fix:** Validate that `callbackUrl` is a relative URL before using it:
```ts
const raw = searchParams.get('callbackUrl') || '/account';
const callbackUrl = raw.startsWith('/') && !raw.startsWith('//') ? raw : '/account';
router.push(callbackUrl);
```

---

## BUG 06 — HIGH: Login page links point to wrong URLs
**File:** `app/(auth)/login/page.tsx`  
**Approx lines:** ~120, ~137

```tsx
<Link href="/auth/forgot-password">Lupa kata sandi?</Link>
<Link href="/auth/register">Daftar</Link>
```

The `(auth)` segment is a Next.js route group — it does not appear in the URL. Both pages route to `/forgot-password` and `/register` respectively. These links lead to 404s.

**Fix:**
```tsx
<Link href="/forgot-password">Lupa kata sandi?</Link>
<Link href="/register">Daftar</Link>
```

---

## BUG 07 — HIGH: Non-constant-time signature comparison in Midtrans webhook
**File:** `lib/midtrans/verify-webhook.ts`  
**Approx line:** ~19

```ts
return hash === signatureKey;
```

JavaScript string equality is not constant-time. A timing side-channel attack could theoretically recover signature bytes by measuring response time differences.

**Fix:**
```ts
import { timingSafeEqual } from 'crypto';
return timingSafeEqual(Buffer.from(hash, 'hex'), Buffer.from(signatureKey, 'hex'));
```

---

## BUG 08 — HIGH: `OrderTimeline` component imported but never rendered in order detail
**File:** `app/(store)/account/orders/[orderNumber]/page.tsx`  
**Approx line:** ~8

`OrderTimeline` is imported but the JSX renders a simple status badge instead. Customers see no timeline of their order's progress.

**Fix:** Replace the simple status badge section with `<OrderTimeline order={order} />` (verify the component's props interface first).

---

## BUG 09 — MEDIUM: Cart merge fires on every item change, not just on login
**File:** `hooks/use-cart-merge.ts`  
**Approx line:** ~38

`items` is in the `useEffect` dependency array:
```ts
}, [session, status, items, clearCart]);
```

After login, every item add/remove/update triggers a new POST to `/api/auth/merge-cart`. This hammers the DB, hits rate limits, and overwrites the server cart on each change.

**Fix:** Remove `items` and `clearCart` from the dependency array. The merge should be a one-time event triggered by login:
```ts
}, [session?.user?.id, status]);
```

Add a `hasMerged` ref to prevent double-firing:
```ts
const hasMerged = useRef(false);
useEffect(() => {
  if (status === 'authenticated' && !hasMerged.current && items.length > 0) {
    hasMerged.current = true;
    mergeCart();
  }
}, [session?.user?.id, status]);
```

---

## BUG 10 — MEDIUM: Checkout page calls admin-only settings API
**File:** `app/(store)/checkout/page.tsx`  
**Approx lines:** ~186–197

The checkout page fetches `/api/admin/settings` from a `useEffect`. This endpoint requires `superadmin` or `owner` role. Regular customers always get 401/403. The store hours and other settings intended for the checkout page are never loaded.

**Fix:** Create a public settings endpoint (`/api/settings`) that returns only the settings safe for public consumption (e.g., `store_hours`, `min_order_amount`). Or pass the settings as server-rendered props from the page layout.

---

## BUG 11 — MEDIUM: Auto-skip effect on identity step can override user's back navigation
**File:** `app/(store)/checkout/page.tsx`  
**Approx lines:** ~149–162

```ts
useEffect(() => {
  if (session?.user && step === 'identity') {
    setStep('delivery');
  }
}, [session?.user, profileData]);
```

`profileData` is in the dependency array. If a logged-in user navigates back to the identity step and then `profileData` re-fetches/refreshes, the effect fires again and auto-advances to `delivery`, overriding the intended back navigation.

**Fix:** Remove `profileData` from the dependency array. The auto-skip should only depend on `session?.user` and `step`:
```ts
}, [session?.user?.id]);  // only react to login state changes
```

---

## BUG 12 — MEDIUM: `showAddressPicker` state is set but never read
**File:** `app/(store)/checkout/page.tsx`  
**Approx lines:** ~121, ~546

```ts
const [showAddressPicker, setShowAddressPicker] = useState(false);
// ...
setShowAddressPicker(true);  // ← set
// ... but never read in JSX
```

The address picker visibility is controlled by `showNewAddressForm` alone. `showAddressPicker` is dead state.

**Fix:** Remove this state variable and its setter. The address UI should only use `showNewAddressForm`.

---

## BUG 13 — MEDIUM: Admin points adjustment returns stale `newBalance`
**File:** `app/api/admin/points/adjust/route.ts`  
**Approx line:** ~76

```ts
const newBalance = (targetUser.pointsBalance ?? 0) + adjustedAmount;
```

`targetUser` was fetched before the transaction ran. If any concurrent transaction modified the user's balance between the initial fetch and the update, `newBalance` in the response is wrong.

**Fix:** Use `.returning()` on the update:
```ts
const [updated] = await tx
  .update(users)
  .set({ pointsBalance: sql`points_balance + ${adjustedAmount}` })
  .where(eq(users.id, targetUser.id))
  .returning({ pointsBalance: users.pointsBalance });
return success({ newBalance: updated.pointsBalance });
```

---

## BUG 14 — MEDIUM: Admin points adjustment allows negative balance
**File:** `app/api/admin/points/adjust/route.ts`  
**Approx line:** ~58

When `type: 'deduct'`, `adjustedAmount` is negative and the update uses:
```ts
sql`points_balance + ${adjustedAmount}`
```

There is no guard preventing `pointsBalance` going negative. The DB column has no check constraint.

**Fix:** Add a pre-check:
```ts
if (type === 'deduct' && (targetUser.pointsBalance ?? 0) < amount) {
  return badRequest('Insufficient points balance');
}
```

---

## BUG 15 — LOW: Midtrans `transaction_time` parsed without timezone (webhook may reject valid payments near midnight)
**File:** `app/api/webhooks/midtrans/route.ts`  
**Approx lines:** ~53–59

Midtrans sends `transaction_time` in WIB format (UTC+7) as a bare string like `"2026-05-15 23:30:00"` without a timezone suffix. `new Date("2026-05-15 23:30:00")` is parsed as **UTC** in V8, making it 7 hours off. For transactions near midnight WIB, this can cause the stale webhook check to incorrectly reject valid webhooks.

**Fix:** Append the WIB offset when parsing:
```ts
const txTime = new Date(body.transaction_time.replace(' ', 'T') + '+07:00').getTime();
```

---

## BUG 16 — LOW: `parseGrossAmount` exported from verify-webhook but never used
**File:** `lib/midtrans/verify-webhook.ts`

```ts
export function parseGrossAmount(grossAmount: string): number { ... }
```

The webhook route uses `Math.round(parseFloat(gross_amount))` directly, bypassing this utility. Dead export adds confusion.

**Fix:** Either use `parseGrossAmount` in the webhook route or remove the export.

---

## BUG 17 — LOW: Register page: 429 rate limit error not surfaced to user
**File:** `app/(auth)/register/page.tsx`

When the backend returns a 429, the client shows a generic "Gagal mendaftar" message if the 429 response body doesn't include an `error` string in the expected format.

**Fix:** Handle 429 explicitly:
```ts
if (res.status === 429) {
  setError('Terlalu banyak percobaan pendaftaran. Coba lagi nanti.');
  return;
}
```
