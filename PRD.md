````markdown
# PRD.md — Product Requirements Document
# DapurDekaka.com — Frozen Food Direct Ordering Platform
**Version:** 1.0
**Last Updated:** May 2026
**Author:** Bashara (Product Owner)
**Status:** Active — Pre-Development

---

## TABLE OF CONTENTS
1. Project Overview & Business Goals
2. User Personas & Roles
3. Site Map & Page Inventory
4. Feature List with Priority
5. Checkout & Order Flow Rules
6. Pricing, Coupons & Points System
7. Product & Inventory Rules
8. Shipping & Logistics Rules
9. Auth, Access Control & Security
10. Out of Scope (V1)

---

## 1. PROJECT OVERVIEW & BUSINESS GOALS

### 1.1 What Is This Product
DapurDekaka.com is a direct-to-consumer (D2C) e-commerce website for **Dapur Dekaka**, an Indonesian frozen food brand based in Bandung. The brand specializes in Chinese-Indonesian frozen dimsum and related products, sold under the heritage brand identity "德卡 DEKAKA".

The website serves as the brand's **owned sales channel**, complementing existing channels:
- Shopee (online marketplace — highest price point)
- Instagram (engagement + influencer)
- WhatsApp (B2B and loyal customers)
- GrabMart (online delivery)
- Offline store (lowest price point)

### 1.2 The Business Model
- Products are priced **between** offline store price and Shopee price
- Example: Offline 105k → Website 120k → Shopee 143k
- The **15k–18k margin per order** goes to the website operator (Bashara)
- Dapur Dekaka benefits from: additional sales channel, website traffic, digital presence, B2B credibility
- This is a **win-win**: operator earns margin, brand gets free marketing infrastructure

### 1.3 Primary Goals (3-Month Targets)
| KPI | Target |
|---|---|
| Monthly orders | 500–1000 orders/month |
| Monthly revenue (gross) | IDR 20–100 juta/month |
| Registered customers | 1000+ accounts |
| B2B inquiries | 10+ per month |
| Conversion rate | >2.5% of visitors |

### 1.4 Strategic Value Propositions
1. **Price advantage** over Shopee — cheaper for customer, direct relationship with brand
2. **No marketplace competition** — no competitor ads, no price war on same page
3. **Heritage brand identity** — Chinese-Indonesian warmth, "bukan frozen food biasa"
4. **Direct customer ownership** — email list, points, repeat purchase loop
5. **B2B credibility** — professional website for pitching hotels and catering companies
6. **SEO-driven organic traffic** — blog content reduces dependence on paid ads

### 1.5 Success Criteria for V1 Launch
- [ ] Customer can browse, add to cart, checkout, and pay without creating an account
- [ ] Midtrans payment processes successfully end-to-end
- [ ] RajaOngkir calculates real shipping cost at checkout
- [ ] Admin can manage products, orders, inventory, and coupons
- [ ] Warehouse staff can update tracking numbers from mobile
- [ ] PDF receipt generated and emailed after payment
- [ ] Website loads under 3 seconds on mobile (3G connection)
- [ ] All pages render correctly on mobile viewport

---

## 2. USER PERSONAS & ROLES

### 2.1 Customer Personas

#### Persona A — "Ibu Rumah Tangga" (Primary B2C)
- Age: 28–45, female, urban Indonesia
- Buys frozen food for family convenience
- Shops via mobile, uses WhatsApp daily
- Discovered brand via Instagram or TikTok
- Price-sensitive but values quality and halal certification
- **Goal:** Find product → check price → order easily → receive at home
- **Pain point:** Shopee feels expensive, WhatsApp ordering is confusing

#### Persona B — "Foodie Millennial"
- Age: 22–35, male/female, urban
- Follows food content on TikTok and Instagram
- Impulse buyer, driven by visuals and promotions
- Willing to try new brands if packaging looks premium
- **Goal:** Discover product → buy immediately → share experience
- **Pain point:** No direct website to buy from brand they follow

#### Persona C — "B2B Event Organizer / Hotel Procurement"
- Age: 30–50, professional
- Needs bulk quantities for events, hotels, office catering
- Needs proper invoice, reliable supply, professional communication
- **Goal:** Assess brand credibility → request bulk quote → place large order
- **Pain point:** No professional channel to engage beyond WhatsApp

### 2.2 System Roles

#### Role: Customer (Registered)
- Can browse, search, filter products
- Can add to cart and checkout
- Has saved addresses
- Earns and redeems loyalty points
- Can apply coupons
- Can view order history and track orders
- Can download PDF receipts
- Can switch UI language (ID/EN)
- Can write order notes

#### Role: Guest
- Can browse, search, filter products
- Can add to cart and checkout (provides name, email, phone at checkout)
- Cannot earn points or save addresses
- Can track order via order number + email lookup
- Cannot view order history (no account)

#### Role: B2B Customer (Registered, separate portal)
- Has own login account
- Sees B2B-specific bulk pricing
- Can request custom quotes
- Gets Net-30 payment option (manual approval by superadmin)
- Has dedicated WhatsApp contact assigned
- Receives custom PDF quote/proposal
- Can view B2B order history

#### Role: Warehouse Staff
- Mobile-only access
- Can view orders with status: paid, processing, packed
- Can update stock count per product variant
- Can input tracking number and mark order as shipped
- Cannot view revenue, customer data, or pricing
- Cannot edit products or coupons

#### Role: Owner (Girlfriend)
- Can view all orders and order details
- Can view revenue dashboard and charts
- Can view customer list (no edit)
- Can view and edit products
- Can view inventory levels
- Cannot access settings, AI tools, or superadmin functions
- Cannot delete data

#### Role: Superadmin (Bashara)
- Full access to all features
- Only role that can:
  - Create/edit/delete admin accounts
  - Change system settings
  - Access AI content generator
  - Approve B2B Net-30 payment terms
  - Issue manual refunds
  - Edit coupon and points settings

---

## 3. SITE MAP & PAGE INVENTORY

### 3.1 Customer-Facing Store (Public)

```
/ ................................. Homepage
/products ......................... Product catalog
/products/[slug] .................. Product detail
/cart ............................. Shopping cart
/checkout ......................... Checkout (multi-step)
/checkout/success ................. Order success page
/checkout/pending ................. Payment pending page
/checkout/failed .................. Payment failed page
/orders/[orderNumber] ............. Order tracking (public, by order number)
/account .......................... Account dashboard (protected)
/account/orders ................... Order history
/account/orders/[orderNumber] ..... Order detail
/account/addresses ................ Saved addresses
/account/points ................... Points balance + history
/account/vouchers ................. Available coupons
/account/profile .................. Edit profile
/blog ............................. Blog listing
/blog/[slug] ...................... Blog post detail
/auth/login ....................... Login page
/auth/register .................... Register page
/auth/forgot-password ............. Forgot password
/auth/reset-password .............. Reset password
```

### 3.2 B2B Portal

```
/b2b .............................. B2B landing page
/b2b/products ..................... B2B product catalog (bulk pricing)
/b2b/quote ........................ Request custom quote
/b2b/account ...................... B2B account dashboard (protected)
/b2b/account/orders ............... B2B order history
/b2b/account/quotes ............... Quote history
```

### 3.3 Admin Dashboard

```
/admin ............................ Redirect to /admin/dashboard
/admin/dashboard .................. KPI overview
/admin/orders ..................... Order management
/admin/orders/[id] ................ Order detail + status update
/admin/products ................... Product list
/admin/products/new ............... Add product
/admin/products/[id] .............. Edit product
/admin/inventory .................. Stock management (warehouse)
/admin/shipments .................. Shipment tracking update (warehouse)
/admin/customers .................. Customer list
/admin/customers/[id] ............. Customer detail
/admin/coupons .................... Coupon management
/admin/blog ....................... Blog post list
/admin/blog/new ................... New blog post
/admin/blog/[id] .................. Edit blog post
/admin/carousel ................... Homepage carousel management
/admin/b2b-inquiries .............. B2B inquiry inbox
/admin/b2b-quotes ................. B2B quote management
/admin/ai-content ................. AI caption generator (Minimax)
/admin/settings ................... System settings (superadmin only)
/admin/users ...................... Admin user management (superadmin only)
```

### 3.4 API Routes

```
/api/auth/[...nextauth] ........... NextAuth handlers
/api/products ..................... Product listing + search
/api/products/[slug] .............. Product detail
/api/cart ......................... Cart validation
/api/checkout/initiate ............ Create order + Midtrans token
/api/checkout/pickup-invitation ... Generate pickup instructions
/api/webhooks/midtrans ............ Midtrans payment notification
/api/orders/[orderNumber] ......... Order detail
/api/orders/[orderNumber]/receipt . PDF receipt download
/api/shipping/provinces ........... RajaOngkir provinces
/api/shipping/cities .............. RajaOngkir cities
/api/shipping/cost ................ RajaOngkir cost calculation
/api/coupons/validate ............. Coupon validation
/api/points/redeem ................ Points redemption
/api/upload ....................... Cloudinary upload
/api/blog ......................... Blog CRUD
/api/b2b/inquiry .................. B2B inquiry submission
/api/admin/[...] .................. Admin API routes (protected)
/api/ai/generate-caption .......... Minimax caption generation
```

---

## 4. FEATURE LIST WITH PRIORITY

**P0 = Must launch (Day 1)**
**P1 = Launch week (Day 1–7)**
**P2 = Post-launch (Week 2–4)**
**P3 = Future (Post month 1)**

### 4.1 Store Features

| Feature | Priority | Notes |
|---|---|---|
| Product catalog with search + filter | P0 | |
| Product detail page | P0 | |
| Shopping cart (guest + registered) | P0 | Persisted in localStorage for guests |
| Guest checkout | P0 | Name, email, phone collected inline |
| Registered checkout with saved address | P0 | |
| RajaOngkir real-time shipping cost | P0 | Cold-chain couriers only |
| Pickup option | P0 | Pay online → receive pickup invitation |
| Midtrans payment (Snap.js) | P0 | Sandbox first |
| Order success / pending / failed pages | P0 | |
| Order tracking page (public) | P0 | By order number |
| PDF receipt download | P0 | Client-side generation |
| Email confirmation (Resend) | P0 | After payment |
| Google login | P0 | |
| Email + password login | P0 | |
| Register page | P0 | |
| Homepage carousel | P0 | |
| WhatsApp floating button | P0 | Always visible |
| Halal badge on products | P0 | |
| Out of stock display ("Habis") | P0 | |
| Order notes at checkout | P0 | |
| Language toggle (ID/EN) | P1 | |
| Coupon code at checkout | P1 | |
| Points earn on purchase | P1 | |
| Points redeem at checkout | P1 | |
| Account dashboard | P1 | |
| Saved addresses management | P1 | |
| Order history | P1 | |
| Product variant selector | P1 | |
| Instagram feed embed on homepage | P1 | |
| Blog listing + detail | P1 | |
| SEO meta tags on all pages | P1 | |
| Sitemap.xml + robots.txt | P1 | |
| Testimonials section | P1 | Static for now |
| B2B landing page | P1 | |
| B2B inquiry form | P1 | |
| Forgot/reset password | P2 | |
| B2B account portal | P2 | |
| B2B bulk pricing | P2 | |
| B2B custom quote PDF | P2 | |
| Points history page | P2 | |
| Vouchers page in account | P2 | |
| Product reviews/ratings | P3 | |
| Referral system | P3 | |
| Push notifications | P3 | |
| Automated TikTok posting | P3 | |

### 4.2 Admin Features

| Feature | Priority | Notes |
|---|---|---|
| Admin login + role-based access | P0 | |
| Order list + detail view | P0 | |
| Order status update | P0 | |
| Product add/edit/delete | P0 | |
| Inventory stock update | P0 | Warehouse staff |
| Tracking number input + mark shipped | P0 | Warehouse staff |
| Revenue dashboard (KPI cards) | P1 | |
| Revenue chart (last 30 days) | P1 | |
| Coupon management | P1 | |
| Customer list + detail | P1 | |
| Blog CMS with TipTap editor | P1 | |
| Carousel management | P1 | |
| B2B inquiry inbox | P1 | |
| AI caption generator (Minimax) | P2 | |
| PDF receipt download from admin | P2 | |
| B2B quote builder + PDF | P2 | |
| Manual points adjustment | P2 | |
| Admin user management | P2 | |
| System settings page | P2 | |
| Low stock alerts | P2 | |
| Export orders to CSV | P3 | |

---

## 5. CHECKOUT & ORDER FLOW RULES

### 5.1 Cart Rules
- Cart persists in `localStorage` for guests (survives page refresh)
- Cart syncs to database for logged-in users
- If guest logs in mid-session, localStorage cart merges with database cart
- If same variant exists in both, quantities are added together
- Maximum quantity per variant per order: 99
- No minimum order amount
- Cart shows real-time stock validation — if stock drops below cart quantity, show warning
- Cart displays: product image, name, variant, price, quantity stepper, remove button, subtotal per item
- Order summary shows: subtotal, shipping (TBD until address entered), discount, points redeemed, total

### 5.2 Checkout Steps

**Step 1 — Identity (Guest only)**
- If not logged in: collect full name, email, phone number
- Show optional login/register prompt (non-blocking — can skip)
- Validate email format, phone format (Indonesian: 08xx or +628xx)

**Step 2 — Delivery Method**
- Option A: **Pengiriman** (delivery to address)
- Option B: **Ambil Sendiri** (pickup at store)
- If pickup selected: skip shipping step, show pickup info after payment

**Step 3 — Delivery Address (if Option A)**
- Logged-in users: select from saved addresses or add new
- Guest users: full address form
- Fields: recipient name, phone, full address line, province (RajaOngkir), city (RajaOngkir, cascades from province), district (RajaOngkir, cascades from city), postal code
- Save address toggle for logged-in users
- Validate all fields before proceeding

**Step 4 — Shipping Option (if Option A)**
- Call RajaOngkir API with: origin (Bandung city_id: 23), destination (customer city_id), weight (sum of all items)
- Show ONLY these services:
  - SiCepat FROZEN
  - JNE YES (next-day)
  - AnterAja frozen service
- Display per option: courier logo, service name, estimated days, cost
- If no cold-chain option available for destination: show message "Maaf, pengiriman frozen ke daerah ini belum tersedia. Silakan hubungi WhatsApp kami."
- Customer selects one option
- Shipping cost added to order total

**Step 5 — Coupon & Points**
- Coupon code input field with "Terapkan" button
- If logged in: show available points balance, toggle to redeem
- Points redeem: minimum 100 points, 100 points = IDR 1,000 discount
- Both coupon and points can be used simultaneously
- Show updated total after applying

**Step 6 — Order Review & Payment**
- Show full order summary: items, shipping address, courier, subtotal, discount, shipping cost, points redeemed, final total
- Show payment method options (handled by Midtrans Snap — VA, e-wallet, QRIS, credit card)
- "Bayar Sekarang" button triggers Midtrans Snap popup
- No COD option

### 5.3 Order Number Format
- Format: `DDK-YYYYMMDD-XXXX`
- Example: `DDK-20260512-0047`
- XXXX is sequential daily counter, zero-padded to 4 digits
- Resets to 0001 each day

### 5.4 Payment Flow

**Success (Midtrans settlement):**
1. Midtrans sends webhook to `/api/webhooks/midtrans`
2. Verify Midtrans signature hash
3. Update order status: `pending_payment` → `paid`
4. Deduct stock for each ordered variant
5. If logged-in user: add loyalty points (1 point per IDR 1,000 spent on subtotal, not shipping)
6. If coupon used: increment coupon `used_count`
7. Generate PDF receipt (client-side on success page)
8. Send confirmation email via Resend (order summary + PDF attachment)
9. Redirect customer to `/checkout/success`

**Pending (Midtrans pending — e.g. VA not yet paid):**
1. Order status stays `pending_payment`
2. Redirect to `/checkout/pending`
3. Show payment instructions (VA number, amount, expiry time)
4. Payment expires after **15 minutes**
5. Customer can click "Bayar Lagi" to generate new Midtrans token for same order
6. After 3 failed regenerations, order is cancelled automatically

**Failed / Expired:**
1. Order status → `cancelled`
2. Stock is NOT deducted (was never confirmed)
3. Points/coupons used are reversed
4. Customer redirected to `/checkout/failed`
5. Show "Coba Lagi" button that creates a new order with same items

**Fraud / Deny:**
1. Order status → `cancelled`
2. Log the Midtrans fraud reason
3. Customer redirected to `/checkout/failed` with generic message

### 5.5 Order Status Transitions

```
pending_payment
    ↓ (Midtrans webhook: settlement)
paid
    ↓ (Admin/Owner manually updates)
processing
    ↓ (Admin/Owner manually updates)
packed
    ↓ (Warehouse staff inputs tracking number)
shipped
    ↓ (Admin updates, or future: auto via courier API)
delivered
```

Additional transitions:
- Any status → `cancelled` (by superadmin, or auto on payment failure)
- `delivered` → `refunded` (by superadmin only, manual process)

### 5.6 Pickup Invitation
When order delivery method is pickup and payment is confirmed:
- System generates a **pickup invitation** page at `/orders/[orderNumber]/pickup`
- Invitation contains:
  - Order number as pickup code (display large, bold)
  - Step-by-step instructions (numbered list):
    1. Tunjukkan kode ini ke staff toko
    2. Staff akan memverifikasi pesanan Anda
    3. Pesanan akan disiapkan dalam X menit
    4. Nikmati produk Anda!
  - Store address: Jl. Sinom V no. 7, Turangga, Bandung
  - Embedded Google Maps link
  - Store opening hours (configured in settings)
  - Contact WhatsApp link
- Invitation is also emailed to customer
- Pickup orders skip shipping steps and go directly: `paid` → `processing` → `delivered` (no `packed` or `shipped`)

---

## 6. PRICING, COUPONS & POINTS SYSTEM

### 6.1 Pricing Rules
- All prices set manually by superadmin in admin dashboard
- Prices stored in IDR as integers (no decimals)
- Price is per variant (e.g. 25pcs has one price, 50pcs has another)
- No dynamic or automated pricing
- B2B customers see different (lower) prices set separately per variant

### 6.2 Coupon Types

| Type | Description | Example |
|---|---|---|
| `percentage` | Discount X% off subtotal | 10% off → -IDR 12,000 on 120k order |
| `fixed` | Flat IDR amount off subtotal | -IDR 20,000 off |
| `free_shipping` | Shipping cost waived entirely | Shipping: IDR 0 |
| `buy_x_get_y` | Buy X qty, get Y qty free | Buy 2 get 1 free |

### 6.3 Coupon Rules
- Coupon codes are case-insensitive
- One coupon per order maximum
- `min_order` field: coupon only valid if subtotal ≥ min_order value
- `max_uses` field: coupon deactivates after N total uses (null = unlimited)
- `expires_at` field: coupon invalid after this timestamp (null = no expiry)
- `is_active` field: manual on/off toggle (superadmin)
- `used_count` incremented only after successful payment (not on order creation)
- If payment fails, used_count is NOT incremented
- Percentage discount applies to subtotal only (not shipping)
- Fixed discount cannot exceed subtotal (minimum total is shipping cost)
- `buy_x_get_y` adds free item to cart automatically — free item is lowest-priced variant in qualifying product

### 6.4 Points System

**Earning Points:**
- Only registered (non-guest) customers earn points
- Rate: **1 point per IDR 1,000 spent** (calculated on subtotal only, not shipping, not discount)
- Points are awarded after payment `settlement` webhook received
- Fractional points are rounded down (IDR 1,500 = 1 point)
- B2B customers earn double points (2 points per IDR 1,000)

**Redeeming Points:**
- Minimum redemption: 100 points
- Conversion: 100 points = IDR 1,000 discount
- Maximum redemption per order: 50% of subtotal value
- Points can be redeemed simultaneously with a coupon
- Points deducted at order creation (before payment)
- If payment fails: points are reversed back to customer account
- Points shown as line item in order summary: "Poin Digunakan: -IDR X,000"

**Points Expiry:**
- Points expire **1 year from the date they were earned**
- Each points transaction has its own expiry date
- FIFO redemption: oldest points used first
- 30 days before expiry: send reminder email
- Expired points shown in history as "Kedaluwarsa"

**Points History:**
Each points_history record stores:
- Type: `earn` or `redeem` or `expire` or `adjust` (manual admin adjustment)
- Points amount
- Related order number (if applicable)
- Description (e.g. "Pembelian DDK-20260512-0047" or "Penukaran Poin")
- Date

### 6.5 Discount Priority & Stacking
When both coupon and points applied:
1. Apply coupon discount first to subtotal
2. Apply points discount to remaining subtotal
3. Add shipping cost
4. Final total = (subtotal - coupon - points) + shipping

Example:
```
Subtotal:        IDR 240,000
Coupon (10%):   -IDR  24,000
Points (500):   -IDR   5,000
Shipping:       +IDR  25,000
─────────────────────────────
Total:           IDR 236,000
```

---

## 7. PRODUCT & INVENTORY RULES

### 7.1 Product Structure
Each product has:
- Name (bilingual: ID + EN)
- Slug (auto-generated from name, URL-safe)
- Description (bilingual, rich text)
- Category
- Images (multiple, Cloudinary URLs, first image = thumbnail)
- Weight in grams (used for shipping calculation — total weight = sum of all items)
- Halal status (boolean, default true — all products are halal)
- Is active (boolean — inactive products hidden from store)
- Is featured (boolean — shown in featured section on homepage)
- B2B available (boolean — shown in B2B catalog)

### 7.2 Variant Structure
Each product variant has:
- Name (e.g. "25 pcs", "50 pcs", "1 kg")
- Price (IDR, integer)
- B2B Price (IDR, integer — separate from regular price)
- Stock (integer)
- SKU (unique identifier)
- Is active (boolean)

### 7.3 Stock Rules
- Stock is tracked per variant (not per product)
- Stock is deducted immediately on payment `settlement` (not on order creation)
- If payment fails: stock is NOT deducted (was reserved but never confirmed)
- Stock reservation (soft hold) during payment: NO — first come first served
- When stock = 0: variant shows "Habis" badge, add to cart button disabled
- When stock < 5: show "Tersisa X pcs" warning on product page
- Negative stock is NOT allowed (system enforces minimum 0)

### 7.4 Manual Stock Sync Workflow
- Warehouse staff accesses `/admin/inventory` on mobile
- Page shows all active variants with current stock count
- Staff taps a variant → input field appears with current value
- Staff types new stock count → taps "Simpan"
- System logs the change: who changed, old value, new value, timestamp
- No bulk import in V1 — each variant updated individually

### 7.5 Product Seeding
At project initialization, seed the database with all 19 SKUs scraped from the Dapur Dekaka Shopee store (https://shopee.co.id/dapurdekaka). For each product include:
- Product name (Bahasa Indonesia)
- All variants with Shopee prices as reference (website prices set 15-20% below Shopee)
- Weight estimate based on product type
- Category assignment
- Placeholder Cloudinary URL for image (to be replaced by admin)

### 7.6 Categories (Initial Seed)
- Dimsum
- Siomay
- Bakso & Sosis
- Snack Frozen
- Paket Hemat

---

## 8. SHIPPING & LOGISTICS RULES

### 8.1 Origin Address
- **Name:** Dapur Dekaka
- **Address:** Jl. Sinom V no. 7, Turangga, Bandung
- **City:** Bandung
- **RajaOngkir City ID:** 23
- **Province:** Jawa Barat

### 8.2 Courier Restrictions
ONLY the following cold-chain services are shown to customers:
| Courier | Service Code | Service Name | Notes |
|---|---|---|---|
| SiCepat | FROZEN | SiCepat Frozen | Primary recommendation |
| JNE | YES | JNE YES (next-day) | Premium option |
| AnterAja | FROZEN | AnterAja Frozen | Alternative |

**Important:** Do NOT show regular JNE REG, J&T Express, Pos Indonesia, or any non-frozen service. Frozen products require cold-chain handling.

If RajaOngkir returns no results for these specific services to a destination, show:
> "Mohon maaf, layanan pengiriman frozen ke daerah Anda belum tersedia. Silakan hubungi kami via WhatsApp untuk solusi pengiriman khusus."
> [WhatsApp button]

### 8.3 Shipping Calculation
- Weight = sum of (variant weight_gram × quantity) for all items in order
- Minimum billable weight: 1000g (1 kg)
- Weight rounded up to nearest 100g for API call
- Shipping cost displayed in IDR, no markup from RajaOngkir price in V1
- RajaOngkir API called server-side to protect API key

### 8.4 Tracking Number Management
- Tracking number entered by warehouse staff in `/admin/shipments`
- Format: free text (different per courier)
- When tracking number saved: order status auto-updates to `shipped`
- Tracking number displayed on:
  - Customer order tracking page
  - Customer account order detail
  - Email notification sent to customer
  - PDF receipt (if available at time of download)
- Deep-link to courier tracking page (pre-built links per courier):
  - SiCepat: `https://www.sicepat.com/checkAwb?awb=[tracking_number]`
  - JNE: `https://www.jne.co.id/id/tracking/trace/[tracking_number]`
  - AnterAja: `https://anteraja.id/tracking/[tracking_number]`

### 8.5 Order Status Notifications
| Status Change | Customer Notification |
|---|---|
| `pending_payment` → `paid` | Email: "Pesanan dikonfirmasi" + PDF receipt |
| `paid` → `processing` | No notification |
| `processing` → `packed` | No notification |
| `packed` → `shipped` | Email: "Pesanan dikirim" + tracking number + courier link |
| `shipped` → `delivered` | Email: "Pesanan tiba" + thank you + points earned info |
| Any → `cancelled` | Email: "Pesanan dibatalkan" + refund info if applicable |

---

## 9. AUTH, ACCESS CONTROL & SECURITY

### 9.1 Authentication Methods
- **Google OAuth 2.0** — "Masuk dengan Google" button
- **Email + Password** — with bcrypt hashing (min 8 chars)
- **Guest Checkout** — no account required, email collected for order tracking

### 9.2 Session Rules
- Session duration: 30 days (remember me by default)
- Session stored in Neon PostgreSQL via NextAuth adapter
- JWT strategy with database session for security

### 9.3 Role Permission Matrix

| Permission | Guest | Customer | B2B | Warehouse | Owner | Superadmin |
|---|---|---|---|---|---|---|
| Browse products | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Add to cart | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Checkout | ✅ | ✅ | ✅ | ❌ | ✅ | ✅ |
| Earn points | ❌ | ✅ | ✅✅ | ❌ | ❌ | ❌ |
| View own orders | ❌ | ✅ | ✅ | ❌ | ✅ | ✅ |
| View all orders | ❌ | ❌ | ❌ | ⚠️ limited | ✅ | ✅ |
| Update order status | ❌ | ❌ | ❌ | ⚠️ shipped only | ✅ | ✅ |
| Manage products | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage inventory | ❌ | ❌ | ❌ | ✅ | ✅ | ✅ |
| Manage coupons | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| View revenue | ❌ | ❌ | ❌ | ❌ | ✅ | ✅ |
| Manage users | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| System settings | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| AI content tools | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |
| Approve B2B Net-30 | ❌ | ❌ | ❌ | ❌ | ❌ | ✅ |

### 9.4 Security Requirements
- All admin routes protected by Next.js middleware — redirect to login if no valid session
- Warehouse staff middleware: only allow `/admin/inventory` and `/admin/shipments`
- Midtrans webhook: verify `SHA512(orderId + statusCode + grossAmount + serverKey)` signature before processing
- All API routes validate session and role server-side (not just client-side)
- Environment variables never exposed to client (NEXT_PUBLIC_ prefix only for safe client keys)
- Cloudinary upload signed — no direct unsigned uploads from client
- Rate limiting on: `/api/auth/*`, `/api/coupons/validate`, `/api/checkout/*`
- Input sanitization on all text fields before database insertion
- `full_export.sql` must be added to `.gitignore` immediately

### 9.5 Guest Order Tracking
- Guest can track order at `/orders/[orderNumber]`
- Must enter email used at checkout to verify ownership
- If email matches order: show full order detail
- If no match: show generic "Order not found" message

---

## 10. OUT OF SCOPE (V1)

The following features are explicitly NOT part of V1. Do not build these:

| Feature | Reason Deferred |
|---|---|
| Cash on Delivery (COD) | Operational complexity, logistics risk |
| Installment / cicilan payment | Requires Midtrans GoPayLater setup |
| Product reviews & ratings | Need order volume first |
| Automated TikTok/Instagram posting | API complexity, not validated yet |
| Mobile app (iOS/Android) | Website first, app after traction |
| Multi-vendor / marketplace | Single brand only |
| Live chat widget | WhatsApp CTA sufficient for V1 |
| Affiliate / referral program | Post-traction feature |
| Automated courier tracking sync | Manual tracking sufficient for V1 |
| Multi-warehouse | Single origin in Bandung |
| Subscription / recurring orders | Post-traction feature |
| Product bundles (custom) | Can use buy_x_get_y coupon instead |
| Flash sale / countdown timer | Post-launch marketing feature |
| Dark mode | Light mode only, per brand decision |
| Push notifications | Post-launch |
| Export to accounting software | Post-launch |
| Multi-currency | IDR only |
| COD payment | Not supported |

---

*End of PRD.md v1.0*
*Next document: TECH_STACK.md*
````

That's the complete PRD. Every business rule, every flow, every feature priority is locked down — Cursor now has zero ambiguity about what to build. Ready for `TECH_STACK.md` next?