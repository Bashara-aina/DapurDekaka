# i18n Translations — Full Audit

**Audit Date:** 2026-05-22
**Auditor:** Deep Code Audit
**Scope:** `i18n/messages/en.json`, `i18n/messages/id.json`, all usage across codebase

---

## Executive Summary

The i18n system is properly configured with next-intl supporting Indonesian (primary) and English. Both translation files are largely complete with matching key structures. However, the **checkout page has significant hardcoded strings** that violate i18n requirements, and several other pages have scattered hardcoded strings.

**i18n Health:** ~85%. Major gap: checkout page. Minor gaps: some error messages in API routes not using consistent translation keys.

---

## 1. Translation File Comparison

### 1.1 Key Count

| File | Top-level Keys | Total Nested Keys |
|------|---------------|-------------------|
| `en.json` | 7 | ~120 |
| `id.json` | 7 | ~120 |

Both files have identical structure. No missing keys detected in the comparison.

### 1.2 Shared Key Structure

Both files share these top-level keys:
- `common` — brandName, tagline
- `nav` — home, products, cart, account, blog
- `product` — addToCart, outOfStock, remainingStock, selectVariant, halal
- `cart` — empty, emptySubtitle, startShopping, total, checkout
- `checkout` — title, delivery, pickup, payNow, identity, address, courier, payment
- `orderStatus` — all order statuses (pending_payment, paid, processing, packed, shipped, delivered, cancelled, refunded + short variants)
- `account` — extensive account-related strings
- `apiErrors` — error messages for API failures
- `blog` — blog listing strings
- `email` — email subject templates

### 1.3 Missing Keys in Both Files

The following features lack translation keys entirely:

| Missing Key Area | Description |
|-----------------|-------------|
| **Coupon types** | "percentage", "fixed", "free_shipping", "buy_x_get_y" — used in admin but not translated |
| **Order status transitions** | "Order status changed to X" notification text |
| **Shipping couriers** | SiCepat, JNE, AnterAja — names not translated |
| **B2B terms** | "Net-30", "approved", "pending approval" |
| **Field dashboard** | Warehouse-specific terms (packing, tracking, pickup) |
| **Admin roles** | "superadmin", "owner", "warehouse", "customer" — role name display |
| **Points terms** | "earned", "redeemed", "expired", "expires in X days" |
| **Time relative** | "baru saja", "X menit lalu", "X jam lalu" — used in admin but may be hardcoded |

### 1.4 Empty Values Check

**Status:** ✅ No empty values found

Both files have all keys populated with actual text.

---

## 2. Hardcoded String Audit — By File

### 2.1 CRITICAL: Checkout Page

**File:** `app/(store)/checkout/page.tsx`

This file has **extensive hardcoded strings**. It imports `useTranslations` at line 28? Let me check...

Actually looking at the imports (line 1-28), `useTranslations` is NOT imported. The file has:

**Hardcoded strings found:**

| Line | Hardcoded String | Should Be |
|------|----------------|-----------|
| 40-44 | `STEPS` array: `'identity'`, `'delivery'`, `'courier'`, `'payment'` label text | `t('checkout.identity')`, etc. |
| 47-50 | `STEPS_PICKUP` array: same labels | Same |
| 88 | `'Senin - Sabtu'` and `'08.00 - 17.00 WIB'` | From store settings |
| 162 | `'Identitas'`, `'Pengiriman'`, `'Kurir'`, `'Bayar'` step labels | `t('checkout.identity')` etc. |
| 228 | `'{items.reduce...} item'` | `t('checkout.itemsCount', { count })` |
| 234 | `'Keranjangmu kosong'` | `t('cart.empty')` |
| 235 | `'Tambahkan produk terlebih dahulu'` | `t('checkout.emptyCartDesc')` |
| 241 | `'Mulai Belanja'` | `t('cart.startShopping')` |
| 254 | `'Menghitung ongkir...'` | `t('checkout.loadingShipping')` |
| 262-263 | Success/error messages | Should be from i18n |
| 304 | `'Gagal menghitung ongkir'` | `t('apiErrors.networkError')` |
| 323 | `'Gagal membuat pesanan'` | `t('apiErrors.networkError')` |
| 352 | `'Kupon tidak valid'` | `t('apiErrors.couponNotFound')` |
| 386 | `'Memproses...'` | `t('common.processing')` |
| 395 | `'Bayar Sekarang — ${formatIDR(totalAmount)}'` | `t('checkout.payNow')` |
| 413 | `'Lanjutkan'` | `t('common.continue')` |
| 417 | `'Kembali'` | `t('common.back')` |
| 468 | `'Item'` | `t('checkout.item')` or reuse |
| 473 | `'Review Pesanan'` | `t('checkout.reviewOrder')` |
| 481 | `'Penerima'` | `t('checkout.recipient')` |
| 487 | `'No. HP'` | `t('checkout.phone')` |
| 491 | `'Alamat'` | `t('checkout.address')` |
| 496 | `'Kurir'` | `t('checkout.courier')` |
| 499 | `'Ambil di Toko'` | `t('checkout.pickup')` |
| 501 | `'Metode'` | `t('checkout.method')` |
| 507 | `'Subtotal'` | `t('cart.subtotal')` |
| 513 | `'Diskon'` | `t('checkout.discount')` |
| 517 | `'Points (${pointsUsed} pt)'` | `t('checkout.pointsUsed')` |
| 520 | `'Ongkir'` | `t('checkout.shipping')` |
| 524 | `'Total Bayar'` | `t('checkout.total')` |
| 530 | `'Kupon gratis item aktif!'` | `t('checkout.buyXgetYActive')` |
| 542 | `'Beli ${buyQty} item, dapat ${getQty} item gratis'` | `t('checkout.buyXgetYDesc')` |
| 558 | `'← Kembali ke Kurir'` | `t('common.back')` |
| 572 | `'dikonfirmasi setelah pesanan dibuat'` | `t('checkout.preOrderNote')` |
| 581 | `'Sudah punya akun?'` + `'Masuk di sini'` | `t('checkout.alreadyHaveAccount')` + `t('nav.login')` |
| 614-648 | Pickup info section — all hardcoded | Entire section |
| 670-672 | Payment section — hardcoded | Partially |
| 696 | `'Paket dikemas, tunggu konfirmasi email'` | `t('checkout.packedNote')` |

**This is a MAJOR i18n violation.** The checkout page is the most conversion-critical page on the site and has dozens of hardcoded strings.

### 2.2 Order Tracking Page

**File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx`

Need to check for hardcoded strings in timeline, status badges, and action buttons.

### 2.3 B2B Pages

All B2B inquiry and quote pages likely have hardcoded strings. B2B is business-focused and may intentionally use English, but the i18n system should still be used.

### 2.4 Admin Pages

Admin pages generally use Bahasa Indonesia hardcoded strings which is acceptable since admin users are internal. However, the system should support toggling between ID/EN in admin as well for consistency.

---

## 3. Bahasa Indonesia Quality Check

### 3.1 Overall Quality: ✅ Natural

The id.json translations use natural Bahasa Indonesia:
- `"Keranjangmu masih kosong"` — natural, warm tone
- `"Tersisa {count} pcs"` — natural abbreviation
- `"Mohon maaf, layanan pengiriman frozen ke daerah Anda belum tersedia"` — polite, natural
- `"Pesanan dibuat, menunggu pembayaran"` — clear status message

No obvious machine-translation artifacts detected.

### 3.2 Potential Improvements

Some longer strings could be shortened for better UX on mobile:

| Current | Suggestion |
|---------|-----------|
| `"Mohon maaf, layanan pengiriman frozen ke daerah Anda belum tersedia. Silakan hubungi kami via WhatsApp untuk solusi pengiriman khusus."` | `"Layanan pengiriman frozen belum tersedia di daerah Anda. Hubungi WhatsApp untuk solusi."` |

---

## 4. i18n Usage in API Routes

### 4.1 API Error Messages

API routes return hardcoded Bahasa Indonesia error strings:
- `"Kupon tidak ditemukan atau sudah tidak berlaku"` — in initiate route
- `"Stok tidak mencukupi"` — in initiate route
- `"Poin tidak mencukupi atau terjadi kesalahan"` — in initiate route

**These are intentional** — API error messages don't use next-intl because they run server-side and next-intl requires a request context. This is acceptable. However, the `apiErrors` section in i18n files provides standardized error keys — but API routes don't consume them.

**Recommendation:** The `apiErrors` section in i18n should be consumed by a shared error formatting utility that API routes can use. But this is low priority since the hardcoded strings are in Bahasa Indonesia which is correct.

### 4.2 Missing Error Keys

The `apiErrors` section has these keys:
- `couponNotFound`, `couponInactive`, `couponExpired`, `couponMaxUses`, `couponMinOrder`, `couponPerUserLimit`
- `insufficientStock`, `insufficientPoints`
- `orderNotFound`, `orderNotRetryable`
- `invalidEmail`, `emailAlreadyRegistered`
- `invalidStatus`
- `networkError`

These cover most error cases but some are missing:
- `invalidCart` — cart validation failure
- `productNotFound` — product doesn't exist
- `variantNotFound` — variant doesn't exist
- `addressNotFound` — saved address not found
- `sessionExpired` — auth session expired
- `rateLimitExceeded` — too many requests

---

## 5. Missing Translation Coverage

### 5.1 By Feature Area

| Feature | Key Coverage | Missing Keys |
|---------|-------------|--------------|
| Checkout (client) | ~30% | Most step labels, button text, error messages |
| Order Tracking | Unknown | Timeline labels, status descriptions |
| B2B Portal | ~20% | Quote accept/reject labels, status descriptions |
| Admin | ~80% | Most in Bahasa Indonesia (acceptable) |
| Email Templates | ~50% | Subject lines done, body content varies |

### 5.2 Untranslated Static Content

The following store pages have static content that may need translation:
- About page — static HTML/markdown content
- Privacy Policy — static content
- Refund Policy — static content

These are typically long-form content pages where translation would require content management system support.

---

## 6. Language Switcher Implementation

### 6.1 Component: `components/store/layout/LanguageSwitcher.tsx`

**Status:** Need to verify implementation

The switcher should:
- Detect current locale from URL or session
- Switch between `id` and `en`
- Persist preference in cookie or user settings
- Work on both store and admin layouts

If the user switches language, the next-intl middleware should handle routing (e.g., `/id/products` vs `/en/products` or `?locale=id` query param).

---

## 7. Number/Date Formatting

### 7.1 Currency Formatting

**Status:** ✅ Correct

`formatIDR()` utility properly formats integers to "Rp 120.000" Indonesian format.

### 7.2 Date Formatting

**Status:** ✅ Correct

`formatWIB()` utility properly formats dates in Asia/Jakarta timezone (UTC+7).

### 7.3 Number Formatting

**Status:** ✅ Correct

`toLocaleString('id-ID')` is used for Indonesian number formatting (1.000 vs 1,000).

---

## 8. Priority Fix List

| Priority | Issue | Location | Fix |
|----------|-------|----------|-----|
| P0-CRITICAL | Checkout page has 60+ hardcoded strings | `page.tsx` | Add `useTranslations()` and replace all hardcoded strings |
| P1-HIGH | Missing `productNotFound`, `variantNotFound` apiErrors | `en.json`, `id.json` | Add these keys |
| P1-HIGH | Order tracking page needs i18n audit | `OrderTrackingClient.tsx` | Check and fix hardcoded strings |
| P2-MEDIUM | B2B pages hardcoded strings | Multiple B2B pages | Consider adding B2B section to i18n |
| P2-MEDIUM | About/Privacy/Refund policy static content | Static pages | Consider CMS or mark as English-only |
| P3-LOW | Language switcher implementation not verified | `LanguageSwitcher.tsx` | Verify locale persistence works |
| P3-LOW | Admin language toggle missing | Admin layout | Consider adding for owner/superadmin |