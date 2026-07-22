# 03 — Caching, Rendering & Front-End Performance

> **Scope:** The single highest-leverage scale change in the whole project.
> Right now the app renders (almost) everything dynamically, so traffic maps
> 1:1 onto serverless invocations and DB queries. Caching breaks that link.

**Headline finding:** `grep "export const dynamic"` → **169 occurrences**, and
essentially **zero** `unstable_cache` / ISR usage on public read paths. The store is
effectively **"server-rendered per request, uncached."** At 10× traffic that is 10×
functions and 10× DB load for content that changes rarely (products, prices, blog,
settings).

---

## 1. The caching pyramid (apply top-down — cheapest wins first)

```
        ┌───────────────────────────────┐
        │ 1. CDN / static (ISR)         │  ← catalog, blog, landing: cache at edge
        ├───────────────────────────────┤
        │ 2. Data cache (unstable_cache)│  ← settings, product data, shipping quotes
        ├───────────────────────────────┤
        │ 3. Redis cache (Upstash)      │  ← cross-instance hot keys, computed values
        ├───────────────────────────────┤
        │ 4. Database (Neon)            │  ← only what truly must be live
        └───────────────────────────────┘
```
Every layer you add above the DB removes load from the layer below.

---

## 2. Classify every route: dynamic vs cacheable

Most `export const dynamic = 'force-dynamic'` lines are **defensive copy-paste**, not
genuine per-request needs. Triage into three buckets:

### A. Truly dynamic (keep `force-dynamic`)
- Anything reading the **user session** (account, cart, checkout, admin).
- **Webhooks & crons** (already non-cacheable by nature).
- Write endpoints (POST/PATCH/DELETE).

### B. Cacheable with revalidation (convert to ISR / cached fetch)
- **Product listing & product detail** — price/stock change occasionally; use ISR
  with `revalidate` (e.g. 60–300s) **or** tag-based revalidation on admin edit.
- **Home/landing, category pages, blog list & posts** — `revalidate: 3600` or
  on-publish revalidate.
- **Public settings** (`/api/settings/public`), **public testimonials**,
  `feed.xml`, sitemap — cache aggressively.

### C. Semi-dynamic (Redis / short data cache)
- **Shipping rate quotes** (Biteship) keyed by origin+destination+weight — cache
  10–30 min in Redis. Biteship calls are slow and rate-limited (doc 04); caching here
  protects both latency and your vendor quota.
- Aggregate counts, "featured" selections, category counts.

> **Action:** produce a spreadsheet of all 169 routes → bucket A/B/C → convert B & C.
> Expect the large majority to move out of "force-dynamic."

---

## 3. Next.js App Router caching mechanics to use

1. **ISR / segment config** on cacheable pages:
   ```ts
   export const revalidate = 300; // seconds
   ```
   Remove the blanket `export const dynamic = 'force-dynamic'` from those segments.
2. **Tag-based revalidation** for instant freshness after admin edits:
   ```ts
   // read path
   const products = await unstable_cache(fetchProducts, ['products'], { tags: ['products'], revalidate: 300 })();
   // write path (admin product update)
   revalidateTag('products');
   ```
   This gives you **cache + immediate consistency** — the best of both.
3. **`generateStaticParams`** for product/blog detail so popular pages are prebuilt.
   (Blog audit already flagged this missing.)
4. **`fetch` caching** for third-party GETs where safe.
5. **Route Handlers**: cacheable `GET` API routes can set
   `Cache-Control: s-maxage=..., stale-while-revalidate=...` so Vercel's CDN serves
   them without hitting your function.

---

## 4. Redis (Upstash) application cache

You already have Upstash wired for rate limiting — reuse it:
- **Cache-aside** pattern: `GET key` → hit? return : compute → `SET key ttl`.
- Good candidates: public settings, shipping quotes, product catalog snapshot,
  homepage payload.
- **Invalidation:** delete/patch the key on the corresponding admin write, or rely on
  short TTL. Prefer explicit invalidation for price/stock, TTL for everything else.
- Guard with a **stampede lock** (SETNX) so a cache miss during a spike doesn't send
  1,000 requests to the DB simultaneously.

---

## 5. Front-end / delivery performance

- **Images (biggest bytes):** serve from **Cloudinary** with `f_auto,q_auto` and
  responsive `w_` transforms. Don't double-proxy already-optimized Cloudinary URLs
  through `/_next/image`. `sharp` is installed for local optimization — fine, but the
  CDN should carry production load.
- **`optimizePackageImports`** already set for `lucide-react`, `recharts`,
  `@radix-ui`. Note: memory says `@radix-ui` isn't actually installed — **remove dead
  entries** so the build doesn't waste effort; the app uses `@base-ui/react`.
- **Code-split heavy admin/editor deps** (`@tiptap/*`, `recharts`,
  `@react-pdf/renderer`, `framer-motion`) — `dynamic(() => import(...), { ssr:false })`
  so the storefront bundle stays small. PDF rendering especially must not ship to
  customers.
- **Fonts:** self-host via `next/font` (you already allow `fonts.gstatic.com` in CSP);
  avoid render-blocking external CSS where possible.
- **Third-party scripts** (Midtrans Snap, Google Maps): load with `next/script`
  `strategy="lazyOnload"`/`afterInteractive`, and only on pages that need them
  (Maps only on address picker, Snap only on payment).
- **React Query** (`@tanstack/react-query`) is present — set sane `staleTime` so the
  client doesn't refetch hot data on every focus; dedupe in-flight requests.

---

## 6. Measuring performance (don't guess)

- **Vercel Analytics** (`@vercel/analytics` installed) + **Speed Insights** for real
  user Core Web Vitals.
- Track **TTFB** on product/home pages before vs after caching — this is where ISR
  shows up.
- Watch **function invocation count** and **DB queries/day** trend down after the
  caching conversion. That drop *is* your headroom.

---

## 7. Caching go/no-go checklist

- [ ] All 169 `force-dynamic` routes triaged into A (keep) / B (ISR) / C (Redis)
- [ ] Product & catalog pages on ISR with `revalidateTag` on admin edits
- [ ] Blog/landing/sitemap/feed cached; `generateStaticParams` for detail pages
- [ ] Public settings + shipping quotes cached (Redis, with stampede lock)
- [ ] Cacheable API routes send `s-maxage` + `stale-while-revalidate`
- [ ] Cloudinary `f_auto,q_auto`; no double image proxying
- [ ] Heavy admin deps (tiptap, recharts, pdf, framer) dynamically imported, no SSR
- [ ] Dead `@radix-ui` entry removed from `optimizePackageImports`
- [ ] Vercel Analytics + Speed Insights live; TTFB baselined

**Related:** what the DB does when caching misses → `02`; vendor rate limits that
caching protects → `04`; load testing the cached vs uncached paths → `05`.
