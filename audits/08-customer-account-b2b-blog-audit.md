# AUDIT 08 — Customer Account, B2B Portal & Blog

**Project:** DapurDekaka.com
**Date:** May 24, 2026

---

## EXECUTIVE SUMMARY

The customer account section, B2B portal, and blog CMS are largely complete and well-structured. No critical bugs found. All pages follow the design system and use proper Server Components where appropriate. Main issues: some i18n gaps, a few hardcoded strings in B2B components, and the B2B order/reorder flow needs verification of the PDF quote generation and payment integration.

---

## CUSTOMER ACCOUNT PAGES

### Account Layout (`app/(store)/account/layout.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | N/A |

- Protected route (requires customer/b2b/owner/superadmin role) ✅
- AccountNav sidebar with sections: Profile, Orders, Addresses, Points ✅
- Uses `auth()` for session data ✅

---

### Account Profile (`app/(store)/account/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- Shows user name, email, phone, role badge
- Edit profile form with Zod validation
- Password change form
- Member since date + points balance display
- B2B users see "B2B Portal" link

---

### Order History (`app/(store)/account/orders/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- Paginated order list with status badges
- Filter by status and date range
- Search by order number
- Click through to order detail

---

### Order Detail (`app/(store)/account/orders/[orderId]/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- Order items with product snapshots
- Shipping/tracking info
- Payment summary
- Status timeline
- "Beli Lagi" (reorder) button — needs verification (see below)

---

### Reorder Flow (`app/(store)/account/orders/[orderId]/page.tsx` — "Beli Lagi")

| Status | 🟡 Not Fully Verified |
|--------|----------------------|
| Severity | **MEDIUM** |

**FINDING — Reorder button exists but flow not audited:**
- The "Beli Lagi" button should add all items from a previous order to the cart
- This involves: fetching order items → adding each to cart with variantId + quantity → merging cart (logged-in) or saving to localStorage (guest)
- Need to verify: does it check current stock? Does it handle discontinued products?

---

### Addresses (`app/(store)/account/addresses/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- List of saved addresses
- Add/Edit/Delete address forms
- Default address selection for checkout
- Province → City cascading selects

---

### Points History (`app/(store)/account/points/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- Current points balance prominently displayed
- Points history table: earn/redeem/expire/adjust events
- FIFO explanation with oldest points highlighted
- Expiring soon warning if points will expire within 30 days

---

## B2B PORTAL

### B2B Landing Page (`app/(b2b)/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- B2B value proposition: bulk pricing, dedicated account manager, event catering
- "Request Quote" form with company details, estimated volume, product interests
- WhatsApp contact button

---

### B2B Registration (`app/(b2b)/register/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- Company name, NPWP/TAX ID, business type, estimated monthly volume
- Zod validation on all fields
- Creates user with `role: 'b2b'` on approval (manual approval workflow)

---

### B2B Account Dashboard (`app/(b2b)/dashboard/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- B2B-specific pricing shown on product pages (uses `b2bPrice` field)
- B2B order history with volume discounts shown
- Account manager contact info

---

### B2B Quote Request Flow

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **MEDIUM** |

**FINDING — Quote PDF Generation Not Audited:**
- `app/(admin)/admin/b2b/page.tsx` has a "Generate Quote PDF" button
- The actual PDF generation using `@react-pdf/renderer` was not audited
- Need to verify: does the PDF include all line items, pricing, terms, validity period?

**Also noted:**
- B2B quote status workflow: `pending → quoted → approved → converted_to_order`
- Status email notification on quote generated — not verified

---

## BLOG SECTION

### Blog Listing (`app/(store)/blog/page.tsx`)

| Status | 🟡 Incomplete |
|--------|--------------|
| Severity | **HIGH** |

All user-facing strings are hardcoded (not using next-intl). See Audit 01 and Audit 07 for the full list of ~8 hardcoded strings.

---

### Blog Post Detail (`app/(store)/blog/[slug]/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- Proper static generation with `generateStaticParams`
- Related posts at bottom
- Social sharing buttons
- Author info (admin user who created post)

---

### Blog CMS (`app/(admin)/admin/blog/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- Tiptap rich text editor for post content
- Featured image upload to Cloudinary
- Tags/categories management
- AI caption generation button (superadmin only)
- Publish/draft toggle
- SEO fields: meta title, meta description (id + en)

---

### AI Content Generation (`app/(admin)/admin/ai-content/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- Minimax integration for product caption and blog content generation
- superadmin only access
- Language selector (id/en)
- Tone selector (professional, friendly, marketing)
- Preview before applying

---

## ORDERS SUCCESS PAGE (`app/(store)/orders/success/[orderNumber]/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- Order number prominently displayed
- Order summary with items
- Payment method + amount paid
- Next steps: "Track Order", "Continue Shopping", "Contact WhatsApp"
- Email confirmation sent message

---

## ORDERS PENDING PAGE (`app/(store)/orders/pending/[orderNumber]/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- Payment instructions
- "Pay Now" button to retry/capture payment
- Order number + amount
- Countdown timer to expiry (should be shown — verify)
- Cancel order option if retries exhausted

---

## ORDERS TRACKING PAGE (`app/(store)/orders/[orderId]/page.tsx`)

| Status | ✅ Complete |
|--------|------------|
| Severity | LOW |

- Status timeline: Pending → Paid → Packed → Shipped → Delivered
- Tracking number with courier link
- Estimated delivery (if available from RajaOngkir)
- Order items summary

---

## PRIORITY FIX LIST

### 🟠 HIGH
1. **`app/(store)/blog/page.tsx`** — Migrate all hardcoded strings to next-intl (also in Audit 01 and 07)

### 🟡 MEDIUM
2. **Reorder flow** — Verify the "Beli Lagi" button correctly adds all items to cart, handles out-of-stock products, and shows a proper error if all items are unavailable
3. **B2B Quote PDF** — Audit `@react-pdf/renderer` implementation in admin B2B quotes page
4. **Order pending page** — Verify countdown timer to payment expiry is displayed

### 🟢 LOW
5. **B2B quote email** — Verify notification email is sent when admin generates a quote
6. **Account points page** — Verify "expiring soon" warning logic correctly shows points expiring within 30 days