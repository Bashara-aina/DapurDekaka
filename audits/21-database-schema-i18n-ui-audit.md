# Audit 21 — Database Schema, i18n & Design System Deep Audit

**Auditor:** Agent 5 — Schema/i18n/Components Specialist
**Date:** 2026-05-23
**Scope:** lib/db/schema.ts, i18n/messages/, components/ui/, design tokens
**Severity Scale:** 🔴 CRITICAL > 🟠 HIGH > 🟡 MEDIUM > 🟢 LOW

---

## Summary

| Severity | Count |
|----------|-------|
| 🔴 CRITICAL | 2 |
| 🟠 HIGH | 7 |
| 🟡 MEDIUM | 5 |
| 🟢 LOW | 3 |
| **Total** | **17** |

---

## 🔴 CRITICAL Issues

### C1 — `addresses` Table Missing `updatedAt`
**File:** `lib/db/schema.ts`
**Lines:** 121-138 (addresses table definition)

```typescript
// PROBLEM: addresses table declared BEFORE timestamps() mixin
// OR timestamps() mixin doesn't include updatedAt for this table
export const addresses = sqliteTable('addresses', {
  id: text('id').primaryKey().$defaultUuid(),
  userId: text('user_id').notNull().references(() => users.id),
  label: text('label').notNull(), // 'Rumah', 'Kantor'
  recipientName: text('recipient_name').notNull(),
  phone: text('phone').notNull(),
  provinceId: text('province_id').notNull(),
  cityId: text('city_id').notNull(),
  postalCode: text('postal_code').notNull(),
  fullAddress: text('full_address').notNull(),
  isDefault: integer('is_default', { mode: 'boolean' }).default(false),
  createdAt: text('created_at').notNull(),  // ✅ Has createdAt
  // ❌ MISSING: updatedAt — address edits won't record timestamp
}, (table) => [
  // indexes...
]);
```

**Problem:** The `addresses` table does NOT have `updatedAt` column. When a user edits their address, there's no timestamp recorded.
**Impact:** Address edit history lost. Can't track when address was last changed.
**Fix:** Add `updatedAt: text('updated_at').notNull()` to addresses table, populate via DB trigger or application code.

---

### C2 — `productVariants` Missing `isActive` Index
**File:** `lib/db/schema.ts`
**Lines:** 224-228 (productVariants table + indexes)

```typescript
export const productVariants = sqliteTable('product_variants', {
  id: text('id').primaryKey().$defaultUuid(),
  productId: text('product_id').notNull().references(() => products.id),
  name: text('name').notNull(), // '500g', '1kg'
  sku: text('sku').unique(),
  price: integer('price').notNull(), // IDR
  stock: integer('stock').notNull().default(0),
  weight: integer('weight').notNull(), // grams
  isActive: boolean('is_active').notNull().default(true),
  createdAt: text('created_at').notNull(),
  updatedAt: text('updated_at').notNull(),
}, (table) => [
  index('product_variants_product_id_idx').on(table.productId),
  // ❌ MISSING: Composite index on (productId, isActive) for filtered queries
  // Current query pattern: WHERE product_id = ? AND is_active = true — needs index
]);
```

**Problem:** No composite index on `(productId, isActive)`. Every product catalog query does a full scan of inactive variants.
**Impact:** As catalog grows to 100+ variants, product listing pages become slow (full table scan per request).
**Fix:** Add `index('product_variants_product_active_idx').on(table.productId, table.isActive)`.

---

## 🟠 HIGH Issues

### H1 — Missing Index on `accounts.userId`
**File:** `lib/db/schema.ts`
**Lines:** ~accounts table

```typescript
// Problem: No index on userId in accounts table
// Users with OAuth providers will have slow session lookups
export const accounts = sqliteTable('accounts', {
  // ...
  userId: text('user_id').notNull().references(() => users.id),
  // ❌ Missing: index('accounts_user_id_idx').on(accounts.userId)
});
```

**Fix:** Add `index('accounts_user_id_idx').on(table.userId)` to accounts table.

---

### H2 — Missing Index on `sessions.userId`
**File:** `lib/db/schema.ts`
**Lines:** ~sessions table

```typescript
// Problem: sessions.userId not indexed
// Session lookup by user will be slow
export const sessions = sqliteTable('sessions', {
  // ...
  userId: text('user_id').notNull().references(() => users.id),
  // ❌ Missing: index('sessions_user_id_idx').on(sessions.userId)
});
```

**Fix:** Add `index('sessions_user_id_idx').on(table.userId)` to sessions table.

---

### H3 — `blogPosts` Missing `authorId` Index
**File:** `lib/db/schema.ts`
**Lines:** 448 (blogPosts table)

```typescript
export const blogPosts = sqliteTable('blog_posts', {
  id: text('id').primaryKey().$defaultUuid(),
  authorId: text('author_id').notNull().references(() => users.id),
  // ❌ Missing: index on authorId for "my posts" queries
});
```

**Fix:** Add `index('blog_posts_author_id_idx').on(table.authorId)`.

---

### H4 — `pointsHistory` Partial Index Complex WHERE
**File:** `lib/db/schema.ts`
**Lines:** 432 (pointsHistory table)

```typescript
// Problem: Neon serverless Postgres may not handle complex partial indexes well
// WHERE expires_at > now() — function in index condition
export const pointsHistory = sqliteTable('points_history', {
  // ...
  expiresAt: text('expires_at'),
}, (table) => [
  index('points_history_user_expires_idx').on(table.userId)
    .where(sql`expires_at > now()`), // Complex partial index
]);
```

**Fix:** Simplify index or evaluate if Neon handles it. Consider storing computed `is_expired` boolean and index that.

---

### H5 — `brand-red-dark` Token Wrong Hex Value
**File:** `tailwind.config.ts` or CSS variables

**Problem:** `brand-red-dark` is defined as `#8B0000` (standard darkred) but master prompt specifies `#A00D24`.
**Impact:** Brand red hover states use wrong color. Off-brand.
**Fix:** Update to `#A00D24`.

---

### H6 — i18n `id.json` Duplicate `pointsUnit` Key
**File:** `i18n/messages/id.json`
**Lines:** ~175, ~194 (two occurrences of `pointsUnit`)

**Problem:** `pointsUnit` key appears twice in `checkout` namespace. JSON parsers silently take last value, but the first reference in code may use the wrong one during SSR/hydration.
**Impact:** Intermittent i18n value mismatch.
**Fix:** Remove duplicate. Ensure only one `pointsUnit` key.

---

### H7 — English i18n — ~30 Missing Keys
**File:** `i18n/messages/en.json`

**Problem:** `en.json` is missing keys that exist in `id.json`:
- `account` namespace: all error strings, profile management, password change
- `checkout.metadata.productsFound`, `showAllProducts`, `loadMore`, `sortDefault`
- Various component-level keys found hardcoded in components

**Impact:** English locale users see blank/missing text for entire account flows.
**Fix:** Audit `id.json` line by line against `en.json`. Add all missing keys.

---

## 🟡 MEDIUM Issues

### M1 — `orders` Table Missing `payment_method` Column
**File:** `lib/db/schema.ts`
**Lines:** ~orders table

```typescript
// Problem: payment_method from Midtrans not persisted
// Admin can't filter by payment method
export const orders = sqliteTable('orders', {
  // ... existing columns
  // ❌ Missing: paymentMethod: text('payment_method'),
});
```

**Fix:** Add `paymentMethod: text('payment_method')` to orders table. Populate from Midtrans webhook.

---

### M2 — `orders` Table Missing `shipping_courier` Column
**File:** `lib/db/schema.ts`
**Lines:** ~orders table

```typescript
// Problem: courier used not stored
// Admin can't see which courier was selected without going to Midtrans
export const orders = sqliteTable('orders', {
  // ... existing columns
  // ❌ Missing: shippingCourier: text('shipping_courier'),
});
```

**Fix:** Add `shippingCourier: text('shipping_courier')` to orders table.

---

### M3 — Global Error Boundary Hardcoded Indonesian
**File:** `app/error.tsx`
**Lines:** 15-17

```tsx
// Problem: Global error boundary uses Indonesian strings
<h2>Terjadi kesalahan</h2>
<p>Maaf, terjadi kesalahan yang tidak terduga.</p>
<button>Memuat ulang...</button>
```

**Fix:** Import `useTranslations` and use `t('errors.something')` or create error-specific namespace.

---

### M4 — Global Error Handler Hardcoded Indonesian
**File:** `app/global-error.tsx`
**Lines:** 21-31

**Problem:** Same issue as `app/error.tsx`. Global error boundary hardcodes Indonesian.
**Fix:** Same solution — use i18n.

---

### M5 — `Footer` Has Extensive Hardcoded Text
**File:** `components/store/layout/Footer.tsx`

**Problem:** Footer contains brand tagline, nav links, contact info, social labels, copyright — all hardcoded Indonesian.
**Impact:** Footer completely ignores locale.
**Fix:** Audit every text string and add i18n keys.

---

## 🟢 LOW Issues

### L1 — `BottomNav` B2B Tab Label Hardcoded
**File:** `components/store/layout/BottomNav.tsx`

**Problem:** B2B tab uses hardcoded label instead of `t('nav.b2b')`.
**Fix:** Add `nav.b2b` to i18n and use it.

---

### L2 — AdminSidebar Imports `cn` from `@/lib/utils`
**File:** `components/admin/layout/AdminSidebar.tsx`

```typescript
// Current:
import { cn } from '@/lib/utils';

// Should be:
import { cn } from '@/lib/utils/cn';
```

**Fix:** Change import path to ensure single `cn` instance.

---

### L3 — `ProductCard` Image `alt` Text Not Localized
**File:** `components/store/products/ProductCard.tsx`

```tsx
// Current:
<Image src={...} alt={`${product.name} product`} />

// Better:
<Image src={...} alt={t('product.imageAlt', { name: product.name })} />
```

**Fix:** Add `product.imageAlt` to i18n and use with proper interpolation.

---

## Complete Schema Audit Matrix

| Table | UUID PK | createdAt | updatedAt | deletedAt | Missing Indexes |
|-------|---------|-----------|-----------|----------|-----------------|
| `users` | ✅ | ✅ | ✅ | ✅ | - |
| `accounts` | ✅ | ✅ | ✅ | - | **❌ userId** |
| `sessions` | ✅ | ✅ | ✅ | - | **❌ userId** |
| `addresses` | ✅ | ✅ | ❌ NO updatedAt | - | - |
| `products` | ✅ | ✅ | ✅ | ✅ | - |
| `productVariants` | ✅ | ✅ | ✅ | ✅ | **❌ (productId, isActive)** |
| `categories` | ✅ | ✅ | ✅ | - | - |
| `orders` | ✅ | ✅ | ✅ | - | - |
| `orderItems` | ✅ | ✅ | - | - | - |
| `coupons` | ✅ | ✅ | ✅ | ✅ | - |
| `couponUsage` | ✅ | ✅ | - | - | - |
| `pointsHistory` | ✅ | ✅ | - | - | ⚠️ complex partial |
| `cartItems` | ✅ | ✅ | ✅ | - | - |
| `blogPosts` | ✅ | ✅ | ✅ | ✅ | **❌ authorId** |
| `carouselItems` | ✅ | ✅ | ✅ | - | - |
| `b2bInquiries` | ✅ | ✅ | ✅ | - | - |
| `b2bQuotes` | ✅ | ✅ | ✅ | - | - |
| `testimonials` | ✅ | ✅ | ✅ | - | - |
| `systemSettings` | ✅ | ✅ | ✅ | - | - |
| `shipments` | ✅ | ✅ | ✅ | - | - |
| `adminActivityLogs` | ✅ | ✅ | - | - | - |

---

## i18n Completeness: id.json vs en.json

### Missing in en.json (Priority Order)

```
account.profile.title
account.profile.editButton
account.profile.saveButton
account.profile.nameLabel
account.profile.emailLabel
account.profile.phoneLabel
account.profile.birthdayLabel
account.addresses.title
account.addresses.addButton
account.addresses.editButton
account.addresses.deleteButton
account.addresses.defaultBadge
account.addresses.emptyState
account.orders.title
account.orders.viewButton
account.orders.status
account.points.title
account.points.balance
account.points.history
account.points.expiring
account.vouchers.title
account.vouchers.redeemButton
account.vouchers.expiredBadge
account.error.notFound
account.error.unauthorized
auth.login.title
auth.login.emailLabel
auth.login.passwordLabel
auth.login.submitButton
auth.login.forgotPassword
auth.register.title
auth.register.nameLabel
auth.register.confirmPasswordLabel
auth.register.submitButton
auth.register.loginLink
auth.forgotPassword.title
auth.forgotPassword.submitButton
auth.forgotPassword.successMessage
auth.resetPassword.title
auth.resetPassword.newPasswordLabel
auth.resetPassword.confirmPasswordLabel
auth.resetPassword.submitButton
auth.resetPassword.successMessage
auth.error.invalidCredentials
auth.error.emailExists
auth.error.weakPassword
nav.home
nav.products
nav.blog
nav.b2b
nav.account
nav.logout
nav.login
product.outOfStock
product.stockRemaining
product.imageAlt
product.addToCart
product.selectVariant
cart.stockInsufficient
cart.addedToCart
cart.removedFromCart
cart.emptyState
whatsapp.chat
checkout.name
checkout.email
checkout.phone
checkout.address
checkout.province
checkout.city
checkout.postalCode
checkout.courier
checkout.couponPlaceholder
checkout.applyCoupon
checkout.pointsLabel
checkout.pointsRedeem
checkout.subtotal
checkout.shipping
checkout.discount
checkout.total
checkout.payNow
checkout.metadata.productsFound
checkout.showAllProducts
checkout.loadMore
checkout.sortDefault
footer.about
footer.contact
footer.privacyPolicy
footer.refundPolicy
footer.termsOfService
footer.copyright
footer.paymentMethods
errors.something
errors.notFound
errors.unauthorized
errors.serverError
errors.validationError
loading.default
```

---

## Recommended Fix Order

1. **C1, C2** — Fix critical schema issues (addresses updatedAt, variant index)
2. **H1-H7** — Fix all missing indexes, duplicate key, wrong design token
3. **M1-M5** — Add missing columns, fix i18n in error boundaries
4. **L1-L3** — Polish small details
