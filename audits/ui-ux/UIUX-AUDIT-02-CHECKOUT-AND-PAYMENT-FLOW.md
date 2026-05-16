# UI/UX AUDIT 02 — Checkout & Payment Flow

**Scope:** Checkout multi-step flow, success/pending/failed pages, order tracking  
**Priority:** Critical = 🔴 | High = 🟠 | Medium = 🟡 | Polish = 🟢

---

## SUMMARY OF ISSUES

| # | Issue | Priority | File |
|---|-------|----------|------|
| 01 | Payment button shows client-calculated total until order created — can mismatched | 🔴 | checkout/page.tsx |
| 02 | No loading state on "Lanjut ke Kurir" button — double-clicks create two orders | 🔴 | checkout/page.tsx |
| 03 | Checkout stepper: completed steps show no checkmark — user can't tell what's done | 🟠 | CheckoutStepper.tsx |
| 04 | Address form: city/province dropdowns have no search — 500+ cities, very slow UX | 🟠 | AddressForm.tsx |
| 05 | Shipping cost loading shows no visual feedback — screen just waits silently | 🟠 | checkout/page.tsx |
| 06 | Points redeemer: slider or toggle shows no "you save Rp X" computation live | 🟠 | PointsRedeemer.tsx |
| 07 | Pickup flow: store hours are hardcoded in UI fallback, not always from DB | 🟠 | checkout/page.tsx |
| 08 | Success page: no estimated delivery date shown for delivery orders | 🟠 | checkout/success/page.tsx |
| 09 | Pending page: no instructions on what to do next — user is left confused | 🔴 | checkout/pending/page.tsx |
| 10 | Failed page: no clear "retry payment" button visible immediately | 🔴 | checkout/failed/page.tsx |
| 11 | Order summary sidebar disappears at md breakpoint — user loses price context | 🟡 | checkout/page.tsx |
| 12 | Coupon error message disappears when user types new code — should persist | 🟡 | CouponInput.tsx |
| 13 | No progress persistence — browser refresh loses entire checkout state | 🟡 | checkout/page.tsx |
| 14 | "Kembali" button positioning: back button appears above pay button — should be below | 🟢 | checkout/page.tsx |
| 15 | Success page confetti fires even for pending/failed payment states | 🟠 | checkout/success/page.tsx |

---

## DETAILED FINDINGS

---

### 🔴 01 — Payment Button Shows Client Total, Not Server Total
**File:** `app/(store)/checkout/page.tsx:748-750`

**Problem:** The payment button reads:
```tsx
{isLoading ? 'Memproses...' : `Bayar Sekarang — ${formatIDR(serverTotalAmount || totalAmount)}`}
```
`serverTotalAmount` is `0` until the order is created (after button click). So the button shows the *client-side calculated* `totalAmount` which can differ from server total if:
- A coupon was applied but discount type is complex (buy_x_get_y)
- Points calculation rounding differs
- Free items were added server-side

The user sees one amount, Midtrans charges another. This causes confusion and potential trust issues.

**Fix:** Show `totalAmount` (client-calculated) pre-click, then update to `serverTotalAmount` post-creation. Add a small "(dikonfirmasi setelah pesanan dibuat)" note. Better: compute the final total server-side before order creation via a preview endpoint and use that value in the button from the start.

---

### 🔴 02 — No Loading State on "Lanjut ke Kurir" — Double Shipping Fetch
**File:** `app/(store)/checkout/page.tsx:498-530` (SavedAddress continue button)

**Problem:** The "Lanjut ke Kurir" button for saved addresses has no `disabled` state during `loadingShipping`. A user who taps twice will trigger two concurrent `/api/shipping/cost` requests. While this won't create two orders, it causes a race condition in `setShippingOptions` and can result in duplicate options or incorrect data.

**Fix:**
```tsx
<button
  type="button"
  disabled={loadingShipping}
  onClick={...}
  className="w-full h-12 bg-brand-red text-white font-bold rounded-button mt-4 disabled:opacity-50"
>
  {loadingShipping ? 'Menghitung ongkir...' : 'Lanjut ke Kurir'}
</button>
```

---

### 🔴 09 — Pending Page Has No Instructions
**File:** `app/(store)/checkout/pending/page.tsx`

**Problem:** The pending page (shown after Midtrans payment is initiated but not confirmed) should tell the user:
1. What "pending" means
2. How long they should wait
3. What to do if payment doesn't confirm
4. Where to check order status

Currently the page is minimal with no actionable guidance, leaving users confused whether their money was taken.

**Fix:** The pending page should include:
```tsx
<div>
  <h1>Pembayaran Sedang Diproses</h1>
  <p>Pembayaran kamu sedang diverifikasi. Ini biasanya memakan waktu 1–10 menit.</p>
  <p>Jika kamu sudah membayar, pesananmu akan dikonfirmasi otomatis. Tidak perlu bayar ulang.</p>
  <Link href={`/orders/${orderNumber}`}>Cek Status Pesanan</Link>
  <Link href="/account/orders">Lihat Semua Pesanan</Link>
  <p className="text-xs text-text-secondary">
    Butuh bantuan? Chat kami di WhatsApp: {wa_number}
  </p>
</div>
```
Also add an auto-poll (every 5s for 2 minutes) to check if the order status changed and redirect to `/checkout/success` if confirmed.

---

### 🔴 10 — Failed Page Has No Prominent Retry Button
**File:** `app/(store)/checkout/failed/page.tsx`

**Problem:** After payment failure, the most important action is to retry payment. The failed page should prominently show a "Coba Lagi" button that re-initiates payment for the same order. Currently this requires the user to navigate back to checkout and rebuild the form.

**Fix:** The failed page receives the `orderNumber` via query param. Use it to call `/api/checkout/retry` and surface a single primary "Bayar Ulang" button. The retry API should return a new snapToken for the existing order.

```tsx
// failed/page.tsx
<Link href={`/api/checkout/retry?order=${orderNumber}`} className="block w-full h-14 bg-brand-red text-white ...">
  Bayar Ulang
</Link>
```

---

### 🟠 03 — Checkout Stepper: No Checkmarks on Completed Steps
**File:** `components/store/checkout/CheckoutStepper.tsx`

**Problem:** The stepper shows step numbers (1, 2, 3, 4) but completed steps don't show a ✓ checkmark. The only visual difference is active vs inactive state. Users can't distinguish "done" from "not yet done" at a glance.

**Fix:** Replace the step number with `<Check className="w-3 h-3" />` for completed steps:
```tsx
{isCompleted ? <Check className="w-3 h-3" /> : stepNumber}
```
`isCompleted` = steps before `currentStepIndex`.

---

### 🟠 04 — Address Form: City Dropdown Has No Search
**File:** `components/store/checkout/AddressForm.tsx`

**Problem:** Indonesia has 500+ cities. The city/province dropdowns render as native `<select>` elements which are completely unfiltered. A user in Bandung must scroll through dozens of unrelated cities. This is one of the highest-friction points in the entire checkout flow.

**Fix:** Replace native selects with a searchable combobox (e.g., `cmdk` or a simple filtered list):
```tsx
<input 
  placeholder="Cari kota..." 
  value={citySearch} 
  onChange={(e) => setCitySearch(e.target.value)}
/>
<div className="dropdown">
  {filteredCities.map(city => <option key={city.id}>{city.name}</option>)}
</div>
```
At minimum, sort cities alphabetically and add a search input above the select.

---

### 🟠 05 — Shipping Cost: No Visual Loading Feedback
**File:** `app/(store)/checkout/page.tsx:273-294`

**Problem:** After address submission, `setLoadingShipping(true)` is called but there's no spinner or progress indicator visible to the user. The screen just sits at the delivery step while the API call completes. Users don't know if something is happening or if the form is broken.

**Fix:** Show a loading overlay or inline spinner on the delivery section:
```tsx
{loadingShipping && (
  <div className="flex items-center justify-center py-12">
    <Loader2 className="w-6 h-6 animate-spin text-brand-red" />
    <span className="ml-2 text-text-secondary">Menghitung ongkir...</span>
  </div>
)}
```

---

### 🟠 06 — Points Redeemer: No Live "You Save" Calculation
**File:** `components/store/checkout/PointsRedeemer.tsx`

**Problem:** The PointsRedeemer component shows a toggle to use/not use points but doesn't display how much IDR the user will save until *after* toggling. Users don't understand the value proposition upfront. "Tukarkan 340 poin" is less compelling than "Tukarkan 340 poin = hemat Rp 3.400".

**Fix:** Show the savings calculation before the toggle:
```tsx
<p className="text-sm text-text-secondary">
  Poin kamu: <strong>{pointsBalance}</strong> 
  {' '}(≈ {formatIDR(pointsBalance * POINTS_VALUE_IDR)} penghematan maks.)
</p>
```

---

### 🟠 07 — Pickup Store Hours: Hardcoded UI Fallback
**File:** `app/(store)/checkout/page.tsx:574-582`

**Problem:** The pickup section shows store hours from `storeHours` state which is fetched from `/api/settings/public`. BUT the fallback values are hardcoded in the component:
```tsx
const [storeHours, setStoreHours] = useState<StoreHours>({ 
  openDays: 'Senin - Sabtu', 
  openHours: '08.00 - 17.00 WIB' 
});
```
If the API fails, users see stale hours. If the admin changes hours, the checkout still shows old info until cache refresh.

**Fix:** Add a visible "Konfirmasi jam operasional di WhatsApp" link below the hours so users can verify. Or add a cache-bust mechanism.

---

### 🟠 08 — Success Page: No Estimated Delivery Date
**File:** `app/(store)/checkout/success/page.tsx:42-96`

**Problem:** The success page shows the order number and points earned but doesn't show when the package will arrive. For delivery orders, showing "Estimasi tiba: 2-3 hari kerja (sesuai kurir yang dipilih)" builds confidence and reduces "where is my order" support queries.

**Fix:** The success page already queries the order via `useQuery`. Add the courier name and estimated delivery from the shipping option (stored in the order). Show:
```tsx
{orderData?.order?.courierName && orderData?.order?.deliveryMethod === 'delivery' && (
  <p className="text-sm text-text-secondary">
    Dikirim via {orderData.order.courierName} · Estimasi 2-3 hari kerja
  </p>
)}
```

---

### 🟠 15 — Confetti Fires on Non-Success States
**File:** `app/(store)/checkout/success/page.tsx:14-19`

**Problem:** `confetti()` fires immediately in `useEffect` with no deps on order verification:
```tsx
useEffect(() => {
  confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 } });
}, []);
```
This runs before `orderData` is fetched. If the order is actually still `pending_payment` (user landed here before webhook confirmed), the confetti fires but the order might not be confirmed. Shows celebration for an unconfirmed payment.

**Fix:**
```tsx
useEffect(() => {
  if (orderData?.verified) {
    confetti({ ... });
  }
}, [orderData?.verified]);
```

---

### 🟡 11 — Order Summary Sidebar Hidden on Mobile
**File:** `app/(store)/checkout/page.tsx:755-765`

**Problem:** The `OrderSummaryCard` is in the right column (`lg:col-span-1`) which only shows on `lg` (1024px+). On mobile and tablet, users have no persistent view of their cart total while filling out forms. They must scroll to see costs, which is especially frustrating at the shipping step where they need to compare options against the total.

**Fix:** Add a collapsed sticky total bar at the top of mobile checkout:
```tsx
{/* Mobile total bar — show on non-lg */}
<div className="lg:hidden sticky top-[76px] z-10 bg-white border-b px-4 py-2 flex justify-between text-sm">
  <span className="text-text-secondary">{getTotalItems()} item</span>
  <span className="font-bold text-brand-red">{formatIDR(totalAmount)}</span>
</div>
```

---

### 🟡 12 — Coupon Error Clears When Typing New Code
**File:** `components/store/checkout/CouponInput.tsx`

**Problem:** When an invalid coupon error shows ("Kupon tidak valid"), typing a new code in the input should clear the error. Currently `error` is managed by the parent and only updated on API call — so the old error persists while typing, which is confusing.

**Fix:** Add a local `touched` state: clear error display when the input changes (not when submitted):
```tsx
const [localCode, setLocalCode] = useState(code);
const handleChange = (val: string) => {
  setLocalCode(val);
  onCodeChange(val);
  if (error) clearError(); // callback to parent
};
```

---

### 🟡 13 — No Checkout State Persistence on Browser Refresh
**File:** `app/(store)/checkout/page.tsx:91-110`

**Problem:** All checkout form state (`formData`, `couponCode`, `step`, `shippingOptions`) is in component state — not persisted to `sessionStorage`. A browser refresh or accidental back-button press loses everything. The user must restart from step 1.

**Fix:** Use `sessionStorage` to persist checkout state with a key like `checkout-draft`. On mount, hydrate from storage. On unmount (but not on order creation), clean it up.

```tsx
useEffect(() => {
  const draft = sessionStorage.getItem('checkout-draft');
  if (draft) setFormData(JSON.parse(draft));
}, []);

useEffect(() => {
  sessionStorage.setItem('checkout-draft', JSON.stringify(formData));
}, [formData]);
```

---

### 🟢 14 — Back Button Order Confuses Users on Payment Step
**File:** `app/(store)/checkout/page.tsx:735-751`

**Problem:** At the payment step, the layout is:
1. Order review collapsible
2. Coupon input
3. Points redeemer  
4. "Kembali" button
5. "Bayar Sekarang" button

The "Kembali" button appears *above* the primary CTA. Standard checkout UX puts the primary action at the very bottom with secondary actions either above it (in a less prominent position) or as a text link. This layout makes users scroll past secondary controls to find the pay button.

**Fix:** Move "Kembali" to a text link at top, keep "Bayar Sekarang" as the full-width bottom button:
```tsx
<button type="button" onClick={handleBack} className="text-sm text-text-secondary hover:underline mb-4">
  ← Kembali ke Kurir
</button>
// ... coupon, points ...
<button type="button" onClick={handlePlaceOrder} className="w-full h-14 bg-brand-red ...">
  Bayar Sekarang
</button>
```

---

## IMPLEMENTATION PRIORITY ORDER

1. **🔴 09** — Pending page instructions + auto-poll (30 min)
2. **🔴 10** — Failed page retry button (15 min)
3. **🔴 02** — Disable shipping button during load (5 min)
4. **🔴 01** — Fix payment button total display (10 min)
5. **🟠 15** — Confetti only on verified (5 min)
6. **🟠 05** — Shipping loading spinner (10 min)
7. **🟠 03** — Stepper checkmarks (10 min)
8. **🟠 06** — Points live savings display (10 min)
9. **🟠 08** — Add estimated delivery to success (15 min)
10. **🟠 04** — Searchable city dropdown (45 min — biggest UX win)
