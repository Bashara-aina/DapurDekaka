# 04 — Tech Stack & Third-Party Dependency Audit

> **Scope:** Every runtime dependency and external vendor, its role, its scaling
> ceiling, and the failure mode to plan for. External APIs you don't control are
> the parts most likely to throttle or time out during a spike.

---

## 1. Core framework & language

| Dep | Version | Note for scale |
|-----|---------|----------------|
| `next` | **14.2.15** | App Router. Solid, but 14.2 is not latest; plan a controlled upgrade path (15.x) after launch for improved caching primitives. Don't upgrade mid-campaign. |
| `react` / `react-dom` | 18.3.1 | Fine. |
| `typescript` | 5.6 | `type-check` script exists — run in CI. |
| `next-intl` | 3.26 | i18n. Memory notes it's **not fully integrated** (product pages force Indonesian). Low scale risk, UX debt. |
| `zod` | 3.23 | Validate **all** API inputs — a validation gap is a DoS/abuse vector under load. |

**Actions:** enforce `type-check` + `lint` + `test:run` in CI (Vitest is present but
verify coverage on money paths). Pin Node `>=20` (already in `engines`).

---

## 2. Data & auth

| Dep | Role | Scale note |
|-----|------|-----------|
| `drizzle-orm` 0.39 + `@neondatabase/serverless` 0.10 | DB access (HTTP driver) | See **doc 02** — chattiness is the risk |
| `pg` 8.20 | Available for pooled/interactive txns | Use for checkout write path |
| `next-auth` 5.0-beta.31 | Auth, **JWT sessions** (`lib/auth/config.ts`) | **Beta** — pin exact version, watch for breaking releases. JWT sessions = no DB read per request (good for scale) but revocation is weak: a banned user's token stays valid until expiry (30d `maxAge`). Add an `isActive`/`bannedAt` check server-side on sensitive actions. |
| `@auth/drizzle-adapter` 1.7 | Adapter | With JWT strategy, DB is only hit at sign-in — good. |
| `bcryptjs` 2.4 | Password hashing | **Pure-JS bcrypt is CPU-heavy and blocks** the event loop; under a login/registration spike this eats function CPU. Consider `bcrypt` (native) or lower rounds sensibly, and **always rate-limit auth endpoints** (doc 05 §1). The audits flagged an O(n) bcrypt reset loop — fix that. |

---

## 3. External vendors — the real ceilings

Each of these is a **shared, rate-limited, occasionally-down** service. Plan
timeouts, retries (with jitter), idempotency, and graceful degradation for all.

### Midtrans (`midtrans-client` 1.4) — payments 💳
- **Criticality: highest.** This is revenue.
- Snap redirect + **webhook** (`app/api/webhooks/midtrans`, `maxDuration:30`).
- Scale risks:
  - Webhook **must verify signature** (a `verify-webhook.ts` was deleted per git
    status — **confirm signature verification still exists** somewhere, or this is a
    critical security regression).
  - Webhook must be **idempotent** (same notification delivered multiple times) and
    fast (do DB work, return 200; offload slow work).
  - Handle **all** transaction statuses (`capture`, `settlement`, `pending`, `deny`,
    `expire`, `cancel`) — audits flagged ignored capture/settlement cases.
  - Don't rely on the 1-hour stale webhook; `reconcile-payments` cron is the safety
    net — make sure it actually **updates DB**, not just logs (known bug).
- **Ceiling:** Midtrans has its own rate limits; during a flash sale you may see
  throttling on status polls. Back off + use the webhook as source of truth.

### Biteship (`BITESHIP_*`) — shipping/courier 🚚
- Rate quotes + courier booking + tracking webhook.
- **Slow and rate-limited.** Quote calls on every cart view = self-inflicted DoS.
  **Cache quotes in Redis** (doc 03 §4).
- `BITESHIP_WEBHOOK_SECRET` is **blank in `.env.example`** — set it and verify webhook
  signatures.
- Failure mode: if Biteship is down, checkout shouldn't hard-fail — allow a fallback
  flat rate or a "we'll confirm shipping" path.

### Fonnte (`FONNTE_*`) — WhatsApp notifications 📱
- **Single device / single API key = single point of failure and a hard throughput
  cap.** A blast of order notifications during a spike will queue or drop.
- Make WA sends **fire-and-forget + retryable**, never blocking checkout. Queue them.
- Have an email fallback (Resend) for critical notifications.

### Resend (`resend` 4.0, `@react-email`) — email ✉️
- Verify **domain + SPF/DKIM/DMARC** or deliverability collapses at volume.
- Watch **daily send quota** on your plan; batch/queue transactional email.
- Never block a request on email send; enqueue and return.

### Cloudinary (`cloudinary` 2.5, `sharp`) — images 🖼️
- CDN-backed — scales well. Use `f_auto,q_auto` + responsive widths (doc 03 §5).
- Watch **monthly transformation/bandwidth credits**; pre-generate common sizes.

### Google Maps (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) — address picker 🗺️
- Public key = **abuse target.** Restrict by HTTP referrer, enable only needed APIs,
  set **billing quotas + alerts**. A leaked/unrestricted key can generate a huge bill.

### MiniMax AI (`MINIMAX_*`)
- Gated behind `aiContent` flag (off). No launch impact. Keep it off for scale.

### Sentry (`@sentry/nextjs` 10.53) — observability 🔭
- DSN **blank in example** — must be set in prod (doc 05 §6).
- Memory notes it was in `devDependencies` — **must be a prod dependency** (verify;
  current `package.json` lists it under `dependencies` ✅).
- Set a **`tracesSampleRate` < 1.0** in prod so Sentry itself doesn't add overhead at
  high traffic.

---

## 4. Front-end libraries (bundle & runtime cost)

| Dep | Cost | Action |
|-----|------|--------|
| `@react-pdf/renderer` 4.0 | Heavy | Server-only, dynamic import; never in storefront bundle |
| `@tiptap/*` | Heavy editor | Admin-only, dynamic import, `ssr:false` |
| `recharts` 2.12 | Heavy charts | Admin dashboards only, lazy-load |
| `framer-motion` 11 | Medium | Lazy where possible; avoid animating large lists |
| `embla-carousel*` | Light | Fine |
| `@upstash/ratelimit` + `@upstash/redis` | — | Core infra (docs 01/03/05) |
| `isomorphic-dompurify` | Security | Keep — sanitize all rich text/blog HTML |
| `shadcn`/`@base-ui/react`/`tailwindcss` | Build-time | Fine |

**Dead-config cleanup:** remove `@radix-ui` from `optimizePackageImports` (not
installed). Move any misplaced deps to correct sections. Run `depcheck` to find unused
packages (each one is build time + audit surface).

---

## 5. Dependency governance

- **Pin beta/critical deps** (`next-auth` beta, `next`) to exact versions; upgrade
  deliberately with a staging soak, never right before a campaign.
- Run `npm audit` + Dependabot; patch security advisories on the payment/auth path
  first.
- Keep a **`renovate`/Dependabot** cadence but **freeze during campaigns**.
- Lockfile (`package-lock.json`) committed ✅ — ensure CI uses `npm ci`.

---

## 6. Stack go/no-go checklist

- [ ] Midtrans webhook: signature verified (confirm `verify-webhook` deletion didn't regress), idempotent, handles all statuses, fast 200
- [ ] `reconcile-payments` cron actually updates DB (not just logs)
- [ ] Biteship quotes cached; webhook secret set + verified; checkout degrades gracefully
- [ ] Fonnte sends async/queued with email fallback; not blocking checkout
- [ ] Resend domain verified (SPF/DKIM/DMARC); sends queued; quota known
- [ ] Google Maps key referrer-restricted + billing alerts
- [ ] Cloudinary `f_auto,q_auto`; transformation credits monitored
- [ ] bcrypt cost reviewed; auth endpoints rate-limited; O(n) reset loop fixed
- [ ] Sentry DSN set, prod dependency, `tracesSampleRate` tuned
- [ ] Heavy libs dynamically imported; dead deps/config removed; `npm ci` in CI

**Related:** infra/env for these vendors → `01`; caching that shields them → `03`;
webhook idempotency + incident runbook → `05`.
