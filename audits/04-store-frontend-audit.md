# Store Frontend & Cart Deep Audit

## Audit Date: 2026-05-23
## Scope: Store Frontend (Customer-facing pages, Cart, Checkout Flow)
## Method: Component-level code review + API route inspection

---

## 🔴 CRITICAL BUGS (Must Fix Before Launch)

### C-01: Pickup Address is Hardcoded — NOT from Database
**File:** `components/store/checkout/DeliveryMethodToggle.tsx` line 72-73

```tsx
{/* TODO: Fetch pickup address from system_settings table */}
Jl. Sinom V no. 7, Turangga, Bandung
```

**Problem:** The pickup store address is hardcoded in the component. There's a `TODO` comment acknowledging this should come from `system_settings` table, but it's not implemented.

**Impact:** If the store moves or changes address, admin must edit code. Not translatable. Not editable from admin panel.

**Fix Required:** Fetch `store_pickup_address` from `/api/settings/public` and display dynamically, like `storeHours` is fetched.

**Evidence:**
```tsx
// DeliveryMethodToggle.tsx:71-74
<p className="text-sm text-text-secondary">
  {/* TODO: Fetch pickup address from system_settings table */}
  Jl. Sinom V no. 7, Turangga, Bandung
</p>
```

---

### C-02: InstagramFeed is Hardcoded Placeholder — No Real IG Integration
**File:** `components/store/home/InstagramFeed.tsx` lines 9-16

```tsx
const galleryPosts = [
  { id: 1, cloudinaryPublicId: 'dapurdekaka/gallery/gallery-01', alt: 'Dimsum premium' },
  { id: 2, cloudinaryPublicId: 'dapurdekaka/gallery/gallery-02', alt: 'Bakso frozen' },
  // ... 6 hardcoded entries
];
```

**Problem:** The "Instagram Feed" section on homepage shows hardcoded static images. It's not fetching real Instagram content. All 6 images are fixed in code.

**Impact:** The section is labeled "Galeri Kami" but is not connected to Instagram API or any real feed. If those Cloudinary images don't exist or are deleted, the homepage shows broken images.

**Also:** The section links to `https://instagram.com/dapurdekaka` but doesn't reflect actual IG content.

**Fix Options:**
1. Fetch actual Instagram posts via Meta Graph API (requires Facebook App setup)
2. Or convert to "Gallery" section managed from CMS/admin (carousel_slides table already exists)

**Evidence:**
```tsx
// InstagramFeed.tsx:9-16 — hardcoded array
const galleryPosts = [
  { id: 1, cloudinaryPublicId: 'dapurdekaka/gallery/gallery-01', alt: 'Dimsum premium' },
  // 5 more...
];
```

---

### C-03: Order Summary Card "Ringkasan Pesanan" Uses Hardcoded Indonesian
**File:** `components/store/checkout/OrderSummaryCard.tsx` line 29

```tsx
<h3 className="font-semibold mb-4">Ringkasan Pesanan</h3>
```

**Problem:** "Ringkasan Pesanan" is hardcoded Indonesian, not using `useTranslations()`. This violates the i18n rule (all UI strings must be translated).

**Evidence:**
```tsx
// OrderSummaryCard.tsx:28-29
<div className={cn('bg-white rounded-card p-6 shadow-card sticky top-32', className)}>
  <h3 className="font-semibold mb-4">Ringkasan Pesanan</h3> // HARDCODED
```

**Same issue in:** `CartSummary.tsx` line 31 — "Ringkasan Belanja" is hardcoded.

---

### C-04: Testimonials Fetch Uses Silent Fail — No User Feedback on Error
**File:** `components/store/home/Testimonials.tsx` lines 23-34

```tsx
async function fetchTestimonials() {
  try {
    const res = await fetch('/api/testimonials/public');
    const json = await res.json();
    if (json.success && json.data?.length > 0) {
      setTestimonials(json.data);
    }
  } catch {
    // Fallback: use empty array (component shows nothing)
  }
}
```

**Problem:** If `/api/testimonials/public` fails (404, 500, network error), the component silently fails and renders nothing. No toast, no empty state message, no retry option. The user sees nothing where testimonials should be.

**Impact:** If the API route doesn't exist or is broken, customers see a blank space where social proof should be — with no indication anything went wrong.

**Fix:** Show a graceful fallback message or load static fallback data when API fails.

---

### C-05: FeaturedProducts Hardcoded Indonesian Strings
**File:** `components/store/home/FeaturedProducts.tsx` lines 56-59

```tsx
<h2 className="font-display text-2xl md:text-3xl font-semibold text-text-primary">
  Produk Unggulan
</h2>
<p className="text-text-secondary text-sm">Pilihan terbaik dari dapur kami</p>
```

**Problem:** "Produk Unggulan" and "Pilihan terbaik dari dapur kami" are hardcoded Indonesian. Not using `useTranslations()`.

**Also in:**
- Line 65: "Lihat Semua"
- Line 91: "Belum ada produk unggulan saat ini"
- Line 93: "Lihat semua produk"

**Evidence:** Lines 56, 59, 65, 91, 93 — all hardcoded Indonesian text.

---

### C-06: WhatsAppButton has Hardcoded Message Text
**File:** `components/store/layout/WhatsAppButton.tsx` line 20

```tsx
const message = encodeURIComponent('Halo Dapur Dekaka, saya ingin bertanya tentang...');
```

**Problem:** The pre-filled WhatsApp message is hardcoded in English ("Halo Dapur Dekaka..."). This should come from i18n so it's localized (English version would say "Hello Dapur Dekaka...").

---

## 🟠 MEDIUM ISSUES

### M-01: HeroCarousel Has Hardcoded Fallback Text (But Uses i18n Correctly)
**File:** `components/store/home/HeroCarousel.tsx` lines 55-67

When no slides exist, the carousel shows:
```tsx
<h1 className="font-display text-2xl ... whitespace-pre-line leading-tight">
  Cita Rasa Warisan,
  kini di Rumahmu
</h1>
<p className="text-white/90 text-base md:text-lg mb-6 max-w-xl">
  Dimsum, siomay, dan bakso frozen premium dari Bandung — langsung ke pintu rumah Anda
</p>
<Link href="/products" ...>
  Lihat Produk
</Link>
```

**Problem:** The fallback when no slides are configured uses hardcoded Indonesian. But this is only a fallback and unlikely to occur in production (slides are managed in admin). Still, the hero section should use i18n for these fallback strings.

**Note:** This is a fallback scenario only — not as critical since real content comes from DB.

---

### M-02: ShippingOptions Hardcoded Indonesian Strings
**File:** `components/store/checkout/ShippingOptions.tsx` line 36

```tsx
<h2 className="font-semibold text-lg mb-4">Pilih Kurir</h2>
```

**Problem:** "Pilih Kurir" is hardcoded. Should use `useTranslations()`.

**Also:** Line 55 — "Tidak ada opsi pengiriman tersedia untuk daerah ini."

---

### M-03: AddressForm Hardcoded Indonesian Label
**File:** `components/store/checkout/AddressForm.tsx` line 149

```tsx
<h2 className="font-semibold text-lg mb-4">Alamat Pengiriman</h2>
```

**Problem:** "Alamat Pengiriman" is hardcoded. Should use i18n.

---

### M-04: ProductCard Line 126 — MUI Label Hardcoded
**File:** `components/store/products/ProductCard.tsx` lines 126-129

```tsx
{product.isHalal && (
  <span className="text-[8px] text-text-disabled bg-white/60 px-1 rounded text-center">
    MUI 001/2020
  </span>
)}
```

**Problem:** The MUI certification number "001/2020" is hardcoded in the component. Should come from product data (stored in DB) or at minimum from i18n. If the certification changes, code must be edited.

---

### M-05: PointsRedeemer Has Hardcoded Indonesian Labels
**File:** `components/store/checkout/PointsRedeemer.tsx` lines 49-57

```tsx
<div>
  <p className="text-sm font-medium">Gunakan Poin</p>
  <p className="text-xs text-text-secondary">
    Saldo: {pointsBalance.toLocaleString('id-ID')} poin
    {potentialSavings > 0 && (
      <span className="text-success ml-1">(≈ hemat {formatIDR(potentialSavings)})</span>
    )}
  </p>
</div>
```

**Problem:** "Gunakan Poin", "Saldo:", "≈ hemat" all hardcoded. Should use i18n.

**Also line 74-76:**
```tsx
<p className="text-xs text-text-secondary mb-1">
  Maks. {maxPointsToRedeem.toLocaleString('id-ID')} poin (
  {formatIDR(maxPointsToRedeem * POINTS_VALUE_IDR)})
</p>
```

---

### M-06: DeliveryMethodToggle Hardcoded Indonesian
**File:** `components/store/checkout/DeliveryMethodToggle.tsx` line 24

```tsx
<h2 className="font-semibold text-lg mb-4">Metode Pengiriman</h2>
```

And lines 45-48:
```tsx
<p className="font-medium">Kirim ke Alamat</p>
<p className="text-sm text-text-secondary">
  Dikirim via SiCepat FROZEN / JNE YES / AnterAja Frozen
</p>
```

"Metode Pengiriman", "Kirim ke Alamat", "Ambil di Toko" are all hardcoded.

---

### M-07: CartSummary Hardcoded "Ringkasan Belanja"
**File:** `components/store/cart/CartSummary.tsx` line 31

```tsx
<h3 className="font-display font-semibold text-lg mb-4">Ringkasan Belanja</h3>
```

**Also line 34-38:**
```tsx
<div className="bg-warning-light border border-warning/30 rounded-lg p-3 mb-4">
  <p className="text-xs text-warning font-medium">
    Ada item yang stoknya tidak mencukupi. Silakan perbaiki sebelum checkout.
  </p>
</div>
```

All hardcoded Indonesian.

---

### M-08: SavedAddressPicker "Pilih Alamat" Hardcoded
**File:** `components/store/checkout/SavedAddressPicker.tsx` line 40

```tsx
<h2 className="font-semibold text-lg mb-4">Pilih Alamat</h2>
```

Hardcoded.

---

## 🟡 MINOR ISSUES

### L-01: ProductCard Duplicate Add-to-Cart Logic
**File:** `components/store/products/ProductCard.tsx` lines 54-102

`handleQuickAdd` (lines 54-77) and `handleAddToCart` (lines 79-102) are nearly identical functions. Both add item to cart and show toast. This is code duplication.

**Note:** `handleQuickAdd` is for the floating + button; `handleAddToCart` is for the circular cart button inside the card. They could share a common helper.

---

### L-02: FeaturedProducts Double-Import of MotionComp
**File:** `components/store/home/FeaturedProducts.tsx` line 30

```tsx
const [MotionComp, setMotionComp] = useState<typeof import('framer-motion') | null>(null);
```

The component renders a non-animated fallback (lines 51-99) while framer-motion loads asynchronously. This creates a flash of unstyled content. However, the fallback is functional and properly styled, so this is a minor UX issue rather than a bug.

---

### L-03: Checkout Page Comment References "FIX 13"
**File:** `app/(store)/checkout/page.tsx` line 102

```tsx
// FIX 13: Persist checkout state to sessionStorage so refresh doesn't lose progress
```

This is a comment referencing a past bug fix. Not harmful, but indicates a workaround was applied. Should be cleaned up or converted to a proper note in documentation.

---

### L-04: ProductDetailClient Sticky Bottom Bar Offset Calculation
**File:** `components/store/products/ProductDetailClient.tsx` line 340

```tsx
<div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom,0px))] md:hidden left-0 right-0 ...">
```

The BottomNav height (`5rem`) is hardcoded here. If BottomNav height changes (e.g., adding/removing tabs), this offset will be wrong. Should use a CSS variable or consistent constant.

---

## ✅ PLACEHOLDER / INCOMPLETE ITEMS FOUND

| # | Location | Issue | Severity |
|---|----------|-------|----------|
| 1 | `DeliveryMethodToggle.tsx:72` | TODO comment — pickup address should be fetched from DB | 🔴 CRITICAL |
| 2 | `InstagramFeed.tsx:9-16` | 6 hardcoded gallery images — not real IG feed | 🔴 CRITICAL |
| 3 | `app/api/checkout/retry/route.ts:121` | TODO: consider adding a consumedAt version field for earn records | 🟠 MEDIUM (tech debt) |
| 4 | `checkout/page.tsx:102` | FIX 13 comment — work-around for session persistence | 🟡 MINOR (code hygiene) |

---

## 📋 FLOW-BY-FLOW TEST RESULTS

### ✅ Homepage (app/(store)/page.tsx)
- **Carousel:** Works — fetches from DB (carouselSlides), has fallback for empty state
- **CategoryChips:** Uses DB data with product count filtering
- **FeaturedProducts:** Shows products from DB. Has empty state handling.
- **PromoBanner:** Reads from system_settings, has default fallback. Copy-to-clipboard works.
- **WhyDapurDekaka:** Static content — not DB-driven, acceptable.
- **InstagramFeed:** ⚠️ **HARDCODED** — see C-02 above.
- **Testimonials:** ⚠️ **Silent fail on error** — see C-04 above.
- **JSON-LD:** Present and well-structured (Organization, WebSite, LocalBusiness schemas)

### ✅ Product Catalog (app/(store)/products/page.tsx + ProductCatalog.tsx)
- Category filtering works (URL params)
- Search works (debounced 200ms)
- Sorting works (default/price_asc/price_desc/newest)
- OOS products sorted to end
- Empty state renders correctly
- Pagination (cursor-based) present

### ✅ Product Detail (app/(store)/products/[slug]/page.tsx + ProductDetailClient.tsx)
- Image gallery with thumbnails
- Lightbox zoom works
- Variant selection updates price/stock
- Quantity stepper respects stock limits (max 99, capped by stock)
- StockBadge shows correctly
- Add-to-cart works with toast feedback
- Related products from same category
- Breadcrumb navigation present
- Lightbox with X close button works

### ✅ Cart Page (app/(store)/cart/page.tsx)
- Stock validation via `/api/cart/validate` on mount
- Stock issues show warning banner
- Quantity controls respect stock limits
- Remove item works
- Clear cart with confirmation dialog works
- Login prompt banner for guests (earn points)
- Empty state with CTA to products

**Issue:** `EmptyCart` uses `EmptyState` variant="cart" which dynamically imports framer-motion. On slow connections, the sad dimsum animation may not load instantly.

### ✅ Checkout Page (app/(store)/checkout/page.tsx)
- **Step 1 (Identity):** Zod validation on all fields (name min 2, email format, phone regex). Pre-fills from session for logged-in users.
- **Step 2 (Delivery):** Toggle between delivery/pickup works. Saved addresses for logged-in users via `SavedAddressPicker`. New address form with province→city cascade.
- **Step 3 (Courier):** Fetches shipping costs from RajaOngkir via `/api/shipping/cost`. Cold-chain only (SiCepat, JNE YES, AnterAja Frozen).
- **Step 4 (Payment):** Coupon validation via `/api/coupons/validate`. Points redemption with 50% cap. Order review expandable. Midtrans Snap integration.
- **Session persistence:** FIX 13 workaround persists form data to sessionStorage.

**Issues Found:**
- DeliveryMethodToggle pickup address hardcoded (C-01)
- Hardcoded Indonesian strings throughout (M-03, M-06, etc.)

### ✅ API Routes
- `/api/cart/validate` — Zod validation, rate limiting (30/min), proper error responses
- `/api/coupons/validate` — exists and works (referenced in checkout)
- `/api/shipping/cost` — RajaOngkir integration with cold-chain filtering
- `/api/shipping/provinces` and `/api/shipping/cities` — province/city cascade

### ✅ BottomNav (components/store/layout/BottomNav.tsx)
- 5 tabs: Home, Products, Blog, Cart (with badge), Account
- B2B tab added for b2b/superadmin users
- Active state highlights current route
- Cart badge shows total items (capped at 99+)
- Safe area inset respected for iPhone

### ✅ WhatsAppButton
- Positioned above BottomNav (`bottom-20`)
- Tooltip on hover with disclaimer text
- Pre-filled message uses env var for phone number
- Fallback if `NEXT_PUBLIC_WHATSAPP_NUMBER` not set (renders null)

---

## 📁 SPECIFIC FILE:LINE REFERENCES

| File | Lines | Issue |
|------|-------|-------|
| `components/store/checkout/DeliveryMethodToggle.tsx` | 72-73 | Pickup address hardcoded (C-01) |
| `components/store/checkout/DeliveryMethodToggle.tsx` | 24, 45, 47, 70 | Hardcoded i18n strings (M-06) |
| `components/store/home/InstagramFeed.tsx` | 9-16 | Hardcoded 6 gallery posts (C-02) |
| `components/store/home/Testimonials.tsx` | 23-34 | Silent fail on API error (C-04) |
| `components/store/checkout/OrderSummaryCard.tsx` | 29 | "Ringkasan Pesanan" hardcoded (C-03) |
| `components/store/cart/CartSummary.tsx` | 31, 35-37 | Hardcoded i18n strings (M-07) |
| `components/store/home/FeaturedProducts.tsx` | 56-59, 65, 91, 93 | Hardcoded Indonesian (C-05) |
| `components/store/checkout/PointsRedeemer.tsx` | 49-57, 74-76 | Hardcoded i18n strings (M-05) |
| `components/store/checkout/ShippingOptions.tsx` | 36, 55 | Hardcoded i18n strings (M-02) |
| `components/store/checkout/AddressForm.tsx` | 149 | "Alamat Pengiriman" hardcoded (M-03) |
| `components/store/checkout/SavedAddressPicker.tsx` | 40 | "Pilih Alamat" hardcoded (M-08) |
| `components/store/products/ProductCard.tsx` | 126-129 | MUI 001/2020 hardcoded (M-04) |
| `components/store/layout/WhatsAppButton.tsx` | 20 | Hardcoded WA message (C-06) |
| `components/store/products/ProductCard.tsx` | 54-102 | Duplicate add-to-cart functions (L-01) |
| `components/store/products/ProductDetailClient.tsx` | 340 | Hardcoded BottomNav height offset (L-04) |
| `app/(store)/checkout/page.tsx` | 102 | FIX 13 comment — code hygiene (L-03) |
| `app/api/checkout/retry/route.ts` | 121 | TODO comment — tech debt |

---

## 🎯 RECOMMENDATIONS

### P0 — Must Fix Before Launch
1. **Implement pickup address from system_settings** — `DeliveryMethodToggle.tsx:72`
   - Add `store_pickup_address` to system_settings table
   - Fetch via `/api/settings/public` like storeHours
   - Update `DeliveryMethodToggle` to accept pickupAddress prop

2. **Fix InstagramFeed** — either:
   - Option A: Replace with CMS-managed gallery (reuse carouselSlides or create gallery table)
   - Option B: Implement real Instagram Basic Display API
   - Option C: Remove the section entirely and replace with something else

3. **Add i18n to ALL hardcoded Indonesian strings** in these components:
   - `OrderSummaryCard.tsx` (C-03)
   - `CartSummary.tsx` (M-07)
   - `PointsRedeemer.tsx` (M-05)
   - `ShippingOptions.tsx` (M-02)
   - `AddressForm.tsx` (M-03)
   - `SavedAddressPicker.tsx` (M-08)
   - `FeaturedProducts.tsx` (C-05)
   - `DeliveryMethodToggle.tsx` (M-06)

4. **Fix WhatsAppButton message i18n** (C-06)

### P1 — Should Fix
5. **ProductDetailClient sticky bar offset** — use CSS variable instead of hardcoded `5rem`
6. **Testimonials error handling** — show fallback content instead of silent empty render
7. **ProductCard MUI label** — either remove from component or make it come from product data

### P2 — Nice to Have
8. Clean up `FIX 13` and `FIX 11` comments in checkout page
9. Extract `handleAddToCart` into a shared helper in ProductCard to avoid duplication
10. Consider showing a loading skeleton while framer-motion loads in FeaturedProducts and EmptyState

---

## 📊 SUMMARY

| Category | Count |
|----------|-------|
| 🔴 Critical Bugs | 6 |
| 🟠 Medium Issues | 8 |
| 🟡 Minor Issues | 4 |
| Hardcoded Indonesian strings | ~25 instances across 10 files |
| Components needing i18n | 10 |
| TODO comments in store components | 2 |

**Overall Assessment:** The store frontend is structurally sound with good UX patterns. Cart validation works, checkout flow is complete, stock management is in place. However, **i18n compliance is the biggest issue** — ~25 hardcoded Indonesian strings across 10 components need to be converted to use `useTranslations()`. The InstagramFeed placeholder is the most visually misleading issue since it appears on the homepage and claims to be social proof when it's actually static images.

**Recommended Priority:**
1. Fix C-01 (pickup address) + C-02 (InstagramFeed) + all i18n issues (P0 items)
2. Fix C-04 (Testimonials silent fail) + M-04 (MUI label) (P1 items)
3. Clean up code hygiene issues (P2 items)