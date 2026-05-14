# UX_PRODUCTION.md — User Experience Implementation Guide
# DapurDekaka.com v2
**For:** Cursor AI execution
**Status:** Production Target
**Focus:** Micro-interactions · Mobile UX · Copy · Accessibility · Flows

---

## CRITICAL RULES — READ FIRST

1. **Brand voice is warm, not corporate** — copy feels like talking to a friendly parent, not a SaaS app
2. **Bahasa Indonesia primary** — all error messages, labels, CTAs in Indonesian by default
3. **Mobile-first interactions** — every micro-interaction must work with one thumb on a phone
4. **44px minimum touch targets** — no exceptions. Use `min-h-[44px]` on all interactive elements
5. **Loading states are mandatory** — every async action must show a skeleton or spinner, never a blank flash
6. **Error messages are empathetic** — never say "Error 400". Always explain what happened and what to do next
7. **Gentle urgency only** — "Stok terbatas" not "BELI SEKARANG!!! ⚡⚡". Heritage brand, not marketplace
8. **Accessibility is non-negotiable** — WCAG 2.1 AA, focus rings visible, aria-labels on icon-only buttons
9. **Reduced motion respect** — all animations must check `prefers-reduced-motion`
10. **Success feedback is warm** — celebrate purchases with positive, heritage-appropriate language

---

## 1. BRAND VOICE & COPY

### 1.1 UI Copy Principles

| Situation | Wrong ❌ | Right ✅ |
|---|---|---|
| Empty cart | "Your cart is empty" | "Keranjang kamu masih kosong nih" |
| Add to cart success | "Item added" | "Siomay Ayam Udang ditambahkan ke keranjang 🛒" |
| Out of stock | "SOLD OUT" | "Stok sedang habis" |
| Coupon valid | "Coupon applied" | "Yeay! Diskon Rp15.000 berhasil diterapkan 🎉" |
| Coupon invalid | "Invalid coupon code" | "Ups, kode kupon ini tidak berlaku. Coba cek lagi ya!" |
| Payment success | "Order complete" | "Pesanan kamu sudah kami terima! Terima kasih 🙏" |
| Stock low | "Only 3 left" | "Sisa 3 item — segera sebelum kehabisan" |
| Loading products | "Loading..." | "Sedang memuat produk..." |
| Network error | "Error 503" | "Koneksi kamu terputus. Pastikan internet aktif dan coba lagi." |
| Form error required | "Required field" | "Kolom ini wajib diisi" |
| Form error phone | "Invalid phone" | "Format nomor HP tidak valid. Contoh: 08123456789" |
| Order status packed | "Packed" | "Pesanan kamu sedang dikemas dengan hati-hati ❤️" |
| Order shipped | "Shipped" | "Paket dalam perjalanan! Estimasi tiba {days} hari kerja" |
| Login required | "Please login" | "Silakan masuk dulu untuk melanjutkan" |
| Points earned | "+50 points" | "Kamu mendapat +50 poin dari pesanan ini!" |

### 1.2 Error Messages — Complete Reference
```typescript
// lib/copy/errors.ts
export const ERROR_COPY = {
  // Cart
  'insufficient_stock': (name: string, available: number) =>
    `Stok ${name} tidak cukup. Tersisa ${available} item saja.`,
  'product_not_found': 'Produk tidak ditemukan atau sudah tidak tersedia.',
  'cart_empty': 'Keranjang kamu kosong. Yuk pilih produk dulu!',

  // Coupon
  'coupon_not_found': 'Kode kupon tidak ditemukan. Pastikan penulisan sudah benar.',
  'coupon_expired': 'Sayang sekali, kupon ini sudah kedaluwarsa.',
  'coupon_max_uses': 'Kupon ini sudah mencapai batas penggunaan.',
  'coupon_min_order': (amount: string) =>
    `Minimum belanja ${amount} untuk menggunakan kupon ini.`,
  'coupon_already_used': 'Kamu sudah pernah menggunakan kupon ini sebelumnya.',
  'coupon_not_started': 'Kupon ini belum berlaku.',

  // Points
  'insufficient_points': 'Saldo poin kamu tidak cukup.',
  'points_max_exceeded': (max: string) =>
    `Maksimal penggunaan poin adalah 50% dari subtotal (${max} poin).`,

  // Shipping
  'shipping_unavailable': 'Pengiriman ke alamat ini belum tersedia saat ini.',
  'shipping_changed': 'Opsi pengiriman berubah. Silakan pilih ulang.',

  // Checkout
  'checkout_failed': 'Gagal memproses pesanan. Silakan coba lagi.',
  'payment_failed': 'Pembayaran gagal. Silakan coba metode lain.',
  'payment_expired': 'Waktu pembayaran habis. Buat pesanan baru untuk melanjutkan.',

  // Auth
  'login_required': 'Silakan masuk dulu untuk melanjutkan.',
  'invalid_credentials': 'Email atau password salah.',
  'account_inactive': 'Akun kamu dinonaktifkan. Hubungi CS kami.',
  'email_taken': 'Email ini sudah terdaftar. Silakan masuk.',

  // Network
  'network_error': 'Koneksi terputus. Pastikan internet aktif dan coba lagi.',
  'server_error': 'Terjadi gangguan teknis. Tim kami sedang menanganinya.',
  'rate_limited': 'Terlalu banyak percobaan. Tunggu beberapa menit ya.',

  // Forms
  'required': 'Wajib diisi',
  'invalid_email': 'Format email tidak valid',
  'invalid_phone': 'Format nomor HP tidak valid. Contoh: 08123456789',
  'invalid_postal_code': 'Kode pos harus 5 digit',
  'password_too_short': 'Password minimal 8 karakter',
  'password_mismatch': 'Password tidak cocok',
  'address_too_short': 'Alamat terlalu pendek. Tulis dengan lengkap ya!',
} as const;
```

### 1.3 CTA Copy
```typescript
export const CTA_COPY = {
  addToCart: 'Tambah ke Keranjang',
  buyNow: 'Beli Sekarang',
  proceedToCheckout: 'Lanjut ke Checkout',
  pay: 'Bayar Sekarang',
  placeOrder: 'Buat Pesanan',
  applyCode: 'Pakai Kode',
  redeemPoints: 'Tukarkan Poin',
  viewOrder: 'Lihat Pesanan',
  continueShop: 'Lanjut Belanja',
  login: 'Masuk',
  register: 'Daftar',
  logout: 'Keluar',
  save: 'Simpan',
  cancel: 'Batal',
  confirm: 'Konfirmasi',
  delete: 'Hapus',
  edit: 'Ubah',
  download: 'Unduh',
  contact_wa: 'Hubungi via WhatsApp',
} as const;
```

---

## 2. MICRO-INTERACTIONS

### 2.1 Add to Cart Animation
```typescript
// Trigger when user taps "Tambah ke Keranjang"
// 1. Button background shifts from brand-red → green (200ms ease)
// 2. Icon transitions from ShoppingCart → Check (150ms)
// 3. Cart badge in header/bottom nav "bounces" (scale: 1 → 1.3 → 1, 300ms)
// 4. Toast notification slides in from top (sonner, duration 2000ms)
// 5. After 2000ms, button returns to default state

// CSS for cart badge bounce:
.cart-badge-bounce {
  animation: cartBounce 0.3s ease-out;
}

@keyframes cartBounce {
  0%, 100% { transform: scale(1); }
  50% { transform: scale(1.3); }
}
```

Implementation:
```typescript
// hooks/useCartAnimation.ts
import { useCallback, useRef } from 'react';

export function useCartBadgeAnimation() {
  const badgeRef = useRef<HTMLSpanElement>(null);

  const trigger = useCallback(() => {
    if (!badgeRef.current) return;
    badgeRef.current.classList.remove('cart-badge-bounce');
    // Force reflow
    void badgeRef.current.offsetWidth;
    badgeRef.current.classList.add('cart-badge-bounce');
  }, []);

  return { badgeRef, trigger };
}
```

### 2.2 Coupon Applied Feedback
```typescript
// When coupon is valid:
// 1. Input border → green (#16A34A)
// 2. Discount amount "slides down" with animate-slide-up
// 3. Confetti burst (lightweight, CSS-only) from the coupon input
// 4. Toast: "Yeay! Diskon Rp15.000 berhasil diterapkan 🎉"

// Confetti — CSS only, no library
const CONFETTI_COLORS = ['#C8102E', '#F0EAD6', '#16A34A', '#D97706'];

function triggerConfetti(element: HTMLElement) {
  const rect = element.getBoundingClientRect();
  for (let i = 0; i < 12; i++) {
    const particle = document.createElement('div');
    particle.style.cssText = `
      position: fixed;
      width: 6px; height: 6px;
      background: ${CONFETTI_COLORS[i % CONFETTI_COLORS.length]};
      border-radius: 50%;
      left: ${rect.left + rect.width / 2}px;
      top: ${rect.top}px;
      pointer-events: none;
      z-index: 9999;
      animation: confettiPop 0.8s ease-out forwards;
      animation-delay: ${i * 30}ms;
      --tx: ${(Math.random() - 0.5) * 120}px;
      --ty: ${-(Math.random() * 100 + 40)}px;
    `;
    document.body.appendChild(particle);
    setTimeout(() => particle.remove(), 900);
  }
}
```

CSS for confetti:
```css
@keyframes confettiPop {
  0% { transform: translate(0, 0) scale(1); opacity: 1; }
  100% { transform: translate(var(--tx), var(--ty)) scale(0); opacity: 0; }
}
```

### 2.3 Payment Success Animation
```typescript
// app/(store)/pesanan/[orderNumber]/page.tsx — success state
// When payment=finish param is present:
// 1. Full-screen overlay with cream background
// 2. Animated checkmark SVG (draws itself in 600ms)
// 3. Order number fades in below
// 4. "Terima kasih" message slides up
// 5. Two CTAs appear after 1.2s delay

function PaymentSuccessOverlay({ orderNumber }: { orderNumber: string }) {
  return (
    <div className="min-h-[70vh] flex flex-col items-center justify-center px-4 animate-fade-in text-center">
      {/* Animated checkmark */}
      <div className="w-24 h-24 bg-[#DCFCE7] rounded-full flex items-center justify-center mb-6">
        <svg viewBox="0 0 52 52" className="w-12 h-12">
          <circle className="check-circle" cx="26" cy="26" r="25" fill="none" stroke="#16A34A" strokeWidth="2" />
          <path className="check-mark" fill="none" stroke="#16A34A" strokeWidth="3" strokeLinecap="round" d="M14 27l8 8 16-16" />
        </svg>
      </div>
      <h1 className="font-display text-display-sm text-[#1A1A1A] mb-2">
        Pesanan Diterima!
      </h1>
      <p className="text-[#6B6B6B] mb-1">Nomor pesanan kamu:</p>
      <p className="font-mono font-bold text-brand-red text-lg mb-4">{orderNumber}</p>
      <p className="text-[#6B6B6B] text-sm max-w-[280px] mb-8">
        Kami akan segera memproses pesananmu. Cek email untuk konfirmasi. Terima kasih sudah belanja di Dapur Dekaka 🙏
      </p>
      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        <Link href={`/pesanan/${orderNumber}`}>
          <Button className="w-full bg-brand-red text-white">Lihat Pesanan</Button>
        </Link>
        <Link href="/produk">
          <Button variant="outline" className="w-full">Lanjut Belanja</Button>
        </Link>
      </div>
    </div>
  );
}
```

SVG checkmark animation CSS:
```css
.check-circle {
  stroke-dasharray: 157;
  stroke-dashoffset: 157;
  animation: drawCircle 0.6s ease-out forwards;
}
.check-mark {
  stroke-dasharray: 36;
  stroke-dashoffset: 36;
  animation: drawCheck 0.4s ease-out 0.5s forwards;
}
@keyframes drawCircle {
  to { stroke-dashoffset: 0; }
}
@keyframes drawCheck {
  to { stroke-dashoffset: 0; }
}
```

### 2.4 Stock Indicator
```typescript
// components/store/product/StockIndicator.tsx
export function StockIndicator({ stock }: { stock: number }) {
  if (stock === 0) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-[#6B7280]">
        <div className="w-2 h-2 rounded-full bg-[#6B7280]" />
        Stok habis
      </div>
    );
  }

  if (stock <= 3) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-[#DC2626] font-medium">
        <div className="w-2 h-2 rounded-full bg-[#DC2626] animate-pulse" />
        Sisa {stock} item — hampir habis!
      </div>
    );
  }

  if (stock <= 10) {
    return (
      <div className="flex items-center gap-1.5 text-xs text-[#D97706]">
        <div className="w-2 h-2 rounded-full bg-[#D97706]" />
        Stok terbatas
      </div>
    );
  }

  return null; // Don't show indicator for healthy stock
}
```

### 2.5 Quantity Selector
```typescript
// components/store/product/QuantitySelector.tsx
'use client';
import { Minus, Plus } from 'lucide-react';

interface QuantitySelectorProps {
  value: number;
  max: number;
  min?: number;
  onChange: (value: number) => void;
}

export function QuantitySelector({ value, max, min = 1, onChange }: QuantitySelectorProps) {
  return (
    <div className="flex items-center border-2 border-brand-cream-dark rounded-button overflow-hidden">
      <button
        onClick={() => onChange(Math.max(min, value - 1))}
        disabled={value <= min}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-brand-cream hover:bg-brand-cream-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Kurangi jumlah"
      >
        <Minus size={16} />
      </button>
      <span className="w-12 text-center font-semibold text-sm select-none">{value}</span>
      <button
        onClick={() => onChange(Math.min(max, value + 1))}
        disabled={value >= max}
        className="min-w-[44px] min-h-[44px] flex items-center justify-center bg-brand-cream hover:bg-brand-cream-dark disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        aria-label="Tambah jumlah"
      >
        <Plus size={16} />
      </button>
    </div>
  );
}
```

---

## 3. CHECKOUT FLOW — STEP-BY-STEP UX

### 3.1 Flow Overview (6 Steps)
```
Step 1: Cart Review          → User reviews items, quantities, subtotal
Step 2: Address Entry        → Province → City cascade, form validation
Step 3: Shipping Selection   → Shows only cold-chain couriers (FROZEN tier)
Step 4: Promo/Points         → Coupon code + points redemption
Step 5: Order Summary        → Final total review, all breakdowns visible
Step 6: Payment              → Midtrans Snap popup
```

### 3.2 Address Form UX — Key Behaviors

**Province → City cascade:**
```typescript
// When province changes:
// 1. Clear city selection immediately
// 2. Show "Memuat kota..." skeleton in city dropdown
// 3. Fetch cities for new province
// 4. Populate city dropdown
// 5. Clear shipping options (must re-fetch after city changes)

// Implementation pattern:
const [selectedProvince, setSelectedProvince] = useState('');
const [selectedCity, setSelectedCity] = useState('');

// On province change:
function handleProvinceChange(provinceId: string) {
  setSelectedProvince(provinceId);
  setSelectedCity(''); // Reset city
  // Clear shipping options downstream
  setSelectedCourier(null);
  setValue('cityId', '');
}
```

**Phone number formatting:**
```typescript
// Auto-format as user types: 08123456789
// Accept: 08xxx, +628xxx, 628xxx
// Display: always normalized to 08xxx format in UI
// Stored: as typed by user, validated server-side

function formatPhoneInput(value: string): string {
  // Strip non-digits
  const digits = value.replace(/\D/g, '');
  // Normalize 628xxx → 08xxx for display
  if (digits.startsWith('628')) return '0' + digits.slice(2);
  if (digits.startsWith('62')) return '0' + digits.slice(2);
  return digits;
}
```

**Address input UX:**
- Label: "Alamat Lengkap" (full address)
- Placeholder: "Jl. Merdeka No. 10, RT 01/RW 05, Kelurahan Andir"
- Show character count: "120/300"
- Error if < 10 chars: "Alamat terlalu pendek. Tulis dengan lengkap ya!"
- Help text: "Cantumkan nama jalan, nomor, RT/RW, dan nama kelurahan"

### 3.3 Coupon Input UX
```typescript
// components/store/checkout/CouponInput.tsx
'use client';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Check, X, Loader2, Tag } from 'lucide-react';
import { formatIDR } from '@/lib/utils';
import { toast } from 'sonner';

interface CouponInputProps {
  subtotal: number;
  onApply: (code: string, discountIDR: number) => void;
}

export function CouponInput({ subtotal, onApply }: CouponInputProps) {
  const [code, setCode] = useState('');
  const [status, setStatus] = useState<'idle' | 'loading' | 'valid' | 'invalid'>('idle');
  const [discountIDR, setDiscountIDR] = useState(0);
  const [errorMsg, setErrorMsg] = useState('');
  const [appliedCode, setAppliedCode] = useState('');

  async function handleApply() {
    if (!code.trim()) return;
    setStatus('loading');
    setErrorMsg('');

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: code.trim(), subtotalIDR: subtotal }),
      });
      const data = await res.json();

      if (data.success) {
        setStatus('valid');
        setDiscountIDR(data.data.discountIDR);
        setAppliedCode(code.trim());
        onApply(code.trim(), data.data.discountIDR);
        toast.success(`Yeay! Diskon ${formatIDR(data.data.discountIDR)} berhasil diterapkan 🎉`);
      } else {
        setStatus('invalid');
        setErrorMsg(data.error);
      }
    } catch {
      setStatus('invalid');
      setErrorMsg('Koneksi terputus. Coba lagi.');
    }
  }

  function handleRemove() {
    setCode('');
    setStatus('idle');
    setDiscountIDR(0);
    setAppliedCode('');
    onApply('', 0);
  }

  return (
    <div className="bg-white rounded-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <Tag size={16} className="text-brand-red" />
        <h3 className="font-semibold text-sm">Kode Kupon</h3>
      </div>

      {status === 'valid' ? (
        <div className="flex items-center justify-between p-3 bg-[#DCFCE7] rounded-lg border border-[#16A34A]/20">
          <div className="flex items-center gap-2">
            <Check size={16} className="text-[#16A34A]" />
            <div>
              <p className="font-semibold text-sm text-[#16A34A]">{appliedCode}</p>
              <p className="text-xs text-[#6B6B6B]">Hemat {formatIDR(discountIDR)}</p>
            </div>
          </div>
          <button onClick={handleRemove} className="text-[#6B6B6B] hover:text-[#DC2626] min-h-[44px] min-w-[44px] flex items-center justify-center">
            <X size={18} />
          </button>
        </div>
      ) : (
        <div className="flex gap-2">
          <Input
            value={code}
            onChange={(e) => setCode(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && handleApply()}
            placeholder="WELCOME10"
            className={`flex-1 h-11 font-mono tracking-wider ${status === 'invalid' ? 'border-[#DC2626] focus-visible:ring-[#DC2626]' : ''}`}
            disabled={status === 'loading'}
            maxLength={20}
          />
          <Button
            onClick={handleApply}
            disabled={!code.trim() || status === 'loading'}
            className="h-11 px-4 bg-brand-red hover:bg-brand-red-dark text-white rounded-button shrink-0"
          >
            {status === 'loading' ? <Loader2 size={16} className="animate-spin" /> : 'Pakai'}
          </Button>
        </div>
      )}

      {status === 'invalid' && (
        <p className="text-xs text-[#DC2626] mt-2 flex items-center gap-1">
          <X size={12} /> {errorMsg}
        </p>
      )}
    </div>
  );
}
```

### 3.4 Points Redeemer UX
```typescript
// components/store/checkout/PointsRedeemer.tsx
'use client';
import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { formatIDR } from '@/lib/utils';
import { Coins } from 'lucide-react';

interface PointsRedeemerProps {
  subtotal: number;
  onApply: (points: number) => void;
}

export function PointsRedeemer({ subtotal, onApply }: PointsRedeemerProps) {
  const { data: session } = useSession();
  const [balance, setBalance] = useState(0);
  const [enabled, setEnabled] = useState(false);
  const [points, setPoints] = useState(0);

  useEffect(() => {
    if (session?.user?.id) {
      fetch('/api/account/points').then(r => r.json()).then(d => setBalance(d.data.balance ?? 0));
    }
  }, [session]);

  // Max points = min(balance, floor(subtotal * 0.5 / 10)) points
  // Because 10 IDR per point, max discount = 50% of subtotal
  const maxPoints = Math.min(balance, Math.floor(subtotal * 0.5 / 10));
  const discountIDR = Math.floor(points / 100) * 1000; // 100pts = IDR 1,000

  function handleToggle(checked: boolean) {
    setEnabled(checked);
    if (!checked) {
      setPoints(0);
      onApply(0);
    } else {
      setPoints(0);
    }
  }

  if (balance === 0) return null;

  return (
    <div className="bg-white rounded-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <Coins size={16} className="text-[#D97706]" />
          <h3 className="font-semibold text-sm">Tukarkan Poin</h3>
        </div>
        <Switch checked={enabled} onCheckedChange={handleToggle} />
      </div>

      <div className="flex items-center justify-between text-sm text-[#6B6B6B] mb-3">
        <span>Saldo poin kamu:</span>
        <span className="font-semibold text-[#D97706]">{balance.toLocaleString('id-ID')} poin</span>
      </div>

      {enabled && (
        <div className="space-y-3 animate-slide-up">
          <Slider
            value={[points]}
            max={maxPoints}
            step={100}
            onValueChange={([v]) => { setPoints(v); onApply(v); }}
            className="accent-brand-red"
          />
          <div className="flex justify-between text-xs text-[#6B6B6B]">
            <span>0 poin</span>
            <span>{maxPoints.toLocaleString('id-ID')} poin (maks. 50%)</span>
          </div>
          {points > 0 && (
            <div className="bg-[#FEF3C7] rounded-lg p-3 text-sm">
              <span className="font-semibold text-[#D97706]">{points.toLocaleString('id-ID')} poin</span>
              <span className="text-[#6B6B6B]"> = diskon </span>
              <span className="font-semibold text-[#D97706]">{formatIDR(discountIDR)}</span>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## 4. MOBILE UX PATTERNS

### 4.1 Sticky Bottom CTA — Product Detail Page
```typescript
// Sticky add-to-cart bar at bottom on mobile product page
// Hides behind keyboard on scroll up, shows on scroll down

'use client';
import { useEffect, useState } from 'react';
import { AddToCartButton } from '@/components/store/product/AddToCartButton';
import { formatIDR } from '@/lib/utils';

export function StickyProductCTA({ product }: { product: any }) {
  const [visible, setVisible] = useState(false);
  const [lastY, setLastY] = useState(0);

  useEffect(() => {
    function handleScroll() {
      const y = window.scrollY;
      // Show sticky bar after scrolling past the main CTA (roughly 400px)
      if (y > 400) {
        setVisible(y <= lastY || y > 600); // Show when scrolling up or far down
      } else {
        setVisible(false);
      }
      setLastY(y);
    }
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, [lastY]);

  return (
    <div
      className={`
        fixed bottom-0 left-0 right-0 z-40 md:hidden
        bg-white border-t border-brand-cream-dark px-4 py-3
        transition-transform duration-300
        ${visible ? 'translate-y-0' : 'translate-y-full'}
      `}
      style={{ paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))' }}
    >
      <div className="flex items-center gap-3">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-sm truncate">{product.nameId}</p>
          <p className="text-brand-red font-bold">{formatIDR(product.priceIDR)}</p>
        </div>
        <AddToCartButton product={product} variant="detail" className="w-auto px-6" />
      </div>
    </div>
  );
}
```

### 4.2 Pull-to-Refresh Indicator
```typescript
// For order history and account pages
// Use native browser behavior — no custom implementation needed
// Set overflow-y: auto on the scrollable container
// iOS Safari handles PTR natively when using proper scroll containers
```

### 4.3 Swipe to Delete Cart Item
```typescript
// components/store/cart/CartItem.tsx — swipe gesture
'use client';
import { useRef, useState } from 'react';
import { useCartStore } from '@/store/cart.store';
import { Trash2 } from 'lucide-react';

export function CartItem({ item }: { item: CartItem }) {
  const removeItem = useCartStore((s) => s.removeItem);
  const [swipeX, setSwipeX] = useState(0);
  const startX = useRef(0);
  const DELETE_THRESHOLD = -80;

  function handleTouchStart(e: React.TouchEvent) {
    startX.current = e.touches[0].clientX;
  }

  function handleTouchMove(e: React.TouchEvent) {
    const dx = e.touches[0].clientX - startX.current;
    setSwipeX(Math.max(DELETE_THRESHOLD, Math.min(0, dx)));
  }

  function handleTouchEnd() {
    if (swipeX <= DELETE_THRESHOLD * 0.8) {
      removeItem(item.variantId);
    } else {
      setSwipeX(0);
    }
  }

  return (
    <div className="relative overflow-hidden rounded-lg">
      {/* Delete background */}
      <div className="absolute inset-y-0 right-0 w-20 bg-[#DC2626] flex items-center justify-center rounded-r-lg">
        <Trash2 size={20} className="text-white" />
      </div>
      {/* Item content */}
      <div
        className="relative bg-white transition-transform"
        style={{ transform: `translateX(${swipeX}px)` }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
      >
        {/* Cart item content here */}
      </div>
    </div>
  );
}
```

### 4.4 Thumb Zone Design
```
Phone thumb reach zones (375px wide phone):
┌─────────────────────┐
│  ⚠️  Hard to reach  │  ← Navigation/brand only
│─────────────────────│
│  ⚡ Easy to reach   │  ← Main content, product cards
│─────────────────────│
│  ✅ Natural zone    │  ← CTA buttons, Add to Cart
│─────────────────────│
│  [Bottom Nav 80px]  │  ← Nav tabs, icons
└─────────────────────┘

Rules:
- Primary CTAs (Add to Cart, Pay) → bottom 40% of screen
- Never put critical actions in top 20% on mobile
- Bottom sheet / drawer preferred over top modal on mobile
- Price and variant selector → sticky bottom bar on product page
```

---

## 5. FORM VALIDATION UX

### 5.1 Inline Validation Pattern
```typescript
// All forms use react-hook-form + Zod
// Validation triggers: onBlur for text fields, onChange for selects

// Pattern for field-level error display:
function FormFieldWithError({ label, error, children }: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-medium text-[#1A1A1A]">{label}</label>
      {children}
      {error && (
        <p className="text-xs text-[#DC2626] flex items-center gap-1 animate-fade-in">
          <span>⚠</span> {error}
        </p>
      )}
    </div>
  );
}
```

### 5.2 Address Form — Zod Schema + UX Rules
```typescript
import { z } from 'zod';

export const AddressFormSchema = z.object({
  recipientName: z
    .string()
    .min(2, 'Nama penerima minimal 2 karakter')
    .max(100, 'Nama terlalu panjang'),
  phone: z
    .string()
    .regex(/^(\+62|62|0)8[1-9][0-9]{6,10}$/, 'Format nomor HP tidak valid. Contoh: 08123456789'),
  provinceId: z.string().min(1, 'Pilih provinsi'),
  province: z.string().min(1),
  cityId: z.string().min(1, 'Pilih kota/kabupaten'),
  city: z.string().min(1),
  district: z.string().min(1, 'Kecamatan wajib diisi'),
  postalCode: z
    .string()
    .regex(/^\d{5}$/, 'Kode pos harus 5 digit angka'),
  fullAddress: z
    .string()
    .min(10, 'Alamat terlalu pendek. Tulis dengan lengkap ya!')
    .max(300, 'Alamat terlalu panjang (maks 300 karakter)'),
  label: z.enum(['rumah', 'kantor', 'lainnya']).default('rumah'),
  saveAddress: z.boolean().default(false),
});
```

### 5.3 Login Form Validation Flow
```
1. Email field: validate on blur
   - Empty: "Email wajib diisi"
   - Invalid format: "Format email tidak valid"
   
2. Password field: validate on blur
   - Empty: "Password wajib diisi"
   - Submit with wrong password: show error message below button
   - "Email atau password salah. Lupa password? Reset di sini."
   
3. Submit button:
   - Shows Loader2 spinner while authenticating
   - Disabled during loading
   - Re-enables on error
   
4. Remember me checkbox:
   - Checked by default
   - Stores session for 30 days
```

---

## 6. LOADING STATE HIERARCHY

### Priority order for loading states:
1. **Page skeleton** — entire page structure with shimmer (first load)
2. **Section skeleton** — individual section loading (tab switches, pagination)
3. **Inline spinner** — small async action (validate coupon, check stock)
4. **Button loading** — button-specific action (submit, add to cart)
5. **Toast** — action result (after completion, not during)

```typescript
// Loading state examples by component:

// 1. Product listing — full skeleton grid
<Suspense fallback={<ProductGridSkeleton count={8} />}>
  <ProductGrid />
</Suspense>

// 2. Shipping options — inline skeleton
{isLoading ? (
  <div className="space-y-2">
    {[1,2,3].map(i => <Skeleton key={i} className="h-16 w-full shimmer-bg rounded-lg" />)}
  </div>
) : <ShippingOptions />}

// 3. Coupon validation — button spinner
<Button disabled={isValidating}>
  {isValidating ? <Loader2 className="animate-spin mr-2" size={14} /> : null}
  Pakai
</Button>

// 4. Checkout submit — button + overlay
// Never show a full-page spinner — user loses context
// Instead: disable form fields + show button spinner
```

---

## 7. ORDER TRACKING UX

### 7.1 Order Detail Page Structure
```
┌─────────────────────────────────┐
│ ← Kembali    Pesanan DDK-001    │
│─────────────────────────────────│
│ [StatusBadge: Sedang Diproses]  │
│ [Timeline vertical steps]       │
│─────────────────────────────────│
│ PRODUK YANG DIPESAN             │
│ [Item thumbnails + quantities]  │
│─────────────────────────────────│
│ ALAMAT PENGIRIMAN               │
│ [Name, address, phone]          │
│─────────────────────────────────│
│ RINCIAN PEMBAYARAN              │
│ Subtotal:          Rp XXX       │
│ Ongkir (JNE YES): Rp XXX       │
│ Diskon Kupon:     -Rp XXX      │
│ Diskon Poin:      -Rp XXX      │
│ Total:             Rp XXX       │
│─────────────────────────────────│
│ [Unduh Kwitansi]  [Hubungi WA] │
└─────────────────────────────────┘
```

### 7.2 Real-time Status Updates (Polling)
```typescript
// Poll order status every 30s when status is pending_payment or shipped
// Stop polling when status is delivered/cancelled/refunded

'use client';
import { useQuery } from '@tanstack/react-query';

export function useOrderStatus(orderNumber: string, initialStatus: string) {
  const shouldPoll = ['pending_payment', 'shipped'].includes(initialStatus);

  return useQuery({
    queryKey: ['order', orderNumber],
    queryFn: async () => {
      const res = await fetch(`/api/orders/${orderNumber}`);
      return res.json();
    },
    refetchInterval: shouldPoll ? 30_000 : false,
    initialData: { data: { status: initialStatus } },
  });
}
```

---

## 8. ACCESSIBILITY

### 8.1 Focus Management
```css
/* Visible focus ring for all interactive elements */
/* In globals.css */
:focus-visible {
  outline: 2px solid #C8102E;
  outline-offset: 2px;
  border-radius: 4px;
}

/* Remove outline for mouse users, keep for keyboard */
:focus:not(:focus-visible) {
  outline: none;
}
```

### 8.2 Required ARIA Labels
```typescript
// All icon-only buttons MUST have aria-label
<button aria-label="Kurangi jumlah"><Minus /></button>
<button aria-label="Tambah jumlah"><Plus /></button>
<button aria-label="Hapus dari keranjang"><Trash2 /></button>
<button aria-label="Buka keranjang belanja"><ShoppingCart /></button>
<button aria-label="Tutup menu"><X /></button>
<button aria-label="Hubungi via WhatsApp"><MessageCircle /></button>

// Images must have descriptive alt text
<Image alt="Siomay Ayam Udang — dimsum premium Dapur Dekaka" />
<Image alt="" />  // Decorative images get empty alt

// Form fields must have labels
<label htmlFor="email">Email</label>
<input id="email" type="email" aria-required="true" aria-invalid={!!errors.email} />

// Error messages linked to fields
<input aria-describedby="email-error" />
<p id="email-error" role="alert">{errors.email?.message}</p>

// Loading states announced
<div aria-live="polite" aria-label="Status">
  {isLoading ? 'Memuat...' : ''}
</div>
```

### 8.3 Keyboard Navigation
```typescript
// Cart sheet — trap focus inside when open
// Dialog components from shadcn/ui handle this automatically

// Bottom nav — navigable with arrow keys
// Tab key: moves through nav items
// Enter/Space: activates nav item

// Product quantity selector
// Arrow keys: increase/decrease quantity
function handleKeyDown(e: React.KeyboardEvent) {
  if (e.key === 'ArrowUp') onChange(Math.min(max, value + 1));
  if (e.key === 'ArrowDown') onChange(Math.max(min, value - 1));
}
```

### 8.4 Reduced Motion
```typescript
// hooks/useReducedMotion.ts
import { useEffect, useState } from 'react';

export function useReducedMotion(): boolean {
  const [prefersReduced, setPrefersReduced] = useState(false);

  useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    setPrefersReduced(query.matches);
    const handler = (e: MediaQueryListEvent) => setPrefersReduced(e.matches);
    query.addEventListener('change', handler);
    return () => query.removeEventListener('change', handler);
  }, []);

  return prefersReduced;
}

// Usage: skip animations if prefers-reduced-motion
const reducedMotion = useReducedMotion();
<div className={reducedMotion ? '' : 'animate-slide-up'}>
```

CSS global reduced motion:
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
  }
}
```

---

## 9. EMAIL UX

### 9.1 Order Confirmation Email Structure
```
Subject: Pesanan DDK-20260514-0001 Dikonfirmasi 🎉

──────────────────────────────────────
[LOGO — Dapur Dekaka]
Terima kasih sudah belanja!
──────────────────────────────────────

Hai {firstName},

Pesanan kamu sudah kami terima dan sedang kami proses. 
Kamu akan menerima notifikasi saat pesanan dikirim.

[CTA: Lihat Detail Pesanan]

──────────────────────────────────────
DETAIL PESANAN
Nomor: DDK-20260514-0001

[Product Image] Siomay Ayam Udang (Isi 10)  Rp 35.000
[Product Image] Bakpao Kacang Hitam (Isi 6)  Rp 42.000

Subtotal:      Rp  77.000
Ongkir JNE YES: Rp  25.000
Diskon Kupon:  -Rp  10.000
Total:          Rp  92.000
──────────────────────────────────────

ALAMAT PENGIRIMAN
{recipient_name}
{address}
{city}, {province} {postal_code}
Telp: {phone}

──────────────────────────────────────
Ada pertanyaan? Hubungi kami via:
WhatsApp: wa.me/628xxx | Email: cs@dapurdekaka.com

Salam hangat,
Tim Dapur Dekaka 德卡
Jl. Dapur Keluarga No. 1, Bandung
──────────────────────────────────────
```

### 9.2 Email Components — React Email
```typescript
// emails/order-confirmation.tsx
import {
  Html, Head, Body, Container, Section,
  Text, Heading, Button, Img, Hr, Row, Column
} from '@react-email/components';

interface OrderConfirmationEmailProps {
  order: any;
  user: { name: string; email: string };
  items: any[];
}

export function OrderConfirmationEmail({ order, user, items }: OrderConfirmationEmailProps) {
  const firstName = user.name.split(' ')[0];

  return (
    <Html lang="id">
      <Head />
      <Body style={{ backgroundColor: '#FAFAF8', fontFamily: 'Inter, sans-serif' }}>
        <Container style={{ maxWidth: '600px', margin: '0 auto', padding: '24px' }}>
          {/* Header */}
          <Section style={{ backgroundColor: '#C8102E', padding: '24px', textAlign: 'center', borderRadius: '12px 12px 0 0' }}>
            <Img src="https://dapurdekaka.com/logo.jpg" alt="Dapur Dekaka" width="60" height="60" style={{ borderRadius: '50%' }} />
            <Heading style={{ color: '#F0EAD6', fontSize: '20px', margin: '12px 0 0', fontFamily: 'Georgia, serif' }}>
              Dapur Dekaka
            </Heading>
          </Section>

          {/* Body */}
          <Section style={{ backgroundColor: '#FFFFFF', padding: '32px', borderRadius: '0 0 12px 12px' }}>
            <Text style={{ fontSize: '16px', color: '#1A1A1A', marginBottom: '8px' }}>
              Hai {firstName} 👋
            </Text>
            <Text style={{ fontSize: '14px', color: '#6B6B6B', lineHeight: '1.6' }}>
              Pesanan kamu sudah kami terima dan sedang kami proses dengan penuh cinta.
              Kamu akan mendapat notifikasi saat pesanan dikirim.
            </Text>

            <Button
              href={`https://dapurdekaka.com/pesanan/${order.orderNumber}`}
              style={{
                backgroundColor: '#C8102E',
                color: '#FFFFFF',
                padding: '12px 32px',
                borderRadius: '8px',
                fontSize: '14px',
                fontWeight: 'bold',
                display: 'block',
                textAlign: 'center',
                margin: '24px 0',
              }}
            >
              Lihat Detail Pesanan
            </Button>

            <Hr style={{ borderColor: '#E0D4BC', margin: '24px 0' }} />

            {/* Order items */}
            {items.map((item) => (
              <Row key={item.id} style={{ marginBottom: '12px' }}>
                <Column style={{ width: '60px' }}>
                  <Img src={item.imageUrl} alt={item.productName} width="50" height="50" style={{ borderRadius: '8px', objectFit: 'cover' }} />
                </Column>
                <Column style={{ paddingLeft: '12px' }}>
                  <Text style={{ fontSize: '13px', fontWeight: '600', color: '#1A1A1A', margin: '0' }}>
                    {item.productName} ({item.variantName})
                  </Text>
                  <Text style={{ fontSize: '12px', color: '#6B6B6B', margin: '2px 0 0' }}>
                    {item.quantity}x @ Rp {item.unitPriceIDR.toLocaleString('id-ID')}
                  </Text>
                </Column>
                <Column align="right">
                  <Text style={{ fontSize: '13px', fontWeight: '600', color: '#C8102E', margin: '0' }}>
                    Rp {item.totalPriceIDR.toLocaleString('id-ID')}
                  </Text>
                </Column>
              </Row>
            ))}

            <Hr style={{ borderColor: '#E0D4BC', margin: '16px 0' }} />

            {/* Totals */}
            <Row>
              <Column><Text style={{ fontSize: '13px', color: '#6B6B6B' }}>Subtotal</Text></Column>
              <Column align="right"><Text style={{ fontSize: '13px' }}>Rp {order.subtotalIDR.toLocaleString('id-ID')}</Text></Column>
            </Row>
            {/* ... more rows ... */}
            <Row>
              <Column><Text style={{ fontSize: '15px', fontWeight: '700', color: '#1A1A1A' }}>Total</Text></Column>
              <Column align="right">
                <Text style={{ fontSize: '15px', fontWeight: '700', color: '#C8102E' }}>
                  Rp {order.totalAmountIDR.toLocaleString('id-ID')}
                </Text>
              </Column>
            </Row>
          </Section>

          {/* Footer */}
          <Text style={{ textAlign: 'center', fontSize: '12px', color: '#ABABAB', marginTop: '24px' }}>
            Dapur Dekaka 德卡 · Bandung, Jawa Barat
            <br />
            <a href="https://wa.me/628xxx" style={{ color: '#25D366' }}>WhatsApp CS</a>
            {' · '}
            <a href="mailto:cs@dapurdekaka.com" style={{ color: '#C8102E' }}>cs@dapurdekaka.com</a>
          </Text>
        </Container>
      </Body>
    </Html>
  );
}
```

---

## 10. ADMIN UX PATTERNS

### 10.1 KPI Cards
```typescript
// components/admin/dashboard/KPICard.tsx
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { formatIDR } from '@/lib/utils';

interface KPICardProps {
  title: string;
  value: string | number;
  prefix?: string;
  suffix?: string;
  change?: number;       // percentage vs previous period
  changePeriod?: string; // "vs kemarin", "vs minggu lalu"
  icon?: React.ReactNode;
}

export function KPICard({ title, value, prefix, suffix, change, changePeriod, icon }: KPICardProps) {
  const isPositive = change !== undefined && change > 0;
  const isNegative = change !== undefined && change < 0;

  return (
    <div className="bg-white rounded-card p-5 shadow-card">
      <div className="flex items-start justify-between mb-3">
        <p className="text-sm font-medium text-[#6B6B6B]">{title}</p>
        {icon && <div className="text-brand-red">{icon}</div>}
      </div>
      <p className="text-2xl font-bold text-[#1A1A1A] mb-2">
        {prefix}{typeof value === 'number' ? value.toLocaleString('id-ID') : value}{suffix}
      </p>
      {change !== undefined && (
        <div className={`flex items-center gap-1 text-xs font-medium ${isPositive ? 'text-[#16A34A]' : isNegative ? 'text-[#DC2626]' : 'text-[#6B6B6B]'}`}>
          {isPositive ? <TrendingUp size={14} /> : isNegative ? <TrendingDown size={14} /> : <Minus size={14} />}
          <span>{isPositive ? '+' : ''}{change.toFixed(1)}%</span>
          <span className="text-[#ABABAB] font-normal">{changePeriod}</span>
        </div>
      )}
    </div>
  );
}
```

### 10.2 Order Status Updater — Admin
```typescript
// Warehouse-friendly: large touch targets, clear status progression
// components/admin/order/OrderStatusUpdater.tsx
'use client';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { toast } from 'sonner';

const STATUS_ACTIONS: Record<string, { next: string; label: string; color: string }> = {
  paid: { next: 'processing', label: 'Mulai Proses', color: 'bg-violet-600' },
  processing: { next: 'packed', label: 'Tandai Dikemas', color: 'bg-cyan-600' },
  packed: { next: 'shipped', label: 'Tandai Dikirim', color: 'bg-emerald-600' },
  shipped: { next: 'delivered', label: 'Tandai Terkirim', color: 'bg-green-600' },
};

export function OrderStatusUpdater({ orderId, currentStatus, onUpdate }: {
  orderId: string;
  currentStatus: string;
  onUpdate: () => void;
}) {
  const [loading, setLoading] = useState(false);
  const [note, setNote] = useState('');
  const [trackingNumber, setTrackingNumber] = useState('');

  const action = STATUS_ACTIONS[currentStatus];
  if (!action) return null;

  async function handleUpdate() {
    setLoading(true);
    try {
      const res = await fetch(`/api/admin/orders/${orderId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: action.next,
          note,
          trackingNumber: trackingNumber || undefined,
        }),
      });
      const data = await res.json();
      if (data.success) {
        toast.success('Status pesanan berhasil diperbarui');
        onUpdate();
      } else {
        toast.error(data.error);
      }
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="bg-white rounded-card p-4 space-y-3">
      <h3 className="font-semibold">Update Status Pesanan</h3>
      {action.next === 'shipped' && (
        <input
          value={trackingNumber}
          onChange={(e) => setTrackingNumber(e.target.value)}
          placeholder="Nomor resi pengiriman"
          className="w-full h-11 border border-brand-cream-dark rounded-lg px-3 text-sm"
        />
      )}
      <Textarea
        value={note}
        onChange={(e) => setNote(e.target.value)}
        placeholder="Catatan (opsional)"
        rows={2}
        className="resize-none"
      />
      <Button
        onClick={handleUpdate}
        disabled={loading}
        className={`w-full h-12 text-white font-semibold rounded-button ${action.color}`}
      >
        {loading ? 'Memperbarui...' : action.label}
      </Button>
    </div>
  );
}
```

---

## 11. TOAST CONFIGURATION

```typescript
// Sonner toast config — in app/layout.tsx
import { Toaster } from '@/components/ui/sonner';

// Usage:
<Toaster
  position="top-center"
  richColors
  expand={false}
  duration={3000}
  closeButton
  toastOptions={{
    style: {
      fontFamily: 'Inter, sans-serif',
      fontSize: '14px',
    },
  }}
/>

// Toast patterns:
import { toast } from 'sonner';

// Success (green)
toast.success('Produk berhasil disimpan');

// Error (red)
toast.error('Gagal memuat data. Coba lagi.');

// Info (blue)
toast.info('Pesanan kamu sedang diproses...');

// Warning (amber)
toast.warning('Stok tersisa sedikit!');

// Promise (shows loading → success/error)
toast.promise(apiCall(), {
  loading: 'Menyimpan...',
  success: 'Berhasil disimpan!',
  error: 'Gagal menyimpan',
});

// Custom with action
toast('Produk dihapus', {
  action: {
    label: 'Batal',
    onClick: () => restoreProduct(),
  },
  duration: 5000,
});
```

---

## 12. PAGE-SPECIFIC UX SPECS

### Homepage
- Hero carousel: 4s auto-advance, pause on hover/touch, dots indicator, swipeable on mobile
- Category grid: 2x3 on mobile, 6-up horizontal on desktop, tap area is entire card
- Featured products: 2-column on mobile, 4-column on desktop, horizontal scroll on small screens
- Heritage banner: full-width cream section with Chinese pattern texture overlay
- Testimonials: carousel on mobile (1 visible), 3-up on desktop

### Product Listing (`/produk`)
- Filters: bottom sheet on mobile (full-height drawer), sidebar on desktop
- Sort dropdown: sticky below header on mobile
- Grid: 2 columns on mobile, 3 on tablet, 4 on desktop
- Each card: 120×120px minimum image, name (2-line clamp), price in red, Add to Cart button

### Product Detail
- Images: full-width swipeable gallery on mobile, thumbnail sidebar on desktop
- Main image: zoom on pinch-to-zoom (mobile native behavior)
- Variant selector: pill buttons, selected state with brand-red border + background tint
- Description: expandable "Baca Selengkapnya" after 4 lines
- Related products: horizontal scroll on mobile

### Cart
- Cart sheet: slides from right (desktop), full bottom sheet (mobile)
- Each item: swipe left to reveal delete button on mobile
- Quantity updates: debounced 500ms before validating stock
- Empty state: illustration + "Mulai Belanja" CTA

### Checkout
- Single-page layout (all steps visible, not stepper) — simpler on mobile
- Address form: cascading province → city selects
- Shipping: radio group cards with price prominent
- Summary: sticky on desktop sidebar, accordion on mobile
- Pay button: always visible at bottom, disabled until form complete

### Order History
- List view: order number, date, status badge, total amount
- Filter by status: horizontal chip tabs at top
- "Beli Lagi" quick reorder on completed orders
- Real-time status badge update via polling

### Account
- Sections: Profil, Alamat, Poin, Riwayat Pesanan
- Points display: large number + progress bar to next reward
- Address list: default address highlighted, max 5 addresses
