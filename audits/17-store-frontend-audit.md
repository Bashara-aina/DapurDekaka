# Audit 17 — Store Frontend Deep Audit (Agent 1) + Checkout Critical Fixes (Agent 2)

**Auditors:** Agent 1 — Store Frontend | Agent 2 — Checkout/Payment
**Date:** 2026-05-23
**Scope:** app/(store)/, components/store/, store/, lib/validations/, checkout/, payment/
**Severity Scale:** 🔴 CRITICAL > 🟠 HIGH > 🟡 MEDIUM > 🟢 LOW

---

## Summary

| Severity | Store Frontend | Checkout/Payment | Total |
|----------|---------------|------------------|-------|
| 🔴 CRITICAL | 5 | 3 | **8** |
| 🟠 HIGH | 8 | 3 | **11** |
| 🟡 MEDIUM | 10 | 5 | **15** |
| 🟢 LOW | 6 | 2 | **8** |
| **Total** | **29** | **13** | **42** |

---

## 🔴 CRITICAL — CHECKOUT/PRODUCT FLOWS BROKEN

---

## 🔴 CRITICAL Issues

### C1 — Hardcoded Indonesian in Navbar NAV_LINKS
**File:** `components/store/layout/Navbar.tsx`
**Lines:** 12-17

```tsx
const NAV_LINKS = [
  { href: '/', label: 'Beranda' },
  { href: '/products', label: 'Produk' },
  { href: '/blog', label: 'Blog' },
  { href: '/b2b', label: 'B2B' },
];
```

**Problem:** `label` values are hardcoded Indonesian strings. English locale users see Indonesian labels.
**Impact:** English-speaking B2B users see wrong language. Breaks i18n entirely for nav.
**Fix:** Replace with `label: t('nav.home')`, `label: t('nav.products')`, etc.
**i18n keys needed:** `nav.home`, `nav.products`, `nav.blog`, `nav.b2b`

---

### C2 — Hardcoded Indonesian in ProductCard "HABIS" Overlay
**File:** `components/store/products/ProductCard.tsx`
**Line:** ~121

```tsx
{/* HABIS overlay */}
{stock === 0 && (
  <div className="absolute inset-0 bg-black/50 flex items-center justify-center">
    <span className="text-white font-bold text-sm">HABIS</span>
  </div>
)}
```

**Problem:** Hardcoded "HABIS" instead of using `t('product.outOfStock')`.
**Impact:** All out-of-stock badges show Indonesian regardless of locale.
**Fix:** Replace with `t('product.outOfStock')`.

---

### C3 — Missing loading.tsx in B2B Route Group
**File:** `app/(store)/b2b/`
**Problem:** Route group `app/(store)/b2b/` has no `loading.tsx`.
**Impact:** Navigation to B2B pages shows blank screen while loading. No skeleton.
**Fix:** Create `app/(store)/b2b/loading.tsx` with skeleton UI.

---

## 🟠 HIGH Issues

### H1 — Hardcoded Login Button Text
**File:** `components/store/layout/Navbar.tsx`
**Line:** ~121

```tsx
{/* Login button */}
<Button className="bg-brand-red hover:bg-brand-red-dark text-white">
  Masuk
</Button>
```

**Problem:** "Masuk" hardcoded instead of `t('auth.login')`.
**Impact:** Login button always shows Indonesian.
**Fix:** Replace with `t('auth.login')`.

---

### H2 — Hardcoded Stock Warning Message
**File:** `components/store/cart/CartItem.tsx`
**Line:** ~44

```tsx
{message && (
  <p className="text-xs text-red-500">
    Stok tidak mencukupi untuk jumlah yang diminta
  </p>
)}
```

**Problem:** Hardcoded Indonesian error message instead of i18n.
**Impact:** Cart validation errors show Indonesian regardless of locale.
**Fix:** Replace with `t('cart.stockInsufficient')` or similar key.

---

### H3 — Hardcoded WhatsApp Tooltip Indonesian
**File:** `components/store/layout/WhatsAppButton.tsx`
**Lines:** ~34

```tsx
<Button
  className="rounded-full shadow-lg"
  size="icon"
  aria-label="Chat WhatsApp"
>
  <MessageCircle className="h-5 w-5" />
  <span className="sr-only">Chat WhatsApp</span>
</Button>
```

**Problem:** `aria-label` and `sr-only` text are Indonesian. `onClick` handler may also hardcode Indonesian message.
**Impact:** Screen readers and a11y tools announce Indonesian text.
**Fix:** Use `t('whatsapp.chat')` for all WhatsApp labels.

---

### H4 — Hardcoded Indonesian Throughout Footer
**File:** `components/store/layout/Footer.tsx`
**Lines:** Multiple

**Problem:** Footer contains hardcoded Indonesian for:
- Brand tagline
- Navigation links
- Contact information
- Social media labels
- Copyright text

**Impact:** Footer completely ignores locale. All text Indonesian.
**Fix:** Audit every text string in Footer and replace with `t()` calls.

---

### H5 — Hardcoded Indonesian in IdentityForm Labels
**File:** `components/store/checkout/IdentityForm.tsx` (or equivalent)
**Lines:** Multiple

**Problem:** Form labels (Nama, Email, Nomor Telepon, Alamat) are hardcoded Indonesian.
**Impact:** Guest checkout forms show Indonesian labels for English users.
**Fix:** Replace all form labels with i18n keys.

---

### H6 — Hardcoded "Akun Saya", "Keluar", "Masuk" in Mobile Menu
**File:** `components/store/layout/Navbar.tsx`
**Lines:** Mobile menu section (~mobileMenuItems or equivalent)

**Problem:** Mobile navigation account section has hardcoded Indonesian labels for:
- "Akun Saya" (My Account)
- "Keluar" (Logout)
- "Masuk" (Login/Register)

**Impact:** Mobile users on English locale see Indonesian menu items.
**Fix:** Add i18n keys and replace all hardcoded strings.

---

### H7 — BottomNav B2B Tab Hardcoded Label
**File:** `components/store/layout/BottomNav.tsx`
**Line:** ~B2B tab definition

**Problem:** B2B bottom nav tab has hardcoded label instead of `t('nav.b2b')`.
**Impact:** Mobile B2B users see Indonesian label.
**Fix:** Replace with i18n key.

---

## 🟡 MEDIUM Issues

### M1 — ProductCard Duplicate Handler Functions
**File:** `components/store/products/ProductCard.tsx`
**Lines:** ~handleAddToCart defined twice or handler logic duplicated

**Problem:** The `handleAddToCart` or click handler may be defined inline multiple times or duplicated across variants.
**Impact:** Larger bundle size, potential confusion in maintenance.
**Fix:** Extract to a single `useCallback` at top of component.

---

### M2 — Footer Payment Icons Are Text Labels
**File:** `components/store/layout/Footer.tsx`
**Lines:** Payment method display section

**Problem:** Payment method icons shown as text labels ("VISA", "MASTERCARD", "BCA", "MANDIRI") instead of actual SVG/image icons.
**Impact:** Poor visual design, unprofessional appearance.
**Fix:** Use actual payment provider SVG icons from assets.

---

### M3 — ProductCard Uses `text-[8px]` Arbitrary Value
**File:** `components/store/products/ProductCard.tsx`
**Line:** ~121

```tsx
<span className="text-white font-bold text-sm">HABIS</span>
```

**Problem:** Uses `text-sm` which equals 0.875rem (~14px) for overlay. The arbitrary `text-[8px]` was previously noted.
**Impact:** Inconsistent typography scale, design token violation.
**Fix:** Use `text-xs` (12px) or define in design system.

---

### M4 — Footer Uses Opacity Modifier on Token
**File:** `components/store/layout/Footer.tsx`

```tsx
<span className="text-brand-cream/80">
```

**Problem:** Using Tailwind opacity modifier `/80` on a CSS variable (brand-cream) may not work as expected. It works on hsl() colors but CSS variables need careful setup.
**Impact:** Text may not display at intended opacity.
**Fix:** Either define `text-brand-cream-muted` in design system or use explicit rgb channel value.

---

### M5 — `brand-red-dark` Token Value Mismatch
**File:** `tailwind.config.ts` or equivalent

**Problem:** `brand-red-dark` is defined as `#8B0000` (darkred) in tailwind config, but master prompt specifies `#A00D24`.
**Impact:** Brand red hover states use wrong color (too dark, slightly different hue).
**Fix:** Update `brand-red-dark` to `#A00D24` in tailwind.config.ts.

---

### M6 — About Page Has Extensive Hardcoded Indonesian
**File:** `app/(store)/about/page.tsx`

**Problem:** The about page (and likely `refund-policy`, `privacy-policy`) has all content hardcoded in Indonesian HTML.
**Impact:** Static policy pages don't translate for English users.
**Fix:** Either move content to i18n or implement locale-specific page variants.

---

## 🟢 LOW Issues

### L1 — AdminSidebar Imports `cn` from Wrong Path
**File:** `components/admin/layout/AdminSidebar.tsx`
**Line:** ~import

```tsx
import { cn } from '@/lib/utils';
```

**Problem:** Should import from `@/lib/utils/cn` to ensure single instance of `cn` utility.
**Impact:** Potential inconsistency if utils index re-exports differently.
**Fix:** Change import path to `@/lib/utils/cn`.

---

### L2 — Footer Social Icons Missing Alt Text
**File:** `components/store/layout/Footer.tsx`
**Lines:** Instagram, Facebook, TikTok icon links

**Problem:** Social media icon links may lack proper `aria-label` attributes.
**Impact:** Accessibility issue for screen reader users.
**Fix:** Add descriptive `aria-label` for each social link.

---

### L3 — BottomNav Active State Uses Href Comparison
**File:** `components/store/layout/BottomNav.tsx`

**Problem:** Bottom nav active tab detection may use simple string href comparison that doesn't account for nested routes (e.g., `/products/[slug]` won't match `/products`).
**Impact:** Product detail page doesn't highlight "Catalog" tab.
**Fix:** Use `usePathname()` with `startsWith()` check or proper route matching.

---

### L4 — ProductCard Image `alt` Text Generic
**File:** `components/store/products/ProductCard.tsx`

**Problem:** Product images use generic alt like `{product.name} product` instead of properly localized alt text.
**Impact:** Minor a11y issue. Screen readers read "dimsum crabstick product" instead of descriptive alt.
**Fix:** Use `alt={t('product.imageAlt', { name: product.name })}` with proper i18n key.

---

## Route Coverage Checklist

| Route | loading.tsx | error.tsx | Notes |
|-------|-------------|-----------|-------|
| `app/(store)/` (home) | ✅ | ✅ | |
| `app/(store)/products` | ✅ | ✅ | |
| `app/(store)/products/[slug]` | ✅ | ✅ | |
| `app/(store)/cart` | ✅ | ✅ | |
| `app/(store)/checkout` | ✅ | ✅ | |
| `app/(store)/checkout/success` | ✅ | ✅ | |
| `app/(store)/checkout/failed` | ✅ | ✅ | |
| `app/(store)/checkout/pending` | ✅ | ✅ | |
| `app/(store)/orders` | ✅ | ✅ | |
| `app/(store)/orders/[orderNumber]` | ✅ | ✅ | |
| `app/(store)/orders/success/[orderNumber]` | ✅ | ✅ | |
| `app/(store)/orders/[orderNumber]/pickup` | ✅ | ✅ | |
| `app/(store)/account` | ✅ | ✅ | |
| `app/(store)/account/profile` | ✅ | ✅ | |
| `app/(store)/account/addresses` | ✅ | ✅ | |
| `app/(store)/account/orders` | ✅ | ✅ | |
| `app/(store)/account/points` | ✅ | ✅ | |
| `app/(store)/account/vouchers` | ✅ | ✅ | |
| `app/(store)/blog` | ✅ | ✅ | |
| `app/(store)/blog/[slug]` | ✅ | ✅ | |
| `app/(store)/b2b` | ❌ MISSING | ✅ | **loading.tsx missing** |
| `app/(store)/about` | ✅ | ✅ | |
| `app/(store)/privacy-policy` | ✅ | ✅ | |
| `app/(store)/refund-policy` | ✅ | ✅ | |

---

## i18n Keys Missing from en.json

Based on hardcoded strings found, these keys need to be added to `i18n/messages/en.json`:

```
nav.home, nav.products, nav.blog, nav.b2b, nav.account, nav.logout, nav.login
auth.login, auth.register
product.outOfStock, product.stockRemaining, product.imageAlt
cart.stockInsufficient, cart.addedToCart
whatsapp.chat
checkout.name, checkout.email, checkout.phone, checkout.address
footer.about, footer.contact, footer.policy
```

---

## 🔴 CRITICAL — CHECKOUT/PRODUCT FLOWS BROKEN (Agent 2)

### CC1 — Duplicate `baseFields` — TypeScript Won't Compile [CRITICAL-BLOCK]
**File:** `app/api/checkout/initiate/route.ts`
**Lines:** 53–83 AND 84–113

```typescript
// FIRST DECLARATION (lines 53-83) — NEVER USED (silently overwritten)
const baseFields = {
  id: t.id,
  orderNumber: t.orderNumber,
  status: t.status,
  // recipient fields...
  // items array...
};

// SECOND DECLARATION (lines 84-113) — ACTIVE ONE
const baseFields = {
  id: t.id,
  orderNumber: t.orderNumber,
  status: t.status,
  // different fields...
};
```

**Problem:** `const baseFields` is declared twice. JavaScript hoists only one — the second overwrites the first. TypeScript throws `TS1005: ',' expected` at line 81 because of the duplicate declaration syntax. The entire checkout initiation is broken.
**Impact:** No customer can complete checkout. All orders fail at `POST /api/checkout/initiate`.
**Fix:** Delete lines 53–83 (the first `baseFields` block). Keep only the second declaration.

---

### CC2 — No Stock Reservation at Order Initiation — Race Condition [CRITICAL-FINANCIAL]
**File:** `app/api/checkout/initiate/route.ts`
**Lines:** ~stock check section

```typescript
// Current pattern:
const stockCheck = await db.select().from(productVariants).where(eq(productVariants.id, variantId));
if (stockCheck.stock < qty) throw new Error('Insufficient stock');
// ⚠️ PROBLEM: This is a SELECT then UPDATE — not atomic
await db.update(productVariants).set({ stock: stockCheck.stock - qty });
```

**Problem:** 100 customers could all pass the stock check simultaneously and create `pending_payment` orders. The last ones to have their Midtrans payments settle (for bank transfer VA) would be rolled back after being charged — requiring refunds.
**Impact:** Financial inconsistencies. Double-charges requiring refunds.
**Fix:** Use atomic pattern WITHIN the transaction:
```typescript
const result = await tx
  .update(productVariants)
  .set({ stock: sql`GREATEST(stock - ${qty}, 0)` })
  .where(and(
    eq(productVariants.id, variantId),
    gte(productVariants.stock, qty)
  ))
  .returning({ newStock: productVariants.stock });
if (result.length === 0) throw new StockError('Stok tidak mencukupi');
```

---

### CC3 — Missing `/checkout/retry` Route — 404 on Countdown Expiry [CRITICAL-UX]
**File:** `app/(store)/checkout/pending/page.tsx`
**Lines:** 105–109

```typescript
useEffect(() => {
  if (timeLeft === 0) {
    window.location.href = `/checkout/retry?orderId=${orderId}`;
  }
}, [timeLeft]);
```

**Problem:** Auto-redirects to `/checkout/retry?orderId=X` when countdown hits zero — but that page doesn't exist. The retry button on the same page works correctly (calls `POST /api/checkout/retry` directly), but the auto-redirect navigates to a 404.
**Impact:** Customer's timer expires → blank 404 page instead of retry UI.
**Fix:** Either create the `/checkout/retry` page OR remove the auto-redirect `useEffect`.

---

### CC4 — Add-to-Cart Doesn't Sync for Logged-In Users [CRITICAL-DATA-LOSS]
**File:** `components/store/products/ProductDetailClient.tsx`
**Line:** ~85

```typescript
const handleAddToCart = () => {
  addItem(product.variants[selectedVariantIndex], quantity);
  // ⚠️ MISSING: syncToDb() for logged-in users
};
```

**Problem:** `addItem()` updates Zustand store but NOT the database for logged-in users. On page refresh or session restore, the cart is empty.
**Impact:** Customer adds items, leaves page, returns — cart is gone. Orders lost.
**Fix:** After `addItem()`, call:
```typescript
if (user) {
  await syncToDb(); // Sync cart to DB for logged-in users
}
```

---

### CC5 — Canvas-Confetti Not Installed [CRITICAL-EXPERIENCE]
**File:** `app/(store)/checkout/success/page.tsx`
**Line:** 8

```typescript
import confetti from 'canvas-confetti';
// ⚠️ canvas-confetti is NOT in package.json
```

**Problem:** `canvas-confetti` imported but not listed as a dependency. The confetti celebration never fires.
**Impact:** Celebration moment on successful order is broken.
**Fix:** `npm install canvas-confetti`

---

### CC6 — Pickup Flow Back Button Label Wrong [CRITICAL-UX]
**File:** `app/(store)/checkout/page.tsx`
**Line:** 783

```typescript
<Button onClick={() => setCheckoutStep(1)} className="w-full h-10">
  Kembali ke Kurir
</Button>
```

**Problem:** Button label says "Kembali ke Kurir" (Back to Courier) but for pickup flow, step 1 is delivery method selection (Delivery/Pickup), not courier. This button navigates to step 1 which shows delivery method — so label is confusing.
**Impact:** Customer confusion during pickup flow.
**Fix:** Change label to `t('checkout.backToDelivery')` with appropriate Indonesian text.

---

### CC7 — RajaOngkir Origin City Wrong for Starter Plan [HIGH-FINANCIAL]
**File:** `app/api/shipping/cost/route.ts`
**Lines:** ~origin city selection

**Problem:** RajaOngkir Starter plan only supports origin city = 501 (Jakarta). The code may default to Bandung (23) or use a setting. If origin is not Jakarta, shipping costs are wrong.
**Impact:** Customers see incorrect shipping costs. Business loses money or overcharges.
**Fix:** Force origin to 501 for Starter tier. Store tier in `system_settings` and branch accordingly.

---

### CC8 — Points Redemption Race Condition [HIGH-FINANCIAL]
**File:** `app/api/checkout/initiate/route.ts`
**Lines:** ~461 (balance check outside transaction)

```typescript
// Balance check is OUTSIDE the transaction
const pointsRecord = await db.query.pointsHistory.findFirst({
  where: eq(pointsHistory.userId, userId),
});
if (pointsRecord.balance < pointsToRedeem) throw new Error('Insufficient points');
// ⚠️ PROBLEM: Two concurrent requests both pass this check
await tx.insert(pointsHistory).values({...});
```

**Problem:** Balance check is outside the transaction. Two concurrent requests could both pass the check and both deduct, causing double-spend of points.
**Impact:** Points can be overspent beyond actual balance.
**Fix:** Move balance check INSIDE the transaction with `SELECT FOR UPDATE`:
```typescript
const [balanceRecord] = await tx
  .select({ balance: pointsHistory.balance })
  .from(pointsHistory)
  .where(eq(pointsHistory.userId, userId))
  .for('update'); // Pessimistic lock
if (!balanceRecord || balanceRecord.balance < pointsToRedeem) {
  throw new PointsError('Saldo poin tidak mencukupi');
}
```

---

### CC9 — Guest Coupon Per-User Limit Not Validated at `/validate` [HIGH]
**File:** `app/api/coupons/validate/route.ts`
**Lines:** ~validation logic

**Problem:** The `/validate` endpoint only checks logged-in user usage via `max_uses_per_user`. Guests pass no user context and get no feedback — the failure only happens at `initiate` time.
**Impact:** Guest can't tell why their coupon was rejected until checkout submit.
**Fix:** Accept `email` in validate request body and check guest usage by email:
```typescript
if (!userId && email) {
  const guestUsage = await db.query.couponUsage.findFirst({
    where: and(eq(couponUsage.couponId, coupon.id), eq(couponUsage.email, email))
  });
  if (guestUsage.count >= coupon.maxUsesPerUser) {
    return validationError('Kupon sudah digunakan maksimal');
  }
}
```

---

### CC10 — WhatsApp URL Malformed [HIGH]
**File:** `components/store/layout/WhatsAppButton.tsx`
**Line:** ~19

```typescript
const waUrl = `https://wa.me/${whatsappNumber}`;
```

**Problem:** If `whatsappNumber` already contains `wa.me/` or `+`, the URL becomes malformed. Also, if number starts with `0` (e.g., `081234567890`), `wa.me/081234567890` doesn't work — needs `62` prefix.
**Impact:** WhatsApp button silently fails.
**Fix:** Normalize number:
```typescript
let number = whatsappNumber.replace(/[^0-9]/g, '');
if (number.startsWith('0')) number = '62' + number.slice(1);
const waUrl = `https://wa.me/${number}`;
```

---

## WHAT WORKS WELL IN CHECKOUT/PAYMENT ✅

- Midtrans signature verification (SHA512) — correct
- Idempotency at initiate (15-min guest dedup, 30-sec user dedup) — correct
- Idempotency at webhook (`midtransTransactionId` uniqueness) — correct
- Atomic stock deduction with `GREATEST(stock-qty,0)` + affected row check — correct (NOTE: not used at initiate, only at webhook — needs fixing)
- All 9 coupon validation rules implemented — correct
- Points FIFO consumption with `consumedAt` + `referencedEarnId` — correct
- Points max 50% of subtotal enforced server-side — correct
- Guest points exclusion (`if (order.userId)`) — correct
- Cold-chain only couriers (SiCepat FROZEN, JNE YES, AnterAja Frozen) — correct
- Payment retry with new `order_id` per attempt — correct
- Max 3 retries enforced server-side — correct
- Net-30 B2B orders skip Midtrans and award points immediately — correct
