# AUDIT-01: Store Pages & Client Flow Bugs

**Project:** DapurDekaka.com  
**Auditor:** Deep Code Audit  
**Date:** May 2026  
**Scope:** `app/(store)/`, `store/`, `hooks/`, `components/Providers.tsx`, i18n messages

---

## 1. Cart Merge Flow — CRITICAL BUG

### Bug: `use-cart-merge.ts` Clears Cart Instead of Merging

**File:** `hooks/use-cart-merge.ts`

```typescript
export const useCartMerge = () => {
  const { clearCart } = useCartStore();
  const { data: session } = useSession();
  const utils = useQueryClient();

  useEffect(() => {
    if (!session?.user) return;
    triggerMerge().then(() => {
      clearCart(); // ❌ WRONG — clears server cart instead of applying merged result
    });
  }, [session?.user]);

  return { mergeCart };
};
```

**Problem:** After a successful cart merge, `clearCart()` wipes the Zustand store. The merge response from `POST /api/auth/merge-cart` is never read or applied. The user loses whatever items were in the server cart.

**Expected behavior:**  
1. `POST /api/auth/merge-cart` returns `{ mergedItems: CartItem[] }`  
2. `clearCart()` is called first (to remove stale local items)  
3. `mergedItems` are individually added via `addItem()` — this respects the existing merge logic (adds quantities if same variantId exists)

**Fix required in:** `hooks/use-cart-merge.ts` + `store/cart.store.ts` — implement `loadFromDb()` properly

---

## 2. Cart `loadFromDb` — STUB

**File:** `store/cart.store.ts`

```typescript
loadFromDb: async (items: CartItem[]) => {
  // TODO: load from db
  console.log('loadFromDb not implemented');
},
```

**Problem:** No endpoint exists to load a persisted cart from the DB (`/api/cart/load` or similar). When a logged-in user returns to the site, their saved cart is never restored from the DB into Zustand.

**Trace:** When `triggerMerge()` is called in `use-cart-merge.ts`, the response from `POST /api/auth/merge-cart` should contain the merged cart items. But the hook never reads or applies them — it only clears the store.

**Fix required in:** `hooks/use-cart-merge.ts` — read `response.data` from merge-cart, then call `addItem()` for each merged item

---

## 3. Cart `validateStock` — Silent Failure

**File:** `store/cart.store.ts`

```typescript
validateStock: async () => {
  // ...
  } catch (err) {
    console.error('Failed to validate cart', err);
    // Silently swallowed — cart continues with stale stock values
  }
},
```

**Problem:** If stock validation fails (network error, server error), the cart silently continues with potentially incorrect stock values. The user might proceed to checkout with items that are actually out of stock.

**Expected behavior:** Show a toast error, mark the affected items as having stale stock, optionally block checkout.

**Fix required in:** `store/cart.store.ts` — return a validation result that indicates which items have issues

---

## 4. Language Toggle — Hardcoded Locale

**File:** `components/Providers.tsx`

```typescript
<NextIntlClientProvider locale="id" messages={idMessages} timeZone="Asia/Jakarta">
```

**Problem:** The locale is hardcoded as `"id"`. When a user toggles language via `LanguageSwitcher`, the UI language might update, but `NextIntlClientProvider` always uses `idMessages` regardless of the user's selected locale. The `locale` prop should come from a dynamic source.

**Expected behavior:** The locale should be read from the server session or a cookie, passed from the layout, and passed dynamically to `NextIntlClientProvider`. When language is toggled, the messages should update without a full page reload.

**Fix required in:** `components/Providers.tsx`, `app/(store)/layout.tsx`, `app/(store)/providers.tsx`

---

## 5. UI Store — Language Not Persisted

**File:** `store/ui.store.ts`

```typescript
language: 'id', // default
setLanguage: (lang) => set({ language: lang }),
```

**Problem:** The `language` in `ui.store` is never persisted to localStorage or a cookie. On page refresh, the user's language preference is reset to `'id'`. The `languagePreference` is stored in the DB (`users.language_preference`) but there's no sync between the UI store and the DB.

**Fix required in:** `store/ui.store.ts` — add Zustand persist middleware with `language` field, or rely entirely on next-intl's locale cookie

---

## 6. Checkout — `sessionStorage` Is Lost on Browser Close

**File:** `app/(store)/checkout/page.tsx`

The multi-step checkout state is stored in `sessionStorage`:

```typescript
const STORAGE_KEY = 'ddk-checkout-state';
// ... reads/writes to sessionStorage on every step change
```

**Problem:** `sessionStorage` is cleared when the browser tab closes. If a user starts checkout, closes the tab, and comes back later, their checkout progress is lost. The checkout state is never synced to the DB (for logged-in users) or even `localStorage`.

**Impact:** Medium — checkout is complex enough that users may abandon and return. Losing all progress is a bad UX.

**Fix:** Either persist to `localStorage` (keyed by session or order draft ID) for guest users, or create a draft order record in the DB for logged-in users.

---

## 7. Checkout — B2B Net-30 Flow Appears Functional But Untested

**File:** `app/(store)/checkout/page.tsx`

The B2B Net-30 payment skip exists:

```typescript
if (isB2B && isNet30Approved) {
  await initiateB2BOrder(data);
  router.push(`/checkout/success?orderNumber=${result.data.orderNumber}`);
  return;
}
```

**Problem:** This path bypasses Midtrans entirely for B2B Net-30 orders. No payment is initiated. The order is created with `status: 'pending_payment'` and immediately redirected to success. This means:
1. No Midtrans transaction is created for B2B Net-30 orders
2. Stock is NOT deducted (webhook won't fire since no payment occurred)
3. Order status never progresses from `pending_payment`

**Fix required in:** `app/api/checkout/initiate/route.ts` — handle B2B Net-30 separately: create order with `pending_payment`, but immediately update to `paid` for Net-30 (since the payment is guaranteed via invoice, not upfront)

---

## 8. Checkout — Points Redemption `maxRedeemable` Mismatch

**File:** `components/store/checkout/PointsRedeemer.tsx`

The component calculates max redeemable as 50% of subtotal:

```typescript
const maxRedeemable = Math.floor(subtotal * 0.5);
```

But the server (`lib/services/points.service.ts`) calculates it differently:

```typescript
// From points.service.ts
const maxRedeemable = Math.floor(subtotal / POINTS_VALUE_IDR);
// where POINTS_VALUE_IDR = 1000
// So for subtotal 240,000: maxRedeemable = 240 points = Rp 240,000 discount
```

**Problem:** The frontend uses `Math.floor(subtotal * 0.5)` which for subtotal 240,000 gives 120,000 ( Rp 120,000 worth of points = 120 points at 1pt=Rp1000). But the backend uses `Math.floor(subtotal / 1000) = 240 points`. The frontend shows a different maximum than the backend will accept.

**Fix:** The backend's `POINTS_VALUE_IDR = 1000` means 1 point = Rp 1,000, so the max redeemable in points is `Math.floor(subtotal * 0.5 / 1000)`. The PointsRedeemer component needs to use this formula consistently.

---

## 9. Order Pending Page — Polling Continues After Payment

**File:** `app/(store)/checkout/pending/page.tsx`

```typescript
useEffect(() => {
  const interval = setInterval(() => {
    checkPaymentStatus();
  }, 5000);
  return () => clearInterval(interval);
}, [orderNumber, router]);
```

**Problem:** When the user completes payment on another device or tab, the 5-second polling interval continues indefinitely even after `order.status === 'paid'`. The page correctly navigates to success when it detects `paid`, but the `clearInterval` might not fire immediately if the navigation is asynchronous.

**Fix:** Add a `return () => clearInterval(interval)` inside the polling success handler, before the `router.push()`.

---

## 10. Product Detail — No Variant Selector Component

**File:** `components/store/products/ProductDetailClient.tsx` (~356 lines)

**Problem:** The PRD specified a `VariantSelector` component (`components/store/products/VariantSelector.tsx`). It was never created. Instead, variant selection logic is embedded directly inside `ProductDetailClient.tsx` which is already 356 lines (exceeds the 300-line project limit).

**What needs splitting:**
1. `VariantSelector.tsx` — pure variant selection UI (pills/buttons per variant)
2. `ProductDetailClient.tsx` — orchestration: calls `VariantSelector`, manages quantity, handles `addToCart`

---

## 11. Order Tracking — Email Verification Not Enforced

**File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx`

The page is supposed to verify guest ownership via email before showing order details:

```typescript
// The server component (page.tsx) fetches the order and passes to client
// But there's no email verification form for guests
```

**Problem:** Looking at the page component, it seems the order data is fetched server-side and passed to the client component. If a guest knows someone's order number, they might be able to see order details without email verification. The PRD explicitly states: "Guest can track order at `/orders/[orderNumber]` — Must enter email used at checkout to verify ownership."

**Fix required in:** `app/(store)/orders/[orderNumber]/page.tsx` — add email verification step for guest orders (check `order.userId === null`)

---

## 12. Account — Points Balance Not Synced After Redemption

**File:** `app/(store)/account/points/page.tsx`

After redeeming points at checkout, the user's points balance is deducted. However, the `account/points` page shows the balance from the session (which might be stale). There's no revalidation of the points balance after checkout success.

**Problem:** If a user completes checkout with points redemption, then immediately visits `/account/points`, the displayed balance might not reflect the deduction until they refresh or re-login.

**Fix:** Use `useQuery` with `refetchOnWindowFocus: true` or invalidate the points query on the checkout success page.

---

## 13. Cart — No Stock Warning on Quantity Decrease

**File:** `store/cart.store.ts`

When a user reduces quantity via `updateQuantity`, there's no re-validation against live stock. If another user bought the last items between the cart being loaded and the user reducing quantity, the cart silently shows a quantity that now exceeds available stock.

**Fix:** After any quantity update in `updateQuantity`, if the new quantity > current `stock` in the store, show a warning toast and cap the quantity at available stock.

---

## 14. Checkout — Saved Address Picker Doesn't Show Default Badge

**File:** `components/store/checkout/SavedAddressPicker.tsx`

When rendering saved addresses, the component doesn't visually distinguish the `isDefault` address with a "Default" badge. Users might not realize which address will be used.

**Fix:** Add a badge or highlight to the default address in `SavedAddressPicker`.

---

## 15. Product Card — Add to Cart Button Not Disabled for Zero Stock

**File:** `components/store/products/ProductCard.tsx`

If a variant has `stock === 0`, the "Tambah" button might still be active. The `disabled` state should be checked per variant in the cart store.

**Fix:** Ensure the `addToCart` call checks `variant.stock > 0` and the button renders as disabled/grayed out when stock is 0.

---

## 16. Cart Drawer — Opens on Add but No Empty State for Zero Items

**File:** `components/store/cart/CartItem.tsx`

When cart is empty after removing the last item, the cart drawer stays open showing an empty cart (the items array is empty but the drawer doesn't auto-close).

**Fix:** Add a check in `CartSummary` or `useCartStore` — when `items.length === 0`, close the cart drawer automatically.

---

## 17. Checkout — Phone Number Not Normalized

**File:** `app/(store)/checkout/page.tsx`

Indonesian phone numbers can be entered as `08123456789`, `628123456789`, or `+628123456789`. The form accepts all three formats but doesn't normalize before storing in the DB.

**Fix:** Use the Indonesian phone transformer from `lib/validations/` (if it exists) to normalize to `08xx` format before storing in `order.recipientPhone`.

---

## 18. Order Success Page — Confetti Import

**File:** `app/(store)/checkout/success/page.tsx`

The confetti animation uses:

```typescript
const confetti = (await import('canvas-confetti')).default;
```

**Problem:** This is dynamically imported (correct), but it's called unconditionally on mount even if `status !== 'paid'`. The confetti fires even for pending orders that later become 'paid' via polling.

**Fix:** Only fire confetti when `status === 'paid'` and it's the first render (not a re-render from polling).

---

## 19. Auth — Login Redirect Back to Checkout

**File:** `app/(store)/checkout/page.tsx`

```typescript
const loginModal = (
  <Dialog open={showLoginModal} onOpenChange={setShowLoginModal}>
    <DialogContent>
      <AuthForms
        onSuccess={() => {
          setShowLoginModal(false);
          // Need to re-fetch user session but don't re-submit checkout
        }}
      />
    </DialogContent>
  </Dialog>
);
```

**Problem:** When a guest clicks "Masuk" during checkout and successfully logs in, the checkout form data is not re-populated with their saved profile data (name, email, phone). They have to re-enter it.

**Fix:** After login success, call `/api/account/profile` to fetch the user's saved info and pre-fill the identity form fields.

---

## 20. Blog — Reading Progress Bar Always Visible

**File:** `components/store/blog/ReadingProgress.tsx`

The `ReadingProgress` bar at the top of blog posts is always rendered. On short blog posts or on desktop viewports where the scroll container is small, it might not make sense to show a progress bar.

**Fix:** Add a minimum scroll threshold before showing the progress bar, or only render it when the article exceeds a certain number of characters.
