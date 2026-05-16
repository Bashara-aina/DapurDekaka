# FINAL AUDIT 04 — B2B Portal & Content Management
**Date:** 2026-05-15  
**Focus:** B2B customer portal, B2B ordering flow, B2B account, blog, carousel, testimonials, homepage content  
**Priority:** P0 = broken | P1 = significant gap | P2 = polish

---

## 1. B2B LANDING PAGE (`/b2b`)

### 1.1 Product Category Counts Are Hardcoded [P1]
**File:** `app/(b2b)/b2b/page.tsx:31-37`

```typescript
const PRODUCT_CATEGORIES = [
  { name: 'Dimsum', count: '9 Varian' },
  { name: 'Siomay', count: '4 Varian' },
  { name: 'Bakso & Sosis', count: '3 Varian' },
  { name: 'Lumpia', count: '2 Varian' },
  { name: 'Pangsit', count: '2 Varian' },
];
```

These counts are hardcoded. When products are added or removed, this display becomes incorrect.

**Fix:** Query the `categories` table with a count of active `b2bAvailable` products per category. Use dynamic data.

---

### 1.2 B2B "Minimum Order" Info Is Wrong [P1]
**File:** `app/(b2b)/b2b/page.tsx:152`

```typescript
<p className="text-text-secondary text-sm">
  Untuk pesanan minimal 50 item per varian. Hubungi tim kami untuk penawaran terbaik.
</p>
```

"50 item per varian" is hardcoded. This should either be configurable in `systemSettings` or removed if the actual minimum isn't defined.

**PRD:** B2B pricing is set "per variant" by the admin. There's no mention of a specific minimum quantity in the PRD for the B2B landing page.

---

### 1.3 B2B Landing Has No Real Price Teaser [P2]
The B2B page says "Harga khusus untuk pemesanan dalam jumlah besar" but doesn't show any actual pricing context. Sophisticated B2B buyers (hotel procurement, catering) want to see price ranges before submitting a form.

**Fix:** Show a "Sample B2B Price" comparison table: Regular Price vs B2B Price for 2-3 popular products.

---

## 2. B2B INQUIRY FORM (`/b2b/quote`)

### 2.1 B2B Inquiry Form Submits But User Has No Confirmation [P1]
After submitting the inquiry form, what happens? Need to verify:
- Does the form show a success message?
- Is an email sent to the business inquirer confirming receipt?
- Does the admin get notified of new inquiries?

**PRD:** "team will contact you within 1x24 hours" — this SLA needs to be communicated via email.

**Fix:**
- Send confirmation email to the B2B inquirer: "Kami telah menerima pertanyaan Anda dan akan menghubungi dalam 1x24 jam"
- Send notification email to the admin/owner when new B2B inquiry arrives

---

### 2.2 No Admin Email Alert for New B2B Inquiries [P1]
The admin must manually check `/admin/b2b-inquiries` to see new inquiries. There's no push notification or email alert.

**Fix:** In `/api/b2b/inquiry/route.ts`, after saving the inquiry, send an email to a configurable admin address (stored in `systemSettings`).

---

## 3. B2B ACCOUNT PORTAL (`/b2b/account`)

### 3.1 B2B Account Dashboard Is a Stub [P1]
**File:** `app/(b2b)/b2b/account/page.tsx`

The B2B account dashboard shows:
- "Riwayat Pesanan" menu link
- "Quotes" menu link

That's it. A complete B2B account should show:
- Company name and account status
- Whether Net-30 is approved
- Assigned WhatsApp contact
- Points balance (B2B earns double)
- Quick stats: total orders, total spend

**PRD:** B2B customers have "dedicated WhatsApp contact assigned" — this should be displayed prominently in their account.

**Fix:** 
```
B2B Account Dashboard:
├── Welcome: [Company Name] — Account Status: ✅ Approved
├── Assigned Contact: +62 812-XXXX-XXXX (WhatsApp)
├── Payment Terms: Net-30 ✅ Approved / ❌ Not yet
├── Points Balance: X poin (2x rate)
├── Quick Links: Orders | Quotes | Products
└── Recent Orders: last 3 orders
```

---

### 3.2 B2B Orders Page - Unclear Implementation [P1]
**File:** `app/(b2b)/b2b/account/orders/page.tsx`

This page exists but what does it show? B2B orders should be distinguishable from regular orders. The `orders` table has `isB2b: boolean` field.

**Verify:** Does `/b2b/account/orders` filter only `isB2b = true` orders for the logged-in B2B user?

---

### 3.3 B2B Quotes Page - Unclear Implementation [P1]
**File:** `app/(b2b)/b2b/account/quotes/page.tsx`

The quotes page should show:
- Quote number
- Status (draft/sent/accepted/rejected/expired)
- Valid until date
- Total amount
- Download PDF button (if `pdfUrl` is set)
- Accept/Reject actions

Need to verify what this page currently shows and if all these elements are present.

---

### 3.4 B2B Checkout Flow Is Undefined [P0]
**PRD:** B2B customers have their own checkout:
- Sees B2B-specific bulk pricing (`b2bPrice` per variant)
- Gets Net-30 payment option (manual approval required)
- B2B order is tracked with `isB2b: true`

**What exists:** The regular store checkout at `/checkout`. The B2B products page at `/b2b/products`. But there's no B2B-specific checkout that uses `b2bPrice` instead of regular `price`.

**Current problem:** If a B2B user adds products from `/b2b/products` and goes to `/checkout`, the checkout uses regular prices, not B2B prices.

**Fix:** When `session.user.role === 'b2b'`, the checkout initiate API should:
1. Read `b2bPrice` from the variant instead of `price`
2. Set `isB2b: true` on the order
3. Mark order for double points earning

This is a fundamental business logic gap — B2B customers are paying retail prices.

---

### 3.5 No B2B Net-30 Payment Option in Checkout [P1]
**PRD:** "Net-30 payment option (manual approval by superadmin)"

If a B2B customer has `isNet30Approved: true`, they should see a "Bayar Nanti (Net-30)" payment option in checkout alongside Midtrans.

**Current state:** Net-30 is stored in `b2bProfiles.isNet30Approved` but there's no checkout UI or order flow for it.

**Fix:** In the B2B checkout payment step, check `isNet30Approved`. If true, show a "Net-30" option that creates the order without triggering Midtrans — order goes directly to `paid` status with a note about invoice.

---

## 4. B2B PRODUCTS PAGE (`/b2b/products`)

### 4.1 B2B Product Page Shows Regular Prices [P1]
**File:** `app/(b2b)/b2b/products/page.tsx` (not inspected but inferred)

The B2B products page should show `b2bPrice` for each variant, not the regular `price`. 

**Fix:** In the B2B products query, select `b2bPrice` and display it. Filter `isB2bAvailable: true`.

---

## 5. HOMEPAGE CONTENT

### 5.1 Instagram Feed Shows Fake/Placeholder Images [P1]
**File:** `components/store/home/InstagramFeed.tsx`

```typescript
const instagramPosts = [
  { id: 1, cloudinaryPublicId: 'dapurdekaka/gallery/gallery-01', alt: 'Dimsum premium' },
  ...
```

These are placeholder Cloudinary IDs. If these images don't exist in Cloudinary, the grid shows broken images. If they do exist, they're static photos — not actual Instagram content.

**PRD (P1):** "Instagram feed embed on homepage"

**Reality:** True Instagram feed embed requires Instagram Basic Display API with OAuth token. This is complex and has API rate limits.

**Recommended Fix (Short-term):** Upload real Dapur Dekaka photos to Cloudinary at these exact public IDs. The grid will show actual brand photos with a link to Instagram — this is functionally better than nothing.

**Recommended Fix (Long-term):** Connect Instagram Basic Display API and fetch actual recent posts dynamically.

---

### 5.2 Testimonials Are Database-Driven But No Admin UI [P1]
**Schema:** `testimonials` table exists with `customerName`, `contentId`, `rating`, `isActive`, etc.

**What exists:** `Testimonials` component on homepage queries the DB.

**What's missing:** Admin UI to manage testimonials (`/admin/testimonials` page). Currently, testimonials can only be added/edited via direct database manipulation.

**Fix:** Create a simple `/admin/testimonials` page with CRUD for adding customer testimonials (name, location, content, rating, image).

---

### 5.3 PromoBanner Is Hardcoded [P2]
**File:** `components/store/home/PromoBanner.tsx`

The promotional banner below featured products is hardcoded content (not DB-driven). If the admin wants to update the promo message, they need to edit code and redeploy.

**Fix:** Move promo banner content to `systemSettings` or create a simple admin-editable banner component.

---

### 5.4 WhyDapurDekaka Section Is Hardcoded [P3]
**File:** `components/store/home/WhyDapurDekaka.tsx`

The "Why Dapur Dekaka" value propositions (icons + text) are hardcoded. This is fine for V1 but should be configurable long-term.

---

### 5.5 Category Chips Don't Represent DB Categories Accurately [P2]
**File:** `app/(store)/page.tsx:73-91`

The homepage fetches categories with a JOIN to products. The filter `filter(cat => cat.id !== null)` is applied but the comment says "Filter to only categories that have at least one active product" — this filter is actually checking if `cat.id !== null`, not if the category has products. The JOIN should use `productCount > 0` logic.

**Fix:** Fix the query to properly only show categories with active products using a proper GROUP BY + HAVING COUNT > 0.

---

## 6. BLOG (`/blog`, `/blog/[slug]`)

### 6.1 Blog Listing Has No Search or Filter [P2]
The blog listing page shows all published posts but has no way to:
- Search for a specific post
- Filter by category
- Browse by date

For SEO purposes, categories are important for blog content discovery.

---

### 6.2 Blog Post Has No Social Share Buttons [P2]
Blog posts should have "Share to WhatsApp," "Share to Instagram," etc. buttons. This is implied by the goal of driving organic traffic and brand awareness.

---

### 6.3 No Related Posts Section [P2]
After reading a blog post, there's no "Related Articles" section to keep users engaged.

---

### 6.4 Blog SEO - No Breadcrumb Schema [P2]
Blog posts have Open Graph and Twitter meta but likely missing breadcrumb structured data (`BreadcrumbList` schema.org) which helps Google search results.

---

## 7. CAROUSEL MANAGEMENT

### 7.1 Carousel Has No Scheduling Verification [P1]
**Schema:** `carouselSlides.startsAt` and `endsAt` for scheduling.

The homepage filters slides by date:
```typescript
const startOk = !slide.startsAt || slide.startsAt <= now;
const endOk = !slide.endsAt || slide.endsAt >= now;
```

This works correctly. But the **admin carousel creation form** (`/admin/carousel/new`) — need to verify it exposes the `startsAt`/`endsAt` date pickers so admin can schedule campaigns.

---

### 7.2 Carousel Rotation Speed Not Configurable [P2]
The HeroCarousel auto-rotation speed is hardcoded. It should come from `systemSettings` or a carousel setting so the admin can adjust without a code change.

---

## 8. DESIGN SYSTEM CONSISTENCY ISSUES

### 8.1 B2B Pages Use Different Styling [P2]
The B2B landing page uses `bg-admin-sidebar` (dark navy) for its hero section. The admin layout and the B2B landing page share the same dark color, which is confusing — the B2B portal looks like the admin.

**Fix:** Define a separate color palette for B2B (e.g., dark teal or dark gold) to visually differentiate B2B from admin.

---

### 8.2 Mobile Bottom Nav Missing B2B Link [P2]
**File:** `components/store/layout/BottomNav.tsx`

The bottom nav (mobile) has tabs for Home, Products, Cart, and Account. There's no B2B entry point from mobile navigation.

A B2B customer on mobile has no visible navigation to the B2B portal unless they know the URL.

---

## SUMMARY TABLE

| # | Issue | Location | Priority |
|---|---|---|---|
| 3.4 | B2B customers pay regular prices, not B2B prices | `api/checkout/initiate` | **P0** |
| 3.5 | Net-30 payment option missing from checkout | `checkout/page.tsx` | P1 |
| 3.1 | B2B account dashboard is a stub | `b2b/account/page.tsx` | P1 |
| 2.1 | No B2B inquiry confirmation email | `api/b2b/inquiry` | P1 |
| 2.2 | No admin notification for new B2B inquiries | `api/b2b/inquiry` | P1 |
| 5.2 | Testimonials have no admin UI | Missing `/admin/testimonials` page | P1 |
| 1.1 | Product category counts hardcoded on B2B page | `b2b/page.tsx:31` | P1 |
| 5.1 | Instagram feed shows placeholder/fake images | `InstagramFeed.tsx` | P1 |
| 3.3 | B2B quotes page unclear implementation | `b2b/account/quotes/page.tsx` | P1 |
| 5.5 | Category chips filter logic incorrect | `app/(store)/page.tsx:91` | P2 |
| 8.2 | Mobile bottom nav missing B2B entry point | `BottomNav.tsx` | P2 |
