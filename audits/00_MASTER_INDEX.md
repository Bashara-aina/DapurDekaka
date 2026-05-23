---
title: "Master Audit Index — All 10 Reports"
audit-date: "2026-05-23"
scope: "Complete audit report overview with cross-references"
severity: "CRITICAL"
files-affected: "ALL FILES"
---

# Master Audit Index — DapurDekaka.com Deep Audit (2026-05-23)

**Date:** May 23, 2026
**Auditors:** 5 parallel AI agents, ~200 files audited
**Total Issues Found:** 87+ (7 CRITICAL, 15 HIGH, 28 MEDIUM, 37 MINOR)

---

## ALL 10 AUDIT FILES

| # | File | Focus | Issues | CRITICAL |
|---|------|-------|--------|----------|
| 01 | `STORE_FRONTEND_DEEP_AUDIT.md` | Customer journey: homepage → cart → checkout → order | 32 bugs | 3 |
| 02 | `ADMIN_DASHBOARD_DEEP_AUDIT.md` | Admin pages, CRUD, role permissions, Team Dashboard | 20+ bugs | 2 |
| 03 | `PAYMENT_FLOW_DEEP_AUDIT.md` | Midtrans, webhooks, retry, points, coupons | 15 bugs | 5 |
| 04 | `AUTH_DATABASE_DEEP_AUDIT.md` | NextAuth, user accounts, DB schema, data integrity | 10 bugs | 2 |
| 05 | `I18N_UI_EDGE_CASES_DEEP_AUDIT.md` | Translations, design system, error handling, edge cases | 25+ bugs | 2 |
| 06 | `CRITICAL_FIX_ROADMAP.md` | All CRITICAL severity bugs with exact fix code | 7 bugs | 7 |
| 07 | `DATABASE_SCHEMA_AUDIT.md` | Drizzle schema, constraints, indexes, migrations | 7 issues | 2 |
| 08 | `API_ROUTES_DEEP_AUDIT.md` | All API routes, auth, validation, rate limiting | 15 bugs | 4 |
| 09 | `INCOMPLETE_FEATURES_AUDIT.md` | Disabled buttons, missing routes, TODO comments | 15 features | 4 |
| 10 | `QUICK_FIX_CHECKLIST.md` | Every bug by file:line with one-line fix | 28 fixes | 7 |

---

## QUICK SUMMARY — WHAT'S BROKEN

### 🚨 7 CRITICAL BLOCKERS

| # | Bug | Impact | File |
|---|-----|--------|------|
| 1 | **Webhook signature verification missing** | Payment fraud — anyone can fake payments | `app/api/webhooks/midtrans/route.ts` |
| 2 | **`order` undefined in Net-30 block** | B2B orders crash when awarding points | `checkout/initiate/route.ts:611` |
| 3 | **Payment retry endpoint 404** | Customers can't retry failed payments | `app/api/checkout/retry/route.ts` (MISSING) |
| 4 | **Buy X Get Y no stock validation** | Stock can go negative with free items | `checkout/initiate/route.ts:258-285` |
| 5 | **ProductDetailClient hardcoded Indonesian** | i18n broken on conversion page | `ProductDetailClient.tsx` (entire file) |
| 6 | **PointsRedeemer double division bug** | Customers see wrong point values | `PointsRedeemer.tsx:29-32` |
| 7 | **B2B quote workflow disabled** | Email and PDF buttons disabled, workflow broken | `b2b-quotes/[id]/page.tsx` |

---

### 🔴 15 HIGH PRIORITY ISSUES

| # | Issue | Impact |
|---|-------|--------|
| 1 | Team Dashboard 6 missing API routes | 60% of panels crash with 404 |
| 2 | No stock reservation at initiate | Race condition / oversell risk |
| 3 | `freeShipping` column doesn't exist | Free shipping coupons don't work |
| 4 | Points deducted outside transaction | Users lose points on failed orders |
| 5 | RajaOngkir origin city mismatch | Non-Jakarta stores can't calculate shipping |
| 6 | Guest coupon per-user limit bypass | Guests can reuse single-use coupons |
| 7 | Coupon validate has no rate limiting | Coupon codes can be brute-forced |
| 8 | Dashboard `ordersDelta` always 0 | Revenue delta shows 0% always |
| 9 | DrizzleAdapter type safety bypassed | Type errors hidden with @ts-expect-error |
| 10 | No database stock CHECK constraint | Stock can go negative at DB level |
| 11 | `midtransOrderId` missing unique constraint | Duplicate order IDs possible |
| 12 | Points expire query missing index | FIFO queries slow on large tables |
| 13 | Case-insensitive email not enforced | `Test@Email.com` vs `test@email.com` |
| 14 | `weightInKg` variable misleadingly named | Actually in grams, not kg |
| 15 | PointsRedeemer potentialSavings ×100 error | Shows 100x actual savings |

---

## AUDIT COVERAGE MATRIX

| Area | STORE | ADMIN | PAYMENT | AUTH | I18N | DB | API | INCOMPLETE |
|------|-------|-------|---------|------|------|----|----|-------------|
| Homepage | ✅ | | | | ✅ | | | |
| Product Catalog | ✅ | | | | ✅ | | | |
| Product Detail | ✅ | | | | ✅ | | | |
| Cart | ✅ | | | | ✅ | | | |
| Checkout | ✅ | | ✅ | | ✅ | | | |
| Payment/Webhook | | | ✅ | | | | ✅ | |
| Order Status | | ✅ | ✅ | | | | | |
| Auth Pages | | | | ✅ | | | | |
| Account Pages | | | | ✅ | | | | |
| Admin Dashboard | | ✅ | | | | | ✅ | |
| Products CRUD | | ✅ | | | | | | |
| Orders CRUD | | ✅ | | | | | ✅ | |
| Customers | | ✅ | | | | | | |
| Coupons | | ✅ | ✅ | | | ✅ | ✅ | |
| Blog CMS | | ✅ | | | | | | |
| Carousel | | ✅ | | | | | | |
| B2B Inquiries | | ✅ | | | | | | |
| B2B Quotes | | ✅ | | | | | | ✅ |
| Team Dashboard | | ✅ | | | | | ✅ | ✅ |
| Field Dashboard | | ✅ | | | | | | |
| Settings | | ✅ | | | | | | |
| AI Content | | ✅ | | | | | | |
| Shipping API | | | | | | | ✅ | |
| Points System | | ✅ | ✅ | ✅ | | | | |
| DB Schema | | | | | | ✅ | | |
| Middleware | | | | ✅ | | | | |
| i18n Strings | | | | | ✅ | | | |
| Design Tokens | | | | | ✅ | | | |
| Error States | | | | | ✅ | | | |
| Loading States | | | | | ✅ | | | |

---

## FILES WITH MOST BUGS

| Rank | File | Bug Count | Most Severe |
|------|------|-----------|-------------|
| 1 | `app/api/checkout/initiate/route.ts` | 5 critical | Payment fraud, B2B crash |
| 2 | `components/store/products/ProductDetailClient.tsx` | 1 critical | i18n broken |
| 3 | `app/(admin)/admin/team-dashboard/TeamDashboardClient.tsx` | 6 critical | Missing APIs |
| 4 | `app/(admin)/admin/b2b-quotes/[id]/page.tsx` | 1 critical | B2B broken |
| 5 | `components/store/checkout/PointsRedeemer.tsx` | 1 critical | Wrong math |
| 6 | `app/api/webhooks/midtrans/route.ts` | 1 critical | No signature check |

---

## RECOMMENDED FIX ORDER

```
Week 1 (Launch blockers):
  1. Webhook signature verification
  2. Fix order undefined in Net-30
  3. Create payment retry endpoint
  4. Fix PointsRedeemer double division

Week 2 (Core functionality):
  5. Add Buy X Get Y stock validation
  6. Fix freeShipping column check
  7. Fix RajaOngkir origin city
  8. Add coupon validate rate limiting

Week 3 (Admin polish):
  9. Create 6 missing team dashboard APIs
  10. Fix dashboard ordersDelta
  11. Add DB constraints (stock, unique)
  12. Add missing loading/error files

Week 4 (i18n & completeness):
  13. ProductDetailClient i18n (big job)
  14. Implement B2B quote PDF/email
  15. About page error.tsx
  16. Fix all <img> tags → Next Image
```

---

## CROSS-REFERENCES

| Bug | Found In |
|-----|----------|
| `order.pointsEarned` undefined | STORE_FRONTEND (BUG-30), PAYMENT (CRITICAL-3), AUTH (9.1) |
| Double division in PointsRedeemer | STORE_FRONTEND (BUG-10), I18N (21), PAYMENT |
| B2B quote buttons disabled | ADMIN (11.2), INCOMPLETE (CRITICAL-1) |
| Team dashboard 6 missing APIs | ADMIN (12.1), INCOMPLETE (CRITICAL-3) |
| `freeShipping` column | STORE_FRONTEND (BUG-16), PAYMENT (HIGH-5), DB (ISSUE-8) |
| Points deducted outside transaction | PAYMENT (HIGH-3), AUTH (7.3) |
| Guest coupon bypass | PAYMENT (HIGH-4), I18N (9.1) |
| RajaOngkir origin city | STORE_FRONTEND (BUG-29), PAYMENT (HIGH-2), API |
| No webhook signature | PAYMENT (CRITICAL-5), AUTH (8.1) |
| 6 missing team APIs | ADMIN (12.1), API (team-dashboard), INCOMPLETE (CRITICAL-3) |

---

## AUDIT METHODOLOGY

- **5 parallel agents** covering different areas
- **~200 files read** across app/, components/, lib/, api/
- **Customer journey traced** end-to-end (homepage → order completion)
- **Admin pages audited** for all CRUD operations
- **API routes verified** for validation, auth, error handling
- **Schema reviewed** for constraints, indexes, relationships
- **Design system checked** for token violations
- **i18n coverage verified** by grep for hardcoded strings

---

*End of Master Audit Index*