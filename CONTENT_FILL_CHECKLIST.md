# Track D — Content Fill Checklist

Post-code checklist for filling real business content via admin dashboard and Cloudinary. Complete after Tracks A–C (CMS schema, wiring fixes, storefront consumers) are deployed.

## 1. Cloudinary assets

- [ ] Upload all 11 product PNGs to `dapurdekaka/products/` (see ASSETS.md mapping)
- [ ] Upload 3 sauce images to `dapurdekaka/sauces/`
- [ ] Upload gallery images `gallery-01` … `gallery-33` to `dapurdekaka/gallery/`
- [ ] Upload OG image to `dapurdekaka/og-image`
- [ ] Update each product's Cloudinary image in `/admin/products`
- [ ] Run `npm run db:seed:cms` (dev only) or verify gallery rows in `/admin/gallery`

## 2. Catalog — prices, stock, dimensions

- [ ] Set real retail prices on every variant (25 pcs / 50 pcs)
- [ ] Set B2B prices where applicable
- [ ] Set accurate stock levels in `/admin/inventory`
- [ ] Add product dimensions (cm) and weight where missing
- [ ] Mark featured products for homepage (`isFeatured`)
- [ ] Verify halal badge and product descriptions (ID + EN)

## 3. Carousel

- [ ] Replace 3 seed carousel slides with production Cloudinary images
- [ ] Update titles/subtitles/CTAs in `/admin/carousel`
- [ ] Set `carousel_speed_ms` in Settings → Promo (default 5000)

## 4. Promo

- [ ] Run `npm run db:migrate:settings` once if legacy `PROMO_*` keys exist
- [ ] Set `promo_code`, `promo_title`, `promo_subtitle` in Settings → Promo
- [ ] Enable `promo_active` and verify matching coupon is active in `/admin/coupons`
- [ ] Remove misleading "gratis ongkir" copy unless a free-shipping coupon is intentionally live

## 5. Testimonials

- [ ] Add 3–5 real customer testimonials in `/admin/testimonials`
- [ ] Include name, rating, content ID (+ EN optional), sort order

## 6. Blog

- [ ] Publish ≥1 blog post via `/admin/blog`
- [ ] Remove or redirect static blog routes if they still shadow CMS slugs
- [ ] Verify blog categories if used

## 7. CMS pages (after `db:seed:cms` or manual entry)

- [ ] **home-why** — Why Dekaka features
- [ ] **home-cta** — Homepage CTA blocks
- [ ] **about** — Story, values, hero image
- [ ] **trust** — Customer Promise Charter
- [ ] **privacy** — Privacy policy (UU PDP)
- [ ] **refund** — Refund / claim policy
- [ ] **terms** — Terms of service
- [ ] **b2b-landing** — B2B hero, benefits, motion copy
- [ ] **Instagram gallery** — Pick 6 images for `instagram_feed` usage
- [ ] **About hero** — Confirm `about_hero` gallery image

## 8. Store settings

- [ ] `store_whatsapp_number` (not legacy `whatsapp_number`)
- [ ] Store address, opening hours, open days, Sunday hours
- [ ] Biteship origin lat/lng/address/postal code
- [ ] `instagram_url` and `instagram_handle`
- [ ] `og_image_public_id`
- [ ] `admin_email`
- [ ] Soft launch banner toggle + WA message
- [ ] Points rules (earn rate, expiry, min/max redeem) if different from defaults

## 9. SEO & static assets

- [ ] Verify Organization / LocalBusiness JSON-LD (founding year, price range, coords)
- [ ] Confirm logo, halal badge, favicon resolve in production (`/public/assets/logo/`)
- [ ] Set `founding_year`, `price_range_min`, `price_range_max` in Settings → SEO

## 10. Smoke test

- [ ] Homepage: carousel, promo, why, gallery, testimonials, CTA
- [ ] About / trust / privacy / refund / terms pages render CMS content (fallback to i18n if empty)
- [ ] B2B landing benefits from CMS
- [ ] Footer WA number and address from DB settings
- [ ] `GET /api/settings/public` returns store hours, WA, address

---

**Scripts**

| Command | Purpose |
|---------|---------|
| `npm run db:seed:cms` | Idempotent CMS page + gallery seed (dev only) |
| `npm run db:migrate:settings` | One-shot legacy settings key migration |

**Out of scope for Track D:** live Instagram API, auto-translate CMS fields, payment/shipping provider changes.
