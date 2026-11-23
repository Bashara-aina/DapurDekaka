# Agent 20×10 execution progress (2026-11-23)

Midtrans stays sandbox. Biteship stays test.

## Shipped (code + ops)

| Section | Status |
|---------|--------|
| S01 Env | TOTP on Vercel Prod; Upstash present; Maps/Fonnte/Sentry still missing keys |
| S02 Auth | OAuth adapter + tokenVersion + strong password + guest redirect register + inactive login msg |
| S03 Address | Area search (Biteship), postal 5-digit, saved-addr pin gate, map hide when saved |
| S04 Delivery | Smoke Biteship 0 hard failures; empty-rates i18n; Jabodetabek express WARN (courier activation) |
| S05 Checkout | Pickup email gate; free_shipping blocked |
| S06 Midtrans | Webhook Vitest green; sandbox keys remain |
| S07 Biteship | smoke book+cancel grab/instant GREEN |
| S08 Notify | Fonnte still missing key — documented in gate |
| S09 Catalog | 15 active products; gallery instagram_feed=6 + about_hero |
| S10 Marketing | Carousel still seed titles — human replace |
| S11 Legal | privacy/refund/terms/trust/about **published** |
| S12 Settings | legacy rajaongkir + PROMO_* deleted; WA seed may remain |
| S13 Admin | rate limits + field dispatch wrap; 2FA enroll = human |
| S14 Security | vouchers guard, password policy, validateEnv log, admin rate limits |
| S15 Flags | vouchers guarded; samplerPromo documented unused |
| S16 Obs | health config includes Maps/TOTP/Sentry; Sentry DSN still missing |
| S17 Neon | singular auth tables gone; legacy settings deleted |
| S18 E2E | Vitest + biteship smoke; browser Snap UAT = human |
| S19 Docs | PRD/TECH/SCHEMA/CURSOR/GO-LIVE/PRODUCTION archived+bannered; dekaka-early patched |
| S20 Gate | [`docs/SOFT-LAUNCH-GATE.md`](SOFT-LAUNCH-GATE.md) |

## PRs

- #18 OAuth/pickup/checkout soft-launch
- follow-up: `feature/prod-ready-20x10-continue`

## Human blockers (cannot invent)

1. `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
2. `FONNTE_API_KEY` (+ device)
3. `SENTRY_DSN` / `NEXT_PUBLIC_SENTRY_DSN`
4. 2FA enroll, lawyer sign-off, warehouse recount, Snap browser open, Field Book Kurir click, carousel images, confirm WA number
