# Audit 25 — Quick Reference: File Locations & Line Numbers

**Purpose:** Instantly find any issue's exact location
**Date:** 2026-05-23
**Total Issues Documented:** 89 across 5 agents

---

## Security & Payment

| Issue | File | Lines |
|-------|------|-------|
| Midtrans webhook no signature verification | `app/api/webhooks/midtrans/route.ts` | TBD |
| Webhook no idempotency | `app/api/webhooks/midtrans/route.ts` | TBD |
| Coupon validation incomplete | `app/api/coupons/validate/route.ts` | TBD |
| Price not re-fetched at checkout | `app/api/checkout/initiate/route.ts` | TBD |
| Stock not re-checked at checkout | `app/api/checkout/initiate/route.ts` | TBD |
| Admin middleware not protecting routes | `app/middleware.ts` | TBD |
| No rate limit on cart validate | `app/api/cart/validate/route.ts` | TBD |
| RajaOngkir cities fetched every request | `app/api/shipping/cities/route.ts` | TBD |
| NextAuth CSRF may be disabled | `app/api/auth/[...nextauth]/route.ts` | TBD |
| B2B 2x points multiplier missing | `app/api/webhooks/midtrans/route.ts` | TBD |
| Payment retry order_id collision | `app/api/checkout/retry/route.ts` | TBD |
| Cold-chain courier filter incomplete | `app/api/shipping/cost/route.ts` | TBD |
| Checkout missing transaction wrapper | `app/api/checkout/initiate/route.ts` | TBD |
| Payment expiry not enforced | `app/api/webhooks/midtrans/route.ts` | TBD |

---

## i18n & Hardcoded Strings

| Issue | File | Lines |
|-------|------|-------|
| NAV_LINKS hardcoded Indonesian | `components/store/layout/Navbar.tsx` | 12-17 |
| ProductCard "HABIS" hardcoded | `components/store/products/ProductCard.tsx` | ~121 |
| Login button "Masuk" hardcoded | `components/store/layout/Navbar.tsx` | ~121 |
| CartItem stock warning hardcoded | `components/store/cart/CartItem.tsx` | ~44 |
| WhatsApp aria-label hardcoded | `components/store/layout/WhatsAppButton.tsx` | ~34 |
| IdentityForm labels hardcoded | `components/store/checkout/` | TBD |
| Mobile menu "Akun Saya", "Keluar" hardcoded | `components/store/layout/Navbar.tsx` | TBD |
| Footer all text hardcoded | `components/store/layout/Footer.tsx` | TBD |
| BottomNav B2B tab hardcoded | `components/store/layout/BottomNav.tsx` | TBD |
| Global error boundary hardcoded | `app/error.tsx` | 15-17 |
| Global error handler hardcoded | `app/global-error.tsx` | 21-31 |
| About/Privacy/Refund hardcoded | `app/(store)/about/page.tsx`, etc. | TBD |

---

## Schema & Indexes

| Issue | File | Lines |
|-------|------|-------|
| addresses missing updatedAt | `lib/db/schema.ts` | 121-138 |
| productVariants missing (productId, isActive) index | `lib/db/schema.ts` | 224-228 |
| accounts.userId missing index | `lib/db/schema.ts` | TBD |
| sessions.userId missing index | `lib/db/schema.ts` | TBD |
| blogPosts.authorId missing index | `lib/db/schema.ts` | 448 |
| orders missing payment_method column | `lib/db/schema.ts` | TBD |
| orders missing shipping_courier column | `lib/db/schema.ts` | TBD |

---

## Admin Dashboard

| Issue | File | Lines |
|-------|------|-------|
| Order status update missing role check | `app/api/admin/orders/[id]/status/route.ts` | TBD |
| Superadmin-only actions to owner | `app/api/admin/coupons/` | TBD |
| Dashboard revenue uses UTC not WIB | `app/api/admin/dashboard/` | TBD |
| Soft-deleted products in admin list | `app/(admin)/admin/products/` | TBD |
| B2B quote status transitions not validated | `app/api/b2b/quotes/[id]/[action]/route.ts` | TBD |
| Carousel upload no server validation | `app/api/admin/carousel/` | TBD |
| Testimonials public no approval | `app/api/testimonials/public/route.ts` | TBD |
| 4 admin routes missing loading.tsx | See route coverage table | TBD |
| Admin sidebar active state wrong | `components/admin/layout/AdminSidebar.tsx` | TBD |

---

## Incomplete Features

| Issue | File | Lines |
|-------|------|-------|
| AI caption generation unstable | `app/(admin)/admin/ai-content/` | TBD |
| B2B quote PDF not working | `app/api/b2b/quotes/` | TBD |
| Blog cover image upload no server validation | `components/admin/blog/CoverImageUploader.tsx` | TBD |
| Team dashboard data may be stale | `app/api/admin/team-dashboard/` | TBD |
| Points expiry cron no auth | `app/api/cron/expire-points/route.ts` | TBD |
| Cancel expired orders cron no auth | `app/api/cron/cancel-expired-orders/route.ts` | TBD |
| Cart merge verification missing | `app/api/auth/merge-cart/route.ts` | TBD |
| Blog AI description incomplete | `app/api/ai/caption/route.ts` | TBD |

---

## Design Tokens & i18n Files

| Issue | File | Lines |
|-------|------|-------|
| brand-red-dark wrong hex | `tailwind.config.ts` | TBD |
| id.json duplicate pointsUnit | `i18n/messages/id.json` | 175, 194 |
| en.json ~30 keys missing | `i18n/messages/en.json` | TBD |
| B2B route group missing loading.tsx | `app/(store)/b2b/` | TBD |

---

## Grep Commands for Quick Verification

```bash
# Find all hardcoded Indonesian strings
rg "Beranda|Masuk|Keluar|HABIS|Stok tidak" components/store/

# Find all TODO/FIXME
rg "TODO|FIXME|XXX|HACK" --type tsx --type ts

# Find all console.log
rg "console\\.log" --type tsx --type ts

# Find routes without rate limiting
rg "rateLimit" app/api/ || echo "RATE LIMITING MISSING"

# Find routes without auth check
rg "await auth\\(\\)" app/api/ | head -20

# Find all .tsx files with hardcoded t() calls needing i18n
rg "t\\('" components/store/ | head -30

# Find all missing loading.tsx route groups
for dir in app/*/; do ls "$dir"*/loading.tsx 2>/dev/null || echo "MISSING: $dir"; done

# Find all missing error.tsx route groups  
for dir in app/*/; do ls "$dir"*/error.tsx 2>/dev/null || echo "MISSING: $dir"; done

# Check for any in production code
rg "test\\.|Test\\.|console\\.log" app/api/ components/

# Verify brand-red-dark value
rg "brand-red-dark" tailwind.config.ts

# Check for .any usage
rg ": any\\>" --type ts | head -10
```