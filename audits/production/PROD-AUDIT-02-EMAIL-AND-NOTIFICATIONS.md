# PROD-AUDIT-02: Email & Notification System
**Status: NOT PRODUCTION READY — 3 critical, 5 high severity**
**Focus: `lib/resend/`, email templates, all routes that send email**

---

## Overview of email sends in the codebase

| Trigger | Email Type | Route | Status |
|---------|-----------|-------|--------|
| Midtrans settlement | Order Confirmation | `webhooks/midtrans` | BROKEN (missing pointsEarned, double send for pickup) |
| Midtrans settlement (pickup) | Pickup Invitation | `webhooks/midtrans` | BROKEN (sent alongside confirmation) |
| Admin status → cancelled | Order Cancellation | `admin/orders/[id]/status` | BROKEN (missing refund info) |
| Admin status → shipped | Order Shipped | `admin/orders/[id]/status` | Review needed |
| Cron points-expiry-warning | Points Expiry Warning | `cron/points-expiry-warning` | BROKEN (process.exit in module) |
| Auth forgot-password | Password Reset | `auth/forgot-password` | BROKEN (raw HTML, user enumeration) |
| B2B quote accepted | B2B Quote Accepted | `b2b/quotes/[id]/[action]` | Needs verification |
| Admin user invite | Team Invite | `admin/users/invite` | Needs verification |

---

## BUG-01 [CRITICAL] `lib/points/expiry-check.ts` calls `process.exit(0)` at module level

**File:** `lib/points/expiry-check.ts` ~line 111–121

**Problem:** The file ends with a standalone execution block:
```typescript
checkExpiringPoints()
  .then(() => process.exit(0))
  .catch((err) => { console.error(err); process.exit(1); });
```
Any import of this file from any context (including transitive imports) will fire the DB query, send emails to all users, and then call `process.exit(0)` — killing the Next.js worker process instantly. This is a live server-kill bug.

**Fix:** Delete lines 111–121 entirely. The cron route that calls this function already handles the invocation:

```typescript
// lib/points/expiry-check.ts — only export the function, nothing else
export async function checkExpiringPoints(): Promise<void> {
  // ... existing implementation
}
// ← nothing after this line
```

The cron endpoint `/api/cron/points-expiry-warning/route.ts` already imports and calls `checkExpiringPoints()` — that is the correct usage.

---

## BUG-02 [CRITICAL] Hardcoded developer email in production business logic

**File:** `lib/points/expiry-check.ts` ~line 56–57

**Problem:**
```typescript
if (user.email === 'bashara@dapurdekaka.com') continue;
```
This skips points expiry warnings for a specific hardcoded email address. This is production code.

**Fix:** Remove this line entirely. If test/internal accounts need to be excluded from expiry warnings, use a `users.skipExpiryEmails` boolean column or check for a `role === 'superadmin'` flag. Never hardcode email addresses in business logic.

---

## BUG-03 [CRITICAL] Forgot-password email sends raw HTML string instead of branded template and confirms email existence (user enumeration)

**File:** `app/api/auth/forgot-password/route.ts` ~line 34–85

**Problem 1 — User enumeration:** The endpoint returns `404 'Email tidak ditemukan'` when the email is not in the database. This tells an attacker exactly which emails are registered, violating GDPR and security best practices.

**Problem 2 — Raw HTML:** Uses `resend.emails.send({ html: '<html>...' })` with an inline HTML string instead of the shared `sendEmail` util and a React Email component. The email will not match brand styling.

**Fix — User enumeration:**
```typescript
// Always return success regardless of whether email exists:
const user = await db.query.users.findFirst({
  where: eq(users.email, parsed.data.email),
});

// Do the token work only if user exists, but always return 200:
if (user) {
  const token = crypto.randomBytes(32).toString('hex');
  const hashedToken = await bcrypt.hash(token, 10);
  await db.insert(passwordResetTokens).values({
    userId: user.id,
    token: hashedToken,
    expiresAt: new Date(Date.now() + 60 * 60 * 1000),
  });
  await sendEmail({
    to: user.email,
    subject: 'Reset Password Dapur Dekaka',
    react: PasswordResetEmail({ resetUrl: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${token}` }),
  });
}

// Always return 200 — do not reveal whether user exists
return NextResponse.json({ success: true });
```

**Fix — Email template:** Create `components/email/PasswordResetEmail.tsx` as a React Email component following the same pattern as `OrderConfirmationEmail`. Use the shared `sendEmail` util from `lib/resend/send-email.ts`.

---

## BUG-04 [CRITICAL] Reset-password token lookup is O(n) bcrypt scans — slow and timing-attackable

**File:** `app/api/auth/reset-password/route.ts` ~line 27–37

**Problem:** The endpoint fetches ALL non-expired tokens from the DB and bcrypt-compares each one until a match is found. With hundreds of users requesting resets simultaneously, this becomes exponentially expensive (each bcrypt compare is ~100ms). Also creates a timing side-channel.

**Fix:** Store a non-secret prefix of the token as a plaintext lookup key alongside the hashed full token:
```typescript
// At token creation time:
const rawToken = crypto.randomBytes(32).toString('hex');
const tokenPrefix = rawToken.slice(0, 8);           // ← plaintext prefix for lookup
const hashedToken = await bcrypt.hash(rawToken, 10); // ← bcrypt of full token

await db.insert(passwordResetTokens).values({
  userId: user.id,
  tokenPrefix,     // ← new column: varchar(8), indexed
  token: hashedToken,
  expiresAt: ...,
});

// At reset time (use the token from URL param — first 8 chars are the prefix):
const token = params.token; // full 64-char hex
const prefix = token.slice(0, 8);

// Look up by prefix (1 row instead of all rows):
const record = await db.query.passwordResetTokens.findFirst({
  where: and(
    eq(passwordResetTokens.tokenPrefix, prefix),
    gte(passwordResetTokens.expiresAt, new Date())
  ),
});

if (!record || !(await bcrypt.compare(token, record.token))) {
  return NextResponse.json({ error: 'Invalid or expired token' }, { status: 400 });
}
```

Schema change needed: add `tokenPrefix varchar(8)` column to `passwordResetTokens` table.

---

## BUG-05 [HIGH] Pickup orders receive two emails — confirmation AND pickup invitation

**File:** `app/api/webhooks/midtrans/route.ts` ~line 218–270

**Problem:** The settlement handler sends `OrderConfirmationEmail` unconditionally, then checks `if (order.deliveryMethod === 'pickup')` and also sends `PickupInvitationEmail`. Pickup customers receive two emails. The confirmation email mentions shipping/courier details irrelevant to pickup.

**Fix:**
```typescript
if (order.deliveryMethod === 'pickup') {
  // ONLY send pickup invitation — skip the general confirmation
  await sendEmail({
    to: order.recipientEmail,
    subject: `Pesanan ${order.orderNumber} Siap Diambil`,
    react: PickupInvitationEmail({
      orderNumber: order.orderNumber,
      customerName: order.recipientName,
      pickupCode: order.pickupCode,
      pickupAddress: settings.pickupAddress,
      pickupHours: settings.pickupHours,
    }),
  });
} else {
  // Only send general confirmation for delivery orders
  await sendEmail({
    to: order.recipientEmail,
    subject: `Pesanan ${order.orderNumber} Dikonfirmasi`,
    react: OrderConfirmationEmail({
      ...orderDetails,
      pointsEarned: order.pointsEarned,  // ← also add this (see BUG-06)
    }),
  });
}
```

---

## BUG-06 [HIGH] Order confirmation email does not include `pointsEarned`

**File:** `app/api/webhooks/midtrans/route.ts` ~line 218–246

**Problem:** The `OrderConfirmationEmail` call does not pass `pointsEarned`. The customer will not see their loyalty points earned from the order. If the template renders the loyalty section conditionally on this prop being present, the section is simply omitted — customers don't know they earned points.

**Fix:**
```typescript
react: OrderConfirmationEmail({
  orderNumber: order.orderNumber,
  customerName: order.recipientName,
  items: orderItems,
  subtotal: order.subtotal,
  shippingCost: order.shippingCost,
  discount: order.discountAmount,
  total: order.totalAmount,
  pointsEarned: order.pointsEarned ?? 0,  // ← add this
  deliveryMethod: order.deliveryMethod,
  estimatedDelivery: ...,
}),
```
Also confirm that `OrderConfirmationEmail` template accepts and renders this prop.

---

## BUG-07 [HIGH] Admin cancellation email missing refund amount and refund instructions

**File:** `app/api/admin/orders/[id]/status/route.ts` ~line 251–280

**Problem:** When an admin cancels a paid order, the cancellation email call does not include `refundAmount` or `refundInfo`. The webhook cancellation email (in `webhooks/midtrans/route.ts` ~line 330–361) does include these. Customers cancelled by an admin get no information about their refund.

**Fix:**
```typescript
await sendEmail({
  to: order.userEmail,
  subject: `Pesanan ${order.orderNumber} Dibatalkan`,
  react: OrderCancellationEmail({
    orderNumber: order.orderNumber,
    customerName: order.recipientName,
    items: orderItems,
    total: order.totalAmount,
    refundAmount: order.status === 'paid' ? order.totalAmount : 0,  // ← add
    refundInfo: order.status === 'paid'                              // ← add
      ? 'Refund akan diproses dalam 3-5 hari kerja ke metode pembayaran asal Anda.'
      : undefined,
    cancelReason: note || 'Dibatalkan oleh admin',
  }),
});
```

---

## BUG-08 [HIGH] `lib/resend/send-email.ts` silently swallows all email errors

**File:** `lib/resend/send-email.ts` ~line 23–25

**Problem:**
```typescript
} catch (error) {
  console.error('Email send failed:', error);
  // ← silent swallow, no throw, no metric, no alert
}
```
In production on Vercel, `console.error` is ephemeral. There is no way to know emails are failing. A full Resend outage would be invisible.

**Fix:** Add structured error tracking. At minimum, re-throw the error so calling code can handle it (and wrap email sends in a try-catch in each caller if you want fire-and-forget behavior):

```typescript
export async function sendEmail(options: SendEmailOptions): Promise<boolean> {
  try {
    const { data, error } = await resend.emails.send({
      from: process.env.RESEND_FROM_EMAIL!,
      ...options,
    });
    if (error) {
      // Log to your observability stack (Sentry, Logtail, etc.)
      console.error('[Email] Resend API error:', { error, to: options.to, subject: options.subject });
      return false;
    }
    return true;
  } catch (err) {
    console.error('[Email] Unexpected error:', { err, to: options.to });
    return false;
  }
}
```
Then callers can check the return value: `const sent = await sendEmail(...); if (!sent) { /* log, alert, or queue for retry */ }`.

---

## BUG-09 [HIGH] Points expiry email uses raw points amount as IDR value — wrong display

**File:** `lib/points/expiry-check.ts` ~line 72–73

**Problem:**
```typescript
userGroup.totalValue += record.pointsAmount;  // ← should be pointsAmount * POINTS_VALUE_IDR
```
`totalValue` equals `totalPoints` exactly because the IDR conversion multiplier was forgotten. The expiry email will say "Points: 500, Value: 500" instead of "Points: 500, Value: Rp 5.000" (assuming 10 IDR/point).

**Fix:**
```typescript
import { POINTS_VALUE_IDR } from '@/lib/constants/points';

userGroup.totalValue += record.pointsAmount * POINTS_VALUE_IDR;
```
Confirm the `POINTS_VALUE_IDR` constant is defined and correct in `lib/constants/points.ts`.

---

## BUG-10 [MEDIUM] No email sent when order status changes to `shipped` from field interface

**File:** `app/api/admin/field/orders/[id]/route.ts` PATCH

**Problem:** The field order status update route updates the status and writes history but never sends a shipment notification email to the customer. Only the admin status route (`admin/orders/[id]/status/route.ts`) sends shipped emails. When warehouse staff use the field interface to mark an order as `shipped` (entering the tracking number), customers get no notification.

**Fix:** After status update in field orders route, mirror the shipped email from admin status route:
```typescript
if (newStatus === 'shipped' && trackingNumber) {
  await sendEmail({
    to: order.userEmail,
    subject: `Pesanan ${order.orderNumber} Sedang Dikirim`,
    react: OrderShippedEmail({
      orderNumber: order.orderNumber,
      customerName: order.recipientName,
      trackingNumber,
      courierName: order.courierName,
      estimatedDelivery: order.estimatedDelivery,
    }),
  });
}
```

---

## BUG-11 [MEDIUM] B2B quote approval email not verified to exist/work

**File:** `app/api/b2b/quotes/[id]/[action]/route.ts`

**Problem:** The B2B quote accept/reject flow has no visible email notification to the B2B customer. When an admin approves or rejects a quote, the B2B customer should receive a notification. Verify this email exists and is called.

**Action required:** Check the route file for email sends on `action === 'accept'` and `action === 'reject'`. If missing, create `B2BQuoteApprovedEmail` and `B2BQuoteRejectedEmail` components and send them:
```typescript
if (action === 'accept') {
  await sendEmail({
    to: b2bUser.email,
    subject: `Penawaran #${quote.quoteNumber} Telah Disetujui`,
    react: B2BQuoteApprovedEmail({ quote, validUntil: quote.validUntil }),
  });
} else if (action === 'reject') {
  await sendEmail({
    to: b2bUser.email,
    subject: `Penawaran #${quote.quoteNumber} Tidak Dapat Diproses`,
    react: B2BQuoteRejectedEmail({ quote }),
  });
}
```

---

## BUG-12 [MEDIUM] Team invite email uses raw HTML; no welcome email for new admin users

**File:** `app/api/admin/users/invite/route.ts`

**Problem:** Verify that the invite email uses a React Email template, not a raw HTML string. Also verify that the invite contains a valid deep link for the invitee to set their password.

**Action required:** Check the invite route for:
1. Uses `sendEmail` from `lib/resend/send-email.ts`  
2. Uses a `TeamInviteEmail` React Email component  
3. The invite link is `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${token}` (leveraging the password reset flow)  
4. The token is created in `passwordResetTokens` table so the invitee can set their first password  

---

## Checklist: All email templates that must exist as React Email components

Verify each of these exists and renders correctly at `components/email/`:

- [ ] `OrderConfirmationEmail.tsx` — props: orderNumber, customerName, items, totals, pointsEarned, deliveryMethod
- [ ] `OrderCancellationEmail.tsx` — props: orderNumber, customerName, items, total, refundAmount, refundInfo, cancelReason
- [ ] `OrderShippedEmail.tsx` — props: orderNumber, customerName, trackingNumber, courierName, estimatedDelivery
- [ ] `PickupInvitationEmail.tsx` — props: orderNumber, customerName, pickupCode, pickupAddress, pickupHours
- [ ] `PasswordResetEmail.tsx` — props: resetUrl, userName (CREATE THIS — does not exist)
- [ ] `PointsExpiryWarningEmail.tsx` — props: customerName, expiringPoints, expiryDate, pointsValueIDR
- [ ] `B2BQuoteApprovedEmail.tsx` — props: quoteNumber, companyName, items, total, validUntil (CREATE IF MISSING)
- [ ] `B2BQuoteRejectedEmail.tsx` — props: quoteNumber, companyName (CREATE IF MISSING)
- [ ] `TeamInviteEmail.tsx` — props: inviteUrl, inviterName, role (CREATE IF MISSING)
