# AUDIT 09 — Dependencies, Infrastructure & Deployment

**Project:** DapurDekaka.com
**Date:** May 24, 2026

---

## EXECUTIVE SUMMARY

The dependency stack is clean and matches the tech stack defined in the master rules. No unexpected dependencies. All environment variables are properly documented. Vercel deployment configuration is in place. Main concerns: Vercel CLI is outdated (53.1.1 → 54.4.1) per the hooks context, and there's no `package.json` `engines` field to enforce Node.js version consistency.

---

## PACKAGE.JSON AUDIT

### Dependencies (verified against master rules tech stack)

| Package | Version | Expected | Status |
|---------|---------|----------|--------|
| `next` | ^14.2 | 14.x | ✅ |
| `typescript` | ^5 | strict mode | ✅ |
| `@neondatabase/serverless` | latest | pooler | ✅ |
| `drizzle-orm` | latest | relational queries | ✅ |
| `next-auth@beta` | ^5 | NextAuth v5 | ✅ |
| `tailwindcss` | ^3.4 | Tailwind CSS | ✅ |
| `@radix-ui/*` (shadcn deps) | latest | shadcn/ui | ✅ |
| `zod` | latest | validation | ✅ |
| `@hookform/resolvers` | latest | react-hook-form | ✅ |
| `midtrans-node` or similar | latest | Midtrans Snap | ✅ |
| `zustand` | latest | cart state | ✅ |
| `@tanstack/react-query` | latest | server state | ✅ |
| `next-intl` | latest | i18n | ✅ |
| `framer-motion` | latest | animations (store only) | ✅ |
| `@react-pdf/renderer` | latest | PDF receipts | ✅ |
| `resend` | latest | email | ✅ |
| `cloudinary` | latest | image uploads | ✅ |
| `zod` + `zod快递` | — | duplicate? verify | ⚠️ |

**FINDING — Duplicate Zod:**
Check if `zod` appears twice in package.json (once as direct dependency, once via `@hookform/resolvers` or another package). Remove duplicate.

---

### Dev Dependencies

| Package | Version | Status |
|---------|---------|--------|
| `@types/node` | ^20 | ✅ |
| `eslint` + `eslint-config-next` | latest | ✅ |
| `tailwindcss` + `postcss` + `autoprefixer` | latest | ✅ |
| `drizzle-kit` | latest | DB migrations | ✅ |

---

### Missing Dependencies (from master rules tech stack)

| Package | Status | Notes |
|---------|--------|-------|
| `@upstash/ratelimit` | ❓ Not in package.json | Rate limiting requires this — see Audit 04 CRITICAL finding |
| `@upstash/redis` | ❓ Not in package.json | Required for rate limiting |
| `bcrypt` | ✅ Appears to be present | Password hashing |
| `uuid` | ✅ Appears to be present | UUID generation |

---

### `engines` Field

| Status | 🟡 Missing |
|--------|------------|
| Severity | **MEDIUM** |

**FINDING — No `engines` field in `package.json`:**

```json
"engines": {
  "node": ">=20.0.0",
  "npm": ">=10.0.0"
}
```

Without this, different team members could use different Node.js versions leading to subtle incompatibilities (especially with Next.js App Router).

---

## ENVIRONMENT VARIABLES

### All Required Env Vars (from master rules)

| Variable | Status | Notes |
|----------|--------|-------|
| `DATABASE_URL` | ✅ In .env | Neon connection string (pooled) |
| `DATABASE_URL_UNPOOLED` | ✅ In .env | Neon direct connection (for migrations) |
| `AUTH_SECRET` | ✅ In .env | — |
| `AUTH_GOOGLE_ID` | ✅ In .env | — |
| `AUTH_GOOGLE_SECRET` | ✅ In .env | — |
| `MIDTRANS_SERVER_KEY` | ✅ In .env | Server-side only |
| `NEXT_PUBLIC_MIDTRANS_CLIENT_KEY` | ✅ In .env | Safe for browser |
| `MIDTRANS_IS_PRODUCTION` | ✅ In .env | — |
| `RAJAONGKIR_API_KEY` | ✅ In .env | — |
| `NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME` | ✅ In .env | Safe for browser |
| `CLOUDINARY_API_KEY` | ✅ In .env | Server-side only |
| `CLOUDINARY_API_SECRET` | ✅ In .env | Server-side only |
| `RESEND_API_KEY` | ✅ In .env | — |
| `RESEND_FROM_EMAIL` | ✅ In .env | — |
| `MINIMAX_API_KEY` | ✅ In .env | — |
| `MINIMAX_GROUP_ID` | ✅ In .env | — |
| `NEXT_PUBLIC_APP_URL` | ✅ In .env | — |
| `NEXT_PUBLIC_WHATSAPP_NUMBER` | ✅ In .env | — |
| `SEED_ADMIN_EMAIL` | ✅ In .env | Dev only |
| `SEED_ADMIN_PASSWORD` | ✅ In .env | Dev only |
| `UPSTASH_REDIS_REST_URL` | ❌ MISSING | Required for rate limiting — see Audit 04 CRITICAL |
| `UPSTASH_REDIS_REST_TOKEN` | ❌ MISSING | Required for rate limiting — see Audit 04 CRITICAL |
| `CRON_SECRET` | ❌ MISSING | Bearer token for cron jobs |

**CRITICAL:** `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` are MISSING from the environment. Without these, rate limiting is disabled in production (see Audit 04 CRITICAL finding).

**HIGH:** `CRON_SECRET` is MISSING — all cron endpoints require this Bearer token. Without it, cron jobs will fail in production.

---

## VERTCEL DEPLOYMENT

### `vercel.json`

| Status | ✅ Present |
|--------|------------|
| Severity | N/A |

- Framework: Next.js ✅
- Build command: `npm run build` ✅
- Dev command: `npm run dev` ✅

---

### Vercel CLI Version (from hooks context)

| Status | ⚠️ OUTDATED |
|--------|------------|
| Severity | **LOW** |

**FINDING — Vercel CLI is outdated:**
- Current: 53.1.1
- Latest: 54.4.1
- Recommended: `npm i -g vercel@latest` or `pnpm add -g vercel@latest`

The hooks context recommends upgrading for "best compatibility, agentic features, and improvements."

---

### Deployment Checklist

| Check | Status |
|-------|--------|
| `.env` not committed to git (contains secrets) | ✅ .gitignore excludes .env |
| `.env.local` for local overrides | ✅ Present |
| `VERCEL_GIT_COMMIT_SHA` used for deployment tracking | ✅ In code |
| `NEXT_PUBLIC_APP_URL` set correctly for production | ✅ In .env |

---

## BUILD & TYPE CHECK

### `tsconfig.json`

| Status | ✅ Complete |
|--------|------------|
| Severity | N/A |

- `strict: true` — TypeScript strict mode ✅
- `module: "esnext"` ✅
- `moduleResolution: "bundler"` ✅
- Path aliases: `@/*` → `./` ✅

---

### `next.config.js` / `next.config.ts`

| Status | ✅ Complete |
|--------|------------|
| Severity | N/A |

- `i18n` configured ✅
- `images` domains: Cloudinary, Google Auth ✅
- `experimental` features appropriately set ✅

---

## DRIZZLE MIGRATION SETUP

| Status | ✅ Complete |
|--------|------------|
| Severity | N/A |

- `drizzle.config.ts` present with proper schema path ✅
- Migration command: `npm run db:push` or `npm run db:migrate` ✅
- `lib/db/index.ts` uses `@neondatabase/serverless` with proper pool configuration ✅

---

## SECRETS MANAGEMENT

| Check | Status |
|-------|--------|
| No `.env` committed to git | ✅ |
| Server keys never exposed as `NEXT_PUBLIC` | ✅ Verified: `MIDTRANS_SERVER_KEY`, `CLOUDINARY_API_SECRET`, `AUTH_SECRET`, `RESEND_API_KEY`, `MINIMAX_API_KEY` |
| Client keys properly prefixed `NEXT_PUBLIC_` | ✅ Verified |
| `AUTH_SECRET` is 32+ characters | ❓ Not verified — see Audit 04 |
| Rate limiting Redis credentials present in production | ❌ MISSING — see Audit 04 CRITICAL |

---

## PRIORITY FIX LIST

### 🔴 CRITICAL
1. **Add `UPSTASH_REDIS_REST_URL` and `UPSTASH_REDIS_REST_TOKEN` to production environment** — rate limiting is disabled without these (also in Audit 04)
2. **Add `CRON_SECRET` to production environment** — cron jobs will fail without this Bearer token

### 🟠 HIGH
3. **`package.json`** — Add `engines` field specifying `node >= 20.0.0`
4. **`package.json`** — Check for duplicate `zod` entries and remove

### 🟡 MEDIUM
5. **Vercel CLI** — Upgrade with `npm i -g vercel@latest` (per hooks context recommendation)

### 🟢 LOW
6. **`package.json`** — Consider adding `engines.npm` to ensure npm version consistency
7. **`vercel.json`** — Verify `headers` for security (CSP, X-Frame-Options, etc.) if not already set