# Human Launch Checklist — DapurDekaka.com

**Who this is for:** Bashara (owner), admin content, warehouse operator, and external vendors (lawyer, Midtrans, Biteship, Google, Resend DNS).

**What this is NOT:** Code work for the AI agent. Agent work lives in the Cursor plan (`production_launch_checklist`) — code fixes, tests, docs sync, wiring helpers.

**Rule:** Do **sandbox Midtrans + Biteship test** first. Sync real products/photos next. Flip **live keys only after** both are green.

### Guided how-to (role split)

| Role | Follow |
|------|--------|
| **Developer + Agent** (env, Midtrans, Biteship, UAT, live flip) | [`GUIDED-LAUNCH-WALKTHROUGH.md`](GUIDED-LAUNCH-WALKTHROUGH.md) — session-by-session |
| **Warehouse / Admin** (harga, foto, stok, packing, CMS — **admin UI only**) | [`WAREHOUSE-ADMIN-PLAYBOOK.md`](WAREHOUSE-ADMIN-PLAYBOOK.md) |

This file stays the **master checkbox list**. The two docs above are the click-by-click scripts.

**Related:** [`CONTENT_FILL_CHECKLIST.md`](../CONTENT_FILL_CHECKLIST.md) · [`GO-LIVE-CHECKLIST.md`](../GO-LIVE-CHECKLIST.md) · [`ASSETS.md`](../ASSETS.md) · [`SANDBOX-UAT-SUPPORT.md`](SANDBOX-UAT-SUPPORT.md)

---

## How to use

1. Work top to bottom within each phase.
2. Check boxes only when **you** verified it (not when seed/default still shows).
3. Admin paths assume you are logged in as `superadmin` or `owner` on the live/admin URL.
4. Anything marked **LEGAL** needs lawyer sign-off before you announce.

---

## Phase 0 — Decide launch surface

- [x] Soft launch stays **on** until sandbox money + courier pass (banner + noindex OK).
- [x] Keep flags **OFF** for launch unless you QA them separately: B2B portal, Blog CMS flag, AI content, Vouchers (`NEXT_PUBLIC_FLAG_*`).
- [x] Confirm launch city/scope: **broader delivery** (`shipping_phase=phase2` + soft override while soft launch banner ON). Express + frozen same-day + intercity frozen express (min order rules masih berlaku).
- [x] Confirm catalog: sell all ready SKUs; unfinished → nonaktifkan di `/admin/products` (owner CRUD: tambah/edit/hapus/nonaktif + foto + varian).

---

## Phase A — Sandbox Midtrans (you + dashboards)

Env must stay: `MIDTRANS_IS_PRODUCTION=false`, sandbox keys (`SB-…`).

### A1. Midtrans Sandbox dashboard

- [x] Log into Midtrans **Sandbox**.
- [x] Copy sandbox Server Key + Client Key into the env used for this test (local or Vercel Preview).
- [x] Set Payment Notification URL → `https://www.dapurdekaka.com/api/webhooks/midtrans`.
- [x] Set Finish / Unfinish / Error URLs → checkout success / pending / failed on same host.
- [ ] Confirm Snap opens from `app.sandbox.midtrans.com` (not production Snap) — **human: one browser checkout open**.

### A2. Payment matrix (agent webhook matrix 2026-11-22 GREEN)

- [x] Guest settle → `paid` (DDK-20261122-0008); stock deducted; pickup code random.
- [x] Logged-in settle → `paid` + points awarded (DDK-20261122-0009).
- [x] Retry → Midtrans id `…-retry-1` (DDK-20261122-0010).
- [x] Expire/cancel webhook → `cancelled` (DDK-20261122-0011).
- [x] Admin-cancel paid sandbox → refunds queue pending (`DDK-20261122-0008`, `/admin/refunds`).
- [ ] Confirm customer email arrived (Resend inbox) and WA if Fonnte is configured — **Fonnte belum di `.env`**.
- [ ] Confirm owner new-order alert (email and/or WA).
- [x] Evidence order numbers logged above.
- [ ] Purge sandbox test orders when done (ask agent for `purge-e2e-orders` if needed).

**Stop rule:** If webhook never settles to `paid`, do not proceed to live keys. Ping agent with order number + Midtrans notification log.

---

## Phase B — Biteship test courier path (you + dashboards)

Env: `BITESHIP_API_KEY=biteship_test.*`. Keep Midtrans on sandbox so delivery orders are unpaid with monopoly money.

### B1. Biteship test setup

- [x] Create/confirm Biteship **test** API key (`biteship_test.*` in env).
- [x] Set origin = warehouse (Jl. Sinom V No. 7, Turangga, Bandung) — DB + smoke OK.
- [ ] Register test webhook → `https://www.dapurdekaka.com/api/webhooks/biteship` — **confirm in Biteship dashboard**.
- [x] `BITESHIP_WEBHOOK_SECRET` set (not the API key).
- [x] Cold-chain filter: express grab/instant + frozen express sicepat (REG plain filtered where applicable).
- [x] `npm run smoke:biteship` — 0 hard failures (book+cancel GREEN).

### B2. Delivery + pickup UAT

- [x] Agent book path GREEN: Session3 dispatch grab/instant book+cancel (`DDK-E2E-20261122-79`).
- [ ] Open `/admin/field` — mark packed → **Book Kurir** once on a real paid delivery (UI click UAT).
- [ ] Receive/simulate Biteship status → shipped → delivered.
- [ ] Check `/orders/track/[orderNumber]` updates.
- [x] Pickup code is random (not order number) — verified on settle matrix pickup `619254`.
- [ ] Confirm shipped/delivered email + WA after webhook.
- [x] Do **not** switch to `biteship_live.*` until Phase C–D (catalog/photos) done.

---

## Phase C — Cloudinary media (you upload)

Folder conventions from `ASSETS.md`.

### C1. Product photos (11)

Upload to Cloudinary folder `dapurdekaka/products/`, then set image on each product in `/admin/products`:

- [ ] `dimsum-crabstick` ← Dimsum Crabstick
- [ ] `dimsum-jamur` ← Dimsum Jamur
- [ ] `dimsum-mozarella` ← Dimsum Mozarella
- [ ] `dimsum-tuna` ← Dimsum Tuna
- [ ] `dimsum-golden` ← Dimsum Golden
- [ ] `dimsum-pedas` ← Dimsum Pedas
- [ ] `lumpia-kulit-tahu` ← Lumpia (Kulit Tahu)
- [ ] `dimsum-nori` ← Dimsum Nori
- [ ] `dimsum-rambutan` ← Dimsum Rambutan
- [ ] `ekado` ← Ekado
- [ ] `pangsit-ayam` ← Pangsit Ayam

### C2. Sauces (if shown)

- [ ] `dapurdekaka/sauces/chilli-oil`
- [ ] `dapurdekaka/sauces/saos-mentai-mayo`
- [ ] `dapurdekaka/sauces/saos-tartar`

### C3. Gallery + OG

- [ ] Upload `gallery-01` … `gallery-33` → `dapurdekaka/gallery/`
- [ ] Upload OG image → `dapurdekaka/og-image`
- [ ] In `/admin/gallery`: pick **6** images for usage `instagram_feed`
- [ ] In `/admin/gallery`: set `about_hero` image
- [ ] Settings → SEO: set `og_image_public_id`

### C4. Visual smoke (browser)

- [ ] Homepage carousel/gallery: no broken images
- [x] Catalog + each PDP: real product photo (Shopee listing images → Cloudinary, Nov 2026 sync)
- [ ] Cart thumbnails OK
- [ ] Logo + halal badge + favicon on production/preview

---

## Phase D — Catalog truth (admin — replace seed prices/stock)

**Synced 2026-11-22/23 from live Shopee shop** (`npm run sync:shopee`). Website prices = Shopee normal/base. Canonical SKUs = `DDK-*` (see `docs/SHOPEE-SKU-REMAP-CHECKLIST.md` + `data/shopee-model-crosswalk.json`).

### D1. Per-product checklist

Active catalog is the **15 Shopee listings** (not the old 11 studio-only seed names). Off-Shopee products deactivated.

- [x] All active rows filled with **real** prices (integer IDR from Shopee base).
- [x] Stock seeded from Shopee listing stock (re-count warehouse in `/admin/inventory` before hard launch if needed).
- [x] Weight set per variant from sync defaults (re-verify dims for Biteship if quotes look off).
- [x] Long description ID + EN from Shopee copy.
- [x] Halal flag + real `shopee_url` per product.
- [x] B2B prices = 85% of retail (auto); portal flag left on.
- [x] Unfinished / off-Shopee products `isActive=false`.
- [x] Featured products set from sync (Mix, Lumpia, Nori, Pangsit, Katsu, etc.).

### D2. Categories

- [x] Categories match sell set: Dimsum Premium / Klasik / Spesial / Lumpia & Ekado / Pangsit / **Saus & Dressing**.
- [x] Empty off-catalog products hidden; sauce category active.

---

## Phase E — Homepage & marketing content (admin)

### E1. Carousel — `/admin/carousel`

Seed shows promo “SELAMATDATANG / 10% / dikirim ke seluruh Indonesia” with seed Cloudinary IDs.

- [ ] Replace all 3 slides with production images
- [ ] Rewrite title / subtitle / CTA / badge (or remove badge)
- [ ] Confirm links go to real catalog or WA
- [ ] Settings → Promo: `carousel_speed_ms` (e.g. 5000)

### E2. Promo banner + coupons — Settings → Promo + `/admin/coupons`

Seed: `SELAMATDATANG` 10% (min 50k), `GRATISONGKIR` free shipping (min 150k). Homepage falls back to code `SELAMATDATANG` if settings missing.

- [ ] Decide launch promo (or turn `promo_active=false`)
- [ ] Create/edit coupon in `/admin/coupons` to match
- [ ] Set `promo_code`, `promo_title`, `promo_subtitle`, `promo_active`
- [ ] Deactivate `GRATISONGKIR` unless you truly offer free shipping
- [ ] Remove any “gratis ongkir” homepage copy if coupon is inactive

### E3. Why + CTA CMS

- [ ] `/admin/cms/home-why` — real “Why Dekaka” features (or accept i18n fallback after review)
- [ ] `/admin/cms/home-cta` — real CTA copy + links

### E4. Testimonials — `/admin/testimonials`

Seed has **0** testimonials → section hidden. Do **not** invent reviews.

- [ ] Add 3–5 **real** customer testimonials (name, rating, content ID, sort order)
- [ ] Or deliberately leave empty (section stays hidden)

### E5. Instagram gallery section

- [ ] 6 `instagram_feed` images set (Phase C)
- [ ] Settings: `instagram_url`, `instagram_handle` real

---

## Phase F — About, Trust, Legal pages (admin + LEGAL)

If CMS missing/unpublished, public pages show **"Konten … sedang disiapkan."** — must not ship.

### F1. About — `/admin/cms/about`

- [ ] Hero copy + image (`about_hero`)
- [ ] Story / values accurate
- [ ] Remove false “free shipping on first purchase” if not true
- [ ] Verify MUI/halal claim text matches real cert (i18n currently shows **MUI 001/2020** — confirm or change via agent/i18n)

### F2. Trust — `/admin/cms/trust` — **LEGAL**

- [ ] Customer Promise Charter reviewed (promises, non-promises, SLA, disputes)
- [ ] Matches how warehouse actually operates

### F3. Privacy — `/admin/cms/privacy` — **LEGAL**

- [ ] UU PDP–ready privacy policy published
- [ ] Contact email `privasi@…` (or your real privacy mailbox) exists and is monitored
- [ ] Page does **not** show “sedang disiapkan”

### F4. Refund — `/admin/cms/refund` — **LEGAL**

- [ ] Frozen-food / cold-chain claim & return rules match real ops
- [ ] Matches admin refund workflow you will actually use
- [ ] Published (no “sedang disiapkan”)

### F5. Terms — `/admin/cms/terms` — **LEGAL**

- [ ] Terms of service reviewed and published
- [ ] Last-updated date correct

---

## Phase G — Blog (optional for launch)

If Blog CMS flag is off and you still expose `/blog`:

- [ ] Delete or unpublish **seed** sample posts (`db:seed:blog` cooking-tip stubs)
- [ ] Publish ≥1 real post with real cover image in `/admin/blog`
- [ ] Or hide blog from nav / keep empty state intentional
- [ ] BlogCTA WA uses real number (env `NEXT_PUBLIC_WHATSAPP_NUMBER` — no reliance on hardcoded `6289673737886`)

---

## Phase H — B2B landing (optional)

Portal flag default **OFF**. Public `/b2b` page may still be reachable.

- [ ] Review hardcoded hero copy on `/b2b` (or edit `/admin/cms/b2b-landing` benefits)
- [ ] Confirm B2B price table disclaimer (“perkiraan”) is acceptable
- [ ] Set real B2B contact WA via `store_whatsapp_number`
- [ ] Decide: leave portal off until after store launch

---

## Phase I — Store settings — `/admin/settings`

### I1. Toko

- [ ] `store_name`, `store_tagline`
- [ ] `store_whatsapp_number` = real business line (replace seed `6289673737886` if still there)
- [ ] `store_address`, `store_city`, `store_province`, `store_postal_code`
- [ ] `store_opening_hours`, `store_open_days`, `store_sunday_hours`
- [ ] `instagram_url`, `instagram_handle`
- [ ] `wa_default_message` (floating button; also align with i18n if needed)
- [ ] `payment_methods` matches Midtrans methods you enable
- [ ] `soft_launch_banner_enabled` / `soft_launch_wa_message` — keep on until go-live announce

### I2. Pengiriman

- [ ] `biteship_origin_lat` / `lng` = exact warehouse pin
- [ ] `biteship_origin_address`, `biteship_origin_postal_code`
- [ ] `free_shipping_threshold` intentional (seed 300000) or disabled via promo policy

### I3. Poin

- [ ] `points_earn_rate`, `points_expiry_days`, `points_min_redeem`, `points_max_redeem_pct`
- [ ] Decide `b2b_points_multiplier` (seed/default **2** — confirm vs finance rule “no 2×”)

### I4. SEO

- [ ] `og_image_public_id`
- [ ] `seo_logo_url`
- [ ] `founding_year`
- [ ] `price_range_min` / `price_range_max`
- [ ] `admin_email` = mailbox that **exists** (receives new-order alerts)
- [ ] `tokopedia_url` / `shopee_url` if used

### I5. Email / payments / maintenance

- [ ] `resend_from_email_orders` / `resend_from_email_generic` if overriding
- [ ] `payment_expiry_minutes` (seed 15), `payment_max_retries` (seed 3)
- [ ] `maintenance_mode=false` when open for customers

### I6. Env vs DB WhatsApp (must match)

- [ ] Vercel/local `NEXT_PUBLIC_WHATSAPP_NUMBER` = same number as `store_whatsapp_number`
- [ ] Ops alerts work (agent can unify helper in code; you must set both values)

---

## Phase J — Team accounts & security (human enrollment)

Agent can enforce 2FA in code; **you** must enroll devices.

- [ ] List of admin accounts: 2× superadmin, owner, warehouse (update if different)
- [ ] Enroll **2FA** on every admin; store backup codes offline
- [ ] Create warehouse login for `/admin/field`
- [ ] Create owner login for orders/products
- [ ] Deactivate test/staff accounts
- [ ] Confirm password-reset email lands with production host (not localhost)
- [ ] Google OAuth login works on production URL (if used)

---

## Phase K — External vendors & infrastructure (Owner)

### K1. Vercel Production env

- [ ] `DATABASE_URL` + `DATABASE_URL_UNPOOLED` (Neon prod)
- [ ] `AUTH_SECRET` (≥32), `TOTP_ENCRYPTION_KEY`
- [ ] `UPSTASH_REDIS_REST_URL` + `TOKEN` (required in prod or rate-limit throws)
- [ ] `CRON_SECRET`
- [ ] Midtrans **sandbox** keys for now; **live** keys only in Phase M
- [ ] Biteship **test** key for now; **live** only in Phase M
- [ ] `BITESHIP_WEBHOOK_SECRET` dedicated
- [ ] Cloudinary keys + cloud name
- [ ] Resend API + from email
- [ ] Fonnte API + device
- [ ] Google Maps key (Maps JS + Places; referrer-restricted)
- [ ] Google OAuth client + callback URLs
- [ ] `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`
- [ ] `NEXT_PUBLIC_APP_URL=https://www.dapurdekaka.com` (or your canonical host)
- [ ] Verify presence via `/api/admin/health/config` (ConfigHealthCard)

### K2. Neon

- [ ] Production project confirmed
- [ ] Separate **dev/preview branch** so local `.env` does not hit prod
- [ ] Backup/PITR retention confirmed
- [ ] One restore drill into a branch
- [ ] Remove stale settings keys (`rajaongkir_*`, duplicate `PROMO_*`) — run `npm run db:migrate:settings` once with care

### K3. Resend DNS

- [ ] Domain verified: SPF, DKIM, DMARC
- [ ] Test send to your inbox (order confirmation template)

### K4. Fonnte

- [ ] Device online
- [ ] Test WA: paid / shipped / delivered / pickup ready

### K5. Google

- [ ] Maps + Places billing enabled
- [ ] OAuth redirect production + preview
- [ ] (Later) Search Console + Business Profile

### K6. Domain

- [ ] `dapurdekaka.com` / `www` SSL
- [ ] Apex → www redirect works

---

## Phase L — Warehouse operator SOP

- [ ] Physical stock count matches `/admin/inventory`
- [ ] Trained: packing queue → mark packed → Book Courier
- [ ] Trained: pickup code handover (customer shows code)
- [ ] Trained: manual resi fallback if Biteship fails
- [ ] Knows where `needs_attention` orders appear
- [ ] Cooler-bag / express tier packing rules understood

---

## Phase M — Live flip (ONLY after A–D green + agent blockers fixed)

- [ ] Agent confirmed: pickup code, webhook secret, sandbox UAT green
- [ ] Real products + photos + legal pages published
- [ ] Flip Midtrans: `MIDTRANS_IS_PRODUCTION=true` + live keys (no `SB-`)
- [ ] Midtrans **Production** notification URL → `https://www.dapurdekaka.com/api/webhooks/midtrans`
- [ ] Flip Biteship live key + wallet topped up
- [ ] Biteship production webhook + secret
- [ ] Disable sandbox webhook endpoints in both dashboards
- [ ] `maintenance_mode=false`
- [ ] Deploy latest `main`
- [ ] One **real** smoke order (small amount): pay → settle → pack → courier or pickup
- [ ] Soft-launch banner/noindex **off** only after smoke green
- [ ] Announce to customers
- [ ] First 48h: watch Midtrans unsettled, Biteship wallet, Fonnte, Vercel cron, Sentry

---

## Phase N — Post-launch human ops (first week)

- [ ] Uptime monitor on `/api/health` (Better Stack / UptimeRobot)
- [ ] Sentry alert on webhook 5xx
- [ ] Daily Biteship wallet check
- [ ] Points-drift SQL = 0 rows (ask agent for query)
- [ ] `needs_attention` queue empty daily
- [ ] Submit sitemap in Search Console after index allowed

---

## Quick “still placeholder?” browser audit

Open each URL and confirm nothing looks seeded/stub:

| URL | Must NOT see |
|-----|----------------|
| `/` | Seed carousel promo if you cancelled it; broken Cloudinary; empty why/CTA if unpublished |
| `/products` | Wrong prices; broken images; inactive SKUs you meant to hide |
| `/products/[slug]` | Short seed-only description if you wanted long copy; wrong MUI number |
| `/about` | Wrong free-shipping claim; wrong founding story |
| `/trust` | Unreviewed promise charter |
| `/privacy-policy` | “Konten kebijakan privasi sedang disiapkan.” |
| `/refund-policy` | “sedang disiapkan” |
| `/terms` | “sedang disiapkan” |
| `/blog` | Sample seed cooking posts / random gallery covers |
| `/b2b` | Wrong contact / wrong B2B prices |
| Footer | Wrong WA, address, hours |
| Soft-launch banner | Still on after you intended to announce |

---

## Role summary

| Role | Owns |
|------|------|
| **Owner (Bashara)** | Env, vendors, sandbox/live payments, Neon, domain, soft-launch switches, announce |
| **Admin content** | Cloudinary, products copy, carousel, CMS, blog, testimonials, settings tabs |
| **Warehouse** | Stock counts, pack/dispatch/pickup SOP |
| **Lawyer** | Privacy, terms, refund, trust/claims |
| **AI agent** | Code fixes, tests, wiring, docs — see Cursor plan (agent section only) |

---

*Last updated: 2026-11-22 — generated from storefront/CMS/seed audit + go-live docs. Prefer this file over scattered audit notes for human fill work.*
