# AUDIT 06 — I18N & TRANSLATIONS GAP ANALYSIS
**Project:** DapurDekaka.com
**Date:** May 22, 2026
**Scope:** `i18n/messages/`, all pages using `useTranslations()` or hardcoded strings
**Severity Scale:** 🔴 CRITICAL · 🟠 HIGH · 🟡 MEDIUM · 🟢 LOW

---

## The Big Picture

The i18n setup exists but is **fundamentally incomplete**. With 100 real users tomorrow:
- The language toggle (if it exists in the UI) does **nothing**
- All users see Bahasa Indonesia regardless of preference
- English-speaking B2B visitors get zero localization
- API error messages are hardcoded in Bahasa Indonesia with no translation path
- The `en.json` file is essentially empty

---

## 🔴 CRITICAL

### C-01: `id.json` and `en.json` — Only 37 Lines, 90%+ of UI Text Missing

**Files:** `i18n/messages/id.json`, `i18n/messages/en.json`

**Current coverage:**
```json
{
  "common": { ... },
  "nav": { ... },
  "product": { ... },
  "cart": { ... },
  "checkout": { ... }
}
```

**Missing entirely:**
- `orderStatus` — "Menunggu Pembayaran", "Diproses", "Dikemas", "Dikirim", "Diterima", "Dibatalkan", "Dikembalikan"
- `errorMessages` — "Kupon tidak ditemukan", "Stok tidak mencukupi", "Poin tidak valid", "Minimal pesanan Rp X", etc.
- `admin` — all admin UI strings (sidebar labels, table headers, button labels, form labels)
- `auth` — "Masuk", "Daftar", "Lupa Password", "Reset Password", email template strings
- `account` — profile, addresses, orders, points, vouchers labels and empty states
- `blog` — post titles, categories, read more, published date format
- `email` — all email template strings (confirmation, reset, shipment tracking)
- `apiErrors` — all API validation error messages returned by Zod

**Action:** This is a massive migration task. Prioritize:
1. **Tier 1 (blocking for B2B):** API error messages + order status labels + auth strings
2. **Tier 2 (UX):** Account page strings + checkout strings
3. **Tier 3 (nice-to-have):** Blog + email templates

---

### C-02: API Routes Return Hardcoded Bahasa Indonesia Error Messages

**Files:** ALL `app/api/` route files

**Examples:**
- `app/api/coupons/validate/route.ts` — returns `"Kupon tidak ditemukan"`, `"Kupon sudah tidak aktif"`, `"Kupon sudah kadaluarsa"`
- `app/api/checkout/initiate/route.ts` — returns `"Stok tidak mencukupi"`, `"Poin tidak mencukupi"`
- `app/api/checkout/retry/route.ts` — returns `"Pesanan tidak ditemukan"` or `"Pesanan sudah tidak dapat diulang"`
- `app/api/auth/register/route.ts` — returns `"Email sudah terdaftar"`
- `app/api/admin/orders/[id]/status/route.ts` — returns `"Status pesanan tidak valid"`

**Issue:** These strings should come from `id.json` (or a dedicated `apiErrors` namespace). Currently, even if the frontend uses next-intl, API error messages shown to users (via toast) are hardcoded in the API response body.

**Fix:** Create `i18n/messages/id.json` `apiErrors` namespace:
```json
{
  "apiErrors": {
    "couponNotFound": "Kupon tidak ditemukan",
    "couponInactive": "Kupon sudah tidak aktif",
    "couponExpired": "Kupon sudah kadaluarsa",
    "insufficientStock": "Stok tidak mencukupi",
    "insufficientPoints": "Poin tidak mencukupi"
  }
}
```
Then use `t('apiErrors.insufficientStock')` in API routes. Note: API routes can't use `getTranslations()` in server components directly — consider a helper that returns the error string by key.

---

### C-03: No `useTranslations()` in Store Pages — Hardcoded Strings Everywhere

**Files:** `app/(store)/page.tsx`, `app/(store)/account/page.tsx`, `app/(store)/account/addresses/page.tsx`, `app/(store)/account/orders/page.tsx`, `app/(store)/account/points/page.tsx`, `app/(store)/account/vouchers/page.tsx`, `app/(store)/cart/page.tsx`, and more

**Issue:** ZERO of the audited store pages use `useTranslations()`. Every single string is hardcoded Bahasa Indonesia:
- "Keranjang", "Masuk", "Daftar", "Halo", "Total Pesanan", "Poin Saya", "Voucher & Kupon"
- "Alamat Tersimpan", "Tambah Alamat", "Hapus Semua", "Simpan Perubahan"
- Order status labels, empty state messages, loading text

**Fix:** For each page:
1. Import `useTranslations` from `next-intl`
2. Wrap the component (or extract interactive parts) with a client component that calls `useTranslations()`
3. Replace all hardcoded strings with `t('key')`

---

## 🟠 HIGH

### H-01: `I18N_SURVEY.md` Documents 225+ Hardcoded Strings — This Is the Blueprint

**File:** `i18n/messages/I18N_SURVEY.md`

**Issue:** This file is actually a valuable resource — it lists 225 hardcoded Indonesian strings that were identified as needing i18n migration. This is the **todo list** for the i18n migration.

**Action:** Use `I18N_SURVEY.md` as the source of truth to populate `id.json` and `en.json`. Go through each string listed and create corresponding entries in both locale files.

---

### H-02: Admin Pages — Completely Untranslated

**Files:** All `app/(admin)/admin/` pages

**Issue:** All admin UI text is hardcoded in Bahasa Indonesia:
- Sidebar labels ("Pesanan", "Produk", "Inventori", "Pengiriman", "Pelanggan", "Kupon", "Blog", "Karousel", "B2B", "Pengaturan", "AI Content")
- Table headers ("ID Pesanan", "Pelanggan", "Total", "Status", "Aksi")
- Button labels ("Simpan", "Batal", "Hapus", "Tambah", "Edit")
- Form labels and error messages

**Fix:** This is a large task. Consider a separate admin i18n namespace or accept Bahasa Indonesia as the admin-only language (which may be intentional per brand voice). Clarify with Bashara whether admin needs i18n.

---

### H-03: Email Templates — Non-Internationalized

**Files:** `components/email/` (all email templates)

**Issue:** Email templates (order confirmation, password reset, shipment tracking, pickup invitation) are React Email components with hardcoded Indonesian strings. They cannot be sent in English even if a B2B customer sets their language to English.

**Fix:** Add i18n support to email templates using `getTranslations()` server-side, or create separate `EmailTemplate.en.tsx` variants.

---

## 🟡 MEDIUM

### M-01: Order Status Labels — DRY Violation

**Files:** `app/(store)/account/page.tsx` lines 181–187, `app/(store)/account/orders/page.tsx` lines 136–142

**Issue:** Identical hardcoded status label mappings exist in two places. If a new status is added, both files must be manually updated.

**Fix:** Extract to a shared constant in `@/lib/constants/orders.ts`:
```typescript
export const ORDER_STATUS_LABELS = {
 pending_payment: 'Menunggu Pembayaran',
 paid: 'Sudah Dibayar',
 processing: 'Diproses',
 packed: 'Dikemas',
 shipped: 'Dikirim',
 delivered: 'Diterima',
 cancelled: 'Dibatalkan',
 refunded: 'Dikembalikan',
} as const;
```

---

### M-02: Order Status Labels Not in `id.json` / `en.json`

**File:** `i18n/messages/id.json`

**Issue:** Even the existing `id.json` doesn't have an `orderStatus` namespace. The status labels are not in the translation files at all.

**Fix:** Add `orderStatus` namespace to both locale files.

---

### M-03: Points Page Loading Text Hardcoded

**File:** `app/(store)/account/points/page.tsx` line 190

```tsx
{isLoadingMore ? 'Memuat...' : 'Tampilkan Lebih Banyak'}
```

**Action:** Add to `id.json` / `en.json`.

---

### M-04: `blog/page.tsx` — Hardcoded Blog Category and Post Labels

**File:** `app/(store)/blog/page.tsx`

**Issue:** "Semua", "Artikel", "Resep", and all blog post labels hardcoded.

**Fix:** Add blog namespace to translation files.

---

## 🟢 LOW

### L-01: `next-intl` Configuration vs App Router Integration

**File:** `i18n/` (configuration)

**Note:** Need to verify the next-intl config (`i18n.ts` or `i18n/request.ts`) properly integrates with App Router. The `i18n/routing.ts` and `i18n/request.ts` files should exist and be configured for `id` (default) and `en` locales. If middleware is not properly configured, the locale switcher will not work.

**Action:** Verify `middleware.ts` has the next-intl middleware configuration.

---

## RECOMMENDED MIGRATION ORDER

### Phase 1 — API Error Messages (1 hour)
1. Create `i18n/messages/id.json` `apiErrors` namespace
2. Create `lib/utils/api-errors.ts` helper to get error strings
3. Update all API routes to use the helper

### Phase 2 — Order Status Labels (30 min)
1. Add `orderStatus` namespace to both locale files
2. Extract `ORDER_STATUS_LABELS` constant
3. Replace hardcoded strings in account pages

### Phase 3 — Auth Pages (1 hour)
1. Add `auth` namespace to locale files
2. Wrap login, register, forgot-password, reset-password with `useTranslations()`
3. Replace all hardcoded strings

### Phase 4 — Account Pages (1 hour)
1. Add `account` namespace to locale files
2. Wrap account sub-pages with `useTranslations()`
3. Replace all hardcoded strings

### Phase 5 — Checkout Pages (1 hour)
1. Add `checkout` namespace to locale files
2. Wrap checkout, pending, success, failed pages
3. Replace all hardcoded strings

### Phase 6 — Admin Pages (2 hours, or decide admin=BI only)
1. Add `admin` namespace or accept BI-only for admin

---

## SUMMARY

| ID | Severity | Issue | Fix Action |
|----|----------|-------|------------|
| C-01 | 🔴 CRITICAL | id.json/en.json only 37 lines — 90% missing | Massive migration using I18N_SURVEY.md as blueprint |
| C-02 | 🔴 CRITICAL | API routes return hardcoded BI error messages | Create apiErrors namespace + helper |
| C-03 | 🔴 CRITICAL | Zero store pages use next-intl | Add useTranslations() to every page |
| H-01 | 🟠 HIGH | I18N_SURVEY.md is the migration todo list | Use as source of truth to populate locale files |
| H-02 | 🟠 HIGH | Admin pages completely untranslated | Decide: translate admin or accept BI-only |
| H-03 | 🟠 HIGH | Email templates non-internationalized | Add i18n to email templates |
| M-01 | 🟡 MEDIUM | Order status labels DRY violation | Extract to shared constant |
| M-02 | 🟡 MEDIUM | orderStatus namespace missing from locale files | Add to both locale files |
| M-03 | 🟡 MEDIUM | Points page loading text hardcoded | Add to locale files |
| M-04 | 🟡 MEDIUM | Blog page hardcoded strings | Add blog namespace |
| L-01 | 🟢 LOW | next-intl middleware integration verification | Verify routing.ts and request.ts config |

**Total: 3 CRITICAL · 3 HIGH · 4 MEDIUM · 1 LOW**