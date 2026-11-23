# Agent 20×10 execution progress (2026-11-23)

Midtrans stays sandbox. Biteship stays test.

## Shipped this session (code)

| Item | Status |
|------|--------|
| S02 Google OAuth `DrizzleAdapter` plural tables | Fixed in `lib/auth/config.ts` |
| S02 OAuth role hydrate + deletedAt check | Done |
| S02 admin role/active → `tokenVersion++` | Done |
| S02 login `?inactive=1` message | Done |
| S03 saved address needs pin + hide map when selected | Done |
| S03 logged-in identity no longer skipped | Done |
| S03 postal code 5-digit required | Done |
| S05 pickup page email gate (no code leak / no order# fallback) | Done |
| S05 free_shipping client + admin picker blocked | Done |
| S14 `/account/vouchers` middleware flag guard | Done |
| S01 `TOTP_ENCRYPTION_KEY` on Vercel Production | Added via CLI |

## Blocked without secrets Bashara must supply

| Key | Why |
|-----|-----|
| `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY` | Checkout map fails live (“Peta tidak dapat dimuat”) — not in Vercel or local `.env` |
| `FONNTE_API_KEY` (+ device) | WA alerts skipped; cron logs confirm missing |
| `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN` | No production error alerting |

## Human / legal / physical (cannot automate)

- 2FA enroll on all admin devices
- Lawyer sign-off legal pages
- Warehouse physical stock recount + Field Book Kurir UI click
- Midtrans Snap browser open confirmation
- Resend inbox confirmation
- Carousel production images / real testimonials
- Replace seed WA `6289673737886` if not the real line
- Biteship dashboard: enable couriers + webhook URL confirm

## Next deploy

Push `feature/prod-ready-20x10` → PR → merge → redeploy Production so OAuth + pickup gate go live.
