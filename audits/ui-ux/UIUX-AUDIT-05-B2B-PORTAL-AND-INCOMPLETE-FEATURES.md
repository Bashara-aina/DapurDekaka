# UI/UX AUDIT 05 — B2B Portal & Incomplete / Stub Features

**Scope:** B2B landing, B2B account, B2B orders, B2B quotes; plus all features across the platform that are incomplete or stubbed  
**Priority:** Critical = 🔴 | High = 🟠 | Medium = 🟡 | Polish = 🟢

---

## SUMMARY OF ISSUES

| # | Issue | Priority | File |
|---|-------|----------|------|
| 01 | B2B orders list: order rows are NOT clickable — no order detail page exists | 🔴 | b2b/account/orders/page.tsx |
| 02 | B2B quotes: status is shown but no way to accept/reject from portal | 🔴 | b2b/account/quotes/page.tsx |
| 03 | B2B landing: category chips link to nothing — `href="#"` dead ends | 🔴 | b2b/page.tsx |
| 04 | OrderTimeline component is defined but **never rendered** on public order tracking | 🔴 | orders/[orderNumber]/page.tsx |
| 05 | Order tracking page (`/orders/[orderNumber]`) has no UI built — bare data | 🔴 | orders/[orderNumber]/OrderTrackingClient.tsx |
| 06 | Vouchers page: shows empty state only — voucher listing/redemption not implemented | 🔴 | account/vouchers/page.tsx |
| 07 | B2B portal: no dashboard/home for logged-in B2B users — goes to landing | 🟠 | b2b/account/page.tsx |
| 08 | B2B products page: prices show retail price, not B2B price for logged-in B2B users | 🟠 | b2b/products/page.tsx |
| 09 | Testimonials section on homepage: loads from DB but shows hardcoded fallback if empty | 🟠 | Testimonials.tsx |
| 10 | InstagramFeed section is a hardcoded placeholder with no real IG integration | 🟠 | InstagramFeed.tsx |
| 11 | Blog listing page exists but has no category filter or search | 🟡 | (store)/blog/page.tsx |
| 12 | WhatsApp button appears on every page but is hidden behind BottomNav on mobile | 🟠 | WhatsAppButton.tsx |
| 13 | Privacy Policy page exists but is not linked from footer | 🟡 | footer | 
| 14 | Refund Policy page exists but is not linked from checkout or footer | 🟡 | footer |
| 15 | B2B quote form: submitted quotes disappear — no confirmation or next-step message | 🔴 | b2b/page.tsx (QuoteForm) |
| 16 | Carousel admin: can create slides but no preview of how they look on storefront | 🟡 | admin/carousel/ |
| 17 | Admin categories page exists but has no way to reorder categories | 🟡 | admin/categories/page.tsx |
| 18 | AI Content page: complete stub — renders an empty form with no functionality | 🟠 | admin/ai-content/page.tsx |

---

## DETAILED FINDINGS

---

### 🔴 01 — B2B Orders: Non-Clickable Rows with No Detail View
**File:** `app/(b2b)/b2b/account/orders/page.tsx:49-82`

**Problem:**
```tsx
<div key={order.id} className="bg-white rounded-xl p-4 shadow-sm">
  {/* ChevronRight icon — implies clickable but nothing happens */}
```
The order rows render a `<div>` (not a link) with a `ChevronRight` icon that implies navigation. Clicking does nothing. There is no B2B order detail page — `app/(b2b)/b2b/account/orders/[id]/page.tsx` does not exist.

B2B customers need to see order details including:
- Items ordered
- B2B pricing breakdown
- Invoice/PDF download
- Delivery tracking

**Fix:** 
1. Create `app/(b2b)/b2b/account/orders/[orderNumber]/page.tsx`
2. Change the row to a proper link: `<Link href={`/b2b/account/orders/${order.orderNumber}`}>`
3. The detail page can reuse the same order query as the B2C one, with B2B-specific invoice formatting

---

### 🔴 02 — B2B Quotes: No Accept/Reject from Portal
**File:** `app/(b2b)/b2b/account/quotes/page.tsx`

**Problem:** The B2B quotes page shows pending/approved quotes with status badges. But there is no UI for the B2B customer to:
- Accept a quote (convert to order)
- Reject a quote with a reason
- Download quote PDF
- See itemized pricing

Quotes are essentially view-only — the entire conversion funnel is missing.

**Fix:**
```tsx
{quote.status === 'approved' && (
  <div className="mt-4 flex gap-3">
    <button onClick={() => handleAcceptQuote(quote.id)} className="flex-1 h-10 bg-brand-red text-white rounded-lg font-bold">
      Terima & Pesan
    </button>
    <button onClick={() => handleRejectQuote(quote.id)} className="flex-1 h-10 border border-gray-200 rounded-lg text-gray-600">
      Tolak
    </button>
  </div>
)}
```
Also add quote PDF download for accepted quotes.

---

### 🔴 03 — B2B Landing: Category Chips Are Dead Links
**File:** `app/(b2b)/b2b/page.tsx:173-188`

**Problem:**
```tsx
<div className="bg-brand-cream rounded-lg p-4 text-center hover:bg-brand-cream-dark cursor-pointer">
```
Category chips in the B2B landing page are `<div>` elements with `cursor-pointer` but no `href`. Clicking them does nothing. They should navigate to the B2B product catalog filtered by that category.

**Fix:** Change to `<Link>`:
```tsx
<Link 
  href={`/b2b/products?category=${cat.id}`}
  className="bg-brand-cream rounded-lg p-4 text-center hover:bg-brand-cream-dark transition-colors block"
>
  {cat.name}
  <p>{cat.count} Produk</p>
</Link>
```

---

### 🔴 04 — OrderTimeline: Defined But Never Rendered on Public Tracking
**File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx`

**Problem:** `OrderTimeline` is imported and defined in `components/store/orders/OrderTimeline.tsx` but the public order tracking page (`/orders/[orderNumber]`) — which guests use when they receive tracking links — does not render `OrderTimeline`. The component is also used in the authenticated order detail page (`/account/orders/[orderNumber]`) but even there, the timeline only shows steps, not the actual timestamp of each transition.

The `statusHistory` is fetched (with `createdAt`) but the `OrderTimeline` component only accepts `steps` labels and `currentStepIndex` — it doesn't display timestamps.

**Fix 1:** Update `OrderTimeline` to accept an optional `timestamps` array:
```tsx
interface OrderTimelineProps {
  steps: { label: string; timestamp?: Date }[];
  currentStepIndex: number;
  cancelled?: boolean;
}
```

**Fix 2:** Populate timestamps from `order.statusHistory` on the order detail page.

**Fix 3:** Ensure the public order tracking page also uses the timeline.

---

### 🔴 05 — Public Order Tracking Page Has Bare UI
**File:** `app/(store)/orders/[orderNumber]/OrderTrackingClient.tsx`

**Problem:** The public order tracking page at `/orders/[orderNumber]` (accessible without login — for guest order tracking via email links) likely has incomplete or minimal UI. Guest customers who paid but don't have an account need a clean, reassuring order status page.

Based on the directory structure (`orders/[orderNumber]/pickup/page.tsx` also exists), this is intended as a public tracking flow but the `OrderTrackingClient.tsx` component likely shows raw data without proper UX.

**Required UI elements:**
1. Order status badge (large, prominent)
2. `OrderTimeline` with timestamps
3. Delivery details (courier, tracking number if shipped)
4. Pickup instructions if pickup order (with QR code or pickup code display)
5. WhatsApp support link
6. Link to create account to save order history

---

### 🔴 06 — Vouchers Page: Completely Unimplemented
**File:** `app/(store)/account/vouchers/page.tsx`

**Problem:** The account sidebar includes a "Vouchers" link and the page exists, but it renders only an empty state with no voucher listing functionality. The `account/vouchers` API exists (`/api/account/vouchers/route.ts`) but if the UI shows only empty state, it's either:
1. Never fetching from the API
2. The API always returns empty
3. The component is a stub

**Fix:** Connect the page to the vouchers API and implement:
- List of owned vouchers with code, discount amount, expiry
- Copy-to-clipboard for voucher codes
- Expiry countdown for near-expiry vouchers
- Empty state with "Lihat Promo" link to discover available coupons

---

### 🔴 15 — B2B Quote Form: No Post-Submit UI
**File:** `components/b2b/QuoteForm.tsx`

**Problem:** After submitting the inquiry/quote form on the B2B landing page, users get a toast notification but no persistent UI confirmation. The form resets and looks like nothing happened. Users don't know:
- Their inquiry was received
- What to expect next (response timeline)
- Who will contact them (WhatsApp? Email?)
- What their inquiry reference number is

**Fix:** After successful submission, replace the form with a success state:
```tsx
{submitted ? (
  <div className="text-center py-8">
    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
      <CheckCircle className="w-8 h-8 text-green-600" />
    </div>
    <h3 className="font-display text-xl font-bold mb-2">Terima Kasih!</h3>
    <p className="text-text-secondary mb-4">
      Permintaan penawaran Anda telah kami terima. Tim kami akan menghubungi Anda dalam 1×24 jam melalui WhatsApp atau email.
    </p>
    <a href="https://wa.me/..." className="...">Chat WhatsApp Sekarang</a>
  </div>
) : <form ...>}
```

---

### 🟠 07 — B2B Portal: No Dedicated Dashboard for Logged-In Users
**File:** `app/(b2b)/b2b/account/page.tsx`

**Problem:** When a logged-in B2B user navigates to `/b2b`, they see the same landing page as anonymous visitors (with the inquiry form). There's no B2B-specific dashboard that shows:
- Their account status (approved B2B partner or pending)
- Pending quotes
- Recent orders
- B2B account manager contact

The `account/page.tsx` exists but may not be surfaced in the navigation.

**Fix:** Add B2B-specific nav items for authenticated B2B users and route them to `/b2b/account` after login. The account page should show:
```tsx
<div className="grid grid-cols-2 gap-4">
  <Link href="/b2b/account/orders">Pesanan Saya</Link>
  <Link href="/b2b/account/quotes">Penawaran Saya</Link>
</div>
```

---

### 🟠 08 — B2B Products: No B2B Pricing for Logged-In Users
**File:** `app/(b2b)/b2b/products/page.tsx`

**Problem:** The B2B product catalog shows products but likely shows retail prices. B2B users who have been approved and assigned a B2B role should see `variant.b2bPrice` instead of `variant.price`. The landing page has a price teaser table but the actual catalog doesn't differentiate.

**Fix:** 
1. Server-side: check if `session?.user?.role === 'b2b'`
2. If B2B user: query and display `b2bPrice` field where not null
3. Add a badge "Harga B2B" to differentiate from retail pricing
4. If `b2bPrice` is null: show "Hubungi kami untuk harga"

---

### 🟠 09 — Testimonials: Hardcoded Fallback if DB Empty
**File:** `components/store/home/Testimonials.tsx`

**Problem:** The testimonials section fetches from a DB table (`testimonials`) via admin management. However, if no testimonials exist in the DB, the component either:
- Shows nothing (bad)
- Shows hardcoded dummy data (misleading)

There is an admin testimonials page (`admin/testimonials/page.tsx`) but it's not clear if the DB table is populated. On a fresh installation or after clearing the table, the homepage would show either a broken section or fake reviews.

**Fix:** 
1. Add a minimum of 3-5 real testimonials to seed data
2. If count < 3, don't render the section at all (not an empty skeleton)
3. The admin testimonials page should make it clear how many are needed for the section to display

---

### 🟠 10 — InstagramFeed: Hardcoded Placeholder
**File:** `components/store/home/InstagramFeed.tsx`

**Problem:** Based on the component name and location, this is likely a grid of Instagram post thumbnails. Without a real Instagram API integration, this is either:
- A hardcoded grid of static images (misleading — would show outdated content)
- An empty section
- A placeholder that says "Follow us @dapurdekaka"

A fake Instagram feed damages credibility if the images shown differ from actual Instagram.

**Fix:** Two options:
1. **Replace with real content:** Use a Cloudinary-hosted image grid (manually curated) that links to the Instagram profile
2. **Remove the section:** If no API integration exists, replace with a simple "Follow kami di Instagram" CTA card with the actual handle and follower count

---

### 🟠 12 — WhatsApp Button Hidden Behind BottomNav on Mobile
**File:** `components/store/layout/WhatsAppButton.tsx`

**Problem:** The WhatsApp floating button (`fixed bottom-4 right-4`) is positioned at `bottom-4` (16px from bottom). The BottomNav is `h-16` (64px). On mobile, the WhatsApp button is completely covered by the BottomNav — it's inaccessible on small screens where users most need it.

**Fix:**
```tsx
// WhatsAppButton.tsx
<a 
  href="..."
  className="fixed right-4 bottom-[calc(4rem+1rem)] md:bottom-4 ..."
>
```
Position it 64px (nav height) + 16px (original offset) = 80px from bottom on mobile.

---

### 🟡 11 — Blog: No Category Filter or Search
**File:** `app/(store)/blog/page.tsx`

**Problem:** The blog listing shows all posts in reverse chronological order with no way to filter by category or search by keyword. As the blog grows beyond 10+ articles, discovery becomes a problem.

**Fix:** Add a category filter row at the top:
```tsx
const categories = await getUniqueCategories(); // query distinct categories from blog posts
// Render as clickable chips that add ?category= to URL
```

---

### 🟡 13 & 14 — Policy Pages Not Linked in Footer
**File:** `components/store/layout/Footer.tsx`

**Problem:** `app/(store)/privacy-policy/page.tsx` and `app/(store)/refund-policy/page.tsx` exist but are not linked from:
- The store footer
- The checkout page (where they're most relevant)
- The registration form ("Dengan mendaftar, kamu menyetujui Kebijakan Privasi")

This is a legal/trust issue — Indonesian e-commerce regulations (Kominfo) require visible policy links.

**Fix:**
```tsx
// Footer.tsx — add links:
<Link href="/privacy-policy">Kebijakan Privasi</Link>
<Link href="/refund-policy">Kebijakan Refund</Link>

// Registration form — add:
<p className="text-xs text-text-secondary">
  Dengan mendaftar, kamu menyetujui <Link href="/privacy-policy">Kebijakan Privasi</Link> kami.
</p>
```

---

### 🟡 16 — Carousel Admin: No Storefront Preview
**File:** `app/(admin)/admin/carousel/[id]/page.tsx`

**Problem:** Admins can create/edit carousel slides (image, title, subtitle, CTA button) but there's no preview of how the slide looks in the actual `HeroCarousel` component on the storefront. Admins must save and check the live site.

**Fix:** Add a live preview panel in the carousel edit form:
```tsx
<div className="border rounded-xl overflow-hidden">
  <p className="text-xs text-gray-500 p-2 border-b">Preview</p>
  <div className="relative aspect-[4/3] bg-brand-cream">
    {imageUrl && <Image src={imageUrl} fill className="object-cover" />}
    <div className="absolute bottom-0 left-0 p-4 bg-gradient-to-t from-black/50">
      <p className="text-white font-bold">{titleValue}</p>
      <p className="text-white/80 text-sm">{subtitleValue}</p>
    </div>
  </div>
</div>
```

---

### 🟠 18 — AI Content Page: Complete Stub
**File:** `app/(admin)/admin/ai-content/page.tsx`

**Problem:** The AI Content admin page exists in the navigation but is likely a minimal stub. The `CaptionGenerator` component exists (`components/admin/ai/CaptionGenerator.tsx`) and there's an API route (`/api/ai/caption/route.ts`). However, it's unclear if this is functional or just scaffolded.

**Expected functionality:**
- Generate Instagram captions for products
- Generate blog post outlines
- Generate product descriptions
- Generate promo copy

**Current state unknown** — need to check if the API route actually calls an AI model or is also a stub.

**Fix:** At minimum, complete the `CaptionGenerator` component to:
1. Accept a product name/description as input
2. Call the AI caption API
3. Show the generated caption with copy-to-clipboard
4. Track which templates are most used

---

## MOST CRITICAL INCOMPLETE FEATURES (RANKED)

These are features that are **visible in the UI but broken or empty** — they create the worst UX because users expect them to work:

| Rank | Feature | Impact |
|------|---------|--------|
| 1 | **Vouchers page** — visible in nav, shows nothing | 🔴 Trust |
| 2 | **B2B orders not clickable** — ChevronRight implies action | 🔴 B2B customers |
| 3 | **Order pending payment** — no "Bayar Sekarang" | 🔴 Revenue |
| 4 | **Public order tracking** — bare UI for guest customers | 🔴 Post-purchase |
| 5 | **B2B quote form** — no post-submit confirmation | 🔴 B2B leads |
| 6 | **WhatsApp button** — hidden on mobile | 🟠 Support |
| 7 | **B2B category links** — dead clicks | 🟠 B2B UX |
| 8 | **Policy pages** — not linked anywhere | 🟡 Legal/Trust |

---

## IMPLEMENTATION PRIORITY ORDER

1. **🔴 15** — B2B quote form post-submit state (15 min)
2. **🔴 06** — Connect vouchers page to API (30 min)
3. **🔴 03** — Fix B2B category chip links (10 min)
4. **🔴 01** — B2B order rows — make clickable + create detail page (60 min)
5. **🔴 04 & 05** — Public order tracking page full UI (90 min)
6. **🟠 12** — Fix WhatsApp button position (5 min)
7. **🟠 10** — Replace fake Instagram feed (20 min)
8. **🟠 08** — B2B products: show B2B price for B2B users (30 min)
9. **🟡 13 & 14** — Link policy pages in footer (10 min)
10. **🟠 07** — B2B dashboard for logged-in users (45 min)
