# AUDIT 06 — COMPLIANCE AND DEPLOYMENT
DapurDekaka.com — Legal Compliance, SEO, Deployment Configuration, and Edge Case Audit
Date: May 2026 | Auditor: Claude Code | Scope: Halal Display, Price Compliance, Privacy, SEO, Deployment, Edge Cases

---

## LEGEND

```
✅ Implemented & correct
⚠️ Partially implemented or has a bug
❌ Not implemented (stub / placeholder)
🔴 Critical — blocks real usage
🟡 Major — significant UX or business impact
🟢 Minor — nice-to-have improvement
```

---

## SECTION 1 — LEGAL & REGULATORY

### 1.1 Halal Certification Display

**Finding:** `⚠️ Partially implemented — certificate number not displayed`

- `HalalBadge` component renders the halal image badge at `components/store/common/HalalBadge.tsx:7-19`
- Badge appears on `ProductCard` at line 60 (`components/store/products/ProductCard.tsx:60`)
- Badge appears on `ProductDetailClient` at line 78 (`components/store/products/ProductDetailClient.tsx:78`) — but only when `product.isHalal` is truthy (conditional render)
- Badge is rendered from `/public/assets/logo/halal.png` — image file exists at that path
- **No certificate number is displayed anywhere** — this is legally required in Indonesia for halal-labeled products. MUI certification number should be visible near or below the badge
- Footer (`components/store/layout/Footer.tsx:77`) shows text "Halal" but no certificate reference

**Code fix needed for ProductDetailClient:**
```tsx:components/store/products/ProductDetailClient.tsx
<div className="absolute top-4 right-4 flex flex-col gap-2">
  {product.isHalal && <HalalBadge />}
  {product.isHalal && product.halalCertificateNumber && (
    <span className="text-[10px] text-text-muted bg-white/60 px-1 rounded">
      MUI {product.halalCertificateNumber}
    </span>
  )}
</div>
```

**Code fix needed for ProductCard** — add certificate number below badge overlay.

---

### 1.2 Price Display Compliance (Indonesian VAT)

**Finding:** `⚠️ Implemented but incomplete disclosure`

- All prices rendered via `formatIDR()` from `lib/utils/format-currency.ts` — correct IDR integer formatting
- Prices shown on `ProductCard:84`, `ProductDetailClient:139`, `CartSummary`, `OrderSummaryCard`
- **No VATInclusive or VATExclusive notice** is displayed anywhere on the store
- Indonesian law (PP No. 86 Tahun 2017) requires price displays for consumer goods to either show "sudah termasuk PPN" or clearly state if exclusive
- At minimum, a footer disclaimer or checkout notice is needed: *"Harga sudah termasuk PPN 11%"*
- The word "Rp" prefix in `formatIDR(120000)` → "Rp 120.000" is standard but doesn't satisfy the tax disclosure requirement on its own

**Fix:** Add VAT notice to checkout page and/or Footer legal section.

---

### 1.3 Return/Refund Policy

**Finding:** `❌ Not implemented — no refund policy page exists`

- `components/store/layout/Footer.tsx` has NO policy links whatsoever
- No page at `/refund`, `/return-policy`, `/kebijakan-pengembalian`, or similar
- No mention of frozen food return rules (frozen food is generally non-returnable due to food safety — this must be stated explicitly)
- This is a 🔴 critical legal gap — Indonesian Consumer Protection Law (UU 8/1999) requires clear return/refund policies to be accessible

**Action required:** Create a refund policy page (e.g., `app/(store)/refund-policy/page.tsx`) with:
- Statement that frozen food is non-returnable due to food safety
- Policy for damaged/incorrect items (photo evidence required)
- Refund timeline (1-7 working days)
- Link in Footer under "Bantuan" section

---

### 1.4 Consumer Data Privacy

**Finding:** `❌ Not implemented — no privacy policy page, no data retention flow`

- No privacy policy page at `/privacy`, `/kebijakan-privasi`, or similar
- No `privacyPolicy` content in schema or CMS
- User PII stored: `name`, `email`, `phone`, `address` in `users` and `addresses` tables (`lib/db/schema.ts:72-120`)
- `deletedAt` soft-delete exists on `users` table (`lib/db/schema.ts:85`) — accounts can be soft-deleted but there is **no documented data retention/deletion flow** for PII
- No GDPR-style "data deletion request" mechanism exists
- No consent banners for data collection (WhatsApp link pre-fills message — user may not know their chat is logged by WhatsApp)
- For Indonesian PDPA (UU 27/2022) compliance: must have privacy policy, consent mechanism, data retention limits

**Action required:**
1. Create privacy policy page with Indonesian language
2. Implement "delete account" flow that permanently anonymizes PII (not just soft-delete)
3. Add WhatsApp consent notice near WhatsAppButton: *"Chat ini akan tercatat di WhatsApp Business untuk keperluan Customer Service"*

---

### 1.5 WhatsApp Business Compliance

**Finding:** `⚠️ Partially implemented — no consent or disclaimer`

- `WhatsAppButton` at `components/store/layout/WhatsAppButton.tsx:10-25` generates a pre-filled message: *"Halo Dapur Dekaka, saya ingin bertanya tentang..."*
- No disclaimer shown to user that the chat will be logged by WhatsApp Business
- No consent collection before opening WhatsApp chat
- `NEXT_PUBLIC_WHATSAPP_NUMBER` used from env var — WhatsApp Business should have business hours/disclaimer on the chat link

**Fix:** Add small tooltip or modal on first tap: *"Anda akan diarahkan ke WhatsApp. Chat ini tercatat untuk keperluan CS kami."*

---

## SECTION 2 — SEO AUDIT

### 2.1 Meta Tags

**Finding:** `✅ Homepage: good | ⚠️ Product listing: needs og:image | ❌ Blog listing: missing`

| Page | Title | Description | Keywords | OG Tags | Issue |
|------|-------|-------------|----------|---------|-------|
| `app/(store)/page.tsx` | ✅ Unique | ✅ Unique | ✅ Indonesian | ✅ Full OG | None |
| `app/(store)/products/page.tsx` | ✅ Unique | ✅ Unique | ✅ | ⚠️ Missing og:image | No og:image set |
| `app/(store)/products/[slug]/page.tsx` | ✅ Unique | ✅ Unique | ✅ | ✅ Full OG | None |
| `app/(store)/blog/page.tsx` | Not reviewed | Not reviewed | — | — | Needs check |
| `app/(store)/blog/[slug]/page.tsx` | ✅ Unique | ✅ Unique | ✅ | ✅ Full OG + `publishedTime` | None |
| `app/(b2b)/b2b/page.tsx` | Not reviewed | Not reviewed | — | — | Needs metadata |

---

### 2.2 Open Graph Tags

**Finding:** `⚠️ Most pages OK — products listing page missing og:image`

- `app/(store)/products/page.tsx:15-28` — No `openGraph.images` defined
- Homepage has proper Cloudinary OG image: `https://res.cloudinary.com/dapurdekaka/image/upload/v1/dapurdekaka/og-image.jpg`
- Product detail pages use first product image as OG image (`products/[slug]/page.tsx:50-57`)
- Blog posts use cover image as OG image (`blog/[slug]/page.tsx:44-51`)

**Fix:** Add og:image to products listing page pointing to a default catalog image or homepage OG image.

---

### 2.3 Structured Data (JSON-LD)

**Finding:** `❌ Not implemented — no JSON-LD schema anywhere`

- No `application/ld+json` script tags found across any store page
- Missing critical structured data:
  - **Organization schema** — required for Google Knowledge Panel
  - **Product schema** with `price`, `availability`, `image` — required for Google Shopping
  - **WebSite schema** with search box — enables Sitelinks search
  - **BreadcrumbList** for product pages — improves SERP appearance
- `app/(store)/products/[slug]/page.tsx` has the product data available server-side (line 77-84) but never renders JSON-LD

**Code fix for Product Detail page:**
```tsx:app/(store)/products/[slug]/page.tsx
export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  // ... existing data fetching ...
  
  const jsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.nameId,
    description: product.shortDescriptionId || product.descriptionId,
    image: product.images[0]?.cloudinaryUrl,
    offers: {
      '@type': 'Offer',
      price: selectedVariant?.price,
      priceCurrency: 'IDR',
      availability: selectedVariant?.stock > 0 
        ? 'https://schema.org/InStock' 
        : 'https://schema.org/OutOfStock',
    },
  };

  return (
    <div className="bg-brand-cream min-h-screen pb-20">
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      {/* ... rest of page */}
    </div>
  );
}
```

---

### 2.4 Sitemap

**Finding:** `✅ Implemented and correct`

- `app/sitemap.ts:8-86` generates comprehensive sitemap
- Includes: homepage, products (filtered by `isActive=true`), blog posts (filtered by `isPublished=true`), static pages
- Uses `product.updatedAt` for `lastModified`
- Has try/catch fallback for DB unavailability — graceful degradation
- Only missing: **B2B pages** (`/b2b`, `/b2b/products`) — add these to sitemap
- Only missing: **Account pages** are correctly excluded

---

### 2.5 robots.txt

**Finding:** `✅ Correctly configured`

- `app/robots.ts:3-19` properly blocks: `/api/`, `/admin/`, `/checkout/`, `/account/`, `/b2b/account/`
- Allows all public pages
- Points to `sitemap.xml` at correct URL
- NOTE: `/b2b/account/` is blocked but `/b2b/` is allowed — correct

---

### 2.6 Image SEO

**Finding:** `⚠️ Partial — alt text present but generic on some images`

- `ProductCard.tsx:53` uses `alt={product.nameId}` — ✅ good
- `ProductDetailClient.tsx:56` uses `alt={product.nameId}` — ✅ good
- Product images served from Cloudinary (proper CDN)
- Blog post images use `alt={post.titleId}` — ✅ good
- Some images in `InstagramFeed` or `HeroCarousel` may use generic filenames — check before production upload
- `ProductDetailClient.tsx:93` uses `alt=""` for thumbnail images (line 93) — should have descriptive alt text for thumbnails

---

### 2.7 Blog SEO

**Finding:** `⚠️ Implemented but Indonesian keyword optimization unknown`

- `blog/[slug]/page.tsx` has proper meta tags and `publishedTime` for Article schema
- `app/(store)/blog/page.tsx` likely has metadata — needs verification
- Internal linking within blog posts is unknown — requires content review
- `keywords` in metadata use general terms — consider adding location-based keywords ("Bandung", "Indonesia") for local SEO

---

## SECTION 3 — DEPLOYMENT AUDIT

### 3.1 Vercel Configuration

**Finding:** `✅ vercel.json configured correctly`

- `vercel.json:1-24` has `framework: "nextjs"` — correct
- **Cron jobs configured** (lines 3-15):
  - `*/5 * * * *` — `/api/cron/cancel-expired-orders` (every 5 min)
  - `0 18 * * *` — `/api/cron/expire-points` (daily 6 PM WIB = 11:00 UTC)
  - `0 2 * * *` — `/api/cron/points-expiry-warning` (daily 2 AM UTC = 9 AM WIB)
- **Function timeouts** (lines 17-23): 30s max for webhook and checkout/initiate — appropriate
- Missing: **regions** config — for a production app, consider setting `regions: ['sin1']` (Singapore) or Vercel's closest region to Indonesia for lower latency

---

### 3.2 Env Vars in Vercel

**Finding:** `✅ .env.example exists — needs verification in Vercel dashboard`

- `.env.example:1-37` has ALL required env vars documented:
  - `DATABASE_URL`, `DATABASE_URL_UNPOOLED`
  - `AUTH_SECRET`, `AUTH_GOOGLE_ID`, `AUTH_GOOGLE_SECRET`
  - `MIDTRANS_SERVER_KEY`, `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY`, `MIDTRANS_IS_PRODUCTION`
  - `RAJAONGKIR_API_KEY`
  - `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
  - `RESEND_API_KEY`, `RESEND_FROM_EMAIL`
  - `MINIMAX_API_KEY`, `MINIMAX_GROUP_ID`
  - `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`
  - `SEED_ADMIN_EMAIL`, `SEED_ADMIN_PASSWORD`
  - `CRON_SECRET` — ⚠️ **CRON_SECRET is missing from `.env.example`** — this must be added since `lib/utils/cron-auth.ts:13` requires it

**Critical gap:** `.env.example` does NOT include `CRON_SECRET`. Add:
```
CRON_SECRET=your-random-cron-secret-here
```

---

### 3.3 next.config.js

**Finding:** `✅ No breaking overrides — good configuration`

- `next.config.ts:48-74` config is production-ready
- `images.remotePatterns` includes Cloudinary and Google OAuth — ✅ correct
- `experimental.optimizePackageImports` for lucide-react, recharts, radix-ui — ✅ performance win
- CSP headers configured — ✅ security positive
- All security headers (HSTS, X-Frame-Options, etc.) are properly set — ✅ good
- No `next/image` domain misconfigurations found

---

### 3.4 Build Size

**Finding:** `🟢 Likely OK — no direct measurement, but pattern is good`

- `.next/` is gitignored (standard Next.js setup) — ✅ not checked in
- No evidence of large binaries or assets in codebase
- `optimizePackageImports` in next.config.ts reduces bundle — ✅ good
- `recharts` is only loaded where used (deferred) — ✅ tree-shakeable
- **Recommendation:** Run `npm run build` locally and check `.next/static` size before first production deploy. Target <50MB for client bundle.

---

### 3.5 Cron/Scheduled Jobs

**Finding:** `✅ Cron jobs properly configured via Vercel`

- `vercel.json` cron schedules match the three API routes:
  1. `cancel-expired-orders` — `app/api/cron/cancel-expired-orders/route.ts:14-146`
  2. `expire-points` — `app/api/cron/expire-points/route.ts`
  3. `points-expiry-warning` — `app/api/cron/points-expiry-warning/route.ts`
- All three cron routes protected by `verifyCronAuth()` from `lib/utils/cron-auth.ts`
- **Vercel Cron caveat:** Vercel Cron uses UTC. The schedule `0 18 * * *` is 18:00 UTC = 01:00 WIB (next day) — not 9 AM WIB as intended. Adjust schedule to `0 2 * * *` for 9 AM WIB. Similarly, `0 2 * * *` UTC = 09:00 WIB — this seems intentional for points expiry warning. Double-check the timezone conversion:
  - `0 18 * * *` UTC = 01:00 WIB next day (likely wrong for cancel-expired orders)
  - `0 2 * * *` UTC = 09:00 WIB (correct for points warning)
  
**Fix:** Change cancel-expired cron to `0 7 * * *` for 14:00 WIB or adjust based on business hours.

---

### 3.6 Rollback Plan

**Finding:** `❌ No documented rollback procedure`

- No `ROLLBACK.md` or deployment runbook exists
- No documented procedure in the codebase for:
  - Reverting to previous Vercel deployment
  - Database rollback steps
  - Midtrans payment gateway rollback
- Recommended: Add a `DEPLOYMENT.md` or `RUNBOOK.md` covering:
  1. How to rollback via `vercel-cli`: `vercel rollback [deployment-url]`
  2. How to rollback database migrations
  3. Emergency contacts (Midtrans support, Vercel support)
  4. How to disable the site entirely if critical issue

---

## SECTION 4 — EDGE CASE AUDIT

### 4.1 Concurrent Stock Deduction

**Finding:** `✅ Correctly handled — atomic pattern with affected row check`

- `app/api/webhooks/midtrans/route.ts:82-95` uses the atomic `GREATEST(stock - qty, 0)` pattern
- Line 92-93: `sql`stock >= ${item.quantity}`` ensures stock check is atomic
- Lines 97-101: If `result[0]` is falsy (no rows returned), the variant is skipped with a warning — does NOT throw/rollback
- ⚠️ **Bug:** If one variant in an order fails (zero stock), the other variants still get their stock deducted and order marked paid. This is a partial fulfillment risk.
- **Fix needed:** Wrap the entire item loop in the transaction and throw if any item fails:

```tsx:app/api/webhooks/midtrans/route.ts
for (const item of order.items) {
  const result = await tx
    .update(productVariants)
    .set({ stock: sql`GREATEST(stock - ${item.quantity}, 0)`, updatedAt: new Date() })
    .where(and(eq(productVariants.id, item.variantId), sql`stock >= ${item.quantity}`))
    .returning({ newStock: productVariants.stock });
  
  if (result.length === 0) {
    throw new Error(`Insufficient stock for variant ${item.variantId}`);
  }
  // ... rest of inventory log
}
```

---

### 4.2 Payment Expiry Race (16 minutes after order)

**Finding:** `✅ Correctly handled with double-check pattern`

- `app/api/cron/cancel-expired-orders/route.ts:40-63` has Midtrans double-check before cancelling
- Line 44: `checkTransactionStatus()` queries Midtrans before cancelling
- If Midtrans reports `settlement` or `capture`, the order is skipped (line 47-55)
- This means a payment that arrives within milliseconds of the cron check won't be incorrectly cancelled
- For the scenario: payment at minute 16 (past the 15-minute expiry): if the cron runs at minute 16+, it will check Midtrans first and skip cancellation if payment actually went through. ✅ correct

---

### 4.3 Retry Payment Logic

**Finding:** `✅ Correctly implemented**

- `app/api/checkout/retry/route.ts:34-93` correctly implements retry:
  - Line 34: Max 3 retries check
  - Line 45: New `midtransOrderId` = `${orderNumber}-retry-${retryCount}` — old token is orphaned
  - Line 91: New `paymentExpiresAt` set to 15 minutes from retry time
  - Line 90: `paymentRetryCount` incremented and saved
- Old Midtrans snap_token becomes invalid when new one is created — ✅ correct (Midtrans behavior)
- `app/(store)/checkout/pending/page.tsx` likely shows retry UI — needs frontend verification

---

### 4.4 Coupon Race Condition

**Finding:** `⚠️ Partial — server-side validation exists but not atomic with order creation`

- `app/api/checkout/initiate/route.ts:149-151` checks `coupon.maxUses && coupon.usedCount >= coupon.maxUses` BEFORE order creation
- But `coupon.usedCount` is incremented in the **Midtrans webhook** (`app/api/webhooks/midtrans/route.ts:113-118`) — AFTER payment settlement
- This means two simultaneous checkout initiations with the same single-use coupon can both pass the check at line 149, create two orders, but only one payment will settle. The other order gets cancelled via the expiry cron, but this creates a bad UX (order created then cancelled after payment attempt)
- **Fix:** Use database-level locking or `SELECT FOR UPDATE` when checking coupon availability in `initiate`. Or increment `usedCount` tentatively at initiate time (with reversal on payment failure/cancel).

---

### 4.5 Cart Item Removed During Checkout

**Finding:** `⚠️ Partially handled — stock re-checked but not product existence`

- `app/api/checkout/initiate/route.ts:93-101` re-fetches variant from DB and checks stock
- If variant `stock < quantity` → returns 409 conflict error (line 97-101)
- If variant doesn't exist → returns conflict (line 94-96)
- **Missing check:** Product `isActive` or `deletedAt` is NOT checked in initiate route. If a product is soft-deleted mid-checkout, the order can still be created but the product will be invisible in the store.
- **Fix:** Add `eq(products.isActive, true)` check or at minimum check `productVariants.isActive` (already filtered in initiate at line 87 via `db.query.productVariants.findMany` without isActive filter — variants don't have isActive in the current schema design)

---

### 4.6 Session Expiration Mid-Checkout

**Finding:** `🟢 Not applicable — guest checkout supported`

- Checkout (`app/(store)/checkout/page.tsx`) supports guest checkout (no session required for initiate)
- `app/api/checkout/initiate/route.ts:203` allows `userId: session?.user?.id ?? null` — ✅ guest checkout works
- Session is only needed for logged-in features (points redemption, saved addresses)
- Therefore session expiry during checkout does NOT break the payment flow for guests or logged-in users who don't redeem points

---

### 4.7 Order Number Collisions

**Finding:** `⚠️ Low risk but not fully collision-proof**

- `lib/utils/generate-order-number.ts:8-11` generates: `DDK-YYYYMMDD-XXXX` format
- Line 191 of `app/api/checkout/initiate/route.ts` uses `Math.floor(1000 + Math.random() * 9000)` for the 4-digit sequence
- **Problem:** Random 1000-9999 = only 9000 possible values per day. Two orders created in the same second with the same random value will have the same order number.
- **Fix:** Use a true sequence counter (from a database counter table or Redis INCR) instead of `Math.random()`. Alternatively use `crypto.randomUUID()` or nanoid for the suffix.

```typescript
// Better: use atomic DB counter
const seq = await db.query.orderSequence.findFirst({ 
  where: eq(orderSequence.date, today) 
});
const nextSeq = (seq?.value ?? 0) + 1;
// Then update sequence
```

---

### 4.8 Zero-Stock Display

**Finding:** `✅ Correctly implemented on both card and detail page`

- `ProductCard.tsx:61-65` — shows "HABIS" badge when `variant.stock === 0`
- `ProductCard.tsx:67-71` — shows `<StockBadge>` when `stock < 5` (orange "Tersisa X pcs")
- `ProductDetailClient.tsx:78` — HalalBadge shown
- `ProductDetailClient.tsx:120` — variant button disabled when `stock === 0`
- `ProductDetailClient.tsx:126` — out-of-stock styled with disabled appearance
- `ProductDetailClient.tsx:145` — `StockBadge` rendered for detail page
- ✅ "Habis" badge (line 194: `'Stok Habis'`) shown on Add to Cart button

---

### 4.9 Admin Action Audit Trail

**Finding:** `✅ Implemented via orderStatusHistory and inventoryLogs — but partial for admin actions`

- `orderStatusHistory` table (`lib/db/schema.ts:295`) records ALL order status changes with `changedByType: 'system' | 'admin' | 'user'`
- `inventoryLogs` table (`lib/db/schema.ts`) records all stock changes with `changedByUserId`
- `app/api/admin/field/inventory/adjust/route.ts:49-57` logs manual inventory adjustments with `changedByUserId` and `changeType: 'manual'`
- **Gaps:**
  - `orderStatusHistory.changedByUserId` is populated but I could not verify it's consistently set for admin role changes in all admin routes
  - No `admin_activity_log` table for tracking admin logins, page views, or settings changes
  - Admin settings changes (`/admin/settings`) — no audit log if a superadmin changes a system setting
  - No tracking of coupon creation/modification by admin

**Recommendation:** Consider adding a `systemSettingsAuditLog` table or at minimum log settings changes to `inventoryLogs` (abusing its purpose) or create a dedicated log table for admin-only actions.

---

## SUMMARY TABLE

| Area | Finding | Severity | Status |
|------|---------|----------|--------|
| Halal badge | Badge exists, no certificate number | 🟡 Major | ⚠️ Partial |
| Price VAT display | No PPN notice | 🟡 Major | ⚠️ Partial |
| Refund policy | No page exists | 🔴 Critical | ❌ Missing |
| Privacy policy | No page exists | 🔴 Critical | ❌ Missing |
| WhatsApp consent | No disclaimer | 🟡 Major | ⚠️ Partial |
| JSON-LD schema | No structured data | 🟡 Major | ❌ Missing |
| OG image (products) | Missing on listing page | 🟢 Minor | ❌ Missing |
| robots.txt | ✅ Correct | — | ✅ OK |
| Sitemap | ✅ Good, missing B2B | 🟢 Minor | ⚠️ Partial |
| Image alt text | Thumbnails use empty alt | 🟢 Minor | ⚠️ Partial |
| vercel.json | ✅ Configured | — | ✅ OK |
| .env.example | Missing CRON_SECRET | 🔴 Critical | ❌ Missing |
| next.config.js | ✅ Production ready | — | ✅ OK |
| Cron timezone | Wrong timezone for one cron | 🟡 Major | ⚠️ Bug |
| Rollback plan | No documentation | 🟡 Major | ❌ Missing |
| Concurrent stock | Partial fulfillment risk | 🟡 Major | ⚠️ Bug |
| Coupon race | Non-atomic with order | 🟡 Major | ⚠️ Partial |
| Product deleted | Not checked in checkout | 🟡 Major | ⚠️ Gap |
| Order number | Random collision risk | 🟡 Major | ⚠️ Bug |
| Admin audit | Partial coverage | 🟡 Major | ⚠️ Partial |

---

## TOP PRIORITY ACTIONS (Before Launch)

1. **🔴 Create refund policy page** — frozen food return rules mandatory
2. **🔴 Create privacy policy page** — Indonesian PDPA compliance
3. **🔴 Add CRON_SECRET to `.env.example`** — cron auth will fail without it
4. **🔴 Add PPN 11% notice** to checkout page or footer
5. **🟡 Add JSON-LD Product + Organization schema** — Google SEO requirement
6. **🟡 Fix order number entropy** — use DB sequence instead of Math.random
7. **🟡 Fix cancel-expired cron timezone** — adjust `0 18 * * *` to correct WIB hour
8. **🟡 Add WhatsApp chat consent disclaimer**
9. **🟡 Add halal certificate number** to badge display
10. **🟢 Document rollback procedure** in RUNBOOK.md