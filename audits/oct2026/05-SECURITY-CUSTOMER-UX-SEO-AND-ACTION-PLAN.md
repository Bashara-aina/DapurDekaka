# 05 — Security, Customer Experience, SEO & Action Plan

**Audit date:** 2026-10-19 · **Commit:** `d646f56`

---

## Part A — Security & Auth

### What's solid
JWT sessions with `secure` cookies, bcrypt, TOTP 2FA with backup codes, rate limiting via Upstash on auth/checkout/webhooks, reset tokens hashed with prefix lookup, password reset/2FA disable bump `tokenVersion`, Midtrans signature + amount verification, CSP + security headers, signed Cloudinary uploads (admin-only), DOMPurify on CMS/blog HTML, every admin API role-checked.

### Findings

| # | Sev | Issue | Evidence | Fix |
|---|---|---|---|---|
| S1 | **HIGH** | **`tokenVersion` is never checked.** It's written into the JWT and bumped on password reset / 2FA disable / password change, but the `jwt` callback never compares it with the DB. Stolen or old sessions survive a password reset for 30 days. | `lib/auth/config.ts:152-195` | In `jwt`, every N minutes (store `t.checkedAt`) re-read `token_version, role, is_active`; if version differs or inactive → return `null` (sign out) |
| S2 | **HIGH** | **Deactivation & role changes don't apply.** `requireAdmin`, `requireActiveUser` and middleware read `role`/`isActive` from the JWT only; refresh happens only on `trigger === 'update'`. | `lib/auth/require-admin.ts:44-52`, `require-active.ts:7-8` | Same as S1 (periodic DB refresh). Covers staff offboarding |
| S3 | HIGH | Public B2B inquiry endpoint has **no rate limit / captcha** and sends an auto-reply to any email typed in → spam relay that burns your Resend domain reputation | `app/api/b2b/inquiry/route.ts` (no `withRateLimit`) | `withRateLimit(…, 'public-strict')`, honeypot field, don't auto-reply until verified or cap per email/day |
| S4 | MED | `GET /api/orders/[orderNumber]` returns the **entire order row** to the owner or anyone who knows number + email: `midtransSnapToken`, `biteshipActualCost`, `shippingMarkupAmount` (your margin), `needsAttentionReason`, internal ids | `app/api/orders/[orderNumber]/route.ts:38-46` | Return an explicit DTO (like the POST handler does) |
| S5 | MED | Order lookup by number+email has no rate limit on GET; order numbers are sequential (`DDK-YYYYMMDD-0001`) | same + `track/[orderNumber]` | Add `withRateLimit`; consider random suffix |
| S6 | MED | CSRF token/same-origin check on only 13 of ~82 mutating routes. Mitigated by NextAuth's `SameSite=Lax` cookies, so low exploitability — but admin mutations (status change, refunds, settings, user invite) should be explicit | `lib/utils/csrf.ts` | Wrap all `app/api/admin/**` mutations with `withCsrf` or `isSameOriginRequest` |
| S7 | MED | 2FA secrets are encrypted with `AUTH_SECRET`; rotating it locks out every 2FA user (documented in code) | `config.ts:91-95` | Separate `TOTP_ENCRYPTION_KEY` |
| S8 | MED | Warehouse can export full customer PII CSV | `export/orders/route.ts:19` | Owner/superadmin only |
| S9 | LOW | CSP `frame-ancestors 'none'` vs `X-Frame-Options: SAMEORIGIN` set in middleware — contradictory, harmless | `next.config.mjs`, `middleware.ts:16` | Keep one |
| S10 | LOW | Webhook idempotency check runs before signature verification | `webhooks/midtrans/route.ts:64-76` | Verify first |
| S11 | LOW | `.env` and `.env.local` contain live Neon credentials and share one DB with production; ensure they never get committed (currently ignored ✅) | — | Neon dev branch for local |

---

## Part B — Customer journey (walked through code + live site)

| Step | Status | Issues |
|---|---|---|
| Land on home | ✅ 200, ~1.4 s | Soft-launch banner on; JSON-LD URLs = localhost |
| Browse `/products`, product page | ✅ prices render (Rp 65.000 …) | Only active products listed ✅ |
| Read Terms / Privacy / Refund | ❌ **500** | File 01 Blocker 3 |
| Read blog post | ❌ **500** | same |
| Add to cart → cart | ✅ | Cart validated server-side via `/api/cart/validate` ✅ |
| Register / Login | ❌ likely broken (DB missing 2FA columns) | File 01 Blocker 1 |
| Forgot password | ❌ email link → localhost | File 01 Blocker 2 |
| Checkout: address + map + courier | ⚠️ | Phase 0 = only **pickup** and **express (instant, Bandung polygon)**. Customers outside Bandung get "hubungi WhatsApp". Make this explicit on product pages *before* checkout |
| COD toggle | ❌ double charge | File 02 C2 — remove |
| Pay with Snap | ⚠️ | Webhook likely 500s today (Blocker 1); redirect methods land on localhost / empty success page (02 H7) |
| Abandon & retry payment | ⚠️ | Old VA payment lost (02 C3); redeemed points lost overnight (03 P1) |
| Success page | ⚠️ | Guest sees limited info without email ✅; points shown before award |
| Track order `/orders/track/...` | ✅ email-verified, Biteship live status | Depends on Biteship webhook working (04 W4) |
| Delivered email / review | ⚠️ | Only if Biteship webhook works; emails may be dropped (02 H8) |
| Account: orders, points, addresses, profile, 2FA | ✅ pages exist | Points may be unredeemable (03 P2) |

**UX improvements worth doing before marketing spend**
1. Delivery-area checker on product page/cart ("Kirim ke: [kecamatan] → Instant ✓ / Pickup only").
2. WhatsApp order fallback CTA on cart & checkout errors (your real conversion channel in phase 0).
3. Show pickup address, hours, and a map on checkout when pickup is chosen (settings `store_address`, `store_opening_hours` exist).
4. Payment-pending page with countdown + "bayar lagi" that reuses the same VA when still valid instead of minting a new one.
5. Clear frozen-food handling copy: ice gel, max transit time, what to do if it arrives thawed (link to refund policy + dispute form).

---

## Part C — SEO & discoverability

| # | Issue | Fix |
|---|---|---|
| SEO1 | Sitemap & robots point to `http://localhost:3000` | Fix `NEXT_PUBLIC_APP_URL` (file 01) |
| SEO2 | Canonical/og:url = apex `dapurdekaka.com`, which 307s to `www` | One canonical host everywhere; 308 redirect |
| SEO3 | Three robots sources (`public/robots.txt`, `app/robots.ts`, `next-sitemap` config) | Keep `app/robots.ts`, move AI-crawler rules in, delete the others + `next-sitemap` dep |
| SEO4 | Blog posts 500 → Google drops them | File 01 Blocker 3 |
| SEO5 | Soft-launch `noindex` while broken is correct; remember to turn off | After checklist |
| SEO6 | Product JSON-LD should include `offers.availability` from stock and `priceCurrency: IDR` (verify on product page) | Add if missing |
| SEO7 | Google Business Profile + Search Console not verifiable from code | Set up; local "dimsum frozen Bandung" intent is the main organic channel |

---

## Part D — Engineering hygiene

- **Migrations:** journal has 9 entries vs 50+ SQL files; duplicate `0052_*`. Baseline, renumber, and run `drizzle-kit migrate` in CI against a Neon branch before deploy.
- **Audit sprawl:** `audits/` has 100+ historical files from different tools that contradict each other. Archive everything except `audits/oct2026/` into `audits/archive/`.
- **Tests:** 131 good unit tests, but none cover the bugs above (initiate payload trust, cancel-path ledger, retry webhook). Add integration tests against a Neon branch for initiate → webhook → cancel.
- **Observability:** Sentry is installed; make sure `SENTRY_DSN` is set in Vercel and money paths use `captureException`, not only `logger`.
- **`@types/node` 20 vs engines node 24.x**; `tsconfig.tsbuildinfo` still committed.

---

## Part E — Action plan

### Phase 0 — Make production work (today, ~1–2 h, no code except one env)
1. Apply `drizzle/0052_add_two_factor_columns.sql` to prod → redeploy `main` (fixes build, login, webhook, blog).
2. Set `NEXT_PUBLIC_APP_URL=https://www.dapurdekaka.com` → redeploy.
3. Verify env vars in Vercel (file 01 Blocker 4) and add `biteship_origin_*` settings.
4. Verify legal pages + blog = 200.
5. Delete E2E orders from prod.

### Phase 1 — Money safety (1–2 days) — must ship before taking real orders
| Item | File |
|---|---|
| Server-only discount; `totalAmount ≥ 1` guard | 02 C1 |
| Remove COD | 02 C2 |
| Webhook resolves retry/old Midtrans ids | 02 C3 |
| Cancel paid order without API refund → refund queue | 02 C4 |
| Reject inactive products; take weight/name/SKU from DB | 02 H1, H2 |
| One `reverseRedeemedPointsTx` with ledger row | 03 P1 |
| `waitUntil` for all notifications | 02 H8 |
| Dispatch booking race guard | 04 W2 |
| Pickup code verification + unified pickup states | 04 W9, W10 |

### Phase 2 — Operate with confidence (week 1 after launch)
- JWT periodic DB refresh (`tokenVersion`, role, isActive) — 05 S1/S2
- Owner new-order WhatsApp/email alert — 04
- Stock reservation or oversell→refund queue — 02 H3
- Partial FIFO (`points_remaining`) — 03 P2
- Biteship webhook verification confirmed with a real shipment — 04 W4
- Rate limit + honeypot on B2B inquiry — 05 S3
- Order API DTO (stop leaking markup) — 05 S4
- Midtrans `capture`/`refund` notification handling — 02 H5, H6
- Fix `vercel.json` cron glob + `force-dynamic` on health — 01

### Phase 3 — Grow (weeks 2–4)
- Delivery-area checker, WA fallback CTAs, pickup map — Part B
- Canonical host, single robots, Search Console, GBP — Part C
- Coupon product targeting, single coupon validator — 03 K6/K7
- Decide B2B points multiplier and Net-30 (`confirm-payment` is effectively a no-op because initiate already awards Net-30 points)
- Integration test suite on a Neon branch; archive old audits

### Definition of "ready to use"
A stranger in Bandung can: open the site → read the refund policy → register → order 2 packs for instant delivery and 1 for pickup → pay by QRIS and by BCA VA (one after a retry) → receive confirmation emails → see the order move to shipped/delivered with a working tracking link → get the right points, still redeemable the next day. And the owner can: get notified, pack, book courier, hand over a pickup with a code, cancel a VA-paid order and track the refund — with `balance == SUM(ledger)` holding for every user.
