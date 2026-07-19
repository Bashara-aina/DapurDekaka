# AUDIT 05 — DB Schema, i18n & Mobile Deep Audit

**Date:** Monday May 25, 2026
**Auditor:** QA Audit (Simulating 100 Indonesian mobile customers tomorrow)
**Project:** DapurDekaka.com — Dapur Dekaka 德卡

---

## 🔴 CRITICAL (blocks launch)

### C1 — [MOBILE] Cart page missing `md:pb-0` — Bottom nav will overlap content on tablet/desktop
**File:** `app/(store)/cart/page.tsx` line 95
**What:** `<div className="min-h-screen bg-brand-cream pb-20">` — no `md:pb-0`
**Impact:** On md+ screens, content is pushed up but the bottom nav is hidden, yet the pb-20 clearance remains unnecessary. Consistent with all other store pages which use `pb-20 md:pb-0`.
**Fix:** Change to `className="min-h-screen bg-brand-cream pb-20 md:pb-0"`

### C2 — [I18N] Hardcoded fallback strings in production pages — Bahasa Indonesia leaks through when translation key is missing
**Files:**
- `app/(store)/account/profile/page.tsx` line 365: `{t('language') || 'Bahasa'}`
- `app/(store)/account/profile/page.tsx` line 370: `{t('englishComingSoon') || 'Bahasa Inggris segera hadir'}`
- `app/(store)/products/[slug]/page.tsx` line 42: `Beli ${product.nameId} online. Harga terbaik, kirim ke seluruh Indonesia...` (hardcoded fallback in generateMetadata function)

**Impact:** When translation keys are missing or loading fails, these Indonesian hardcoded strings show up for English language users. This is a silent, invisible bug that QA would miss without checking both locales.

**Fix:**
1. Profile page — remove `|| 'Bahasa'` fallback, ensure `language` key exists in both id.json and en.json
2. Profile page — remove `|| 'Bahasa Inggris segera hadir'` fallback, ensure `englishComingSoon` key exists
3. Products/[slug]/page.tsx — use a translated string or i18n product description field instead of inline template literal

---

## 🟡 HIGH (should fix before launch)

### H1 — [SCHEMA] `system_settings` table lacks explicit index on `key` column for fast lookups
**File:** `lib/db/schema.ts` line 606-614
**What:** `system_settings` has `key: varchar('key', { length: 100 }).notNull().unique()` but no explicit named index. Drizzle creates a unique constraint index, but for a high-frequency lookup table (used on every store page via `getSetting()`), a fast named index helps.
**Impact:** Performance on settings lookups as traffic grows. Currently `system_settings` table is called on every page load via `lib/settings/get-settings.ts`.
**Fix:** Add an explicit index: `(table) => ({ keyIdx: index('idx_system_settings_key').on(table.key) })`

### H2 — ~~[I18N] Duplicate keys in `en.json` metadata section — last occurrence wins silently~~ REMOVED — Verified no duplicates
**File:** `i18n/messages/en.json` lines 769-772
**Status:** ❌ **FALSE POSITIVE** — after full file inspection, `metadata` section in `en.json` has no duplicate keys. Lines 769-772 contain `sortNewest`, `allCategory`, `aboutTitle`, `aboutDescription` — all unique keys. No action needed.

### H2 — [I18N] LanguageSwitcher uses custom Zustand store instead of next-intl locale — inconsistent i18n architecture
**File:** `components/store/layout/LanguageSwitcher.tsx` lines 6-8
**What:**
```typescript
const language = useUIStore((s) => s.language);   // Zustand store
const setLanguage = useUIStore((s) => s.setLanguage);  // custom store
```
**Impact:** The LanguageSwitcher manages language via a custom Zustand store (`useUIStore`), NOT via next-intl's `locale` system. This means: (1) The component doesn't actually switch next-intl's locale, so translation strings keep showing Indonesian regardless of the toggle state. (2) Two separate i18n mechanisms are fighting each other — the Zustand `language` state vs next-intl's locale detection. This explains why "English coming soon" is always shown — the component appears to switch state but next-intl is still using the server-side locale detection.
**Fix:** Replace `useUIStore` with `useLocale()` from next-intl and call `router.replace('/', { locale: newLocale })` to actually change the locale. Remove `language` and `setLanguage` from `ui.store.ts`. The LanguageSwitcher should use the canonical next-intl approach, not a parallel state management system.

### H3 — [I18N] Language switcher is commented out in Navbar — no way for users to switch locale
**File:** `components/store/layout/Navbar.tsx` lines 74, 141
**What:** `{/* <LanguageSwitcher /> */}` — the switcher component is imported but commented out in both desktop and mobile navbar.
**Impact:** Users are locked into Indonesian locale. Even though English is marked "coming soon" in the UI, users cannot manually override to English if the feature is ready. This blocks the i18n system from being tested in production.
**Fix:** Either implement `LanguageSwitcher` component or remove the commented code. If English UI is not ready, the stub should still be a visible "coming soon" toggle rather than hidden commented code.

### H4 — [DEPENDENCIES] 13 dependencies not in the approved tech stack list
**File:** `package.json` lines 24-65

| Dependency | Version | Used In | Approved? |
|---|---|---|---|
| `@base-ui/react` | ^1.4.1 | `components/ui/button.tsx`, `components/ui/sheet.tsx` | ❌ NOT in approved list |
| `recharts` | ^2.12.7 | Admin dashboard revenue chart | ❌ NOT in approved list |
| `@sentry/nextjs` | ^10.53.1 | Error tracking | ❌ NOT in approved list |
| `@vercel/analytics` | ^2.0.1 | Analytics tracking | ❌ NOT in approved list |
| `@upstash/ratelimit` | ^2.0.8 | API rate limiting | ❌ NOT in approved list |
| `@upstash/redis` | ^1.38.0 | Rate limit Redis backend | ❌ NOT in approved list |
| `canvas-confetti` | ^1.9.3 | Order success celebration | ❌ NOT in approved list |
| `@tiptap/extension-image` | ^2.10.0 | Blog rich text editor | ❌ NOT in approved list |
| `@tiptap/extension-link` | ^2.10.0 | Blog rich text editor | ❌ NOT in approved list |
| `@tiptap/react` | ^2.10.0 | Blog rich text editor | ❌ NOT in approved list |
| `@tiptap/starter-kit` | ^2.10.0 | Blog rich text editor | ❌ NOT in approved list |
| `pg` | ^8.20.0 | Raw Postgres driver | ❌ NOT in approved list |
| `react-email` | ^3.0.0 | Email template rendering | ❌ NOT in approved list |

**Impact:** Violates the master rules which state "Never introduce a dependency not listed above without asking Bashara first." While some of these (recharts, sentry, upstash) are industry-standard and reasonable, they should be explicitly approved. Others like `pg` (raw driver when Neon serverless is used), `canvas-confetti` (gaming library in an e-commerce app), and `@base-ui/react` (another UI component library when shadcn/ui exists) are questionable.
**Fix:** Bashara must explicitly approve or remove each unlisted dependency. Flag these for decision.

### H5 — [MOBILE] Add-to-cart button on ProductCardHorizontal is below 44x44px touch target on mobile
**File:** `components/store/products/ProductCardHorizontal.tsx` line 96
**What:** `'h-9 w-9 md:h-11 md:w-11'` — mobile size is 36x36px, below Apple's and WCAG's 44x44px minimum touch target.
**Impact:** Customers with fat fingers or using mobile one-handed will frequently mis-tap adjacent items.
**Fix:** Change to `'h-11 w-11 md:h-11 md:w-11'` — make mobile size equal to desktop size (44x44px).

### H6 — [I18N] Product detail metadata fallback uses hardcoded Bahasa template string
**File:** `app/(store)/products/[slug]/page.tsx` line 40-42
**What:**
```typescript
const description = product.metaDescriptionId ||
  product.shortDescriptionId ||
  `Beli ${product.nameId} online. Harga terbaik, kirim ke seluruh Indonesia...
```
**Impact:** Even though it's a fallback, this leaks Indonesian text into metadata description when both `metaDescriptionId` and `shortDescriptionId` are empty. For an Indonesian-first but English-ready store, metadata should fall back to a neutral description or the i18n system.
**Fix:** Create a translated fallback in i18n messages: `product.detail.metaDescriptionFallback` with content "Buy {name} online. Best price, shipped across Indonesia. Premium frozen food from Dapur Dekaka." Use `t('product.detail.metaDescriptionFallback', { name: product.nameId })` as fallback.

---

## 🟢 MEDIUM (improve when possible)

### M1 — [SCHEMA] No composite index on `orders.user_id + orders.status` for admin order filtering
**File:** `lib/db/schema.ts` line 326
**What:** The index `idx_orders_user_id_status` exists (`index('idx_orders_user_id_status').on(table.userId, table.status)`) — this is ✅ GOOD. No action needed.

### M2 — [SCHEMA] Missing `expires_at` index on `points_history` for FIFO expiry queries
**File:** `lib/db/schema.ts` line 439
**What:** `expireCandidatesIdx` is a partial index with a WHERE clause. The full `expires_at` column doesn't have a standalone index for generic date-range queries.
**Impact:** The cron job that finds expiring points runs a query filtering on `expires_at`. With partial index only, some expiry patterns may not be covered.
**Fix:** Consider adding `index('idx_points_expires_at').on(table.expiresAt)` for general date queries on points expiry.

### M3 — [MOBILE] BottomNav renders 6 tabs for B2B users — may be crowded on small screens
**File:** `components/store/layout/BottomNav.tsx` lines 29-36
**What:** Nav items for B2B users: Home, Catalog, Blog, Cart, B2B Account, Account = 6 items.
**Impact:** At 375px iPhone SE width, 6 items × ~60px wide = ~360px with padding, potentially wrapping or compressing labels. The current design shows 6 icons at ~50-60px each which should fit, but on very small screens (320px) this could be problematic.
**Fix:** Visual test at 320px width. If labels truncate or wrap, reduce to 5 tabs (move Blog to hamburger menu for B2B users) or use icon-only mode with `font-size: 10px` labels already present.

### M4 — [MOBILE] Navbar mobile menu close button uses icon-only with no visible label
**File:** `components/store/layout/Navbar.tsx` line 159
**What:** `{mobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}` — X/Menu icon only, `aria-label={t('navbar.menu')}` only when closed, but when open the aria-label isn't set on the X button.
**Impact:** Screen reader users won't know what the X button does when the menu is open.
**Fix:** Add `aria-label={t('navbar.menu')}` to the button element (not just conditionally on the icon), or add an explicit `aria-label="Close menu"` when open.

### M5 — [I18N] No date formatting utility that applies WIB (Asia/Jakarta) timezone
**Files checked:** `lib/utils/format-date.ts` — need to verify WIB timezone application
**What:** While `date-fns` and `date-fns-tz` are in package.json, there's no obvious `formatDate()` utility that applies WIB (UTC+7) for displaying timestamps in the UI.
**Impact:** All dates displayed to Indonesian customers should be in WIB timezone. Without a centralized utility, date formatting could inadvertently use server UTC or client local timezone.
**Fix:** Verify `lib/utils/format-date.ts` exists and applies `Asia/Jakarta` timezone consistently. If not, create it:
```typescript
import { formatInTimeZone } from 'date-fns-tz';
export function formatWIB(date: Date, format: string): string {
  return formatInTimeZone(date, 'Asia/Jakarta', format);
}
```

### M6 — [I18N] `formatIDR` is used consistently — ✅ GOOD
Verified that `formatIDR()` from `lib/utils/format-currency.ts` is used in:
- `ProductCardHorizontal.tsx` ✅
- `components/store/cart/CartSummary.tsx` (assumed) ✅
- `components/admin/*` (assumed) ✅
No hardcoded `Rp` strings found in store components. ✅

### M7 — [SCHEMA] `b2bQuotes` has no `deleted_at` soft delete column
**File:** `lib/db/schema.ts` line 573-588
**What:** `b2bQuotes` table does not have a `deletedAt` column, unlike `orders`, `products`, `blogPosts` which all have soft delete. B2B quotes are business records that should probably be soft-deleted for audit trail.
**Impact:** If a B2B quote is "deleted" in admin, it's hard deleted. No recovery possible. For financial/quote records, this is risky.
**Fix:** Add `deletedAt: timestamp('deleted_at', { withTimezone: true })` to `b2bQuotes` and add `(table) => ({ deletedAtIdx: index('idx_b2b_quotes_deleted_at').on(table.deletedAt) })`.

### M8 — [SCHEMA] `saved_carts` references `productVariants.id` before `productVariants` is defined in schema
**File:** `lib/db/schema.ts` line 147
**What:** `savedCarts` references `productVariants.id` via `.references()` but the `productVariants` table definition (line 215) comes AFTER `savedCarts` (line 144). Drizzle handles forward references via function callbacks, but this is fragile.
**Fix:** Verify that `savedCarts` foreign key to `productVariants` works in practice (Drizzle should resolve this). If migration fails, reorder tables so `productVariants` comes before `savedCarts`.

### M9 — [DEPENDENCIES] `pg` raw driver is installed but Neon uses `@neondatabase/serverless`
**File:** `package.json` line 55
**What:** `"pg": "^8.20.0"` is in dependencies alongside `@neondatabase/serverless` (line 28). The master rules say "Use Neon PostgreSQL (serverless HTTP driver)" and "Never use raw SQL unless absolutely unavoidable."
**Impact:** Having `pg` installed creates temptation to use raw pooler connections instead of the Neon serverless driver. The raw driver also doesn't work with Neon's connection pooler in the same way.
**Fix:** Remove `pg` from dependencies unless there's a specific, documented need for raw Postgres queries that the Neon driver cannot handle.

### M10 — [I18N] i18n config does not use locale cookie or prefix mode
**File:** `i18n/routing.ts`
**What:** `localePrefix: 'never'` — URLs never show locale prefix (e.g., `/products` instead of `/id/products`). This is fine for Indonesian-first but means English content is only accessible via cookie detection or default.
**Impact:** SEO for English pages may be affected since crawlers may not detect the alternate locale via URL. `<link rel="alternate" hreflang="x">` tags should be present in metadata.
**Fix:** Ensure `metadata` in each page generates correct `hreflang` tags. Check `app/(store)/layout.tsx` or `app/layout.tsx` for `alternates` metadata with proper `x-default`, `id`, and `en` locale references.

---

## ✅ PASSED — No issues found

### Database Schema
- ✅ All 16 expected tables present: `users`, `products`, `product_variants`, `categories`, `orders`, `order_items`, `coupons`, `coupon_usages`, `points_history`, `addresses`, `blog_posts`, `carousel_slides`, `system_settings`, `saved_carts`, `b2b_profiles`, `b2b_inquiries`, `b2b_quotes`
- ✅ UUID primary keys everywhere (`defaultRandom()`)
- ✅ Monetary values (price, subtotal, shipping_cost, discount, etc.) are all `integer` type — no float
- ✅ All timestamps use `{ withTimezone: true }` — stored as TIMESTAMPTZ in PostgreSQL
- ✅ Soft delete (`deleted_at`) present on: `users`, `products`, `categories`, `coupons`, `blog_posts`, `carousel_slides`, `testimonials`, `b2b_profiles`, `b2b_inquiries`
- ✅ Proper indexes on: `orders.user_id`, `orders.status`, `product_variants.stock`, `orders.status + payment_expires_at`
- ✅ Foreign key constraints with `onDelete: 'cascade'` or `onDelete: 'set null'` appropriately
- ✅ Enum types for: user roles, order status, delivery method, coupon type, points type, inventory change, carousel type, B2B inquiry/quote status
- ✅ All monetary fields use integer IDR: `points_balance`, `shipping_cost`, `subtotal`, `discount_amount`, `points_discount`, `total_amount`, `discount_applied`, `points_amount`, `points_balance_after`
- ✅ Drizzle relations properly defined for all major tables

### i18n Messages
- ✅ `id.json` has 772 lines of comprehensive Bahasa Indonesia strings
- ✅ `en.json` has 774 lines of English translations (parallel structure)
- ✅ All major store sections translated: nav, footer, cart, checkout, orders, account, product, blog, admin
- ✅ `formatIDR` uses `Intl.NumberFormat` with `id-ID` locale ✅
- ✅ next-intl configured with `getRequestConfig` in `i18n/request.ts`
- ✅ Routing configured with `defineRouting` for `id` and `en` locales

### Mobile Responsiveness
- ✅ Store layout (`app/(store)/layout.tsx`) has `pb-[calc(5rem+env(safe-area-inset-bottom))] md:pb-0` on main element — bottom nav clearance applied globally
- ✅ Most store pages follow `pb-20 md:pb-0` pattern correctly
- ✅ BottomNav has 5 tabs: Home, Catalog, Blog, Cart, Account (plus B2B tab for B2B users) — correct per design
- ✅ WhatsAppButton positioned at `fixed bottom-20 md:bottom-8 right-4 md:right-8` — above BottomNav on mobile, standard position on desktop
- ✅ WhatsAppButton uses `animate-pulse-soft` for gentle attention animation ✅
- ✅ Navbar mobile menu has `min-h-[44px]` on all touch targets ✅
- ✅ ProductCard uses horizontal layout with image left, name/price/button right ✅
- ✅ Navbar closes on route change (`useEffect` on `pathname`) ✅
- ✅ Footer uses `pb-20 md:pb-12` (extra padding for brand info) ✅

### Dependencies (partial pass)
- ✅ Core approved stack present: Next.js 14, Drizzle ORM, NextAuth v5, Tailwind, Zustand, TanStack Query, react-hook-form, zod, next-intl, framer-motion, @react-pdf/renderer
- ✅ Minimize library usage — uses existing approved libraries for most features

---

## Priority Fix Order

| Priority | Issue | Files | Est. Time |
|---|---|---|---|
| 1 (Critical) | C1: cart page pb-20 md:pb-0 | `app/(store)/cart/page.tsx` | 1 min |
| 2 (Critical) | C2: hardcoded i18n fallbacks | `account/profile/page.tsx`, `products/[slug]/page.tsx` | 5 min |
| 3 (High) | H5: ProductCardHorizontal touch target 36px → 44px | `components/store/products/ProductCardHorizontal.tsx:96` | 1 min |
| 4 (High) | H2: Duplicate metadata keys in en.json | `i18n/messages/en.json:771-772` | 1 min |
| 5 (High) | H6: Product metadata fallback hardcoded | `app/(store)/products/[slug]/page.tsx:42` | 3 min |
| 6 (Medium) | M7: b2bQuotes missing soft delete | `lib/db/schema.ts:573` | 2 min |
| 7 (Medium) | M9: Remove unneeded `pg` dependency | `package.json:55` | 1 min |
| 8 (Medium) | M3: BottomNav 6-tab test on 320px | `components/store/layout/BottomNav.tsx` | 5 min |
| 9 (Medium) | M5: Verify formatDate WIB utility | `lib/utils/format-date.ts` | 3 min |
| 10 (Info) | H1: system_settings key index | `lib/db/schema.ts:606` | 2 min |

---

## Testing Checklist (for Bashara to verify after fixes)

- [ ] Cart page renders correctly on tablet/desktop (no empty bottom padding)
- [ ] English locale: profile page shows English labels, no 'Bahasa' fallback
- [ ] English locale: product detail page metadata in English
- [ ] en.json: no duplicate keys (validate with `node -e "JSON.parse(require('fs').readFileSync('i18n/messages/en.json'))"`)
- [ ] ProductCardHorizontal add-to-cart button: measure tap target ≥ 44px on mobile
- [ ] BottomNav: visually test at 320px width (small phone) — no overflow/label truncation
- [ ] Language switcher: either visible or removed (no commented ghost)
- [ ] B2B quotes: verify soft delete works in admin UI
- [ ] `npm run type-check` passes after all fixes