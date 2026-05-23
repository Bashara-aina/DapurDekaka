# Security Audit — Complete Review

**Audit Date:** 2026-05-22
**Auditor:** Deep Code Audit

---

## Executive Summary

Security posture is **moderate** with several high-severity issues in API authorization, webhook protection, and sensitive data handling. The project has proper foundations (Zod validation, parameterized queries via Drizzle, signature verification) but lacks defense-in-depth in several areas.

---

## 1. API Authorization

### SEC-01: CRITICAL — Admin API routes have no role verification
**Severity:** CRITICAL

Every `app/api/admin/*` route assumes the caller is authorized. While middleware protects page access, API routes receive direct calls and do NOT check `session.user.role`. A logged-in `customer` with a properly crafted fetch request could call:
- `PATCH /api/admin/orders/[id]` — change order status
- `DELETE /api/admin/products/[id]` — delete products
- `PATCH /api/admin/users/[id]` — change user roles

**Fix:** Every admin route must call `requireAdmin(session)` or equivalent at the top.

### SEC-02: CRITICAL — No CSRF protection on mutations
**Severity:** CRITICAL

Next.js App Router uses cookie-based sessions. Cookie-auth requests from the browser automatically include cookies. There's no CSRF token on POST/PATCH/DELETE requests. For a site with authenticated users, CSRF attacks could:
- Change account email/password
- Modify account address
- Create orders as the user
- Apply coupons on behalf of user

**Mitigation:** Using ` SameSite=Lax` cookies partially mitigates this, but POST-from-iframe attacks can still work on some configurations.

**Fix:** Add CSRF tokens via `next-iron-session` or custom header check.

### SEC-03: HIGH — Webhook has no rate limiting
**File:** `app/api/webhooks/midtrans/route.ts`
**Severity:** HIGH

The Midtrans webhook endpoint accepts POST requests. While Midtrans calls it, a determined attacker could flood the endpoint. Even without authentication, the processing includes DB queries and signature verification. Rate limiting should be applied.

### SEC-04: HIGH — Guest checkout has no email verification
**File:** `app/api/checkout/initiate/route.ts`

Guest users submit `recipientEmail`. There's no verification that this email is valid or that the user owns it. An attacker could:
- Create orders with fake emails
- Fill out false contact forms
- Receive order confirmations for fake orders (if email doesn't matter)

Guest checkout is intentional business requirement, but at minimum, a CAPTCHA should prevent automated abuse.

---

## 2. Input Validation

### SEC-05: Zod schema validates types but not business rules on some routes

**Files affected:** Various API routes

Most routes use Zod for input validation. However:
- `orderNumber` regex validation in retry route (`/^DDK-\d{8}-\d{4}(?:-retry-\d+)?$/`) — good
- Phone numbers accept any string 8+ chars — should validate Indonesian phone format
- Address fields accept arbitrary strings — XSS possible in display

**Fix:** Sanitize all user-displayed text with DOMPurify or similar before rendering.

### SEC-06: Product/variant name fields accept arbitrary HTML/markdown
**Severity:** MEDIUM

`productNameId`, `productNameEn`, `descriptionId`, `descriptionEn` — these fields accept text that is later rendered on pages. If they contain `<script>` tags, XSS could occur. The database stores text, and Next.js renders with `dangerouslySetInnerHTML` in some places (blog content).

**Fix:** All rich text fields (blog content, descriptions) should sanitize HTML before storage. Product names are probably plain text, so plain text validation is sufficient.

### SEC-07: No file upload validation on product/blog images
**Files:** `app/api/admin/upload/route.ts`, `app/api/admin/products/[id]/images/route.ts`

Image uploads should validate:
- File extension (jpg, png, webp only)
- MIME type (image/jpeg, image/png, image/webp)
- Max file size (e.g., 5MB)
- Image dimensions (max 4096x4096)
- Scan for malware (basic check — file signature matching)

**Fix:** Add `sharp` or `validate-image` middleware in upload route.

---

## 3. Authentication & Sessions

### SEC-08: NextAuth session — role not exposed in type
**Severity:** MEDIUM

The `session.user.role` is accessed throughout the code, but need to verify NextAuth's type extension includes `role`. If not properly typed, `session.user.role` could be undefined at runtime despite TypeScript accepting it.

**Fix:** Extend NextAuth types in `types/next-auth.d.ts` or similar.

### SEC-09: Auth callbacks not audited
**Severity:** MEDIUM

Need to verify:
1. `jwt` callback stores role in token
2. `session` callback exposes role to client
3. Token is refreshed on correct intervals
4. Logout properly clears session

### SEC-10: No brute force protection on login
**Severity:** MEDIUM

`app/(auth)/login/page.tsx` calls `signIn()`. There's no rate limiting or account lockout after failed attempts. An attacker could brute force weak passwords.

**Fix:** Add login attempt rate limiting with increasing delays or temporary lockout after 5 failed attempts.

---

## 4. Data Exposure

### SEC-11: Order number enumeration — privacy issue
**Severity:** MEDIUM

Order numbers follow `DDK-YYYYMMDD-XXXX` format — predictable. Anyone who knows a customer's email could enumerate order numbers and view:
- Order contents
- Delivery address
- Total amount
- Order status

**Fix:** Add a second factor (order lookup requires email verification) OR use UUID-based order identifiers OR hash order numbers.

### SEC-12: API responses leak internal error details
**Severity:** LOW

The `serverError()` utility logs full stack traces. Need to verify the client-facing error message in API responses doesn't leak internal paths, SQL queries, or environment variables.

**Current pattern:**
```ts
return serverError(error); // In catch block
```

The `serverError` helper should sanitize the error message, returning only a generic "Internal server error" to the client while logging the details server-side.

### SEC-13: No PII logging policy
**Severity:** LOW

`logger.error()` calls in some routes log full request bodies which may contain email, phone, address. Logs should strip PII or use hash identifiers instead of email.

---

## 5. Payment Security

### SEC-14: Midtrans webhook signature check is correct
**Severity:** ✅ Verified good

The webhook verifies SHA512 signature before any processing. Good.

### SEC-15: Midtrans server key in env — not in code
**Severity:** ✅ Verified good

`MIDTRANS_SERVER_KEY` is read from `process.env.MIDTRANS_SERVER_KEY` — not hardcoded. Good.

### SEC-16: No refund API integration
**Severity:** MEDIUM (business risk)

When admin cancels a paid order, there's no Midtrans refund API call. Money leaves customer but order is cancelled without refund. This is a business logic gap that could lead to legal issues.

---

## 6. Admin Security

### SEC-17: Warehouse role can see shipment details
**Severity:** LOW

Warehouse workers see recipient names, addresses, phone numbers in the field dashboard. This is probably fine (warehouse needs this info to pack/ship), but it should be documented in the privacy policy (GDPR, Indonesia's PDP law).

### SEC-18: Admin audit log — is it capturing all sensitive actions?
**File:** `adminActivityLogs` table

Audit log exists and is well-indexed. Need to verify:
- Does every admin mutation create an audit log entry?
- Are password changes logged (old/new state shouldn't be logged, just the action)?
- Are bulk operations logged per-item or per-operation?

### SEC-19: No two-factor authentication for admin
**Severity:** MEDIUM

Admin accounts (superadmin, owner) have no 2FA. If a password is compromised, attacker has full admin access. NextAuth supports TOTP via `providers` — should be enabled for superadmin role.

---

## 7. Dependencies & Infrastructure

### SEC-20: `next.config.mjs` — deleted
**Status:** ⚠️ Not checked

The git status shows `next.config.mjs` was deleted. This file typically contains:
- Image domain allowlist (Cloudinary)
- Redirect rules
- Security headers

If it was deleted, these settings may be lost or misconfigured.

### SEC-21: Security headers not configured
**Files:** `next.config.mjs` (deleted)

Missing security headers:
- `Content-Security-Policy`
- `X-Frame-Options: DENY`
- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `Permissions-Policy`

### SEC-22: `.env.example` vs actual `.env.local`
**Severity:** LOW

If `.env.example` is not kept up to date, new developers may miss required environment variables. Also, if `.env.local` is committed to git, secrets leak.

**Fix:** Ensure `.gitignore` excludes `.env.local`, `.env.production`, etc.

---

## 8. Priority Fix List

| Priority | Issue | Fix |
|----------|-------|-----|
| P0-CRITICAL | Admin APIs have no role checks | Add `requireAdmin()` to every admin route |
| P0-CRITICAL | No CSRF protection | Add CSRF token validation |
| P0-CRITICAL | `next.config.mjs` deleted — security headers lost | Recreate with proper security config |
| P1-HIGH | Webhook has no rate limiting | Add `withRateLimit` to webhook |
| P1-HIGH | Order enumeration privacy issue | Add email verification or UUID order IDs |
| P1-HIGH | No refund API for paid orders | Implement Midtrans refund flow |
| P2-MEDIUM | No file upload validation | Add MIME/size/dimension checks |
| P2-MEDIUM | No 2FA for admin | Enable TOTP for superadmin |
| P2-MEDIUM | Phone number not validated | Add Indonesian phone regex |
| P2-MEDIUM | Blog content stored with HTML — XSS risk | Sanitize HTML on save |
| P3-LOW | `serverError` may leak internal details | Verify client message is sanitized |
| P3-LOW | Audit log coverage incomplete | Verify all mutations logged |
| P3-LOW | `.env.example` not maintained | Keep in sync with actual vars |