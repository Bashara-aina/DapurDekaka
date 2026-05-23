# Audit 16 — i18n & Translations Deep Audit

**Auditor:** Deep Code Audit Agent  
**Date:** 2026-05-23  
**Scope:** `i18n/messages/en.json`, `i18n/messages/id.json`, all components using hardcoded strings  
**Standard:** Every user-facing string must use next-intl; language toggle must work on every page  

---

## SUMMARY

| Severity | Count |
|---|---|
| CRITICAL | 4 |
| HIGH | 5 |
| MEDIUM | 9 |
| LOW | 4 |

---

## SECTION 1: TRANSLATION MISMATCHES (en.json vs id.json)

### CRITICAL-01: `successOrderNumber` — English in Indonesian Translation

**en.json line 101:** `"successOrderNumber": "Order number",`  
**id.json line 101:** `"successOrderNumber": "Order number",` ← SAME AS ENGLISH

**Problem:** Indonesian translation is identical to English. Should be "Nomor Pesanan".

**File:** `app/(store)/checkout/success/page.tsx` line 62 — `{t('successOrderNumber')}`

**Fix:** Update `id.json` line 101:
```json
"successOrderNumber": "Nomor Pesanan",
```

---

### CRITICAL-02: `loadingMidtrans` / `retryTokenError` / `midtransNotLoaded` — NOT TRANSLATED

**en.json line 94:** `"loadingMidtrans": "Loading...",`  
**id.json line 94:** `"loadingMidtrans": "Loading...",` ← ENGLISH IN ID

**en.json line 115:** `"midtransNotLoaded": "Midtrans not loaded yet. Please try again in a moment.",`  
**id.json line 115:** `"midtransNotLoaded": "Midtrans not loaded yet. Please try again in a moment.",` ← ENGLISH IN ID

**en.json line 116:** `"retryTokenError": "Failed to create new payment token",`  
**id.json line 116:** `"retryTokenError": "Failed to create new payment token",` ← ENGLISH IN ID

**Files:** `app/(store)/checkout/pending/page.tsx` lines 252, 126-127

**Fix:** Add to `id.json`:
```json
"loadingMidtrans": "Memuat...",
"midtransNotLoaded": "Midtrans belum dimuat. Silakan coba beberapa saat lagi.",
"retryTokenError": "Gagal membuat token pembayaran baru"
```

---

### CRITICAL-03: `havingTrouble` — Mixed English in Indonesian

**en.json line 96:** `"havingTrouble": "Having trouble? Contact us via WhatsApp for assistance.",`  
**id.json line 96:** `"havingTrouble": "Having trouble? Hubungi kami via WhatsApp untuk bantuan.",`

**Problem:** Indonesian version has English "Having trouble?" mixed with Indonesian. Visible on checkout pending page.

**Fix:** `id.json` line 96:
```json
"havingTrouble": "Mengalami kendala? Hubungi kami via WhatsApp untuk bantuan."
```

---

### CRITICAL-04: OrderTrackingClient — ZERO useTranslations Usage

**File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx`

**Finding:** Entire component (600+ lines) uses NO `useTranslations`. ~40+ strings hardcoded in Indonesian. Every Indonesian user sees hardcoded strings while the rest of the app uses i18n. Language toggle has zero effect on this page.

**Hardcoded strings include:**
- `'Gagal memuat data pesanan'` (line ~98)
- `'Email tidak cocok dengan pesanan'` (line ~123)
- `'Terjadi kesalahan saat verifikasi'` (line ~126)
- `'Dapur Dekaka'` (line ~139)
- `'Lacak Pesanan'` (line ~141)
- `'Nomor Pesanan'` (line ~151)
- `'Verifikasi Email'` (line ~177)
- `'Masukkan email...'` (line ~180)
- `'Email'` (line ~187)
- `'nama@email.com'` (line ~194)
- `'Memverifikasi...'` (line ~209)
- `'Verifikasi'` (line ~209)
- `'Status Pesanan'` (line ~221)
- `'Item Pesanan'` (line ~232)
- `'Informasi Pengiriman'` (line ~259)
- `'Penerima'` (line ~264)
- `'No. HP'` (line ~270)
- `'Alamat'` (line ~277)
- `'Kurir'` (line ~284)
- `'No. Resi'` (line ~290)
- `'Metode'` (line ~298)
- `'Ringkasan Pembayaran'` (line ~307)
- `'Subtotal'` (line ~311)
- `'Diskon'` (line ~317)
- `'Points Digunakan'` (line ~323)
- `'Ongkos Kirim'` (line ~329)
- `'Total'` (line ~335)
- `'Poin Didapat'` (line ~341)
- `'Detail Pesanan'` (line ~357)
- `'Verifikasi email untuk melihat detail pesanan lengkap'` (line ~359)
- All `STATUS_TIMELINE` labels (lines 51-57)
- All `TIMELINE_STEPS` descriptions (lines 60-67)

**Fix:** Refactor entire component to use `const t = useTranslations('checkout')` for all labels. Add missing keys to i18n files. Extract timeline labels to constants file with i18n wrapping.

---

## SECTION 2: HIGH PRIORITY i18n GAPS

### HIGH-01: `net30Redirect` — English in Indonesian

**en.json line 114:** `"net30Redirect": "B2B Net-30 order is being processed...",`  
**id.json line 114:** `"net30Redirect": "B2B Net-30 order is being processed...",` ← ENGLISH IN ID

**Fix:** `id.json`:
```json
"net30Redirect": "Pesanan B2B Net-30 sedang diproses...",
```

---

### HIGH-02: Checkout Pages — Major i18n Gaps

**Files:**
- `app/(store)/checkout/page.tsx` — hardcoded strings throughout
- `app/(store)/checkout/pending/page.tsx` — hardcoded error messages
- `app/(store)/checkout/failed/page.tsx` — hardcoded WhatsApp text
- `app/(store)/checkout/success/page.tsx` — emoji + hardcoded `poin` string

These are the highest-traffic conversion pages. Every string must use i18n.

**Fix:** Audit every string against translation keys. Add missing keys.

---

### HIGH-03: Account Pages — Hardcoded Strings Throughout

**Files:**
- `app/(store)/account/page.tsx`
- `app/(store)/account/addresses/page.tsx`
- `app/(store)/account/orders/page.tsx`
- `app/(store)/account/points/page.tsx`
- `app/(store)/account/vouchers/page.tsx`

Form labels, placeholders, status labels all hardcoded.

---

### HIGH-04: Cart Page — Hardcoded Strings

**File:** `app/(store)/cart/page.tsx`

Cart item labels, empty cart message, coupon input placeholder, points input placeholder, checkout button.

---

### HIGH-05: CheckoutStepper — aria-label Hardcoded

**File:** `components/store/checkout/CheckoutStepper.tsx` line 43

**Code:**
```typescript
aria-label={`Langkah ${idx + 1}: ${step.label}`}
```

**Problem:** `Langkah` is Indonesian hardcoded in a reusable component. `step.label` comes from props and is i18n-ready, but the wrapper is not.

**Fix:**
```typescript
const t = useTranslations('checkout');
aria-label={`${t('stepNumber', { n: idx + 1 })} ${step.label}`}
```

Add to i18n: `"stepNumber": "Langkah {n}"`

---

## SECTION 3: MEDIUM PRIORITY i18n GAPS

### MEDIUM-01: `passwordReset` Email Subject — English in Indonesian

**en.json line 331:** `"passwordReset": "Reset Password — Dapur Dekaka",`  
**id.json line 331:** `"passwordReset": "Reset Password — Dapur Dekaka",` ← ENGLISH IN ID

**Fix:** `id.json`:
```json
"passwordReset": "Atur Ulang Kata Sandi — Dapur Dekaka",
```

---

### MEDIUM-02: `apiErrors` Namespace Missing Keys

**en.json / id.json** — `apiErrors` section missing:
- `emailNotMatch` — used in OrderTrackingClient line 123 — currently hardcoded `'Email tidak cocok dengan pesanan'`
- `orderNotPaid` — used when order status is not 'paid' for email verification
- `invalidPhone` — used in phone validation
- `couponAlreadyUsed` — separate from `couponMaxUses`

---

### MEDIUM-03: `checkout` Namespace Missing Keys

**en.json / id.json** `checkout` section missing:
- `stepOrderCreated` / `stepPaymentReceived` / `stepBeingPrepared` / `stepReadyToShip` / `stepOutForDelivery` / `stepComplete` — timeline step labels
- `stepOrderCreatedDesc` / etc. — step descriptions
- `emailVerificationRequired` — used in OrderTrackingClient
- `enterEmailToTrack` — used in OrderTrackingClient

---

### MEDIUM-04: `auth` Namespace Missing Keys

**en.json / id.json** `auth` section missing:
- `emailPlaceholder` — `"nama@email.com"` hardcoded in OrderTrackingClient
- `phoneLabel` — `"No. HP"` hardcoded in OrderTrackingClient

---

### MEDIUM-05: `account` Namespace Missing Keys

**en.json / id.json** `account` section potentially missing:
- `orderNumber` — column header in order history
- `orderDate` — column header
- `pointsUnit` — needed for `poin` in checkout/success (currently hardcoded)

---

### MEDIUM-06: Homepage Metadata Not Locale-Aware

**File:** `app/(store)/page.tsx` lines 17-63

**Problem:** `metadata` object has hardcoded Indonesian title/description. For a bilingual site, metadata should be generated per locale using `generateMetadata` with `getTranslations`.

**Fix:**
```typescript
export async function generateMetadata({ params }) {
 const t = await getTranslations('metadata');
 return {
  title: t('homeTitle'),
  description: t('homeDescription'),
 };
}
```

---

### MEDIUM-07: Blog Pages — Hardcoded Strings

**Files:**
- `app/(store)/blog/page.tsx` — "Baca Selengkapnya", "Kategori", date formatting
- `app/(store)/blog/[slug]/page.tsx` — all content strings

---

### MEDIUM-08: Product Pages — Hardcoded Strings

**Files:**
- `app/(store)/products/page.tsx` — filter labels, sort labels, "Tersedia", "Habis"
- `app/(store)/products/[slug]/page.tsx` — product detail strings

---

### MEDIUM-09: About Page — Hardcoded Meta and Content

**File:** `app/(store)/about/page.tsx`

**Problem:** Metadata and page content not locale-aware.

---

## SECTION 4: LOW PRIORITY i18n ISSUES

### LOW-01: `poin` Unit Hardcoded in Success Page

**File:** `app/(store)/checkout/success/page.tsx` line 75

**Code:**
```typescript
+{orderData.order.pointsEarned.toLocaleString('id-ID')} poin
```

**Problem:** `poin` is hardcoded Indonesian. English users see "100 poin" instead of "100 points".

**Fix:** Add `"pointsUnit": "poin"` (id) / `"pointsUnit": "points"` (en) to i18n, use `t('pointsUnit')`.

---

### LOW-02: BottomNav Blog Label Hardcoded

**File:** `components/store/layout/BottomNav.tsx`

**Code:** `label: 'Blog'` instead of `t('nav.blog')`

**Fix:** Use `t('nav.blog')`.

---

### LOW-03: `shipmentTracking` Email Subject — English in Indonesian

**en.json line 332:** `"shipmentTracking": "Order Shipped — Dapur Dekaka",`  
**id.json line 332:** `"shipmentTracking": "Pesanan Dikirim — Dapur Dekaka",` ✅ Correct

**Status:** This one is fine.

---

### LOW-04: `orderConfirmation` Email Subject — Correct

**en.json line 330:** `"orderConfirmation": "Order Confirmation",` ✅  
**id.json line 330:** `"orderConfirmation": "Konfirmasi Pesanan",` ✅  

**Status:** Correct.

---

## SECTION 5: TRANSLATION QUALITY NOTES

### `failedContactWhatsApp` — CORRECT ✅

**en.json line 113:** `"failedContactWhatsApp": "If the problem persists, please contact us via WhatsApp.",`  
**id.json line 113:** `"failedContactWhatsApp": "Jika masalah berlanjut, silakan hubungi kami via WhatsApp.",` ✅

### `storeAddressLine` and `storeCity` — ACCEPTABLE ✅

**en.json line 64:** `"storeAddressLine": "Jl. Sinom V No. 7, Turangga",`  
**id.json line 64:** `"storeAddressLine": "Jl. Sinom V No. 7, Turangga",` — Both same (Indonesian address). Address data doesn't need translation.

---

## SECTION 6: COMPONENT-LEVEL I18N AUDIT SUMMARY

| Component | i18n Status | Issue Count |
|---|---|---|
| OrderTrackingClient | ❌ ZERO usage | ~40 hardcoded strings |
| CheckoutStepper | ⚠️ Partial | aria-label hardcoded |
| Checkout pending page | ⚠️ Partial | 3 keys missing in id.json |
| Checkout success page | ⚠️ Partial | `poin` hardcoded |
| Navbar | ✅ Good | — |
| Footer | ✅ Good | — |
| BottomNav | ✅ Mostly good | blog label hardcoded |
| ProductCard | ✅ Good | — |
| CartDrawer | ✅ Good | — |
| Homepage | ⚠️ Partial | metadata not locale-aware |
| Blog listing | ⚠️ Partial | hardcoded labels |
| About page | ⚠️ Partial | metadata not locale-aware |

---

## MISSING i18n KEYS TO ADD

### id.json additions needed:

```json
// checkout section additions
"stepNumber": "Langkah {n}",
"stepOrderCreated": "Pesanan Dibuat",
"stepOrderCreatedDesc": "Pesanan Anda sedang diproses",
"stepPaymentReceived": "Pembayaran Diterima",
"stepPaymentReceivedDesc": "Pembayaran berhasil. Tim kami sedang memproses pesanan Anda.",
"stepBeingPrepared": "Sedang Disiapkan",
"stepBeingPreparedDesc": "Produk sedang disiapkan dengan hati-hati.",
"stepReadyToShip": "Siap Dikirim",
"stepReadyToShipDesc": "Pesanan dikemas dan siap untuk pengiriman.",
"stepOutForDelivery": "Dalam Pengiriman",
"stepOutForDeliveryDesc": "Pesanan sedang dalam perjalanan ke alamat Anda.",
"stepComplete": "Selesai",
"stepCompleteDesc": "Pesanan telah diterima. Selamat menikmati!",

// apiErrors section
"emailNotMatch": "Email tidak cocok dengan pesanan",
"orderNotPaid": "Pesanan belum dibayar",
"invalidPhone": "Nomor telepon tidak valid",
"couponAlreadyUsed": "Kupon sudah digunakan pada pesanan ini",

// auth section
"emailPlaceholder": "nama@email.com",
"phoneLabel": "No. HP",

// checkout section
"pointsUnit": "poin",
"loadingMidtrans": "Memuat...",
"midtransNotLoaded": "Midtrans belum dimuat. Silakan coba beberapa saat lagi.",
"retryTokenError": "Gagal membuat token pembayaran baru",
"net30Redirect": "Pesanan B2B Net-30 sedang diproses...",

// Fix existing wrong translations
"successOrderNumber": "Nomor Pesanan",
"havingTrouble": "Mengalami kendala? Hubungi kami via WhatsApp untuk bantuan.",
"passwordReset": "Atur Ulang Kata Sandi — Dapur Dekaka",
```

---

## PRIORITY FIX ROADMAP

### Week 1 — P0
1. **OrderTrackingClient** — Full refactor with `useTranslations` (~40 strings)
2. **id.json** — Fix `successOrderNumber`, `havingTrouble`, `loadingMidtrans`, `retryTokenError`, `midtransNotLoaded`, `net30Redirect`
3. **id.json** — Add missing `apiErrors` keys: `emailNotMatch`

### Week 2 — P1
4. **CheckoutStepper** — Fix `aria-label` to use i18n
5. **id.json** — Add `pointsUnit` key
6. **id.json** — Add missing `auth` keys: `emailPlaceholder`, `phoneLabel`
7. **Checkout pages** — Audit all strings for i18n gaps

### Week 3 — P2
8. **App store page** — Use `generateMetadata` with `getTranslations` for locale-aware SEO
9. **id.json** — Fix `passwordReset` email subject
10. **Account pages** — Audit and fix all hardcoded strings
11. **Blog pages** — Fix hardcoded labels

### Week 4 — P3
12. **Cart page** — Fix all hardcoded strings
13. **Product pages** — Fix all hardcoded strings
14. **BottomNav** — Fix blog label to use i18n
15. **About page** — Fix metadata not locale-aware