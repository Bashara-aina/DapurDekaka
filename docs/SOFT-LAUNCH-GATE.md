# Soft-launch announce gate (S20)

**Constraint:** Midtrans stays sandbox. Biteship stays test. Soft-launch banner/noindex stay ON.

## Agent-verified (2026-11-23)

- [x] Google OAuth adapter uses plural tables (deployed via PR #18 + follow-up)
- [x] Pickup code gated by email/session
- [x] Checkout identity/phone not skipped for logged-in users
- [x] Area search via Biteship (works without Google Maps)
- [x] Postal code 5-digit required
- [x] free_shipping blocked client+admin
- [x] vouchers route flag-guarded
- [x] Biteship smoke: 0 hard failures (grab/instant book+cancel OK)
- [x] CMS legal pages published (privacy/refund/terms/trust/about)
- [x] Legacy `rajaongkir_origin_city_id` + `PROMO_*` uppercase keys deleted
- [x] `TOTP_ENCRYPTION_KEY` on Vercel Production
- [x] Vitest 154 green (prior pass)

## Still required before customer announce

- [ ] `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` on Production (pin UX)
- [ ] `FONNTE_API_KEY` (+ device) for WA
- [ ] `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`
- [ ] Human: Midtrans Snap sandbox open once in browser
- [ ] Human: Biteship dashboard webhook URL confirmed
- [ ] Human: Field **Book Kurir** UI click on one paid order
- [ ] Human: Resend inbox confirmation email
- [ ] Human: 2FA enrolled on all admin accounts
- [ ] Human: Lawyer sign-off OR accept soft-launch legal risk
- [ ] Human: Confirm WA `6289673737886` is the real business line
- [ ] Human: Carousel production images (seed promo still shows)
- [ ] Human: Warehouse stock recount

## Explicitly deferred (not this gate)

- Midtrans live keys / `MIDTRANS_IS_PRODUCTION=true`
- Biteship `biteship_live.*`
- Soft-launch banner OFF / robots index ON
