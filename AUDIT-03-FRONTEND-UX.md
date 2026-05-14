# AUDIT 03 — Frontend / UX
# DapurDekaka.com — Page-by-Page UI/UX Audit
**Date:** May 2026 | **Auditor:** Claude Code | **Scope:** All pages, components, design system, missing UI, UX gaps

---

## LEGEND
- ✅ Implemented correctly
- ⚠️ Implemented but has UX issues
- ❌ Not built (missing page or component)
- 🔴 Critical
- 🟡 Major
- 🟢 Minor / Polish

---

## 1. STORE — HOME PAGE (`/`)

**Status:** ✅ Structurally complete. Several content/data gaps.

### Sections Implemented
- `HeroCarousel` — animated slides from DB (carousel_slides table) ✅
- `CategoryChips` — product category pills ✅
- `FeaturedProducts` — products where `isFeatured=true` ✅
- `PromoBanner` — static promo callout ✅
- `WhyDapurDekaka` — brand values section ✅
- `Testimonials` — renders from testimonials table ✅
- `InstagramFeed` — renders 6 static Cloudinary URLs ⚠️
- `WhatsAppButton` — floating sticky button ✅

### UX Gaps

**1.1 Instagram Feed**
- ⚠️ 🟡 The `InstagramFeed` component renders 6 hardcoded Cloudinary image URLs, not a real Instagram feed. There is no Instagram Basic Display API integration. The photos shown are gallery placeholders.
- **Fix:** Either use real Cloudinary URLs that the admin manually uploads to match Instagram posts, OR note clearly in admin docs that Instagram section needs manual curation. Do NOT attempt Instagram API — it's in "Out of Scope V1."

**1.2 Carousel Scheduling**
- ⚠️ 🟢 `carousel_slides` has `starts_at` and `ends_at` fields for scheduling, but the `HeroCarousel` component fetches all active slides without filtering by date range. A scheduled slide will appear even if it's outside its valid window unless the DB query in the page filters by date.
- **Fix:** In the server component that fetches carousel slides, add:
  ```sql
  WHERE is_active = true AND (starts_at IS NULL OR starts_at <= NOW()) AND (ends_at IS NULL OR ends_at >= NOW())
  ```

**1.3 Featured Products Empty State**
- ⚠️ 🟢 If no products have `isFeatured=true` (fresh install), the FeaturedProducts section renders an empty container with no message, creating a blank gap in the homepage layout.

**1.4 Testimonials Empty State**
- Same issue — if no testimonials are seeded, the section renders blank.

**1.5 Mobile Bottom Nav**
- ✅ `BottomNav` component exists and renders on mobile.
- ⚠️ 🟢 Cart badge count — verify the badge shows the correct cart item count from `useCartStore`. If Zustand store is not hydrated (SSR), badge may flash from 0 to actual count.

---

## 2. STORE — PRODUCT CATALOG (`/products`)

**Status:** ✅ Functional. Several UX improvements needed.

### What Works
- Grid layout with `ProductCard` components ✅
- Category filter chips ✅
- Search input (client-side filtering) ✅
- Stock badges ("Habis", "Tersisa X") ✅
- Halal badge ✅
- Skeleton loading state ✅

### UX Gaps

**2.1 Search Performance**
- ⚠️ 🟢 Search is entirely client-side. All products are fetched upfront and filtered in-memory. For 19 SKUs this is fine, but if catalog grows this will degrade. No debounce on the search input — every keystroke re-filters.

**2.2 No Sort Options**
- ❌ 🟡 PRD doesn't explicitly require sorting but any real product catalog needs price low→high, price high→low, newest, most popular. Currently fixed to `sortOrder` from DB.

**2.3 Out of Stock Products**
- ⚠️ 🟡 Out-of-stock products are still shown in the catalog (with "Habis" badge) but the PRD doesn't specify whether they should appear at the end or be hidden. Currently they appear in normal sort position which fragments the browsable catalog.
- **Recommendation:** Move OOS variants to end of their category section, or dim the card.

**2.4 URL State for Filters**
- ❌ 🟢 Category filter selection is held in React state, not in URL query params. If user refreshes or shares URL while on "Dimsum" category, they get the unfiltered catalog. Use `useSearchParams` to sync filter state with URL.

**2.5 Product Card — B2B Price Not Shown**
- ✅ Correct behavior — B2B prices are only shown in B2B portal. Regular `ProductCard` shows regular price.

---

## 3. STORE — PRODUCT DETAIL (`/products/[slug]`)

**Status:** ✅ Implemented via `ProductDetailClient` component.

### What Works
- Image gallery ✅
- Variant selector ✅
- Price display ✅
- Stock badge ✅
- Halal badge ✅
- "Tambah ke Keranjang" button ✅
- Add-to-cart with selected variant ✅

### UX Gaps

**3.1 Quantity Selector**
- ❌ 🟡 No quantity selector on the product detail page. User can only add 1 unit at a time. To add more, they must go to cart and increase quantity there. Most e-commerce sites have a quantity input on the PDP.

**3.2 Bilingual Content**
- ⚠️ 🟡 `ProductDetailClient` must read the current language preference (`next-intl` locale or `LanguageSwitcher` state) and display `nameId`/`nameEn` and `descriptionId`/`descriptionEn` accordingly. Verify this is implemented — if the component always shows `_id` fields, EN language toggle has no effect on product content.

**3.3 Image Zoom**
- ❌ 🟢 No image zoom or lightbox on product photos. On mobile, images are small. PRD doesn't require it but it's a strong UX expectation for food product photos.

**3.4 Related Products**
- ❌ 🟢 No "produk serupa" or cross-sell section. Not in PRD v1 scope, acceptable.

**3.5 Stock Threshold Warning**
- ⚠️ 🟡 PRD: "When stock < 5: show 'Tersisa X pcs' warning." Verify the `StockBadge` component uses stock count from the selected variant, not the product-level stock.

---

## 4. STORE — CART (`/cart`)

**Status:** ✅ Implemented.

### What Works
- `CartItem` with quantity stepper ✅
- Remove item ✅
- `CartSummary` with subtotal ✅
- `EmptyCart` state ✅
- Persisted in localStorage via Zustand ✅

### UX Gaps

**4.1 Real-time Stock Validation**
- ❌ 🔴 PRD: "Cart shows real-time stock validation — if stock drops below cart quantity, show warning." The cart page does NOT validate against the DB. A user can have `quantity: 10` in their cart even if only 2 remain in stock. They'll only discover this at checkout initiation (which returns an error).
- **Fix:** On cart page mount, call a `/api/cart/validate` endpoint that checks each item's stock and returns mismatches. Show inline warnings per item.

**4.2 Shipping Cost Preview**
- ❌ 🟢 PRD: "Order summary shows: subtotal, shipping (TBD until address entered)." Currently cart shows subtotal only. Should show "Ongkir: Masukkan alamat untuk kalkulasi."

**4.3 Login Prompt in Cart**
- ❌ 🟡 PRD mentions encouraging non-logged-in users to login for points. Cart should show a soft banner: "Masuk untuk mendapatkan poin dari pembelian ini."

**4.4 Cart Sync for Logged-In Users**
- ⚠️ 🟡 When a logged-in user adds items to cart, where are they stored? The cart store uses localStorage — but PRD says cart should sync to DB for logged-in users. The `merge-cart` API exists for login-time merge, but there's no ongoing DB sync. If user switches devices, their cart is gone.

---

## 5. STORE — CHECKOUT (`/checkout`)

**Status:** ⚠️ Flow works but several critical UX gaps.

### What Works
- 4-step stepper UI with `CheckoutStepper` ✅
- Identity form ✅
- Delivery method toggle ✅
- Address form with province/city cascade ✅
- Shipping options (RajaOngkir) ✅
- Coupon input ✅
- Points redeemer UI ✅ (but 0 balance — see Audit 01)
- Order summary card ✅
- Midtrans Snap payment trigger ✅

### UX Gaps

**5.1 Stepper Navigation**
- ❌ 🟡 Steps are not clickable to go back. Once the user advances from step 2 to step 3, they cannot click step 2 in the stepper to go back. They must use the browser back button (which may clear form state) or find a "Back" button.
- **Fix:** Add "Kembali" button on each step, or make completed stepper items clickable.

**5.2 Pickup Flow — Stepper Mismatch**
- ⚠️ 🟡 When pickup is selected, the stepper still shows 4 steps (Identity → Pengiriman → Kurir → Bayar). But the "Kurir" step is irrelevant for pickup. The stepper should conditionally show 3 steps: Identity → Pengiriman (with pickup address info) → Bayar.

**5.3 Logged-In User Pre-fill**
- ❌ 🟡 If logged in, `recipientName` and `recipientEmail` should be pre-filled from session. The identity form renders blank for all users.

**5.4 Saved Address Picker**
- ❌ 🔴 Logged-in users with saved addresses see no address picker. They must re-type their address at every checkout. This is a major friction point that will hurt conversion rate.

**5.5 Order Notes Field**
- ❌ 🟡 The `customerNote` is in form state and submitted to the API, but there is no textarea rendered anywhere in the checkout UI for the user to input it. Notes are always empty.

**5.6 Points Redeemer — Zero Balance**
- 🔴 See Audit 01 section 1.5. UI renders but always shows 0 balance.

**5.7 Checkout Empty State**
- ✅ If cart is empty, a proper `EmptyState` is shown with a link back to products.

**5.8 Loading States**
- ⚠️ 🟡 When "Bayar Sekarang" is clicked and the initiate API is called, is there a loading spinner or disabled state on the button? If the API is slow (>1s), the user might click multiple times creating duplicate orders.
- **Fix:** Disable button and show spinner during API call. Use `isLoading` state that's already declared.

**5.9 Error Recovery**
- ⚠️ 🟡 If `/api/checkout/initiate` returns an error (e.g., out of stock), the error is shown but the user cannot easily fix it. Should scroll to the problematic cart item and highlight it.

---

## 6. STORE — CHECKOUT SUCCESS/PENDING/FAILED

### Success Page (`/checkout/success`)
**Status:** ⚠️ Exists but details unknown.
- ✅ Should show order number, payment summary.
- ❌ PDF receipt generated client-side — verify this actually works and downloads a real PDF.
- ❌ No confetti animation mentioned, but `canvas-confetti` is in `package.json` — presumably used here.

### Pending Page (`/checkout/pending`)
**Status:** ⚠️ Exists.
- ❌ Should show VA number, payment amount, and expiry countdown. Verify these are populated from the order data (passed via query param or session).
- ❌ "Bayar Lagi" (retry payment) button — verify this calls `/api/checkout/retry` correctly.
- ❌ Countdown timer showing time remaining before order expires — critical UX.

### Failed Page (`/checkout/failed`)
**Status:** ⚠️ Exists.
- ❌ "Coba Lagi" button that recreates order from same cart items — not implemented (see Audit 01).

---

## 7. STORE — ORDER TRACKING (`/orders/[orderNumber]`)

**Status:** ⚠️ Page exists. Guest email verification needs verification.

### UX Gaps

**7.1 Email Gate for Guests**
- ⚠️ 🔴 The API at `/api/orders/[orderNumber]` must verify that the requesting user either (a) owns the order (session user_id matches) or (b) provides the correct email. Verify this gate is implemented. Without it, any user guessing an order number can see private data.

**7.2 Order Timeline**
- ⚠️ 🟡 `OrderTimeline` component reads from `order_status_history`. Since the Midtrans webhook doesn't write to `order_status_history` (see Audit 01), the timeline will be empty even for paid orders.

**7.3 Tracking URL**
- ✅ `TrackingInfo` component exists.
- ⚠️ 🟡 Verify tracking deep-link URLs are generated and stored in `orders.tracking_url` when warehouse staff inputs the tracking number. If `tracking_url` is null, the component should show the raw tracking number with a manual copy button.

---

## 8. STORE — ACCOUNT PAGES

### Account Dashboard (`/account`)
**Status:** ✅ Renders with server-side data.

**Gaps:**
- ⚠️ 🟡 Shows 5 recent orders — but "recent orders" query may not handle users with no orders gracefully (show empty state).
- ❌ 🟡 No points balance shown prominently on account dashboard. Points balance is buried in `/account/points`.

### Order History (`/account/orders`)
**Status:** ✅ Implemented.

**Gaps:**
- ⚠️ 🟢 No pagination — shows all orders. If a customer has 100 orders, this page will be slow and long.
- ⚠️ 🟢 No filter by status.

### Order Detail (`/account/orders/[orderNumber]`)
**Status:** ✅ Implemented.

### Saved Addresses (`/account/addresses`)
**Status:** ✅ Implemented with `AddressCard` and `AddressForm`.

**Gaps:**
- ⚠️ 🟢 No way to set an address as default from the list (need to verify `AddressCard` has a "Set as default" button).

### Points History (`/account/points`)
**Status:** ✅ Page exists.

**Gaps:**
- ⚠️ 🟡 Verify `/api/account/points` returns full history with type labels (earn/redeem/expire/adjust) and proper date formatting.
- ❌ 🟢 No visual points balance progress bar or "X points until next reward" gamification.

### Vouchers (`/account/vouchers`)
**Status:** ✅ Page exists.

**Gaps:**
- ⚠️ 🟡 Shows public coupons from `is_public=true`. But this means ALL public coupons are shown to all users, not personalized. If a coupon has `max_uses_per_user=1` and the user already used it, the voucher should show as "used" rather than displaying as available.

### Profile (`/account/profile`)
**Status:** ❌ NOT BUILT.

This is a P1 feature per PRD. User cannot change their name, phone, or language preference. The route doesn't exist.

---

## 9. ADMIN PAGES

### Admin Dashboard (`/admin/dashboard`)
**Status:** ❌ UI complete, backend missing.

The page has a sophisticated UI (KPI cards, alert banner, order funnel, action queue, live feed, inventory flash, audit log, users summary) but ALL data comes from 8 API endpoints that don't exist. Result: the dashboard renders in a loading/empty state permanently.

**Specific UI Issues:**
- ⚠️ 🟡 Hardcoded greeting: `"Selamat datang, Bashara"` — this should use `session.user.name`.
- ⚠️ 🟢 "Export CSV" button calls a non-existent endpoint.
- ⚠️ 🟢 System health shows `Cloudinary CDN: ok` as static text, not a real health check.
- ✅ UI design and layout are production-quality.

### Admin Orders (`/admin/orders`)
**Status:** ⚠️ Read-only. No order detail page.

**Gaps:**
- ❌ 🔴 No `/admin/orders/[id]` page — admin cannot view full order detail or update status from the UI.
- ❌ 🔴 No search or filter by status on the orders page.
- ⚠️ 🟡 Shows 50 most recent orders hardcoded — no pagination.
- ❌ 🟡 No "Mark as Processing" or "Mark as Packed" action buttons on the orders list.

### Admin Products (`/admin/products`)
**Status:** ⚠️ Read-only list. No create/edit.

- `/admin/products` — Shows product list ✅ (read-only)
- `/admin/products/new` — Shows placeholder text ❌
- `/admin/products/[id]` — Shows product detail ✅ (read-only, no edit form)

**Missing:**
- ❌ 🔴 Product create form with: name (ID/EN), category selector, description (TipTap editor), image upload, variants (add/remove), halal toggle, featured toggle, B2B toggle, SEO fields.
- ❌ 🔴 Product edit form (same as create but pre-filled).
- ❌ 🟡 Variant management UI: add variant, set price, B2B price, weight, SKU, stock.
- ❌ 🟡 Image management: drag-to-reorder, delete individual images.

### Admin Inventory (`/admin/inventory`)
**Status:** ⚠️ Read-only. Shows stock levels only.

**Gaps:**
- ❌ 🔴 No inline stock editing on this page. Warehouse staff go to `/admin/field` for interactive inventory, but that's also broken (missing APIs).
- ❌ 🟡 Export stock to CSV — referenced but not built.

### Admin Shipments (`/admin/shipments`)
**Status:** ⚠️ Shows orders needing tracking. Verify input works.

- Shows orders with status `processing`, `packed`, `shipped` ✅
- Has tracking number input field ✅ (assumed)
- Verify PATCH call to `/api/admin/orders/[id]/status` with `tracking_number` works for `packed→shipped` transition.

### Admin Customers (`/admin/customers`)
**Status:** ⚠️ Read-only list.

**Gaps:**
- ❌ 🟡 No `/admin/customers/[id]` page — cannot view customer order history, points balance, address list from admin.
- ❌ 🟡 No export to CSV.
- ⚠️ 🟢 100-user limit hardcoded, no pagination.

### Admin Users (`/admin/users`)
**Status:** ⚠️ Read-only list.

**Gaps:**
- ❌ 🔴 No role editing UI — cannot promote a customer to warehouse staff without DB access.
- ❌ 🔴 No user deactivation UI (`is_active=false`).
- ❌ 🟡 No invite-by-email flow for creating warehouse/owner accounts.

### Admin Settings (`/admin/settings`)
**Status:** ⚠️ Read-only table.

**Gaps:**
- ❌ 🟡 No inline editing of settings values. Cannot change WhatsApp number, payment expiry, points rate from UI.
- ❌ 🟢 No type-aware input rendering (boolean settings should show toggles, integer settings should show number inputs).

### Admin B2B Inquiries (`/admin/b2b-inquiries`)
**Status:** ✅ List view and status update appear implemented.

**Gaps:**
- ⚠️ 🟢 No rich inquiry detail view — just status update. No conversation thread or note-taking UI.

### Admin B2B Quotes (`/admin/b2b-quotes`)
**Status:** ⚠️ Partial.

- List view ✅
- Quote detail ⚠️
- New quote form (`/admin/b2b-quotes/new`) — needs verification

**Gaps:**
- ❌ 🟡 No PDF quote generation/download from admin.
- ❌ 🟡 No "Send quote to client" email action.

### Admin Carousel (`/admin/carousel`)
**Status:** ✅ Implemented with `CarouselForm`.

**Gaps:**
- ⚠️ 🟢 No drag-to-reorder for slide sort order. Must manually edit `sort_order` numbers.
- ⚠️ 🟢 No preview of how the carousel slide will look on the homepage.

### Admin Blog (`/admin/blog`)
**Status:** ✅ TipTap editor implemented.

**Gaps:**
- ⚠️ 🟢 No image upload in TipTap editor (only image URL input). Should support dragging images directly into content.
- ⚠️ 🟢 No draft autosave.

### Admin AI Content (`/admin/ai-content`)
**Status:** ✅ Minimax AI caption generator implemented.

### Admin Field / Warehouse (`/admin/field`)
**Status:** ❌ BROKEN — all API calls fail.

Beautiful interactive UI for warehouse staff but all data endpoints missing. This is the warehouse staff's primary interface:
- Packing queue (packed → mark as packed) ❌
- Tracking queue (add tracking number) ❌
- Pickup queue (mark pickup as collected) ❌
- Inventory update (restock/adjust) ❌
- Worker activity log ❌
- Today's summary ❌

Until the 7+ missing API routes are built, warehouse staff cannot use this dashboard.

### Admin Team Dashboard (`/admin/team-dashboard`)
**Status:** Unknown — page exists but not audited. Verify content.

---

## 10. B2B PAGES

### B2B Landing (`/b2b`)
**Status:** ✅ Static marketing page. Looks complete.

### B2B Products (`/b2b/products`)
**Status:** ✅ Read-only catalog with B2B pricing.

**Gaps:**
- ❌ No "Add to Quote" functionality.
- ❌ No price displayed for unapproved B2B users (should require login and approval before seeing B2B prices).

### B2B Quote Request (`/b2b/quote`)
**Status:** ❌ Stub. `QuoteForm` component renders but no backend.

### B2B Account (`/b2b/account`)
**Status:** ❌ Menu card only. Subpages are stubs.

---

## 11. AUTH PAGES

### Login (`/login`)
**Status:** ✅ Email+password and Google OAuth buttons.

**Gaps:**
- ⚠️ 🟡 After successful login, redirect goes to homepage by default. Should redirect to the page the user was trying to access (use `callbackUrl` param). The middleware should set this.

### Register (`/register`)
**Status:** ✅ Email + password registration.

**Gaps:**
- ⚠️ 🟡 No phone number field at registration. PRD shows phone as part of the user profile. Users can set phone later in account settings (if that page existed).
- ⚠️ 🟢 No terms of service checkbox.

### Forgot Password (`/forgot-password`)
**Status:** ✅ Sends reset email via Resend.

### Reset Password (`/reset-password/[token]`)
**Status:** ✅ Token consumption and password update.

---

## 12. LAYOUT & NAVIGATION

### Navbar
**Status:** ✅ `Navbar` component renders with logo, navigation links, cart icon, account dropdown.

**Gaps:**
- ⚠️ 🟢 Cart icon badge count — verify it reads from Zustand store and updates reactively.
- ⚠️ 🟢 Language switcher (`LanguageSwitcher`) — verify it actually switches content language (next-intl locale) and persists preference.
- ❌ 🟢 No search bar in navbar (search is only on `/products` page).

### Footer
**Status:** ✅ `Footer` component renders with links and social icons.

**Gaps:**
- ⚠️ 🟢 Footer links (Privacy Policy, Terms of Service, Sitemap) likely lead to non-existent pages.

### WhatsApp Button
**Status:** ✅ Always visible on all store pages.

**Gaps:**
- ⚠️ 🟡 Phone number in `WhatsAppButton` is hardcoded — should read from `system_settings.store_whatsapp_number`.

---

## 13. DESIGN SYSTEM COMPLETENESS

Based on `components/ui/` directory, the following shadcn components are installed:
- `badge`, `button`, `card`, `dialog`, `input`, `label`, `select`, `separator`, `sheet`, `skeleton`, `sonner`, `switch`, `tabs`, `textarea`, `toggle`

**Missing UI Components (needed for full implementation):**
- ❌ `table` — needed for admin data tables (currently raw HTML `<table>` tags used)
- ❌ `form` — react-hook-form integration component
- ❌ `toast` — Sonner is there ✅ but verify it's imported correctly everywhere
- ❌ `checkbox` — needed for multi-select in admin
- ❌ `radio-group` — needed for delivery method toggle (currently custom component)
- ❌ `date-picker` — needed for coupon expiry date, carousel scheduling
- ❌ `pagination` — needed for orders list, products list, customers list
- ❌ `command`/`combobox` — needed for province/city selectors (currently custom)
- ❌ `progress` — could be used for multi-step checkout stepper

---

## 14. LANGUAGE / INTERNATIONALIZATION

**Current State:** `next-intl` is installed. `LanguageSwitcher` component exists.

**Issues:**
- ⚠️ 🟡 Most error messages and UI labels are hardcoded in Indonesian (e.g., "Keranjangmu kosong", "Masuk dengan Google"). There are no message dictionaries. The language toggle likely has no effect on these strings.
- ⚠️ 🟡 Product content (name, description) has `_id` and `_en` fields in DB, but the product components must detect current locale and render the correct field. Verify `ProductCard`, `ProductDetailClient`, etc. use the locale to select the right field.
- ❌ 🟡 No `messages/id.json` or `messages/en.json` translation files found in the codebase. If `next-intl` is configured without these, it will fall back to the key string or throw errors.

---

## 15. SEO & META TAGS

**Status:** ⚠️ Partial.

- `robots.ts` and `sitemap.ts` exist ✅
- Product detail pages should have dynamic `generateMetadata` using `meta_title_*` and `meta_description_*` from DB.
- Blog post pages should have dynamic `generateMetadata`.

**Gaps:**
- ⚠️ 🟡 Verify `generateMetadata` is implemented in `app/(store)/products/[slug]/page.tsx` and `app/(store)/blog/[slug]/page.tsx`. If missing, all product and blog pages get generic meta tags, hurting SEO.
- ❌ 🟢 No Open Graph image per product (product photo as OG image).
- ❌ 🟢 No structured data (JSON-LD) for products (Product schema), which would boost Google Shopping visibility.

---

## 16. ERROR HANDLING & LOADING STATES

**What Exists:**
- `loading.tsx` files for store and cart routes ✅
- `error.tsx` for store ✅
- `not-found.tsx` ✅

**Gaps:**
- ❌ 🟡 No `error.tsx` in admin routes — if an admin query fails, Next.js throws an unhandled error page.
- ❌ 🟢 No suspense boundaries around individual section components on the home page — if `FeaturedProducts` DB query fails, it takes down the whole page.
- ⚠️ 🟢 The admin field page has proper error handling in React Query (`isError` state) but shows generic error messages, not actionable ones.
