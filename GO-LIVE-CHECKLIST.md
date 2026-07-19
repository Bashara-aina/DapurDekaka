# Go-Live Checklist — DapurDekaka.com

**Last updated:** July 2026 (post Shipping V2 / Biteship)  
**Use this file:** work top-to-bottom. Check each box before flipping production switches.

---

## 1. Database (Neon)

- [ ] **Production Neon project** created and `DATABASE_URL` + `DATABASE_URL_UNPOOLED` set in Vercel
- [ ] **Schema pushed** to production:
  ```bash
  DATABASE_URL_UNPOOLED=... npx drizzle-kit push
  ```
  New columns include: order shipping V2 fields, address `latitude`/`longitude`/`biteship_area_id`, variant `length_cm`/`width_cm`/`height_cm`
- [ ] **Seed run once** on fresh DB (categories, superadmin, system_settings):
  ```bash
  npm run seed   # dev/staging only — or run seed script against prod once manually
  ```
- [ ] **Superadmin account** exists and login works on production URL
- [ ] **Remove old RajaOngkir settings** from `system_settings` if any remain (`rajaongkir_origin_city_id`, etc.)

---

## 2. Environment Variables (Vercel → Production)

Copy from `.env.example`. Set **Production** env in Vercel (not just Preview).

### Required — app will fail without these

| Variable | What to fill | Where to get it |
|----------|--------------|-----------------|
| `DATABASE_URL` | Neon pooled connection string | [neon.tech](https://neon.tech) dashboard |
| `DATABASE_URL_UNPOOLED` | Neon direct connection (migrations) | Same Neon project |
| `AUTH_SECRET` | Random 32+ chars, mixed entropy | `openssl rand -base64 32` |
| `MIDTRANS_SERVER_KEY` | **Production** server key (no `SB-` prefix) | [Midtrans Dashboard](https://dashboard.midtrans.com) → Settings → Access Keys |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | **Production** client key | Same |
| `MIDTRANS_IS_PRODUCTION` | `true` | — |
| `BITESHIP_API_KEY` | `biteship_live.*` key | [Biteship Dashboard](https://dashboard.biteship.com) |
| `BITESHIP_BASE_URL` | `https://api.biteship.com/v1` | Default |
| `BITESHIP_WEBHOOK_SECRET` | HMAC secret from Biteship webhook settings | Biteship dashboard → Webhooks |
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Maps JavaScript + Places API key | [Google Cloud Console](https://console.cloud.google.com) |
| `FONNTE_API_KEY` | Fonnte API token | [fonnte.com](https://fonnte.com) dashboard |
| `FONNTE_DEVICE_ID` | Device ID (if your Fonnte plan requires it) | Fonnte dashboard |
| `SHIPPING_MARKUP_PERCENT` | `20` | Business rule — hidden markup on ongkir |
| `WAREHOUSE_ORIGIN_LAT` | `-6.958` (verify exact pin) | Google Maps pin at warehouse |
| `WAREHOUSE_ORIGIN_LNG` | `107.636` (verify exact pin) | Same |
| `CLOUDINARY_API_KEY` | Cloudinary API key | [cloudinary.com](https://cloudinary.com) |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret | Same |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | Cloud name | Same |
| `RESEND_API_KEY` | Resend API key | [resend.com](https://resend.com) |
| `RESEND_FROM_EMAIL` | `noreply@dapurdekaka.com` (must be verified domain) | Resend → Domains |
| `UPSTASH_REDIS_REST_URL` | Upstash Redis REST URL | [upstash.com](https://upstash.com) |
| `UPSTASH_REDIS_REST_TOKEN` | Upstash Redis REST token | Same |
| `CRON_SECRET` | Random secret for cron auth | `openssl rand -hex 32` |
| `NEXT_PUBLIC_APP_URL` | `https://dapurdekaka.com` | Your domain |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | Store WA number, no `+` (e.g. `62812xxxxxxxx`) | Your business line |

### Auth (Google OAuth)

| Variable | What to fill |
|----------|--------------|
| `AUTH_GOOGLE_ID` | Google OAuth Client ID |
| `AUTH_GOOGLE_SECRET` | Google OAuth Client Secret |

**Google Cloud Console → OAuth client:**
- Authorized redirect URI: `https://dapurdekaka.com/api/auth/callback/google`
- Also add Preview URL if testing on Vercel preview

### Optional but recommended

| Variable | Purpose |
|----------|---------|
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | Error monitoring |
| `MINIMAX_API_KEY` + `MINIMAX_GROUP_ID` | AI caption/blog (superadmin only) |
| `NEXT_PUBLIC_INSTAGRAM_URL` | Instagram link on homepage |

### Remove / do NOT set (deprecated)

- ~~`RAJAONGKIR_API_KEY`~~
- ~~`RAJAONGKIR_ORIGIN_CITY_ID`~~
- ~~`RAJAONGKIR_BASE_URL`~~

---

## 3. External Dashboard Setup

### Midtrans (customer payment)

- [ ] **Production account** activated and business verified
- [ ] **Production keys** copied to Vercel (see above)
- [ ] **Payment notification URL** set in Midtrans dashboard:
  ```
  https://dapurdekaka.com/api/webhooks/midtrans
  ```
- [ ] **Finish / Unfinish / Error redirect URLs** point to your checkout result pages (or Snap handles via `callbacks` in code — verify in sandbox first)
- [ ] Test one **real small payment** (Rp 1.000 product or manual order) before announcing launch

### Biteship (courier booking — NOT customer payment)

- [ ] **Production API key** (`biteship_live.*`) — Order API activated on your plan
- [ ] **Wallet topped up** — Biteship charges wallet when warehouse taps "Book Courier"
- [ ] **Webhook registered:**
  ```
  https://dapurdekaka.com/api/webhooks/biteship
  ```
- [ ] **Webhook secret** copied → `BITESHIP_WEBHOOK_SECRET` in Vercel
- [ ] **Origin address** in Biteship dashboard matches warehouse (Jl. Sinom V No. 7, Turangga, Bandung)
- [ ] Confirm couriers enabled: GoSend, Grab, Paxel, AnterAja, SiCepat, JNE (cold-chain services only — no Borzo, no JNE REG)

### Google Maps

- [ ] **Maps JavaScript API** enabled
- [ ] **Places API** enabled (autocomplete in checkout)
- [ ] **API key restrictions:**
  - HTTP referrers: `https://dapurdekaka.com/*`, `https://*.vercel.app/*` (preview)
  - Restrict to Maps JavaScript API + Places API only
- [ ] Billing account attached (Google gives free tier but requires billing)

### Fonnte (WhatsApp to customers)

- [ ] Device connected and **API key** active
- [ ] Test message to your own number (order paid / shipped / delivered templates)
- [ ] `NEXT_PUBLIC_WHATSAPP_NUMBER` is the **store ops number** (dispatch failure alerts go here too)

### Resend (email)

- [ ] Domain `dapurdekaka.com` **verified** (DNS: SPF, DKIM, DMARC)
- [ ] `RESEND_FROM_EMAIL=noreply@dapurdekaka.com` sends successfully
- [ ] Test: order confirmation, pickup ready, shipped, delivered emails

### Cloudinary

- [ ] Production cloud configured
- [ ] Product images uploaded to `dapurdekaka/products/`
- [ ] Upload preset / signed upload works from admin product form

### Upstash Redis

- [ ] Production Redis instance created (same region as Vercel if possible)
- [ ] Without this, rate limiting falls back to in-memory (not safe on serverless)

---

## 4. Vercel / Cron / Domain

- [ ] **Custom domain** `dapurdekaka.com` connected, SSL active
- [ ] **All env vars** set for Production environment (not only Preview)
- [ ] **Cron jobs** in `vercel.json` deployed (Vercel sends `Authorization: Bearer <CRON_SECRET>`):
  - `/api/cron/cancel-expired-orders` — every 15 min
  - `/api/cron/reconcile-payments` — every 10 min
  - `/api/cron/expire-points` — daily
  - `/api/cron/points-expiry-warning` — daily 09:00
  - `/api/cron/reconcile-points` — daily 03:00
  - `/api/cron/cleanup-counters` — daily 02:00
  - `/api/cron/cleanup-audit-logs` — weekly
- [ ] **Add retry-dispatch cron** (not yet in `vercel.json` — do before launch if you want auto-retry):
  ```json
  { "path": "/api/cron/retry-dispatch", "schedule": "*/30 * * * *" }
  ```
  > Note: retry cron currently calls dispatch API without session auth — verify it works or wire an internal service token before relying on it.

---

## 5. Admin Panel — Data to Fill Before Launch

### Products & inventory

- [ ] All **11 products** live with correct prices (integer IDR), images, categories
- [ ] Every variant has **real stock** counts (not seed placeholders)
- [ ] Every variant has **weight in grams** set
- [ ] Every variant has **dimensions** (`length_cm`, `width_cm`, `height_cm`) — defaults exist but verify for accurate Biteship quotes
- [ ] Halal badge / product slugs correct for SEO URLs

### System settings (`/admin/settings` or DB `system_settings`)

Verify these match your business (seed defaults shown):

| Key | Default | Check |
|-----|---------|-------|
| `biteship_origin_lat` | `-6.958` | Exact warehouse pin |
| `biteship_origin_lng` | `107.636` | Exact warehouse pin |
| `biteship_origin_address` | Jl. Sinom V No. 7… | Full address string |
| `biteship_origin_postal_code` | `40264` | Correct |
| `store_address` | Same as warehouse | Pickup page copy |
| `payment_expiry_minutes` | `15` | OK? |
| `payment_max_retries` | `3` | OK? |
| `points_*` settings | per PRD | OK? |
| `maintenance_mode` | `false` | Must be false at launch |

### Content

- [ ] Homepage carousel slides uploaded
- [ ] Blog posts (if launching with blog)
- [ ] B2B landing page contact info correct
- [ ] Legal pages: privacy policy, refund policy reviewed

### Team access

- [ ] Warehouse role account(s) for field dashboard (`/admin/field`)
- [ ] Owner/superadmin accounts for orders, products, coupons

---

## 6. Pre-Launch Verification (run on staging or production with sandbox keys first)

```bash
npm run type-check
npm run lint
npx vitest run tests/shipping tests/api/checkout/initiate.test.ts
```

### Manual UAT — Bandung (do in order)

- [ ] **Browse → cart → checkout** as guest
- [ ] **Map pin** selects delivery address; autocomplete works
- [ ] **3 shipping tiers** appear with rates; can switch courier within tier
- [ ] **Express tier** shows cooler-bag ack checkbox (required)
- [ ] **Insurance** optional line adds to total correctly
- [ ] **Coupon + points** (logged-in) calculate correctly
- [ ] **Midtrans Snap** opens and payment completes
- [ ] **Webhook** fires → order status `paid`, stock deducted, points awarded (logged-in)
- [ ] **Pickup order** → auto-ready, pickup code = order number, email + WA sent
- [ ] **Delivery order** → field dashboard shows in packing queue
- [ ] Warehouse marks **packed** → taps **Book Courier** → Biteship order created
- [ ] **Tracking page** `/orders/track/[orderNumber]` shows live status
- [ ] **Biteship webhook** updates order → shipped / delivered + customer WA + email
- [ ] **Account addresses** — save address with map pin, reuse at checkout
- [ ] **Payment retry** after expiry (up to 3 times)
- [ ] **Insufficient stock** at checkout blocked server-side

---

## 7. Go-Live Day — Flip These Switches

- [ ] `MIDTRANS_IS_PRODUCTION=true` in Vercel Production
- [ ] Midtrans keys = **live** keys (not `SB-Mid-*` sandbox)
- [ ] `BITESHIP_API_KEY` = **live** key (`biteship_live.*`)
- [ ] Biteship wallet has sufficient balance for expected daily dispatch volume
- [ ] `NEXT_PUBLIC_APP_URL=https://dapurdekaka.com`
- [ ] `maintenance_mode=false` in system_settings
- [ ] Remove/disable any test/sandbox webhook URLs in Midtrans & Biteship dashboards
- [ ] Deploy latest `main` to Vercel Production
- [ ] Smoke test: place one real order end-to-end

---

## 8. Post-Launch — First 48 Hours

- [ ] Monitor Vercel logs for `[checkout/initiate]`, `[webhooks/midtrans]`, `[webhooks/biteship]`, `[admin/field/dispatch]`
- [ ] Monitor Biteship wallet balance daily
- [ ] Check Fonnte delivery rate (failed WA = check device online)
- [ ] Verify cron jobs ran (Vercel → Cron logs)
- [ ] Check Midtrans dashboard for unsettled transactions
- [ ] Warehouse team trained on: pack → Book Courier → enter tracking if manual fallback

---

## Quick Reference — Webhook URLs

| Service | URL |
|---------|-----|
| Midtrans payment | `https://dapurdekaka.com/api/webhooks/midtrans` |
| Biteship courier status | `https://dapurdekaka.com/api/webhooks/biteship` |

---

## Quick Reference — Generate Secrets

```bash
# AUTH_SECRET
openssl rand -base64 32

# CRON_SECRET
openssl rand -hex 32
```

---

*Shipping V2 uses Biteship for rates + dispatch and Midtrans for customer payment only. RajaOngkir is fully removed.*
