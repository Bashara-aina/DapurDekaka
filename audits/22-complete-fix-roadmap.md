# Audit 22 — Complete Prioritized Fix Roadmap

**Purpose:** Master fix list for Cursor to systematically address all issues
**Generated:** 2026-05-23
**Total Issues:** 89 issues across 5 audit areas

---

## Priority 0 — DEPLOY-BLOCKING (Fix Before Any User Access)

These issues cause immediate financial loss or security breach. Must fix NOW.

| # | Area | Issue | File | Fix |
|---|------|-------|------|-----|
| P0-1 | Security | **Midtrans webhook has NO signature verification** | `app/api/webhooks/midtrans/route.ts` | Implement SHA512 signature verification with server key |
| P0-2 | Security | **Admin routes not protected in middleware** | `app/middleware.ts` | Add `/admin/:path*` and `/api/admin/:path*` to protected matcher |
| P0-3 | Payment | **Webhook has no idempotency check** | `app/api/webhooks/midtrans/route.ts` | Use `SELECT FOR UPDATE` or webhook_logs table for idempotency |
| P0-4 | Payment | **Coupon validation only checks 5 of 9 rules** | `app/api/coupons/validate/route.ts` | Implement all 9 validation rules including product/category/user restrictions |
| P0-5 | Payment | **Checkout initiate trusts client prices** | `app/api/checkout/initiate/route.ts` | Re-fetch all prices from DB, never trust client payload |
| P0-6 | Payment | **Stock not re-checked at checkout submit** | `app/api/checkout/initiate/route.ts` | Add atomic stock check for ALL cart items before order creation |

---

## Priority 1 — CRITICAL (Break User Flows)

| # | Area | Issue | File | Fix |
|---|------|-------|------|-----|
| P1-1 | i18n | **NAV_LINKS hardcoded Indonesian** | `components/store/layout/Navbar.tsx` | Add `nav.home/products/blog/b2b` keys, replace all hardcoded |
| P1-2 | i18n | **ProductCard "HABIS" hardcoded** | `components/store/products/ProductCard.tsx` | Replace with `t('product.outOfStock')` |
| P1-3 | Schema | **`addresses` table missing `updatedAt`** | `lib/db/schema.ts` | Add `updatedAt` column to addresses |
| P1-4 | Schema | **`productVariants` missing `(productId, isActive)` index** | `lib/db/schema.ts` | Add composite index for catalog queries |
| P1-5 | Admin | **Order status update missing role check** | `app/api/admin/orders/[id]/status/route.ts` | Add proper role matrix enforcement |
| P1-6 | Admin | **Coupons accessible to owner (superadmin only)** | `app/api/admin/coupons/` | Add `role === 'superadmin'` check for all mutations |
| P1-7 | Flow | **B2B route group missing `loading.tsx`** | `app/(store)/b2b/` | Create `loading.tsx` with skeleton |
| P1-8 | Security | **Cart validate has no rate limiting** | `app/api/cart/validate/route.ts` | Add 30 req/min rate limit |
| P1-9 | Security | **RajaOngkir cities fetched on every request** | `app/api/shipping/cities/route.ts` | Cache in DB, refresh weekly via cron |
| P1-10 | Security | **NextAuth CSRF protection may be disabled** | `app/api/auth/[...nextauth]/route.ts` | Verify `trustHost: true` in production |

---

## Priority 2 — HIGH (Significant Bugs)

| # | Area | Issue | File | Fix |
|---|------|-------|------|-----|
| P2-1 | i18n | **Footer completely hardcoded Indonesian** | `components/store/layout/Footer.tsx` | Audit all text, add i18n keys |
| P2-2 | i18n | **Login button "Masuk" hardcoded** | `components/store/layout/Navbar.tsx` | Use `t('auth.login')` |
| P2-3 | i18n | **CartItem stock warning hardcoded** | `components/store/cart/CartItem.tsx` | Use i18n |
| P2-4 | i18n | **WhatsApp button aria-label hardcoded** | `components/store/layout/WhatsAppButton.tsx` | Use `t('whatsapp.chat')` |
| P2-5 | i18n | **IdentityForm labels hardcoded** | `components/store/checkout/` | Use i18n for all form labels |
| P2-6 | i18n | **Mobile menu hardcoded "Akun Saya", "Keluar"** | `components/store/layout/Navbar.tsx` | Use i18n |
| P2-7 | i18n | **About/Privacy/Refund pages hardcoded** | `app/(store)/about/page.tsx`, etc. | Implement locale variants or i18n |
| P2-8 | Payment | **Points B2B 2x multiplier not applied** | `app/api/webhooks/midtrans/route.ts` | Check `is_b2b` flag and double points |
| P2-9 | Payment | **Payment retry order_id collision risk** | `app/api/checkout/retry/route.ts` | Use UUID suffix for uniqueness |
| P2-10 | Payment | **RajaOngkir origin city may be wrong** | `lib/services/rajaongkir.ts` | Store in system_settings, use "23" (Bandung) |
| P2-11 | Payment | **Cold-chain courier filter incomplete** | `app/api/shipping/cost/route.ts` | Hardcode whitelist: jne, tiki, sicepat, grab, borzo, jnt |
| P2-12 | Payment | **Checkout missing atomic transaction wrapper** | `app/api/checkout/initiate/route.ts` | Wrap order + Midtrans in db.transaction() |
| P2-13 | Payment | **Payment expiry not enforced server-side** | `app/api/webhooks/midtrans/route.ts` | Check payment_expires_at < now() |
| P2-14 | Design | **`brand-red-dark` wrong hex (#8B0000 vs #A00D24)** | `tailwind.config.ts` | Fix to #A00D24 |
| P2-15 | Schema | **Missing index: `accounts.userId`** | `lib/db/schema.ts` | Add index |
| P2-16 | Schema | **Missing index: `sessions.userId`** | `lib/db/schema.ts` | Add index |
| P2-17 | Schema | **Missing index: `blogPosts.authorId`** | `lib/db/schema.ts` | Add index |
| P2-18 | i18n | **`en.json` ~30 keys missing** | `i18n/messages/en.json` | Add all missing keys |
| P2-19 | i18n | **`id.json` duplicate `pointsUnit` key** | `i18n/messages/id.json` | Remove duplicate |
| P2-20 | Admin | **Dashboard revenue uses UTC not WIB** | `app/api/admin/dashboard/` | Convert to Asia/Jakarta timezone |
| P2-21 | Admin | **Soft-deleted products still in admin list** | `app/(admin)/admin/products/` | Add `isNull(products.deletedAt)` filter |
| P2-22 | Admin | **B2B quote status transitions not validated** | `app/api/b2b/quotes/[id]/[action]/` | Define and enforce valid transitions |
| P2-23 | Admin | **Carousel upload no server-side validation** | `app/api/admin/carousel/` | Validate file magic bytes, type, size |
| P2-24 | Admin | **Testimonials public — no approval required** | `app/api/testimonials/public/` | Add `is_approved = true` filter |
| P2-25 | Security | **Auth register — verify password hashed with bcrypt** | `app/api/auth/register/route.ts` | Use bcrypt cost factor 12 |
| P2-26 | Security | **Forgot password token — no expiry** | `app/api/auth/forgot-password/route.ts` | Add 1-hour expiry |
| P2-27 | Security | **API responses inconsistent format** | Various API routes | Enforce `success()`/`serverError()` helpers |
| P2-28 | Security | **Admin orders — no pagination** | `app/api/admin/orders/route.ts` | Implement cursor-based pagination |
| P2-29 | Security | **Merge cart — missing user verification** | `app/api/auth/merge-cart/route.ts` | Verify session token before merge |

---

## Priority 3 — MEDIUM (Poor UX / Technical Debt)

| # | Area | Issue | File | Fix |
|---|------|-------|------|-----|
| P3-1 | Admin | **4 admin routes missing `loading.tsx`** | See route coverage table | Create loading skeletons |
| P3-2 | Admin | **Admin sidebar active state wrong** | `components/admin/layout/AdminSidebar.tsx` | Use `startsWith()` for parent routes |
| P3-3 | Admin | **Blog AI button no loading state** | `components/admin/blog/` | Add `isGenerating` state |
| P3-4 | Admin | **Category dropdown not sorted** | `components/admin/products/ProductForm.tsx` | Sort alphabetically |
| P3-5 | Admin | **Order detail — no status history timeline** | `app/(admin)/admin/orders/[id]/` | Add status change timeline |
| P3-6 | Admin | **Customer detail — no points balance** | `app/(admin)/admin/customers/[id]/` | Add points section |
| P3-7 | Schema | **`orders` missing `payment_method` column** | `lib/db/schema.ts` | Add column, populate from webhook |
| P3-8 | Schema | **`orders` missing `shipping_courier` column** | `lib/db/schema.ts` | Add column, populate from initiate |
| P3-9 | i18n | **Global error boundary hardcoded** | `app/error.tsx`, `app/global-error.tsx` | Use i18n |
| P3-10 | i18n | **Footer all text hardcoded** | `components/store/layout/Footer.tsx` | Use i18n |
| P3-11 | i18n | **BottomNav B2B tab hardcoded** | `components/store/layout/BottomNav.tsx` | Use i18n |
| P3-12 | Flow | **Cart validate doesn't return stock qty** | `app/api/cart/validate/route.ts` | Return `{ available, availableQty }` |
| P3-13 | Flow | **Order number format mismatch risk** | `lib/utils/generate-order-number.ts` | Verify consistent with Midtrans |
| P3-14 | Flow | **Guest checkout points — verify NOT awarded** | `app/api/webhooks/midtrans/` | Guard with `user_id IS NOT NULL` |
| P3-15 | Payment | **No `Cache-Control` on public endpoints** | `app/api/testimonials/public/`, etc. | Add `Cache-Control: public, max-age=60` |
| P3-16 | Security | **API routes — no request timeout** | Various API routes | Add 30s AbortController timeout |
| P3-17 | Security | **Logout — session not immediately invalidated** | `app/api/auth/[...nextauth]/` | Verify session destroyed at DB level |
| P3-18 | Security | **Cron endpoints — no authentication** | `app/api/cron/*` | Add `Authorization: Bearer CRON_SECRET` |
| P3-19 | Security | **Blog content — XSS risk** | `app/api/admin/blog/` | Sanitize HTML with DOMPurify |
| P3-20 | Security | **Missing `X-Content-Type-Options: nosniff`** | `middleware.ts` | Add security headers |

---

## Priority 4 — LOW (Polish)

| # | Area | Issue | File | Fix |
|---|------|-------|------|-----|
| P4-1 | Design | **Footer payment icons are text labels** | `components/store/layout/Footer.tsx` | Use SVG icons |
| P4-2 | Design | **ProductCard `text-[8px]` arbitrary value** | `components/store/products/ProductCard.tsx` | Use `text-xs` |
| P4-3 | Design | **Footer `text-brand-cream/80` opacity** | `components/store/layout/Footer.tsx` | Use explicit color value |
| P4-4 | Design | **Admin KPICard number formatting inconsistent** | `components/admin/dashboard/KPICard.tsx` | Standardize: formatIDR for revenue |
| P4-5 | Design | **Admin header "Admin" hardcoded** | `components/admin/layout/AdminHeader.tsx` | Use role-appropriate label |
| P4-6 | Code | **AdminSidebar `cn` import wrong path** | `components/admin/layout/AdminSidebar.tsx` | Change to `@/lib/utils/cn` |
| P4-7 | Code | **ProductCard duplicate handler functions** | `components/store/products/ProductCard.tsx` | Extract to single `useCallback` |
| P4-8 | a11y | **Social icons missing `aria-label`** | `components/store/layout/Footer.tsx` | Add descriptive labels |
| P4-9 | a11y | **BottomNav active state wrong for nested routes** | `components/store/layout/BottomNav.tsx` | Use `startsWith()` matching |
| P4-10 | a11y | **ProductCard image alt generic** | `components/store/products/ProductCard.tsx` | Use `t('product.imageAlt', { name })` |

---

## Implementation Phases

### Phase 1: Security & Payment (Week 1)
Fix all P0 and P1 issues in this exact order:
1. Midtrans webhook signature verification (P0-1)
2. Webhook idempotency (P0-3)
3. Coupon validation complete (P0-4)
4. Price re-fetch at checkout (P0-5)
5. Stock re-check at checkout (P0-6)
6. Middleware admin protection (P0-2)
7. Rate limiting on cart validate (P1-8)
8. Role checks on admin order status (P1-5)
9. Superadmin-only coupon access (P1-6)
10. Address table updatedAt + variant index (P1-3, P1-4)

### Phase 2: i18n Complete (Week 1-2)
Fix all hardcoded strings systematically:
1. Navbar NAV_LINKS (P1-1)
2. ProductCard HABIS (P1-2)
3. Footer complete (P2-1, P3-10)
4. All form labels (P2-5)
5. Mobile menu (P2-6)
6. About/Policy pages (P2-7)
7. WhatsApp button (P2-4)
8. Global error boundaries (P3-9)
9. en.json all missing keys (P2-18)
10. id.json duplicate fix (P2-19)

### Phase 3: Schema & Indexes (Week 2)
1. All missing indexes (P2-15, P2-16, P2-17)
2. orders.payment_method column (P3-7)
3. orders.shipping_courier column (P3-8)
4. brand-red-dark hex fix (P2-14)

### Phase 4: Admin Polish (Week 2-3)
1. Fix dashboard timezone (P2-20)
2. Soft delete filter (P2-21)
3. B2B status validation (P2-22)
4. Carousel upload validation (P2-23)
5. Testimonial approval (P2-24)
6. All missing loading.tsx (P3-1)
7. Sidebar active state (P3-2)
8. Admin pagination (P2-28)
9. Points in customer detail (P3-6)
10. Order status timeline (P3-5)

### Phase 5: Security Hardening (Week 3)
1. bcrypt password hashing (P2-25)
2. Password reset expiry (P2-26)
3. API response consistency (P2-27)
4. Merge cart verification (P2-29)
5. Security headers (P3-20)
6. Cron auth (P3-18)
7. Blog XSS sanitization (P3-19)
8. Request timeouts (P3-16)
9. Session invalidation (P3-17)
10. Cache-Control headers (P3-15)

### Phase 6: Design Polish (Week 4)
1. All P4 design issues
2. ProductCard handlers (P4-7)
3. Accessibility fixes (P4-8, P4-9, P4-10)
4. Admin KPICard formatting (P4-4)

---

## Quick Win Commands

```bash
# Find all hardcoded Indonesian strings in components
rg "Beranda\|Masuk\|Keluar\|HABIS\|Stok" components/store/

# Find all TODO/FIXME placeholders
rg "TODO\|FIXME\|XXX\|HACK" --type tsx --type ts

# Find missing loading.tsx in route groups
ls app/\(store\)/*/loading.tsx 2>/dev/null || echo "Missing loading.tsx"

# Find missing error.tsx in route groups
ls app/\(store\)/*/error.tsx 2>/dev/null || echo "Missing error.tsx"

# Find all API routes without rate limiting (quick check)
rg "rateLimit\|rate-limit" app/api/ || echo "No rate limiting found"

# Find all DB queries without index hints
# Manual review of EXPLAIN ANALYZE on slow queries
```

---

## Definition of Done

Before declaring any fix complete:
- [ ] TypeScript compiles with zero errors
- [ ] ESLint passes with zero errors
- [ ] Feature works on mobile (375px width)
- [ ] Error messages in Bahasa Indonesia
- [ ] i18n keys exist in both id.json AND en.json
- [ ] loading.tsx exists for any new route
- [ ] error.tsx handles all error cases
- [ ] No `any` types introduced
- [ ] No hardcoded strings in components
