# FINAL AUDIT 02 — Incomplete Features vs PRD
**Date:** 2026-05-15  
**Focus:** Feature-by-feature comparison of what the PRD specified vs what is actually built  
**Method:** PRD.md v1.0 vs actual code inspection

---

## HOW TO READ THIS DOCUMENT

Each feature is tagged:
- ✅ **DONE** — Fully implemented and matches PRD
- ⚠️ **PARTIAL** — Built but has meaningful gaps or deviations
- ❌ **MISSING** — Not built at all
- 🚫 **OUT OF SCOPE** — Explicitly deferred (V2+)

---

## SECTION 4.1 — STORE FEATURES

### P0 Features (Must Launch Day 1)

| Feature | Status | Gap / Notes |
|---|---|---|
| Product catalog with search + filter | ✅ | ProductCatalog, ProductSearch, ProductFilters all exist |
| Product detail page | ⚠️ | Exists but "Tersisa X pcs" low-stock warning not verified on page |
| Shopping cart (guest + registered) | ⚠️ | localStorage only — no DB sync for logged-in users per PRD requirement |
| Guest checkout | ✅ | Identity form collects name/email/phone |
| Registered checkout with saved address | ⚠️ | Works but identity step not skipped for logged-in users |
| RajaOngkir real-time shipping cost | ⚠️ | API exists; only 3 cold-chain services filtered — need to verify filter logic is correct |
| Pickup option | ✅ | Delivery method toggle + pickup info screen exists |
| Midtrans payment (Snap.js) | ⚠️ | Works on checkout page; broken on pending/retry page (Snap.js not reloaded) |
| Order success / pending / failed pages | ⚠️ | All exist but each has significant gaps (see Audit 01) |
| Order tracking page (public) | ⚠️ | Exists but has CRITICAL security gap — no email verification |
| PDF receipt download | ❌ | No `/api/orders/[orderNumber]/receipt` route exists; no download button on any page |
| Email confirmation (Resend) | ⚠️ | OrderConfirmation email sent ✓; Shipped + Delivered emails missing |
| Google login | ✅ | NextAuth Google provider configured |
| Email + password login | ✅ | Email/password with bcrypt configured |
| Register page | ✅ | `/register` exists |
| Homepage carousel | ✅ | HeroCarousel with DB-driven slides |
| WhatsApp floating button | ✅ | WhatsAppButton component in store layout |
| Halal badge on products | ✅ | HalalBadge component exists |
| Out of stock display ("Habis") | ✅ | StockBadge component, variant disabled |
| Order notes at checkout | ⚠️ | Field exists in Identity step but poorly placed (should be in payment step) |

### P1 Features (Launch Week 1–7)

| Feature | Status | Gap / Notes |
|---|---|---|
| Language toggle (ID/EN) | ❌ | **BROKEN** — LanguageSwitcher uses next-intl routing that is not configured. App crashes if next-intl hooks are invoked without provider. All content is hardcoded in ID. |
| Coupon code at checkout | ⚠️ | Input exists, validation API works; but `maxUsesPerUser` check doesn't pass userId |
| Points earn on purchase | ⚠️ | Points awarded in webhook ✓; success page doesn't show earned points |
| Points redeem at checkout | ⚠️ | UI exists but `formData.pointsUsed` is never updated from PointsRedeemer — points discount likely not sent to API |
| Account dashboard | ⚠️ | Exists; total orders count is wrong (max 5); points conversion display is off |
| Saved addresses management | ✅ | Full CRUD at `/account/addresses` |
| Order history | ✅ | `/account/orders` exists |
| Product variant selector | ✅ | ProductDetailClient handles variants |
| Instagram feed embed on homepage | ⚠️ | Hardcoded Cloudinary image IDs displayed as grid — not real Instagram data. Links go to instagram.com/dapurdekaka correctly. |
| Blog listing + detail | ✅ | `/blog` and `/blog/[slug]` with TipTap editor in admin |
| SEO meta tags on all pages | ✅ | Metadata defined on all major pages |
| Sitemap.xml + robots.txt | ❓ | Not verified — check `app/sitemap.ts` and `app/robots.ts` exist |
| Testimonials section | ⚠️ | Testimonials component exists on homepage but data appears hardcoded or from DB — need to verify admin can manage these |
| B2B landing page | ✅ | `/b2b` with hero, benefits, quote form |
| B2B inquiry form | ✅ | QuoteForm submits to `/api/b2b/inquiry` |

### P2 Features (Week 2–4)

| Feature | Status | Gap / Notes |
|---|---|---|
| Forgot/reset password | ✅ | `/forgot-password` and `/reset-password/[token]` exist (note: path is `/forgot-password` not `/auth/forgot-password` as PRD says) |
| B2B account portal | ⚠️ | Stub — shows menu links to orders/quotes. No company info, no B2B profile display, no Net-30 status display |
| B2B bulk pricing | ⚠️ | Schema has `b2bPrice` on variants; B2B products page exists but unclear if B2B pricing is shown |
| B2B custom quote PDF | ❌ | Quote builder exists in admin; `pdfUrl` field in schema; but PDF generation not implemented |
| Points history page | ⚠️ | `/account/points` page exists — need to verify it shows full FIFO history with expiry dates |
| Vouchers page in account | ⚠️ | `/account/vouchers` page exists — shows public coupons from DB; need to verify display |

### P3 Features (Post Month 1)

| Feature | Status | Gap / Notes |
|---|---|---|
| Product reviews/ratings | 🚫 | Out of scope V1 — correctly not built |
| Referral system | 🚫 | Out of scope V1 |
| Push notifications | 🚫 | Out of scope V1 |
| Automated TikTok posting | 🚫 | Out of scope V1 |

---

## SECTION 4.2 — ADMIN FEATURES

| Feature | Status | Gap / Notes |
|---|---|---|
| Admin login + role-based access | ✅ | Middleware + role checks |
| Order list + detail view | ⚠️ | List exists; need to verify admin `/admin/orders/[id]` detail page exists |
| Order status update | ⚠️ | API exists; UI in OrdersClient — verify warehouse role can only set "shipped" |
| Product add/edit/delete | ✅ | Full ProductForm with variants and images |
| Inventory stock update | ✅ | `/admin/inventory` field page with mobile-friendly UI |
| Tracking number input + mark shipped | ✅ | `/admin/shipments` field page |
| Revenue dashboard (KPI cards) | ✅ | Revenue Today, Orders Today, etc. on dashboard |
| Revenue chart (last 30 days) | ❌ | **MISSING** — Dashboard has KPI cards and funnel but NO time-series revenue chart. PRD says "Revenue chart (last 30 days)" |
| Coupon management | ✅ | Full CRUD at `/admin/coupons` |
| Customer list + detail | ⚠️ | `/admin/customers` list exists; detail page `/admin/customers/[id]` — verify it shows order history |
| Blog CMS with TipTap editor | ✅ | TipTapEditor component, full blog CRUD |
| Carousel management | ✅ | Full CRUD with image upload |
| B2B inquiry inbox | ✅ | `/admin/b2b-inquiries` with status update |
| AI caption generator (Minimax) | ⚠️ | `/admin/ai-content` page with CaptionGenerator component exists — verify Minimax API integration works |
| PDF receipt download from admin | ❌ | No admin-side PDF download |
| B2B quote builder + PDF | ⚠️ | Admin can create quotes; `pdfUrl` stored but actual PDF generation is not implemented |
| Manual points adjustment | ⚠️ | `/api/admin/points/adjust` route exists — verify if there's a UI for it |
| Admin user management | ✅ | `/admin/users` page exists |
| System settings page | ✅ | Key-value settings table at `/admin/settings` |
| Low stock alerts | ✅ | Dashboard "Inventory Flash" shows out-of-stock and low-stock items |
| Export orders to CSV | ⚠️ | `/api/admin/export/orders` route exists — verify if linked from UI |

---

## SECTION 5 — CHECKOUT FLOW RULES

### 5.1 Cart Rules

| Rule | Status | Gap |
|---|---|---|
| Cart persists in localStorage for guests | ✅ | Zustand persist |
| Cart syncs to database for logged-in users | ❌ | Only localStorage — no DB sync |
| Guest logs in → cart merges | ⚠️ | `/api/auth/merge-cart` route exists but never auto-called on login |
| Max quantity per variant: 99 | ✅ | Enforced in cart store |
| No minimum order amount | ✅ | No validation |
| Real-time stock validation in cart | ⚠️ | Only for logged-in users; guests skip |
| Cart shows item image, name, variant, price, qty stepper, remove, subtotal | ✅ | CartItemComponent |
| Order summary shows: subtotal, shipping (TBD), discount, points, total | ⚠️ | Sidebar shows totals but on mobile it's below fold |

### 5.2 Checkout Steps

| Step | Status | Gap |
|---|---|---|
| Step 1 — Identity (Guest only) | ⚠️ | Shown to logged-in users too — should auto-skip |
| Step 2 — Delivery Method | ✅ | DeliveryMethodToggle |
| Step 3 — Delivery Address | ✅ | AddressForm + SavedAddressPicker |
| Step 4 — Shipping Option | ⚠️ | SiCepat FROZEN, JNE YES, AnterAja — need to verify courier filtering |
| Step 5 — Coupon & Points | ⚠️ | Both in payment step ✓; but points calculation not properly passed to API |
| Step 6 — Order Review & Payment | ⚠️ | No full order review before payment |
| "Bayar Sekarang" triggers Snap | ✅ | Works on checkout page |
| No COD option | ✅ | Correctly absent |

### 5.3 Order Number Format `DDK-YYYYMMDD-XXXX`

| Rule | Status | Gap |
|---|---|---|
| Format correct | ✅ | Implemented in checkout initiate |
| Daily counter resets | ✅ | `orderDailyCounters` table |
| Sequential zero-padded | ✅ | XXXX format |

### 5.4 Payment Flow

| Event | Status | Gap |
|---|---|---|
| Midtrans webhook verified | ✅ | SHA512 signature check |
| Replay attack protection (1hr) | ✅ | `transaction_time` check |
| Idempotency check | ✅ | Already-paid check |
| Update order to "paid" | ✅ | |
| Deduct stock on settlement | ✅ | Atomic in DB transaction |
| Award loyalty points | ✅ | B2B 2x multiplier ✓ |
| Increment coupon used_count | ✅ | |
| Send confirmation email | ✅ | |
| Pickup invitation email | ✅ | |
| Redirect to /checkout/success | ⚠️ | Handled by Midtrans Snap callbacks |
| Failed: reverse points | ✅ | FIFO unconsume in webhook |
| Failed: reverse coupon count | ✅ | |
| Failed: redirect to /checkout/failed | ⚠️ | Handled by Snap callbacks |
| Cart cleared after success | ⚠️ | Only if Snap `onSuccess` fires |
| PDF receipt generated | ❌ | Not implemented |
| "Shipped" email with tracking | ❌ | Email template missing |
| "Delivered" email with points info | ❌ | Email template missing |
| Cancellation email | ✅ | OrderCancellationEmail template |

### 5.5 Order Status Transitions

| Transition | Status | Gap |
|---|---|---|
| pending_payment → paid (webhook) | ✅ | |
| paid → processing (admin) | ✅ | Via admin orders status update |
| processing → packed (admin) | ✅ | |
| packed → shipped (warehouse, tracking input) | ✅ | |
| shipped → delivered (admin) | ✅ | |
| Any → cancelled (superadmin/auto) | ✅ | |
| delivered → refunded (superadmin) | ⚠️ | Enum exists; UI for this flow unclear |
| Pickup: paid → processing → delivered (no packed/shipped) | ⚠️ | No enforcement that pickup orders skip packed/shipped |

### 5.6 Pickup Invitation

| Rule | Status | Gap |
|---|---|---|
| Pickup page at `/orders/[orderNumber]/pickup` | ✅ | Page exists |
| Order number as pickup code (large, bold) | ✅ | PickupInvitation component |
| Step-by-step instructions | ✅ | |
| Store address display | ✅ | |
| Google Maps link | ✅ | |
| Opening hours (from settings) | ⚠️ | Hardcoded in page, not from systemSettings table |
| WhatsApp contact link | ✅ | |
| Pickup invitation emailed | ✅ | PickupInvitationEmail sent in webhook |

---

## SECTION 6 — PRICING, COUPONS & POINTS

### 6.2 Coupon Types

| Type | Status | Gap |
|---|---|---|
| `percentage` | ✅ | |
| `fixed` | ✅ | |
| `free_shipping` | ⚠️ | Enum + schema exists; UI handling in checkout unclear |
| `buy_x_get_y` | ⚠️ | Shows info message; but free item NOT auto-added to cart |

**Critical Gap:** The `buy_x_get_y` coupon type shows a message "Beli X item, dapat Y item gratis otomatis" but nothing actually adds the free item. The PRD says: "free item added to cart automatically — free item is lowest-priced variant in qualifying product." This logic is completely absent.

### 6.3 Coupon Rules

| Rule | Status | Gap |
|---|---|---|
| Case-insensitive codes | ✅ | Validated server-side |
| One coupon per order | ✅ | |
| Min order amount check | ✅ | |
| Max total uses check | ✅ | `used_count` vs `max_uses` |
| Expiry check | ✅ | |
| `is_active` check | ✅ | |
| `used_count` incremented only after settlement | ✅ | In webhook |
| Per-user limit (`maxUsesPerUser`) | ⚠️ | Schema has field; validation API doesn't receive userId to check |
| Percentage applies to subtotal only | ✅ | |
| Fixed discount ≤ subtotal | ⚠️ | Not explicitly enforced in UI; API should clamp |

### 6.4 Points System

| Rule | Status | Gap |
|---|---|---|
| Only registered users earn points | ✅ | Webhook checks `order.userId` |
| Rate: 1 point per IDR 1,000 on subtotal | ✅ | `pointsEarned` set at initiate |
| B2B customers earn 2x points | ✅ | In webhook |
| Points expire 1 year from earned date | ✅ | `expiresAt` set to +365 days |
| FIFO redemption (oldest first) | ⚠️ | Schema has `referencedEarnId`; implementation in initiate needs verification |
| 30-day expiry reminder email | ⚠️ | `/api/admin/points/expiry-reminders` exists; cron integration needed |
| Min redemption: 100 points | ✅ | `POINTS_MIN_REDEEM` constant |
| 100 points = IDR 1,000 | ✅ | `POINTS_VALUE_IDR` constant |
| Max redemption: 50% of subtotal | ✅ | In PointsRedeemer calculation |
| Points deducted at order creation | ⚠️ | Check `/api/checkout/initiate` |
| Points reversed on failure | ✅ | In webhook cancellation handler |

---

## SECTION 8 — SHIPPING & LOGISTICS

| Rule | Status | Gap |
|---|---|---|
| Only cold-chain couriers shown | ⚠️ | Filtering exists in shipping cost API — **must verify** SiCepat FROZEN, JNE YES, AnterAja FROZEN are the ONLY services returned |
| "No service available" message with WhatsApp button | ⚠️ | Need to verify ShippingOptions component handles empty results |
| Origin: Bandung city_id 23 | ✅ | |
| Min billable weight: 1000g | ✅ | In shipping cost API |
| Weight rounded up to nearest 100g | ✅ | |
| Tracking deep-links per courier | ⚠️ | TrackingInfo component — verify it generates correct URLs for each courier |
| Tracking number auto-updates status to "shipped" | ✅ | In admin field API |

---

## SECTION 9 — AUTH & ACCESS CONTROL

| Rule | Status | Gap |
|---|---|---|
| Google OAuth | ✅ | |
| Email + password with bcrypt | ✅ | |
| Guest checkout | ✅ | |
| 30-day session duration | ✅ | |
| All admin routes protected by middleware | ✅ | `app/middleware.ts` |
| Warehouse staff: only `/admin/inventory` + `/admin/shipments` | ⚠️ | Middleware exists — verify warehouse role restriction is applied correctly to `/admin/field` vs other admin pages |
| Midtrans signature verification | ✅ | |
| Rate limiting on auth/coupons/checkout | ✅ | `lib/utils/rate-limit.ts` |
| Input sanitization | ✅ | Zod schemas on all forms |
| Guest order tracking: email verification | ❌ | **CRITICAL** — missing entirely |
| Superadmin-only functions (coupons mgmt, B2B Net-30) | ⚠️ | Need to verify role checks on each restricted route |

---

## CRITICAL GAPS SUMMARY (WHAT TO FIX FIRST)

### Week 1 Fixes (P0 — Breaks Revenue/Privacy)
1. **Points not sent to checkout API** — discount shows but isn't applied
2. **Snap.js not loaded on pending page** — retry button silently fails
3. **Cart restore shape mismatch on failed page** — users must re-add all items manually
4. **No email gate on public order tracking** — customer address/phone exposed to anyone
5. **LanguageSwitcher crashes app** — next-intl used without configuration

### Week 2 Fixes (P1 — Feature Gaps vs PRD)
6. **PDF receipt** — needed for post-purchase confidence and B2B
7. **Revenue chart (30 days)** — admin can't see trends
8. **Shipped + Delivered email notifications** — customers not informed of delivery progress
9. **buy_x_get_y free item logic** — coupon type shows message but doesn't function
10. **Cart DB sync for logged-in users** — multi-device cart lost
11. **Order review step before payment** — customers paying blind on mobile
12. **Identity step shown to logged-in users** — extra friction

### Week 3 Fixes (P1 — UX Polish)
13. **Total orders count (max 5 bug)**
14. **Countdown timer on pending page**
15. **VA number display on pending page**
16. **Pickup orders: enforce no packed/shipped status**
17. **Per-user coupon limit check** — send userId with coupon validation
