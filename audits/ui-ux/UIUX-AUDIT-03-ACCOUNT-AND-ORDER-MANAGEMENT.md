# UI/UX AUDIT 03 — Account & Order Management (Customer-Facing)

**Scope:** Account dashboard, order list, order detail, points, profile, addresses, auth pages  
**Priority:** Critical = 🔴 | High = 🟠 | Medium = 🟡 | Polish = 🟢

---

## SUMMARY OF ISSUES

| # | Issue | Priority | File |
|---|-------|----------|------|
| 01 | Account mobile nav doesn't exist — no bottom tab for "Akun" section | 🔴 | account/layout.tsx |
| 02 | Order detail: no "Bayar Sekarang" button for pending_payment orders | 🔴 | account/orders/[orderNumber]/page.tsx |
| 03 | Order detail: `OrderTimeline` shows wrong step index for cancelled orders | 🔴 | account/orders/[orderNumber]/page.tsx |
| 04 | Login page: "Lupa password?" link points to `/auth/forgot-password` (wrong path) | 🔴 | (auth)/login/page.tsx |
| 05 | Register link points to `/auth/register` (wrong path, not `/register`) | 🔴 | (auth)/login/page.tsx |
| 06 | Points page: "Tukarkan" CTA goes to `/account/points` but page has no redemption UI | 🔴 | account/page.tsx |
| 07 | Profile page: language toggle is permanently disabled with no timeline | 🟠 | account/profile/page.tsx |
| 08 | Order list: no filter by status — must scroll all orders to find one | 🟠 | account/orders/page.tsx |
| 09 | Account overview: "Menunggu Pembayaran" count only checks recent 5 orders | 🟠 | account/page.tsx |
| 10 | Order detail: courier tracking section only shows when `shipped` + trackingNumber | 🟠 | account/orders/[orderNumber]/page.tsx |
| 11 | Address page: delete address has no confirmation dialog | 🟠 | account/addresses/page.tsx |
| 12 | Points history: no pagination — loads entire history at once | 🟡 | account/points/page.tsx |
| 13 | Points page: "Cara Mendapatkan Poin" only lists 1 method (purchase) | 🟡 | account/points/page.tsx |
| 14 | Account logout uses `/api/auth/signout` href — should use NextAuth signOut() | 🟡 | account/layout.tsx |
| 15 | Password change functionality completely missing from profile page | 🔴 | account/profile/page.tsx |
| 16 | Order detail: no copy-to-clipboard for order number | 🟢 | account/orders/[orderNumber]/page.tsx |
| 17 | Account overview "poin saya" links to /account/points but stat is clickable | 🟢 | account/page.tsx |

---

## DETAILED FINDINGS

---

### 🔴 01 — Account Section Has No Mobile Navigation
**File:** `app/(store)/account/layout.tsx:35-72`

**Problem:** The account layout has a desktop sidebar (`hidden md:block`) but zero mobile navigation. On mobile, users are completely trapped — there's no way to switch between "Overview", "Pesanan", "Alamat", "Poin", "Profil" tabs without the desktop sidebar. The `BottomNav` component (in the store layout) does NOT include account section links.

**Current state:** Desktop = sidebar nav. Mobile = no nav at all.

**Fix:** Add a horizontal scrollable tab bar at the top of the account layout for mobile:
```tsx
{/* Mobile account nav */}
<div className="md:hidden bg-white border-b border-brand-cream-dark sticky top-16 z-10">
  <div className="flex overflow-x-auto scrollbar-hide px-4 py-2 gap-1">
    {navItems.map(item => (
      <Link
        key={item.href}
        href={item.href}
        className={cn(
          'flex-shrink-0 flex items-center gap-1.5 px-3 py-2 rounded-full text-xs font-medium whitespace-nowrap',
          isActive(item.href)
            ? 'bg-brand-red text-white'
            : 'bg-brand-cream text-text-secondary'
        )}
      >
        <item.icon className="w-3.5 h-3.5" />
        {item.label}
      </Link>
    ))}
  </div>
</div>
```

---

### 🔴 02 — Order Detail: No "Bayar Sekarang" for Pending Orders
**File:** `app/(store)/account/orders/[orderNumber]/page.tsx`

**Problem:** When an order is in `pending_payment` status, the order detail page shows the status badge and all info, but there is **no button to complete payment**. The only way for a customer to pay a pending order is to:
1. Go back to the checkout flow (broken)
2. Call customer service

This is a critical conversion failure. Orders expire after 24 hours if not paid.

**Fix:** Add a conditional "Bayar Sekarang" button for pending_payment orders:
```tsx
{order.status === 'pending_payment' && (
  <div className="bg-white rounded-card shadow-card p-6">
    <p className="text-sm text-text-secondary mb-4">
      Pesanan ini menunggu pembayaran. Selesaikan pembayaran sebelum expired.
    </p>
    <Link 
      href={`/api/checkout/retry?order=${order.orderNumber}`}
      className="block w-full h-12 bg-brand-red text-white font-bold rounded-button text-center leading-[48px]"
    >
      Bayar Sekarang
    </Link>
  </div>
)}
```

---

### 🔴 03 — OrderTimeline Shows Wrong Index for Cancelled Orders
**File:** `app/(store)/account/orders/[orderNumber]/page.tsx:153-171`

**Problem:** The OrderTimeline steps are:
```tsx
steps={['Pesanan Dibuat', 'Menunggu Pembayaran', 'Pembayaran Diterima', 'Sedang Diproses', 'Dikemas', 'Sedang Dikirim', 'Selesai']}
currentStepIndex={['pending_payment', 'paid', 'processing', 'packed', 'shipped', 'delivered'].indexOf(order.status)}
```

For `cancelled` status, `indexOf` returns `-1`. The `currentStepIndex` of `-1` will likely render all steps as incomplete — no visual indication that the order was cancelled. The timeline component needs a `cancelled` state that shows a red X at the point of cancellation.

**Fix:**
```tsx
const currentStepIndex = order.status === 'cancelled'
  ? -1 // special cancelled state
  : ['pending_payment', 'paid', 'processing', 'packed', 'shipped', 'delivered'].indexOf(order.status);
```
And in `OrderTimeline.tsx`, handle `currentStepIndex === -1` as a cancelled state, showing a red badge instead of the progress indicator.

---

### 🔴 04 — Login Page: Wrong Path for "Lupa Password"
**File:** `app/(auth)/login/page.tsx:132-133`

**Problem:**
```tsx
<Link href="/auth/forgot-password" className="...">Lupa password?</Link>
```
The actual route is `app/(auth)/forgot-password/page.tsx` which maps to `/forgot-password` (the group `(auth)` is invisible in the URL). The link `/auth/forgot-password` does not exist and will 404.

**Fix:**
```tsx
<Link href="/forgot-password">Lupa password?</Link>
```

---

### 🔴 05 — Login Page: Wrong Path for Register Link
**File:** `app/(auth)/login/page.tsx:149`

**Problem:**
```tsx
<Link href="/auth/register" className="...">Daftar di sini</Link>
```
Same issue — the register route is `/register` not `/auth/register`.

**Fix:**
```tsx
<Link href="/register">Daftar di sini</Link>
```

---

### 🔴 06 — Points "Tukarkan" CTA Links to Same Points Page
**File:** `app/(store)/account/page.tsx:208-213`

**Problem:** The account overview shows a points balance banner with a "Tukarkan" button that links to `/account/points`. The points page shows balance and history but has **no redemption UI** — there is no way to actually "redeem" points other than by going to checkout. The "Tukarkan" label implies a separate redemption flow that doesn't exist.

**Fix:** Two options:
1. **Rename the button** to "Lihat Poin" which is accurate to what it does.
2. **Add a redemption shortcut** on the points page: a banner saying "Poin dapat ditukarkan saat checkout" with a "Belanja Sekarang" button to `/products`.

Option 2 is the right UX approach:
```tsx
// In account/points/page.tsx, below the balance card:
<div className="bg-white rounded-card shadow-card p-6">
  <p className="font-semibold mb-2">Cara Menukarkan Poin</p>
  <p className="text-sm text-text-secondary mb-4">
    Poin dapat digunakan saat checkout. Pilih "Gunakan Poin Saya" di halaman pembayaran.
  </p>
  <Link href="/products" className="block w-full h-11 bg-brand-red text-white rounded-button text-center leading-[44px] font-bold">
    Belanja Sekarang
  </Link>
</div>
```

---

### 🔴 15 — Profile Page: No Password Change
**File:** `app/(store)/account/profile/page.tsx`

**Problem:** The profile page only allows updating name, phone, and language preference. There is **no password change** feature. Users who registered with email/password have no way to change their password. The only option is the forgot-password flow (which requires email verification).

This is a critical missing feature — common security practice requires in-app password change.

**Fix:** Add a "Ubah Password" section below the profile form:
```tsx
<div className="bg-white rounded-card shadow-card p-6">
  <h2 className="font-display font-semibold mb-4">Ubah Password</h2>
  <form onSubmit={handleChangePassword}>
    <input type="password" placeholder="Password lama" {...register('currentPassword')} />
    <input type="password" placeholder="Password baru" {...register('newPassword')} />
    <input type="password" placeholder="Konfirmasi password baru" {...register('confirmPassword')} />
    <button type="submit">Ubah Password</button>
  </form>
</div>
```
Add `PATCH /api/account/profile/password` endpoint.

---

### 🟠 07 — Profile Language Toggle Permanently Disabled
**File:** `app/(store)/account/profile/page.tsx:243-282`

**Problem:** The language preference section is wrapped in `opacity-50 pointer-events-none` and shows a banner "Bahasa Inggris akan segera tersedia". This is fine as a placeholder, but the UI still renders the toggle (which looks broken/greyed out), and there's no ETA or action the user can take. It's a dead UI element.

**Fix:** Remove the toggle entirely. Replace with:
```tsx
<div>
  <label className="block text-sm font-medium text-text-secondary mb-1">Bahasa</label>
  <div className="flex items-center gap-2 h-11 px-3 border border-brand-cream-dark rounded-lg bg-gray-50">
    <span>🇮🇩 Indonesia</span>
    <span className="ml-auto text-xs bg-amber-100 text-amber-700 px-2 py-0.5 rounded-full">Bahasa Inggris segera hadir</span>
  </div>
</div>
```
This is honest and doesn't show broken UI.

---

### 🟠 08 — Order List Has No Status Filter
**File:** `app/(store)/account/orders/page.tsx`

**Problem:** The order list is paginated (10/page) but has no filtering by status. A customer who placed 20+ orders and wants to find their "shipped" orders must scroll through all pages. This is a major usability gap as order volume grows.

**Fix:** Add filter chips above the order list:
```tsx
const STATUS_FILTERS = [
  { key: 'all', label: 'Semua' },
  { key: 'pending_payment', label: 'Menunggu Bayar' },
  { key: 'processing', label: 'Diproses' },
  { key: 'shipped', label: 'Dikirim' },
  { key: 'delivered', label: 'Selesai' },
  { key: 'cancelled', label: 'Dibatalkan' },
];
```
Add `status` to the URL search params and filter the DB query accordingly.

---

### 🟠 09 — Account Overview: Wrong "Pending" Count
**File:** `app/(store)/account/page.tsx:115-122`

**Problem:** The "Menunggu Pembayaran" stat counts:
```tsx
recentOrders.filter(o => o.status === 'pending_payment').length
```
`recentOrders` is only the **last 5 orders**. If a customer has 3 pending orders from 6+ orders ago, this count shows `0`. This is misleading — the dashboard shows "0 menunggu pembayaran" but there are actually pending orders.

**Fix:** Add a separate DB query counting ALL pending orders:
```tsx
const [pendingCountResult] = await db.select({ count: count() })
  .from(orders)
  .where(and(eq(orders.userId, session.user.id!), eq(orders.status, 'pending_payment')));
const pendingCount = pendingCountResult?.count ?? 0;
```

---

### 🟠 10 — Tracking Info Only Shown When Status is "shipped" + Has Number
**File:** `app/(store)/account/orders/[orderNumber]/page.tsx:175-186`

**Problem:**
```tsx
{order.status === 'shipped' && order.trackingNumber && (
  <TrackingInfo ... />
)}
```
Two issues:
1. If an order is `delivered` (complete), tracking info is hidden even though it would still be relevant
2. If an order is `shipped` but tracking number isn't entered yet (warehouse hasn't inputted it), no fallback message is shown

**Fix:**
```tsx
{(order.status === 'shipped' || order.status === 'delivered') && (
  <div className="bg-white rounded-card shadow-card p-6">
    {order.trackingNumber ? (
      <TrackingInfo trackingNumber={order.trackingNumber} courierName={order.courierName} />
    ) : (
      <p className="text-text-secondary text-sm">
        Nomor resi sedang disiapkan. Biasanya tersedia dalam 1x24 jam setelah pembayaran.
      </p>
    )}
  </div>
)}
```

---

### 🟠 11 — Address Delete: No Confirmation Dialog
**File:** `app/(store)/account/addresses/page.tsx`

**Problem:** Address deletion is a destructive action. Without a confirmation, accidental taps permanently remove saved addresses. This is especially problematic if the address was used for past orders (foreign key reference).

**Fix:** Add a confirmation before delete:
```tsx
const handleDelete = async (id: string) => {
  if (!confirm('Hapus alamat ini? Tindakan tidak dapat dibatalkan.')) return;
  await fetch(`/api/account/addresses/${id}`, { method: 'DELETE' });
  refetchAddresses();
};
```
Better UX: use a Sheet or Dialog component for the confirmation.

---

### 🟡 12 — Points History: No Pagination
**File:** `app/(store)/account/points/page.tsx:22-33`

**Problem:** The API call `/api/account/points` returns all point history records without pagination. Heavy buyers with 50+ orders will load massive history tables. This will be slow and cause layout overflow.

**Fix:** Add `limit=20&page=1` to the API call and implement a "Load More" button. Server side: add pagination to `/api/account/points` response.

---

### 🟡 13 — Points Page Lists Only 1 Earning Method
**File:** `app/(store)/account/points/page.tsx:95-112`

**Problem:** The "Cara Mendapatkan Poin" section only shows "1 poin per Rp 1.000". But there are (or should be) other earning methods:
- First-time purchase bonus
- Birthday bonus (if implemented)
- Referral (if planned)
- B2B user 2x multiplier

Even if only purchase exists now, the section looks sparse. The single item doesn't even clarify the exclusions (ongkir not counted, discount not counted).

**Fix:** Expand to a proper card list with icons:
```tsx
const EARN_METHODS = [
  { icon: ShoppingBag, title: '1 poin per Rp 1.000', desc: 'Dari nilai belanja, tidak termasuk ongkir dan diskon' },
  { icon: Gift, title: 'Bonus Pendaftaran', desc: 'Poin langsung masuk saat akun dibuat (jika ada promo aktif)' },
];
```

---

### 🟡 14 — Account Logout Uses `/api/auth/signout` Href
**File:** `app/(store)/account/layout.tsx:62-68`

**Problem:**
```tsx
<Link href="/api/auth/signout" className="...">Keluar</Link>
```
This is a GET request to the signout API route. NextAuth's signout via GET can fail in strict browser environments and doesn't handle CSRF protection properly. The correct approach is to use the `signOut()` function from `next-auth/react`.

**Fix:**
```tsx
'use client';
import { signOut } from 'next-auth/react';

<button 
  onClick={() => signOut({ callbackUrl: '/' })}
  className="flex items-center gap-3 px-4 py-3 ..."
>
  <LogOut className="w-5 h-5" />
  Keluar
</button>
```

---

### 🟢 16 — No Copy-to-Clipboard for Order Number
**File:** `app/(store)/account/orders/[orderNumber]/page.tsx:107-108`

**Problem:** The order number is shown but can't be easily copied. Customers often need to share their order number via WhatsApp with customer service or share a tracking number. On mobile, selecting text to copy is clunky.

**Fix:** Add a small copy icon button next to the order number:
```tsx
<button onClick={() => { navigator.clipboard.writeText(order.orderNumber); toast.success('Disalin!'); }}>
  <Copy className="w-4 h-4" />
</button>
```

---

### 🟢 17 — Account Stats Are Static, Not Clickable
**File:** `app/(store)/account/page.tsx:72-122`

**Problem:** The 4 stat cards (Total Pesanan, Poin Saya, Alamat Tersimpan, Menunggu Pembayaran) are visually styled as cards but are not wrapped in `<Link>`. Users naturally expect dashboard stat cards to be clickable/navigable.

**Fix:** Wrap each in an appropriate Link:
```tsx
<Link href="/account/orders"><StatCard ... /></Link>
<Link href="/account/points"><StatCard ... /></Link>
<Link href="/account/addresses"><StatCard ... /></Link>
<Link href="/account/orders?status=pending_payment"><StatCard ... /></Link>
```

---

## IMPLEMENTATION PRIORITY ORDER

1. **🔴 04 & 05** — Fix login page URLs (2 min — critical to not break login)
2. **🔴 01** — Add mobile account nav (30 min — highest friction)
3. **🔴 02** — Add "Bayar Sekarang" on pending order (20 min)
4. **🔴 15** — Add password change UI (45 min)
5. **🔴 06** — Fix "Tukarkan" CTA expectation (10 min)
6. **🔴 03** — Fix cancelled order timeline (15 min)
7. **🟠 08** — Add order list status filter (30 min)
8. **🟠 09** — Fix pending order count (10 min)
9. **🟠 10** — Fix tracking info visibility (10 min)
10. **🟠 11** — Address delete confirmation (10 min)
11. **🟠 07** — Remove broken language toggle (5 min)
12. **🟡 14** — Fix signout method (5 min)
