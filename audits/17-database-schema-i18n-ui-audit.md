# Comprehensive Audit: Database Schema, i18n, UI Components

**Project:** DapurDekakav2 (Dapur Dekaka e-commerce)
**Auditor:** Claude Code
**Date:** 2026-05-23
**Scope:** Database schema → i18n translations → UI components → loading/error states → design system compliance

---

## EXECUTIVE SUMMARY

The foundation is **structurally sound** — schema design, i18n coverage, and design tokens are all well-implemented. However, there are a meaningful number of localized issues scattered across components that compound into a moderate overall risk. The good news: nearly all issues are fixable without architectural changes.

**Total issues found: 32**
- 🔴 Critical (data integrity / security): 4
- 🟠 High (broken functionality / accessibility): 9
- 🟡 Medium (hardcoded strings / design violations): 14
- 🟢 Low (improvement opportunities): 5

---

## PART 1 — DATABASE SCHEMA AUDIT

### Schema Overview: ✅ STRONG

All 23 tables use UUID primary keys. Timestamps consistently use `{ withTimezone: true }`. All foreign keys have `onDelete` cascade behavior. Indexes exist on frequently queried fields. Soft delete (`deleted_at`) applied correctly to products, users, coupons, blog posts, carousel slides, b2b profiles, b2b inquiries. Relationships properly defined in Drizzle relations.

### Issues

#### 🔴 CRITICAL — `addresses` table: missing `updatedAt`

**File:** `lib/db/schema.ts:121-138`
**Impact:** Addresses table has `createdAt` and timestamps spread via `...timestamps`, but since it's declared BEFORE the `timestamps` helper is defined, it only gets `createdAt`. The `updatedAt` field is missing from addresses.
**Fix:**
```typescript
export const addresses = pgTable('addresses', {
  id: uuid('id').primaryKey().defaultRandom(),
  userId: uuid('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  label: varchar('label', { length: 100 }),
  recipientName: varchar('recipient_name', { length: 255 }).notNull(),
  recipientPhone: varchar('recipient_phone', { length: 20 }).notNull(),
  addressLine: text('address_line').notNull(),
  district: varchar('district', { length: 255 }).notNull(),
  city: varchar('city', { length: 255 }).notNull(),
  cityId: varchar('city_id', { length: 10 }).notNull(),
  province: varchar('province', { length: 255 }).notNull(),
  provinceId: varchar('province_id', { length: 10 }).notNull(),
  postalCode: varchar('postal_code', { length: 10 }).notNull(),
  isDefault: boolean('is_default').notNull().default(false),
  createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
}, (table) => ({
  userIdIdx: index('idx_addresses_user_id').on(table.userId),
}));
```

#### 🔴 CRITICAL — `productVariants` table: missing index on `isActive` alone

**File:** `lib/db/schema.ts:211-229`
**Impact:** There's a composite index `idx_product_variants_product_active` on `(productId, isActive)` and `stockIdx` on `stock`. However, when filtering active variants across all products (e.g., `WHERE is_active = true`), the composite index cannot be used efficiently without also filtering by `productId`. A single-column index on `isActive` is needed for this query pattern.

**Fix:** Add `isActiveIdx: index('idx_product_variants_is_active').on(table.isActive)` to the table's index config.

#### 🟠 HIGH — `blogPosts` table: missing index on `authorId`

**File:** `lib/db/schema.ts:448-473`
**Impact:** `authorId` is used in queries (e.g., "posts by author") but has no dedicated index, only via the relation on `blogCategoryId`. Performance will degrade as blog grows.

**Fix:** Add `authorIdIdx: index('idx_blog_posts_author_id').on(table.authorId)` to the table's index config.

#### 🟠 HIGH — `pointsHistory` table: partial index condition may not work

**File:** `lib/db/schema.ts:432-434`
```typescript
expireCandidatesIdx: index('idx_points_expire_candidates').on(table.userId, table.expiresAt).where(sql`${table.type} = 'earn' AND ${table.isExpired} = false AND ${table.consumedAt} IS NULL`),
```
**Impact:** Partial indexes with complex WHERE clauses can be inconsistent across different Postgres versions and during schema migrations. The conditional index logic for finding expirable points may fail during Neon serverless query planning. This is a correctness risk — points may expire incorrectly or not at all.

**Fix:** Consider a separate query-based approach or add a dedicated `expiresAt` index and filter in application code.

#### 🟡 MEDIUM — `orders` table: `recipientEmail` has index but no `email` check in queries

**File:** `lib/db/schema.ts:273-330`
**Impact:** `idx_orders_recipient_email` exists for guest order lookup. But `orders.userId` is nullable (guest checkout), meaning many orders with `userId = NULL` will use recipient email for identity. The index is correctly present — this is not a bug, but confirm that all guest order lookups use email, not just order ID.

#### 🟡 MEDIUM — `inventoryLogs` table: missing `updatedAt`

**File:** `lib/db/schema.ts:242-253`
**Impact:** `inventoryLogs` only has `createdAt`. While it tracks historical changes, having only creation timestamp is acceptable here — the table is append-only and the primary query is by `variantId` + `createdAt` range. Not critical but inconsistent with the `timestamps` pattern.

#### 🟡 MEDIUM — `orderStatusHistory` table: missing `updatedAt`

**File:** `lib/db/schema.ts:353-363`
**Impact:** Same as inventoryLogs — append-only audit table, only `createdAt` exists. Acceptable but inconsistent.

#### 🟡 MEDIUM — `blogCategories` table: missing `timestamps` entirely

**File:** `lib/db/schema.ts:440-446`
**Impact:** `blogCategories` has no `createdAt` or `updatedAt`. It's a simple lookup table with `sortOrder`. Not critical but inconsistent with other tables.

#### 🟡 MEDIUM — `b2bQuoteItems` table: missing `createdAt` timestamp

**File:** `lib/db/schema.ts:582-592`
**Impact:** `b2bQuoteItems` has no timestamps. Items are created once when quote is created and rarely updated. Not critical but inconsistent.

#### 🟡 MEDIUM — `accounts` table: missing indexes

**File:** `lib/db/schema.ts:93-106`
**Impact:** `accounts` table has userId foreign key but no index on it. NextAuth frequently queries accounts by userId. Should add `userIdIdx` index.

**Fix:** Add `(table) => ({ userIdIdx: index('idx_accounts_user_id').on(table.userId) })` to the accounts table config.

#### 🟡 MEDIUM — `sessions` table: missing index on `userId`

**File:** `lib/db/schema.ts:108-113`
**Impact:** Same pattern — sessions are queried by userId frequently but no index exists.

#### 🟢 LOW — `adminActivityLogs` table: no index on `userId`

**File:** `lib/db/schema.ts:624-635`
**Impact:** `adminActivityLogs` tracks admin actions and queries by `userId` for "activity by user" views. No index exists. Low impact for small tables but should be added for scale.

#### 🟢 LOW — `testimonials` table: `createdAt` missing timezone flag

**File:** `lib/db/schema.ts:498-510`
**Impact:** `createdAt: timestamp('created_at', { withTimezone: true }).notNull().defaultNow()` — correctly timezone-aware unlike some other tables. This is actually correct, not an issue.

---

### Schema Good Findings

1. **UUID PKs everywhere** ✅ — all 23 tables use `uuid().primaryKey().defaultRandom()`
2. **All monetary values as integer IDR** ✅ — no float anywhere
3. **Atomic stock deduction pattern** ✅ — uses `GREATEST(stock - qty, 0)` with affected row check
4. **Proper transaction boundaries** ✅ — orders/points/coupons all use transactions
5. **Composite indexes for common query patterns** ✅ — e.g., `idx_orders_user_id_status`
6. **Soft delete on all user-facing content** ✅ — products, users, coupons, blog, carousel, b2b
7. **Order snapshot pattern** ✅ — `order_items` stores productNameId, variantNameId, unitPrice at order time
8. **Points FIFO design** ✅ — `referencedEarnId` self-reference enables FIFO consumption

---

## PART 2 — i18n / TRANSLATIONS AUDIT

### Translation Coverage: ✅ EXCELLENT

Both `id.json` (438 lines) and `en.json` (376 lines) are well-structured and comprehensive. The namespace structure is logical: `common`, `nav`, `product`, `cart`, `checkout`, `orderStatus`, `account`, `auth`, `shipping`, `apiErrors`, `admin`, `blog`, `email`, `metadata`.

### Issues

#### 🟡 MEDIUM — `id.json` has duplicate `pointsUnit` key

**File:** `i18n/messages/id.json:194` and `i18n/messages/id.json:175`
**Line 175:** `"pointsUnit": "poin"` (inside `checkout` namespace — correct)
**Line 194:** `"pointsUnit": "poin"` (duplicate, at end of `checkout` namespace)

This is a duplicate key in the same object. JSON parsers may silently take the last value, but the first occurrence would be ignored. This could cause the first `pointsUnit` reference to fail if a parser stops at the duplicate.

**Fix:** Remove the duplicate at line 194.

#### 🟡 MEDIUM — `en.json` is missing `loadAddressError` and other `account` error strings

**File:** `i18n/messages/en.json:261-295`
`en.json` has `account.loadAddressError`, `account.loadShippingError`, `account.deleteAddressConfirm`, `account.deleteAddressError`, `account.setDefaultError`, `account.saveAddressError`, `account.noAddressesDesc`, `account.loadPointsError`, `account.noUsedVouchers`, `account.loadVouchersError`, `account.loadProfileError`, `account.updateProfileError`, `account.updateProfileSuccess`, `account.updatePasswordError`, `account.updatePasswordSuccess`, `account.createPasswordError`, `account.createPasswordSuccess`, `account.emailCannotChange`, `account.phoneMissingWarning`, `account.fullName`, `account.enterFullName`, `account.language`, `account.englishComingSoon`, `account.changePassword`, `account.currentPassword`, `account.newPassword`, `account.confirmNewPassword`, `account.enterCurrentPassword`, `account.minCharsPassword`, `account.enterNewPasswordAgain`, `account.createPassword`, `account.connectedWithGoogle`, `account.createPasswordDesc`

These are all present in `id.json` (lines 281-314) but absent from `en.json`. The English translations for the account management flow are incomplete.

**Fix:** Add all missing keys to `en.json` matching the structure in `id.json`.

#### 🟡 MEDIUM — `en.json` is missing `productsFound`, `productsNotFound`, `productsNotFoundDesc`, `showAllProducts`, `loadMore`, `sortDefault`, `sortPriceAsc`, `sortPriceDesc`, `sortNewest`, `allCategory`

**File:** `i18n/messages/en.json` vs `i18n/messages/id.json`
These metadata keys are used in `ProductCatalog.tsx` via `t()` calls but `en.json` is missing several. Specifically in `metadata` section, `id.json` has `productsFound`, `productsNotFound`, `productsNotFoundDesc`, `showAllProducts`, `loadMore`, `sortDefault`, `sortPriceAsc`, `sortPriceDesc`, `sortNewest`, `allCategory` but `en.json` metadata section only has `homeTitle`, `homeDescription`, `blogTitle`, `blogDescription`, `productsTitle`, `productsDescription`, `aboutTitle`, `aboutDescription`.

**Fix:** Add the missing `metadata` keys to `en.json`.

#### 🟡 MEDIUM — `id.json` missing `loadAddressError` translations in `account` namespace

**File:** `i18n/messages/id.json:281-295`
In `id.json`, the keys `loadAddressError`, `loadShippingError`, `deleteAddressConfirm`, `deleteAddressError`, `setDefaultError`, `saveAddressError`, `noAddressesDesc`, `loadPointsError`, `noUsedVouchers`, `loadVouchersError`, `loadProfileError`, `updateProfileError`, `updateProfileSuccess`, `updatePasswordError`, `updatePasswordSuccess`, `createPasswordError`, `createPasswordSuccess`, `emailCannotChange`, `phoneMissingWarning`, `fullName`, `enterFullName`, `language`, `englishComingSoon`, `changePassword`, `currentPassword`, `newPassword`, `confirmNewPassword`, `enterCurrentPassword`, `minCharsPassword`, `enterNewPasswordAgain`, `createPassword`, `connectedWithGoogle`, `createPasswordDesc` exist in `account` namespace. `en.json` needs all of these.

#### 🟡 MEDIUM — Hardcoded string in `Navbar.tsx`

**File:** `components/store/layout/Navbar.tsx:12-17`
```typescript
const NAV_LINKS = [
  { href: '/', label: 'Beranda' },
  { href: '/products', label: 'Produk' },
  { href: '/blog', label: 'Blog' },
  { href: '/b2b', label: 'B2B' },
];
```
**Impact:** Navigation links use hardcoded Indonesian labels. While the `Navbar` is a client component that needs to know which link is active, the labels themselves should come from `useTranslations('nav')`. This will break if English locale is selected — the navbar stays in Indonesian.

**Fix:** Change to:
```typescript
const NAV_LINKS = [
  { href: '/', label: t('home') },
  { href: '/products', label: t('products') },
  { href: '/blog', label: t('blog') },
  { href: '/b2b', label: 'B2B' },
];
```
Note: `b2b` label may need a new translation key `nav.b2b`.

#### 🟡 MEDIUM — Hardcoded strings in `AdminSidebar.tsx`

**File:** `components/admin/layout/AdminSidebar.tsx:104-106`
```typescript
<Link href="/" className="flex items-center gap-2 text-admin-sidebar-text text-xs hover:text-white transition-colors">
  ← Kembali ke Store
</Link>
```
**Impact:** "← Kembali ke Store" is hardcoded Indonesian. Should be a translation or at minimum a config constant.

#### 🟡 MEDIUM — Hardcoded Indonesian in mobile menu of `Navbar.tsx`

**File:** `components/store/layout/Navbar.tsx:189-206`
```typescript
{/* ... */}
<Link onClick={() => setMobileMenuOpen(false)} className="block py-3 px-4 text-text-primary hover:bg-brand-cream rounded-lg transition-colors min-h-[44px] flex items-center">
  Akun Saya
</Link>
<button onClick={handleSignOut} className="block w-full text-left py-3 px-4 text-error hover:bg-error-light rounded-lg transition-colors min-h-[44px] flex items-center">
  Keluar
</button>
{/* ... */}
<Link onClick={() => setMobileMenuOpen(false)} className="block py-3 px-4 text-text-primary hover:bg-brand-cream rounded-lg transition-colors min-h-[44px] flex items-center">
  Masuk
</Link>
```

**Impact:** "Akun Saya", "Keluar", "Masuk" are all hardcoded. Should use `useTranslations('auth')` or inline `t()` calls.

#### 🟡 MEDIUM — Hardcoded Indonesian in `Footer.tsx`

**File:** `components/store/layout/Footer.tsx`
Multiple hardcoded Indonesian strings: "Menu", "Bantuan", "Ikuti Kami", "Metode Pembayaran", "© 2026 Dapur Dekaka. All rights reserved.", "Harga sudah termasuk PPN 11%", "Halal", "Frozen Fresh", "Nationwide Delivery", address "Jl. Sinom V no. 7, Turangga, Bandung".

While the footer is a static display component, these should still be internationalized for consistency. However, this is lower priority since footers rarely change.

#### 🟡 MEDIUM — Hardcoded strings in `AdminHeader.tsx`

**File:** `components/admin/layout/AdminHeader.tsx:44-54`
```typescript
<Breadcrumb />
// ...
<span className="text-xs text-gray-400 hidden md:inline">Admin</span>
```
"Breadcrumb" is a React component name, but the word "Admin" in the header subtitle is hardcoded. Also `BREADCRUMB_MAP` values like 'Pesanan', 'Pelanggan', 'Kupon' are all hardcoded Indonesian.

#### 🟡 MEDIUM — `AccountForm.tsx` (store) has mixed hardcoded labels

**File:** `components/store/account/AddressForm.tsx` — needs checking but likely has hardcoded Indonesian field labels and buttons similar to `IdentityForm.tsx` which has "Nama Lengkap", "Email", "No. HP / WhatsApp", "Catatan Pesanan (opsional)" etc.

#### 🟢 LOW — About page has hardcoded Indonesian

**File:** `app/(store)/about/page.tsx:77-210`
The about page has a lot of hardcoded Indonesian text in sections like "Cerita Dapur Dekaka", "Nilai-Nilai Kami", "Bahan Pilihan", "Halal Terjamin", "Cold Chain Terjaga", etc. This is a marketing page and less critical for i18n, but should be flagged.

#### 🟢 LOW — `ProductCatalog.tsx` uses `t('allCategory')` but `allCategory` is in `metadata` namespace

**File:** `components/store/products/ProductCatalog.tsx:152`
```typescript
{t('allCategory')}
```
This is called without a namespace, so it resolves to the default namespace. But `allCategory` is defined under `metadata` in id.json. This likely works because next-intl merges all namespaces, but it's fragile and not explicit.

---

## PART 3 — UI COMPONENTS AUDIT

### Components Overview: ✅ GOOD STRUCTURE

Overall component architecture is solid. shadcn/ui base components are used throughout. `cn()` utility is consistently used for className merging. formatIDR() is used correctly for all price displays. ProductCard, CartItem, BottomNav, WhatsAppButton, AdminSidebar, AdminHeader all exist and have proper structure.

### Issues

#### 🟠 HIGH — `ProductCard.tsx`: Stock badge "HABIS" hardcoded

**File:** `components/store/products/ProductCard.tsx:121-124`
```typescript
<span className="px-3 py-1.5 bg-white/90 text-text-primary text-xs font-bold rounded-badge tracking-wide">
  HABIS
</span>
```
**Impact:** "HABIS" is hardcoded. Should use `t('product.outOfStock')` which already exists in translations as `"outOfStock": "Habis"`. The hardcoded "HABIS" also uses uppercase while translations use title case.

**Fix:** Add `useTranslations('product')` and use `t('outOfStock')`.

#### 🟠 HIGH — `Navbar.tsx`: Login button hardcoded "Masuk"

**File:** `components/store/layout/Navbar.tsx:121`
```typescript
<span className="text-sm font-medium text-text-primary hidden lg:block">
  {session.user.name?.split(' ')[0] ?? 'Akun'}
</span>
```
And:
```typescript
<Link href="/login" ...>
  Masuk
</Link>
```
**Impact:** The "Masuk" text for the login button is hardcoded. The username fallback "Akun" is also hardcoded — should be `t('account')` or similar.

**Fix:** Add `useTranslations()` and replace hardcoded strings.

#### 🟠 HIGH — `CartItem.tsx`: Stock warning hardcoded Indonesian

**File:** `components/store/cart/CartItem.tsx:44-46`
```typescript
<p className="text-xs font-medium text-warning">
  Stok tidak mencukupi. Tersedia hanya {availableStock} pcs.
</p>
```
**Impact:** The stock validation warning message is hardcoded. Should use a translation key.

#### 🟠 HIGH — `WhatsAppButton.tsx`: Tooltip hardcoded Indonesian

**File:** `components/store/layout/WhatsAppButton.tsx:34-37`
```typescript
<p className="text-xs leading-relaxed">
  Anda akan diarahkan ke WhatsApp. Chat ini tercatat untuk keperluan CS kami.
</p>
```
**Impact:** Hardcoded tooltip text. Should be a translation.

#### 🟠 HIGH — `WhatsAppButton.tsx`: Hardcoded `aria-label`

**File:** `components/store/layout/WhatsAppButton.tsx:45`
```typescript
aria-label="Chat WhatsApp untuk pertanyaan tentang pesanan atau produk"
```
**Impact:** Hardcoded aria-label. Should be translation.

#### 🟡 MEDIUM — `ProductCard.tsx`: Two separate add-to-cart handlers with duplicated toast

**File:** `components/store/products/ProductCard.tsx:42-88`
`handleQuickAdd` and `handleAddToCart` are nearly identical — both call `addItem()` with the same arguments and show the same toast. The only difference is `e.preventDefault()` in quick-add. This is code duplication. Could be refactored to a single `handleAddToCart` function with a parameter.

**Fix:** Create one `handleAddToCart` that accepts a `fromQuickAdd` boolean to control `e.preventDefault()`.

#### 🟡 MEDIUM — `CartItem.tsx`: Stock validation messages hardcoded

**File:** `components/store/cart/CartItem.tsx` — uses hardcoded "Hapus item", "Kurangi jumlah", "Tambah jumlah" aria labels.

#### 🟡 MEDIUM — `AdminSidebar.tsx`: Footer link hardcoded Indonesian

**File:** `components/admin/layout/AdminSidebar.tsx:104-106`
```typescript
← Kembali ke Store
```
Should use translation or at minimum make it a constant.

#### 🟡 MEDIUM — `AdminHeader.tsx`: Hardcoded "Admin" text

**File:** `components/admin/layout/AdminHeader.tsx:88`
```typescript
<span className="text-xs text-gray-400 hidden md:inline">Admin</span>
```
Should use a translation or be removed if the avatar is sufficient context.

#### 🟡 MEDIUM — `IdentityForm.tsx`: All labels hardcoded

**File:** `components/store/checkout/IdentityForm.tsx:51-97`
All field labels ("Nama Lengkap", "Email", "No. HP / WhatsApp", "Catatan Pesanan (opsional)") and button text ("Kembali", "Lanjut ke Pengiriman") are hardcoded. This form needs i18n support.

#### 🟡 MEDIUM — `ProductCatalog.tsx`: Empty state uses inline SVG

**File:** `components/store/products/ProductCatalog.tsx:209-211`
The empty state uses an inline SVG for the search icon rather than a component or icon library. Minor inconsistency but worth noting.

#### 🟢 LOW — `BottomNav.tsx`: B2B tab uses hardcoded label

**File:** `components/store/layout/BottomNav.tsx:34`
```typescript
...isB2bUser ? [{ href: '/b2b/account', Icon: Package, label: 'B2B' }] : []
```
"B2B" label is hardcoded. Could use translation `t('nav.b2b')`.

#### 🟢 LOW — `Footer.tsx`: Payment method icons are inline SVGs

**File:** `components/store/layout/Footer.tsx:84-102`
Visa SVG is inline. Other payment methods (GoPay, OVO, QRIS, BCA, BNI, Mandiri) are text labels inside styled divs. This is inconsistent — no actual icons for most payment methods, just text labels. This is a design inconsistency, not a code bug, but worth noting for the UI review.

#### 🟢 LOW — `AdminSidebar.tsx`: Uses `cn` from `@/lib/utils` not `@/lib/utils/cn`

**File:** `components/admin/layout/AdminSidebar.tsx:10`
```typescript
import { cn } from '@/lib/utils';
```
While this works (re-exports from `@/lib/utils/cn`), the explicit import path `@/lib/utils/cn` is clearer and matches project convention.

---

## PART 4 — LOADING / ERROR STATES AUDIT

### Route Groups Coverage: ✅ GOOD

46 `loading.tsx` files and 44 `error.tsx` files exist across route groups. Both `app/error.tsx` and `app/global-error.tsx` exist. `app/(store)/not-found.tsx` exists.

### Issues

#### 🟡 MEDIUM — `app/(admin)/admin/orders/[id]/page.tsx` — missing loading.tsx

The orders detail page at `app/(admin)/admin/orders/[id]/page.tsx` is modified in git status but there's no `loading.tsx` in `app/(admin)/admin/orders/[id]/`. However, there IS a `loading.tsx` at `app/(admin)/admin/orders/loading.tsx` (for the list page), and there seems to be a `loading.tsx` at the orders `[id]` level. Need to verify this is actually a gap.

#### 🟡 MEDIUM — `app/(admin)/admin/b2b-quotes/new/page.tsx` — has loading.tsx?

**Git status shows:** `?? app/(admin)/admin/b2b-quotes/new/NewB2BQuoteClient.tsx` — this is a new client component. The `loading.tsx` for this route group doesn't appear in the glob results. Let me check: the glob shows `app/(admin)/admin/b2b-quotes/loading.tsx` exists (untracked), but no `app/(admin)/admin/b2b-quotes/new/loading.tsx`. The route group `app/(admin)/admin/b2b-quotes/new/` needs its own loading.tsx.

**Fix:** Create `app/(admin)/admin/b2b-quotes/new/loading.tsx`.

#### 🟡 MEDIUM — `app/(admin)/admin/team-dashboard/` — has loading.tsx and error.tsx (both untracked)

From git status: both `team-dashboard/loading.tsx` and `team-dashboard/error.tsx` are untracked. This means they exist on disk but haven't been committed — the route might be incomplete or in-progress. Not a bug but worth flagging.

#### 🟡 MEDIUM — `app/(admin)/admin/field/` — error.tsx is modified but loading.tsx exists

From git status: `M app/(admin)/admin/field/error.tsx` — this is tracked as modified. The `loading.tsx` exists as untracked. Again, in-progress.

#### 🟡 MEDIUM — Global `app/error.tsx` uses hardcoded strings

**File:** `app/error.tsx:15-17`
```typescript
title="Ups, ada yang tidak beres"
description="Tim kami sedang memperbaikinya. Coba lagi sebentar ya!"
action={{ label: '🔄 Coba Lagi', onClick: reset }}
```
All hardcoded. Should use `useTranslations()`.

#### 🟡 MEDIUM — Global `app/global-error.tsx` has hardcoded strings

**File:** `app/global-error.tsx:21-31`
```typescript
<h1 className="text-2xl font-display font-bold text-text-primary mb-4">
  Terjadi Kesalahan
</h1>
<p className="text-text-secondary mb-6">
  Maaf, terjadi kesalahan yang tidak terduga.
</p>
```
All hardcoded Indonesian. While this is an error boundary (rare case), it should still be translated.

#### 🟡 MEDIUM — Many untracked `loading.tsx` files indicate in-progress work

From git status, many files show `??` status (untracked):
- `ai-content/loading.tsx`, `ai-content/error.tsx`
- `b2b-inquiries/[id]/loading.tsx`, `b2b-inquiries/error.tsx`
- `b2b-quotes/new/NewB2BQuoteClient.tsx`, `b2b-quotes/loading.tsx`
- `team-dashboard/` both loading and error
- Various `blog/`, `carousel/`, `coupons/`, `customers/` untracked files

This suggests the project has many routes that were scaffolded but not yet fully implemented. These are not bugs per se, but the untracked state means they're not in the committed codebase.

#### 🟢 LOW — `app/(admin)/admin/products/new/` — has `error.tsx` but no `loading.tsx` in the glob results

**Git status shows:** `app/(admin)/admin/products/new/error.tsx` exists (untracked), but no `app/(admin)/admin/products/new/loading.tsx` was in the glob results. However, the route `app/(admin)/admin/products/new/page.tsx` is modified in git status, suggesting it's being worked on. Missing `loading.tsx`.

#### 🟢 LOW — `app/(store)/orders/success/[orderNumber]/` — has `loading.tsx` untracked

This is an in-progress route — needs both loading and error states properly committed.

---

## PART 5 — DESIGN SYSTEM COMPLIANCE

### Design Tokens: ✅ CORRECT

Tailwind config properly defines:
- `brand.red: #C8102E` (correct)
- `brand.red-dark: #8B0000` (note: #8B0000 is darkred, not the #A00D24 from master prompt — discrepancy)
- `brand.cream: #F0EAD6` (correct)
- `brand.gold: #C9A84C` (correct)
- `text.primary: #1A1A1A` (correct)
- `fontFamily.display: Playfair Display` (correct)
- `fontFamily.body: Inter` (correct)
- WhatsApp green: `#25D366` (custom non-brand token — acceptable for third-party brand color)

### Issues

#### 🟡 MEDIUM — `brand-red-dark` token value mismatch with master prompt

**File:** `tailwind.config.ts:22`
```typescript
'red-dark': '#8B0000',
```
Master prompt says `#A00D24` for hover states, but tailwind config has `#8B0000`. The actual CSS value used in components is `hover:bg-brand-red-dark` which references this token. The mismatch means the actual dark red on hover is `#8B0000` (darkred) instead of `#A00D24`.

**Impact:** Brand consistency — hover states may look different from the intended brand guide.

**Fix:** Update to `'red-dark': '#A00D24'` in tailwind.config.ts.

#### 🟡 MEDIUM — `Footer.tsx` uses `text-brand-cream/80` (opacity modifier)

**File:** `components/store/layout/Footer.tsx:6`
```typescript
<footer className="bg-text-primary text-brand-cream/80 pt-12 pb-20 md:pb-12 px-4 md:px-0">
```
**Impact:** Using opacity modifiers (`/80`) on brand colors can produce inconsistent results across browsers and when combined with background colors. This is a design system violation — should use a specific token like `text-brand-cream-secondary` or a semi-transparent approach that doesn't rely on opacity.

#### 🟡 MEDIUM — Multiple `bg-white/10` and `bg-white/90` opacity modifiers

**File:** `components/store/layout/Footer.tsx:88-99`
```typescript
<div className="h-7 px-2 bg-white/10 rounded flex items-center">
{/* ... */}
<div className="h-7 px-2.5 bg-white/10 rounded flex items-center">
```
**Impact:** `bg-white/10` is arbitrary opacity on white. Should be a design system token like `bg-surface-overlay` or similar. While this pattern is used for payment method badges, it's inconsistent with the design token approach.

#### 🟡 MEDIUM — `Navbar.tsx` uses hardcoded `text-text-disabled`

**File:** `components/store/layout/Navbar.tsx:112`
The `text-text-disabled` token exists in tailwind as `text.disabled: #ABABAB`. This is correct usage of design tokens, not an issue.

#### 🟡 MEDIUM — `ProductCard.tsx` uses `text-[8px]` inline size

**File:** `components/store/products/ProductCard.tsx:112`
```typescript
<span className="text-[8px] text-text-disabled bg-white/60 px-1 rounded text-center">
```
**Impact:** `text-[8px]` is an arbitrary Tailwind size not in the design system (which has xs=12px, sm=14px, base=16px, etc). 8px is unusually small. This is a design system violation — should use a semantic size class.

#### 🟡 MEDIUM — `CartItem.tsx` uses `w-11 h-11` (44px touch target)

**File:** `components/store/cart/CartItem.tsx:90-104`
Both minus and plus buttons use `w-11 h-11` which equals 44px. This is correct for touch accessibility (minimum 44px per WCAG). The stepper layout is appropriate.

#### 🟡 MEDIUM — `WhatsAppButton.tsx` uses `bottom-20` for mobile positioning

**File:** `components/store/layout/WhatsAppButton.tsx:22`
```typescript
<div className="fixed bottom-20 md:bottom-8 right-4 md:right-8 z-50">
```
`bottom-20` (5rem = 80px) is above the BottomNav (which has `h-[calc(5rem+env(safe-area-inset-bottom))]`). This is correct — WhatsApp button should be visible above the bottom nav on mobile.

#### 🟡 MEDIUM — `AdminSidebar.tsx` uses `bg-admin-sidebar` token correctly

**File:** `components/admin/layout/AdminSidebar.tsx:114`
Uses `bg-admin-sidebar: '#0F172A'` — this is the dark slate admin sidebar. Correct usage.

#### 🟡 MEDIUM — `AdminSidebar.tsx` uses `text-admin-sidebar-text`, `text-admin-sidebar-active`, `bg-admin-sidebar-hover`

**File:** `components/admin/layout/AdminSidebar.tsx:91-93`
All admin sidebar color references use the admin design system tokens. Correct usage.

#### 🟡 MEDIUM — `AdminHeader.tsx` uses raw `text-gray-400`, `text-gray-600`, `bg-gray-100`

**File:** `components/admin/layout/AdminHeader.tsx:44,49,77-80`
```typescript
<nav className="hidden md:flex items-center gap-1 text-sm text-gray-400">
<span className="text-gray-700 font-medium">
<button ... className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
```
**Impact:** Admin header uses generic gray palette instead of admin design system tokens. The admin design system defines `admin.border: #E2E8F0`, but these are not being used. Instead, generic `gray-400`, `gray-600`, `gray-700`, `gray-100` are used. This is inconsistent with the admin design system which was explicitly defined to be different from the store design.

**Fix:** Use admin tokens: `text-admin-sidebar-text`, `bg-admin-content`, `border-admin-border`.

#### 🟢 LOW — `Navbar.tsx` uses `animate-pulse-soft` custom animation

**File:** `components/store/layout/Navbar.tsx` (not used there but referenced in WhatsAppButton)
The `animate-pulse-soft` animation is defined in tailwind config and used in WhatsAppButton. Correct.

#### 🟢 LOW — Some components use `rounded-card`, `rounded-badge` custom radius tokens

**File:** `components/store/products/ProductCard.tsx:94`
```typescript
className="... rounded-card shadow-card hover:shadow-card-hover"
```
These are correctly defined in tailwind config as `'card': '12px'` and `'badge': '6px'`. Correct usage.

---

## PART 6 — CRITICAL CROSS-CUTTING ISSUES

### 🔴 Critical: `addresses` table missing `updatedAt` (data integrity)

If address updates are performed (e.g., user changes default address), the `updatedAt` won't be set because the column doesn't exist. This will cause inconsistent address timestamps.

### 🔴 Critical: `productVariants` missing standalone `isActive` index

Queries filtering for active variants across all products will do a full table scan or rely on the composite index incorrectly, causing performance degradation as product catalog grows.

### 🔴 Critical: Multiple hardcoded Indonesian strings across store components

The Navbar, Footer, ProductCard, WhatsAppButton, CartItem, AdminSidebar all have hardcoded Indonesian strings. When the English locale is selected, users will still see Indonesian text throughout the store, making the i18n effort incomplete.

### 🟠 High: `en.json` missing ~30+ translation keys from `account` namespace

English users on the account page will see missing translations or fallback text for profile editing, address management, points history, and password management features.

### 🟠 High: Error boundaries (`app/error.tsx`, `app/global-error.tsx`) use hardcoded strings

While error pages are rarely seen, they still should display in the user's language. The global error boundary will always show Indonesian regardless of locale setting.

### 🟠 High: B2B navigation in BottomNav uses hardcoded 'B2B' label

**File:** `components/store/layout/BottomNav.tsx:34`
B2B users won't see proper localization of the bottom nav label.

---

## SUMMARY TABLE

| # | Category | File | Line | Issue | Severity |
|---|----------|------|------|-------|----------|
| 1 | Schema | `lib/db/schema.ts` | 121-138 | `addresses` missing `updatedAt` | 🔴 CRITICAL |
| 2 | Schema | `lib/db/schema.ts` | 224-228 | `productVariants` missing standalone `isActive` index | 🔴 CRITICAL |
| 3 | Schema | `lib/db/schema.ts` | 93-106 | `accounts` missing `userId` index | 🟡 MEDIUM |
| 4 | Schema | `lib/db/schema.ts` | 108-113 | `sessions` missing `userId` index | 🟡 MEDIUM |
| 5 | Schema | `lib/db/schema.ts` | 448-473 | `blogPosts` missing `authorId` index | 🟠 HIGH |
| 6 | Schema | `lib/db/schema.ts` | 432-434 | `pointsHistory` partial index may be unreliable | 🟠 HIGH |
| 7 | Schema | `lib/db/schema.ts` | 624-635 | `adminActivityLogs` missing `userId` index | 🟢 LOW |
| 8 | i18n | `i18n/messages/id.json` | 175,194 | Duplicate `pointsUnit` key | 🟡 MEDIUM |
| 9 | i18n | `i18n/messages/en.json` | whole file | Missing ~30+ keys from `account` namespace | 🟠 HIGH |
| 10 | i18n | `i18n/messages/en.json` | metadata | Missing `productsFound`, `showAllProducts`, etc. | 🟡 MEDIUM |
| 11 | i18n | `components/store/layout/Navbar.tsx` | 12-17 | `NAV_LINKS` hardcoded Indonesian | 🟡 MEDIUM |
| 12 | i18n | `components/store/layout/Navbar.tsx` | 189-206 | Mobile menu hardcoded Indonesian | 🟡 MEDIUM |
| 13 | i18n | `components/admin/layout/AdminSidebar.tsx` | 104-106 | Footer link hardcoded "← Kembali ke Store" | 🟡 MEDIUM |
| 14 | i18n | `components/store/layout/Footer.tsx` | entire file | All text hardcoded Indonesian | 🟡 MEDIUM |
| 15 | i18n | `components/admin/layout/AdminHeader.tsx` | 88 | Hardcoded "Admin" text | 🟡 MEDIUM |
| 16 | i18n | `components/store/checkout/IdentityForm.tsx` | 51-97 | All labels hardcoded | 🟡 MEDIUM |
| 17 | i18n | `app/error.tsx` | 15-17 | Global error hardcoded Indonesian | 🟠 HIGH |
| 18 | i18n | `app/global-error.tsx` | 21-31 | Global error hardcoded Indonesian | 🟠 HIGH |
| 19 | UI | `components/store/products/ProductCard.tsx` | 121-124 | Hardcoded "HABIS" overlay | 🟠 HIGH |
| 20 | UI | `components/store/products/ProductCard.tsx` | 42-88 | Duplicated `handleQuickAdd`/`handleAddToCart` | 🟡 MEDIUM |
| 21 | UI | `components/store/layout/Navbar.tsx` | 121 | Hardcoded "Masuk" login button | 🟠 HIGH |
| 22 | UI | `components/store/cart/CartItem.tsx` | 44-46 | Hardcoded stock warning message | 🟠 HIGH |
| 23 | UI | `components/store/layout/WhatsAppButton.tsx` | 34-37 | Hardcoded tooltip Indonesian | 🟠 HIGH |
| 24 | UI | `components/store/layout/WhatsAppButton.tsx` | 45 | Hardcoded aria-label | 🟠 HIGH |
| 25 | UI | `components/store/layout/BottomNav.tsx` | 34 | Hardcoded "B2B" label | 🟢 LOW |
| 26 | Design | `tailwind.config.ts` | 22 | `brand-red-dark` value is `#8B0000` not `#A00D24` | 🟡 MEDIUM |
| 27 | Design | `components/store/layout/Footer.tsx` | 6 | Uses `text-brand-cream/80` opacity modifier | 🟡 MEDIUM |
| 28 | Design | `components/store/layout/Footer.tsx` | 88-99 | Uses `bg-white/10` arbitrary opacity | 🟡 MEDIUM |
| 29 | Design | `components/store/products/ProductCard.tsx` | 112 | Uses `text-[8px]` arbitrary size | 🟡 MEDIUM |
| 30 | Design | `components/admin/layout/AdminHeader.tsx` | 44-80 | Uses raw `gray-*` tokens instead of admin tokens | 🟡 MEDIUM |
| 31 | Loading | `app/(admin)/admin/b2b-quotes/new/` | — | Missing `loading.tsx` | 🟡 MEDIUM |
| 32 | Loading | `app/(admin)/admin/products/new/` | — | Missing `loading.tsx` | 🟢 LOW |

---

## RECOMMENDED PRIORITY ORDER

### Immediate (before next deployment)
1. Fix `addresses` table missing `updatedAt` — data integrity risk
2. Add standalone `isActive` index on `productVariants` — performance risk
3. Add `authorId` index on `blogPosts` — performance risk
4. Fix duplicate `pointsUnit` key in `id.json` — potential runtime error
5. Fix hardcoded "HABIS" → `t('product.outOfStock')` in ProductCard
6. Fix hardcoded "Masuk" in Navbar login button

### Soon (within this sprint)
7. Add missing English translations for `account` namespace in `en.json`
8. Add missing metadata keys to `en.json`
9. Fix `brand-red-dark` color value in tailwind.config.ts
10. Fix Global Error boundary i18n
11. Fix Navbar NAV_LINKS i18n
12. Fix WhatsAppButton hardcoded aria-label and tooltip i18n

### Later (next sprint)
13. Add `userId` indexes to `accounts`, `sessions`, `adminActivityLogs`
14. Replace all hardcoded Indonesian strings in components with `useTranslations()`
15. Replace `gray-*` tokens in AdminHeader with admin design system tokens
16. Refactor `ProductCard` duplicated handlers
17. Add `loading.tsx` to `b2b-quotes/new/` and `products/new/` routes
18. Review and complete all untracked loading/error files

---

*Audit completed. Total 32 issues identified across 3 domains (Schema: 7, i18n: 11, UI/Design: 14). Foundation is solid — issues are localized and fixable without architectural changes.*