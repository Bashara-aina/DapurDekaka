# Audit 24 — Customer Journey Flow Simulation

**Purpose:** Trace 6 critical user journeys step-by-step as a real customer would
**Date:** 2026-05-23

---

## Journey 1: Guest Browsing → Purchase

### Step 1.1: Homepage
```
✅ Open dapurdekaka.com
✅ See hero carousel
✅ Browse product grid
✅ Click "Lihat Produk" (Products)
```

**Blockers found:**
- Navbar labels hardcoded Indonesian (breaks English locale)
- Product grid may not have loading skeleton (if JS slow)

---

### Step 1.2: Product Catalog
```
✅ Browse products
✅ Filter by category (if filter exists)
✅ Click product card
```

**Blockers found:**
- Category filter may not work server-side
- Mobile product grid may overflow horizontally

---

### Step 1.3: Product Detail
```
✅ View product details
✅ See variant selection (size/weight)
✅ Check stock status
✅ Click "Tambah ke Keranjang"
```

**Blockers found:**
- Variant selection may not update price display
- "HABIS" overlay is hardcoded Indonesian
- Stock status may show negative number if bug
- Add to cart may silently fail if network error

---

### Step 1.4: Cart
```
✅ View cart
✅ Adjust quantity
✅ See subtotal update
✅ Proceed to checkout
```

**Blockers found:**
- Quantity adjustment may not debounce (multiple API calls)
- CartItem stock warning hardcoded Indonesian
- Empty cart may still allow checkout URL access

---

### Step 1.5: Checkout - Identity
```
✅ Fill name, email, phone
✅ Select delivery method (Delivery/Pickup)
```

**Blockers found:**
- Form labels hardcoded Indonesian
- Email validation may not match RFC 5322
- Phone validation may not handle +62 format

---

### Step 1.6: Checkout - Address (Delivery)
```
✅ Select province
✅ Select city
✅ Enter street address
✅ Enter postal code
```

**Blockers found:**
- Province → City cascade may cause RajaOngkir API rate limit
- No address validation (can enter "asdf" as address)
- Postal code not validated

---

### Step 1.7: Checkout - Courier
```
✅ View available couriers
✅ Select courier
✅ See shipping cost added
```

**Blockers found:**
- Non-cold-chain couriers may appear (JNE REG, J&T)
- Grab/borzo pricing may be wrong
- No estimated delivery date shown
- Origin city may be wrong (not Bandung = 23)

---

### Step 1.8: Checkout - Coupon
```
✅ Enter coupon code
✅ Click "Gunakan"
✅ See discount applied
```

**Blockers found:**
- Coupon validation may only check 5 of 9 rules
- Inapplicable coupon shows generic error
- Coupon success message may not appear

---

### Step 1.9: Checkout - Points
```
✅ See points balance
✅ Toggle points redemption
✅ See max redemption applied
```

**Blockers found:**
- Points may not respect 50% max rule
- Points may be incorrectly calculated for B2B
- Guest user may see points option (shouldn't)

---

### Step 1.10: Checkout - Review & Pay
```
✅ Review order summary
✅ Click "Bayar Sekarang"
```

**Blockers found:**
- Prices shown may not match what server calculates
- Submit button may allow double-click
- No optimistic UI while waiting

---

### Step 1.11: Payment
```
✅ Midtrans Snap popup opens
✅ Complete payment
✅ Popup closes
✅ Redirected to success page
```

**Blockers found:**
- Snap popup may not open (popup blocked)
- Payment timeout (15 min) not enforced on frontend
- Webhook may fail silently
- Success page may show stale data

---

### Step 1.12: Success Page
```
✅ See order confirmation
✅ See order number
✅ See email confirmation sent
✅ Option to track order
```

**Blockers found:**
- Order number may not match Midtrans record
- Email may not arrive (Resend failure)
- "Track Order" may link to 404 page

---

## Journey 2: Returning Customer Login

### Step 2.1: Login
```
✅ Click "Masuk" in navbar
✅ Enter email
✅ Enter password
✅ Click "Masuk"
✅ Redirected to previous page
```

**Blockers found:**
- "Masuk" button hardcoded Indonesian
- Login form labels hardcoded Indonesian
- Invalid credentials shows English or generic error
- Rate limiting may lock account after N attempts

---

### Step 2.2: View Account
```
✅ Click "Akun Saya" (mobile) or account icon
✅ See profile info
✅ See recent orders
✅ See points balance
```

**Blockers found:**
- "Akun Saya" hardcoded Indonesian
- Points balance may be stale
- Recent orders may not load
- Loading state missing

---

### Step 2.3: Edit Profile
```
✅ Click "Edit Profil"
✅ Change name/phone
✅ Save
```

**Blockers found:**
- Form labels hardcoded Indonesian
- Save may fail silently
- Success toast may not appear

---

### Step 2.4: View Orders
```
✅ Browse order history
✅ Click order detail
✅ See status history
```

**Blockers found:**
- Status timeline may not exist
- Tracking number may not be clickable
- Order detail may 404 for some orders

---

## Journey 3: B2B Customer Inquiry

### Step 3.1: B2B Landing
```
✅ Navigate to /b2b
✅ Read about B2B program
✅ Fill inquiry form
```

**Blockers found:**
- B2B route group missing loading.tsx
- Form labels hardcoded Indonesian
- File upload for company docs may not work
- No validation feedback

---

### Step 3.2: Submit Inquiry
```
✅ Submit inquiry
✅ See confirmation
✅ Receive email
```

**Blockers found:**
- Submit may return 500
- Admin may not get notification email
- Confirmation page may be blank

---

### Step 3.3: Receive Quote
```
✅ Admin sends quote
✅ Receive email notification
✅ View quote in email
✅ Click link to quote
```

**Blockers found:**
- Quote email may have broken rendering
- Quote accept/reject links may 404
- Quote may show wrong prices

---

## Journey 4: Admin Order Processing

### Step 4.1: Admin Login
```
✅ Navigate to /admin
✅ Login with credentials
✅ See dashboard
```

**Blockers found:**
- Dashboard revenue may use wrong timezone
- KPI cards may show loading forever
- Recent orders may be empty

---

### Step 4.2: View New Orders
```
✅ See orders list
✅ Filter by "pending_payment"
✅ Click order detail
```

**Blockers found:**
- Status filter may not work
- Order list may return all orders (no pagination)
- Click order may 404

---

### Step 4.3: Process Payment
```
✅ See webhook notification
✅ Verify payment in Midtrans dashboard
✅ Update order to "paid"
```

**Blockers found:**
- Webhook may not fire (not registered in Midtrans)
- Status update button may be missing role check
- Stock may not deduct correctly

---

### Step 4.4: Pack & Ship
```
✅ Warehouse marks order packed
✅ Add tracking number
✅ Mark shipped
```

**Blockers found:**
- Warehouse role may change status incorrectly
- Tracking number not validated (can enter "asdf")
- Courier selector may show non-cold-chain
- Customer not notified of shipment

---

## Journey 5: Admin Product Management

### Step 5.1: Add New Product
```
✅ Click "Produk Baru"
✅ Fill product details
✅ Upload images
✅ Add variants
✅ Publish
```

**Blockers found:**
- Form validation may be incomplete
- Image upload progress may not show
- Variant stock initialized incorrectly
- Product may appear before publishing (if draft not filtered)

---

### Step 5.2: Update Stock
```
✅ Navigate to inventory
✅ Find low stock item
✅ Update stock quantity
✅ Save
```

**Blockers found:**
- Inventory may show negative stock
- Stock update may not reflect in cart validation immediately
- Low stock alert threshold not configurable

---

### Step 5.3: Create Coupon
```
✅ Navigate to coupons
✅ Click "Kupon Baru"
✅ Fill coupon details
✅ Set restrictions
✅ Save
```

**Blockers found:**
- Owner role may be able to create coupons (shouldn't)
- Restrictions may not save correctly (product/category)
- Coupon may be usable immediately (start_at not enforced)

---

## Journey 6: Password Reset Flow

### Step 6.1: Forgot Password
```
✅ Click "Lupa Password"
✅ Enter email
✅ Submit
```

**Blockers found:**
- "Lupa Password" link may not exist
- Email may not send (Resend error)
- Rate limiting may block repeated attempts

---

### Step 6.2: Email Received
```
✅ Open email
✅ Click reset link
✅ Link may be expired (if no expiry)
✅ Link may 404 (wrong token format)
```

**Blockers found:**
- Reset token may not expire
- Token may not be single-use
- Email template may be broken

---

### Step 6.3: Set New Password
```
✅ Enter new password
✅ Confirm password
✅ Submit
✅ Redirect to login
```

**Blockers found:**
- Password strength not validated
- Old password not invalidated immediately
- Redirect may not work

---

## Common Failure Points Across All Journeys

### Authentication Edge Cases
1. **Session expires mid-checkout** → Order abandoned, stock reserved phantom
2. **Login on two devices** → Cart merge conflict
3. **Google OAuth callback fails** → User stuck at callback URL
4. **Password reset while logged in** → Unexpected state

### Payment Edge Cases
1. **Payment times out** → Order shows pending but customer thinks paid
2. **Webhook fires twice** → Double stock deduction
3. **Midtrans API down** → Checkout completely broken
4. **Customer closes popup** → Unclear if payment succeeded

### Data Consistency Edge Cases
1. **Price changes while in cart** → Customer sees old price at checkout
2. **Stock depletes while in checkout** → Order created for out-of-stock items
3. **Coupon expires while in checkout** → Applied but then rejected at webhook
4. **Product deleted after cart add** → Cart item references dead product

### Mobile-Specific Issues
1. **Bottom nav overlaps content** → `pb-20` not applied everywhere
2. **Horizontal scroll on product grid** → Not responsive
3. **Keyboard covers input fields** → Address forms unusable
4. **Back button loses checkout state** → Must re-enter everything

---

## Test Scenarios to Automate

```typescript
// Happy path tests
test('guest checkout flow completes', async () => { ... })
test('returning customer login works', async () => { ... })
test('B2B inquiry submits successfully', async () => { ... })
test('admin can update order status', async () => { ... })
test('coupon applies correctly', async () => { ... })
test('points redeem correctly', async () => { ... })

// Edge case tests
test('expired coupon rejected', async () => { ... })
test('out-of-stock prevents checkout', async () => { ... })
test('max points redemption enforced', async () => { ... })
test('unauthorized admin route returns 403', async () => { ... })
test('webhook idempotency prevents double-charge', async () => { ... })
test('session expiry redirects to login', async () => { ... })

// i18n tests
test('English locale shows English labels', async () => { ... })
test('Indonesian locale shows Indonesian labels', async () => { ... })

// Mobile tests
test('checkout works on 375px width', async () => { ... })
test('bottom nav does not overlap content', async () => { ... })
```
