# ENGINE_IMPLEMENTATION.md — Business Logic & Processing Engines
# DapurDekaka.com v2
**Version:** 1.0
**Status:** Production Target
**Author:** Bashara (Technical Lead)
**Last Updated:** May 2026

---

## CRITICAL RULES FOR CURSOR

1. The Zustand cart store MUST persist to localStorage for guests — use `persist` middleware
2. Cart merging logic (guest → logged-in) must add quantities, not replace
3. Midtrans Snap.js must be loaded via `<Script>` with `strategy="afterInteractive"` — NOT in `<head>`
4. RajaOngkir cities are loaded ONLY after province is selected — cascade dependency
5. All form validation uses Zod schemas with react-hook-form — no ad-hoc validation
6. PDF receipt is generated client-side with @react-pdf/renderer — dynamically imported
7. Points are shown in real-time — fetch from `/api/account/points` on checkout page load
8. Language toggle stores preference in cookie (server-readable) AND localStorage
9. Admin dashboard KPI data must be fetched server-side (SSR) — not client-fetched
10. All monetary values are integers (IDR, no decimals) — use `Math.floor()` everywhere

---

## TABLE OF CONTENTS
1. Cart Engine (Zustand + localStorage)
2. Checkout Form Engine (Zod + react-hook-form)
3. Shipping Cascade Engine
4. Coupon + Points UI Engine
5. Midtrans Snap.js Integration
6. Order Tracking Engine
7. PDF Receipt Engine
8. Admin Dashboard Engine
9. AI Caption Generator Engine (Minimax)
10. Authentication Flow Engine
11. Internationalization Engine
12. Inventory Management Engine

---

## 1. CART ENGINE

### 1.1 `store/cart.store.ts` — Complete Zustand Cart
```typescript
import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';

export interface CartItem {
  variantId: string;
  productId: string;
  productName: string;
  variantName: string;
  slug: string;
  sku: string;
  price: number;
  quantity: number;
  weightGram: number;
  image: string;
  stock: number; // Live stock — updated on cart validation
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (variantId: string) => void;
  updateQuantity: (variantId: string, quantity: number) => void;
  clearCart: () => void;
  mergeWithServerCart: (serverItems: CartItem[]) => void;
  getItemCount: () => number;
  getSubtotal: () => number;
  getTotalWeight: () => number;
}

export const useCartStore = create<CartStore>()(
  persist(
    (set, get) => ({
      items: [],

      addItem: (newItem) => set((state) => {
        const existing = state.items.find(i => i.variantId === newItem.variantId);
        if (existing) {
          return {
            items: state.items.map(i =>
              i.variantId === newItem.variantId
                ? { ...i, quantity: Math.min(i.quantity + newItem.quantity, 99, i.stock) }
                : i
            ),
          };
        }
        return { items: [...state.items, { ...newItem, quantity: Math.min(newItem.quantity, 99, newItem.stock) }] };
      }),

      removeItem: (variantId) => set((state) => ({
        items: state.items.filter(i => i.variantId !== variantId),
      })),

      updateQuantity: (variantId, quantity) => set((state) => {
        if (quantity <= 0) {
          return { items: state.items.filter(i => i.variantId !== variantId) };
        }
        return {
          items: state.items.map(i =>
            i.variantId === variantId
              ? { ...i, quantity: Math.min(quantity, 99, i.stock) }
              : i
          ),
        };
      }),

      clearCart: () => set({ items: [] }),

      // Merge localStorage cart with DB cart when user logs in
      // Rule: if same variant exists in both, ADD quantities (not replace)
      mergeWithServerCart: (serverItems) => set((state) => {
        const merged = [...serverItems];
        for (const localItem of state.items) {
          const serverItem = merged.find(i => i.variantId === localItem.variantId);
          if (serverItem) {
            serverItem.quantity = Math.min(
              serverItem.quantity + localItem.quantity,
              99,
              serverItem.stock
            );
          } else {
            merged.push(localItem);
          }
        }
        return { items: merged };
      }),

      getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
      getSubtotal: () => get().items.reduce((sum, i) => sum + (i.price * i.quantity), 0),
      getTotalWeight: () => get().items.reduce((sum, i) => sum + (i.weightGram * i.quantity), 0),
    }),
    {
      name: 'dapurdekaka-cart',
      storage: createJSONStorage(() => localStorage),
      // Only persist items, not computed values
      partialize: (state) => ({ items: state.items }),
    }
  )
);
```

### 1.2 `hooks/useCart.ts`
```typescript
import { useCartStore } from '@/store/cart.store';
import { useCallback } from 'react';

export function useCart() {
  const store = useCartStore();

  const addToCart = useCallback((item: Parameters<typeof store.addItem>) => {
    store.addItem(item);
    // Optional: trigger toast notification
  }, [store]);

  return {
    items: store.items,
    itemCount: store.getItemCount(),
    subtotal: store.getSubtotal(),
    totalWeight: store.getTotalWeight(),
    addToCart,
    removeItem: store.removeItem,
    updateQuantity: store.updateQuantity,
    clearCart: store.clearCart,
  };
}
```

---

## 2. CHECKOUT FORM ENGINE

### 2.1 `lib/validations/checkout.schema.ts`
```typescript
import { z } from 'zod';

const phoneRegex = /^(\+62|0)[0-9]{8,12}$/;

export const guestInfoSchema = z.object({
  guestName: z.string().min(3, 'Nama minimal 3 karakter').max(100),
  guestEmail: z.string().email('Format email tidak valid'),
  guestPhone: z.string().regex(phoneRegex, 'Format nomor HP tidak valid (contoh: 081234567890)'),
});

export const addressSchema = z.object({
  shippingName: z.string().min(3, 'Nama penerima minimal 3 karakter'),
  shippingPhone: z.string().regex(phoneRegex, 'Format nomor HP tidak valid'),
  shippingAddressLine: z.string().min(10, 'Alamat terlalu pendek').max(500),
  shippingProvinceId: z.string().min(1, 'Pilih provinsi'),
  shippingProvince: z.string().min(1),
  shippingCityId: z.string().min(1, 'Pilih kota/kabupaten'),
  shippingCity: z.string().min(1),
  shippingDistrict: z.string().optional(),
  shippingPostalCode: z.string().regex(/^[0-9]{5}$/, 'Kode pos harus 5 digit angka'),
});

export const checkoutSchema = z.object({
  // Guest info (only if not logged in)
  guestName: z.string().optional(),
  guestEmail: z.string().email().optional(),
  guestPhone: z.string().optional(),
  // Delivery
  deliveryMethod: z.enum(['delivery', 'pickup']),
  // Shipping address (only if delivery)
  shippingName: z.string().optional(),
  shippingPhone: z.string().optional(),
  shippingAddressLine: z.string().optional(),
  shippingCity: z.string().optional(),
  shippingCityId: z.string().optional(),
  shippingProvince: z.string().optional(),
  shippingPostalCode: z.string().optional(),
  // Courier
  courierCode: z.string().optional(),
  courierService: z.string().optional(),
  courierName: z.string().optional(),
  estimatedDays: z.string().optional(),
  shippingCost: z.number().min(0).default(0),
  // Discount
  couponCode: z.string().optional(),
  pointsToRedeem: z.number().min(0).default(0),
  // Order
  subtotal: z.number().min(0),
  items: z.array(z.object({
    variantId: z.string().uuid(),
    quantity: z.number().min(1).max(99),
  })).min(1),
  orderNotes: z.string().max(500).optional(),
});

export type CheckoutFormData = z.infer<typeof checkoutSchema>;
```

---

## 3. SHIPPING CASCADE ENGINE

### 3.1 `hooks/useShipping.ts`
```typescript
import { useState, useCallback } from 'react';
import { useQuery } from '@tanstack/react-query';

interface ShippingService {
  courier: string;
  courierName: string;
  service: string;
  serviceName: string;
  cost: number;
  etd: string;
}

export function useShipping(totalWeightGram: number) {
  const [selectedProvinceId, setSelectedProvinceId] = useState<string>('');
  const [selectedCityId, setSelectedCityId] = useState<string>('');
  const [selectedService, setSelectedService] = useState<ShippingService | null>(null);

  // Provinces (cached 24h)
  const { data: provinces } = useQuery({
    queryKey: ['shipping-provinces'],
    queryFn: async () => {
      const res = await fetch('/api/shipping/provinces');
      const data = await res.json();
      return data.provinces as Array<{ province_id: string; province: string }>;
    },
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Cities (cached per province)
  const { data: cities } = useQuery({
    queryKey: ['shipping-cities', selectedProvinceId],
    queryFn: async () => {
      const res = await fetch(`/api/shipping/cities?province=${selectedProvinceId}`);
      const data = await res.json();
      return data.cities as Array<{ city_id: string; city_name: string; type: string }>;
    },
    enabled: !!selectedProvinceId,
    staleTime: 24 * 60 * 60 * 1000,
  });

  // Shipping cost (fresh per city + weight)
  const { data: shippingOptions, isLoading: isCalculating } = useQuery({
    queryKey: ['shipping-cost', selectedCityId, totalWeightGram],
    queryFn: async () => {
      const res = await fetch('/api/shipping/cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cityId: selectedCityId, weightGram: totalWeightGram }),
      });
      const data = await res.json();
      return data as { available: boolean; services: ShippingService[] };
    },
    enabled: !!selectedCityId && totalWeightGram > 0,
  });

  const onProvinceChange = useCallback((provinceId: string) => {
    setSelectedProvinceId(provinceId);
    setSelectedCityId(''); // Reset city on province change
    setSelectedService(null);
  }, []);

  const onCityChange = useCallback((cityId: string) => {
    setSelectedCityId(cityId);
    setSelectedService(null); // Reset service on city change
  }, []);

  return {
    provinces: provinces ?? [],
    cities: cities ?? [],
    shippingOptions: shippingOptions?.services ?? [],
    isShippingAvailable: shippingOptions?.available ?? true,
    isCalculating,
    selectedProvinceId,
    selectedCityId,
    selectedService,
    onProvinceChange,
    onCityChange,
    setSelectedService,
  };
}
```

---

## 4. COUPON + POINTS UI ENGINE

### 4.1 `hooks/useCheckout.ts`
```typescript
import { useState, useCallback } from 'react';

interface AppliedCoupon {
  id: string;
  code: string;
  type: string;
  value: number;
  discountAmount: number;
}

export function useCouponAndPoints(subtotal: number, userPointsBalance: number) {
  const [couponCode, setCouponCode] = useState('');
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [couponError, setCouponError] = useState('');
  const [isValidatingCoupon, setIsValidatingCoupon] = useState(false);

  const [pointsToRedeem, setPointsToRedeem] = useState(0);
  const [usePoints, setUsePoints] = useState(false);

  const validateCoupon = useCallback(async () => {
    if (!couponCode.trim()) return;
    setIsValidatingCoupon(true);
    setCouponError('');

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: couponCode, subtotal }),
      });
      const data = await res.json();

      if (data.valid) {
        setAppliedCoupon(data.coupon);
        setCouponError('');
      } else {
        setAppliedCoupon(null);
        setCouponError(data.message);
      }
    } catch {
      setCouponError('Gagal memvalidasi kupon. Coba lagi.');
    } finally {
      setIsValidatingCoupon(false);
    }
  }, [couponCode, subtotal]);

  const removeCoupon = useCallback(() => {
    setAppliedCoupon(null);
    setCouponCode('');
    setCouponError('');
  }, []);

  // Max points = 50% of subtotal, in 100-point increments
  const maxRedeemablePoints = Math.min(
    userPointsBalance,
    Math.floor(subtotal * 0.5 / 1000) * 100
  );

  const togglePoints = useCallback(() => {
    if (!usePoints) {
      setPointsToRedeem(maxRedeemablePoints);
    } else {
      setPointsToRedeem(0);
    }
    setUsePoints(prev => !prev);
  }, [usePoints, maxRedeemablePoints]);

  // Discount calculation (PRD Section 6.5)
  const couponDiscount = appliedCoupon?.discountAmount ?? 0;
  const pointsDiscount = Math.floor(pointsToRedeem / 100) * 1000;

  return {
    couponCode, setCouponCode,
    appliedCoupon, couponError, isValidatingCoupon,
    validateCoupon, removeCoupon,
    pointsToRedeem, usePoints, togglePoints,
    couponDiscount, pointsDiscount,
    maxRedeemablePoints,
  };
}
```

---

## 5. MIDTRANS SNAP.JS INTEGRATION

### 5.1 `components/store/checkout/MidtransButton.tsx`
```typescript
'use client';

import { useState, useCallback } from 'react';
import Script from 'next/script';
import { useRouter } from 'next/navigation';
import { useCartStore } from '@/store/cart.store';
import { Button } from '@/components/ui/button';

declare global {
  interface Window {
    snap: {
      pay: (token: string, options: {
        onSuccess: (result: any) => void;
        onPending: (result: any) => void;
        onError: (result: any) => void;
        onClose: () => void;
      }) => void;
    };
  }
}

interface MidtransButtonProps {
  snapToken: string;
  orderNumber: string;
  onRetry: () => Promise<string>; // Returns new snapToken
  disabled?: boolean;
}

export function MidtransButton({ snapToken, orderNumber, onRetry, disabled }: MidtransButtonProps) {
  const router = useRouter();
  const clearCart = useCartStore(s => s.clearCart);
  const [isLoading, setIsLoading] = useState(false);
  const [currentToken, setCurrentToken] = useState(snapToken);

  const snapScriptUrl = process.env.NEXT_PUBLIC_MIDTRANS_IS_PRODUCTION === 'true'
    ? 'https://app.midtrans.com/snap/snap.js'
    : 'https://app.sandbox.midtrans.com/snap/snap.js';

  const openSnap = useCallback(() => {
    if (!window.snap || !currentToken) return;

    window.snap.pay(currentToken, {
      onSuccess: (result) => {
        clearCart();
        router.push(`/checkout/success?order=${orderNumber}`);
      },
      onPending: (result) => {
        router.push(`/checkout/pending?order=${orderNumber}`);
      },
      onError: (result) => {
        router.push(`/checkout/failed?order=${orderNumber}`);
      },
      onClose: () => {
        // User closed popup without completing payment
        // Stay on current page — do nothing
      },
    });
  }, [currentToken, orderNumber, clearCart, router]);

  return (
    <>
      <Script
        src={snapScriptUrl}
        data-client-key={process.env.NEXT_PUBLIC_MIDTRANS_CLIENT_KEY}
        strategy="afterInteractive"
      />
      <Button
        onClick={openSnap}
        disabled={disabled || isLoading || !currentToken}
        className="w-full bg-red-600 hover:bg-red-700 text-white font-bold py-4 text-lg"
        size="lg"
      >
        {isLoading ? 'Memproses...' : 'Bayar Sekarang'}
      </Button>
    </>
  );
}
```

### 5.2 `app/(store)/checkout/pending/page.tsx` — Payment Retry Logic
```typescript
'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { MidtransButton } from '@/components/store/checkout/MidtransButton';

export default function CheckoutPendingPage() {
  const params = useSearchParams();
  const orderNumber = params.get('order');
  const [snapToken, setSnapToken] = useState<string | null>(null);
  const [retryDisabled, setRetryDisabled] = useState(false);
  const [message, setMessage] = useState('');

  const handleRetry = async () => {
    const res = await fetch('/api/checkout/retry', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderNumber }),
    });
    const data = await res.json();

    if (!res.ok) {
      setMessage(data.error || 'Gagal memproses pembayaran ulang');
      setRetryDisabled(true);
      return '';
    }

    setSnapToken(data.snapToken);
    return data.snapToken;
  };

  return (
    <div className="max-w-md mx-auto mt-16 text-center px-4">
      <div className="text-6xl mb-4">⏳</div>
      <h1 className="text-2xl font-bold text-gray-900 mb-2">Menunggu Pembayaran</h1>
      <p className="text-gray-600 mb-2">Pesanan #{orderNumber} menunggu pembayaran Anda.</p>
      <p className="text-sm text-amber-600 mb-6">Pembayaran kadaluarsa dalam 15 menit.</p>

      {message && <p className="text-red-600 text-sm mb-4">{message}</p>}

      {!retryDisabled && (
        <Button
          onClick={handleRetry}
          className="w-full bg-amber-500 hover:bg-amber-600 text-white"
        >
          Bayar Lagi
        </Button>
      )}
    </div>
  );
}
```

---

## 6. ORDER TRACKING ENGINE

### 6.1 `app/api/orders/[orderNumber]/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';

export async function GET(
  request: NextRequest,
  { params }: { params: { orderNumber: string } }
) {
  const session = await auth();
  const { searchParams } = new URL(request.url);
  const email = searchParams.get('email'); // For guest tracking

  const order = await db.query.orders.findFirst({
    where: eq(orders.orderNumber, params.orderNumber),
    with: { items: true, user: true },
  });

  if (!order) {
    return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
  }

  // Access control: owner/superadmin can see any order
  // Registered user can see their own orders
  // Guest can see order only if email matches
  const isAdmin = session && ['superadmin', 'owner'].includes(session.user.role);
  const isOwner = session && order.userId === session.user.id;
  const isGuestOwner = !order.userId && email &&
    (order.guestEmail?.toLowerCase() === email.toLowerCase());

  if (!isAdmin && !isOwner && !isGuestOwner) {
    return NextResponse.json({ error: 'Pesanan tidak ditemukan' }, { status: 404 });
  }

  // Courier deep-link
  const courierTrackingUrl = getTrackingUrl(order.courierCode, order.trackingNumber);

  return NextResponse.json({ order: { ...order, courierTrackingUrl } });
}

function getTrackingUrl(courierCode: string | null, trackingNumber: string | null): string | null {
  if (!courierCode || !trackingNumber) return null;
  const urls: Record<string, string> = {
    sicepat: `https://www.sicepat.com/checkAwb?awb=${trackingNumber}`,
    jne: `https://www.jne.co.id/id/tracking/trace/${trackingNumber}`,
    anteraja: `https://anteraja.id/tracking/${trackingNumber}`,
  };
  return urls[courierCode] ?? null;
}
```

---

## 7. PDF RECEIPT ENGINE

### 7.1 `components/pdf/ReceiptDocument.tsx`
```typescript
// Dynamic import this — NEVER in main bundle
import { Document, Page, Text, View, StyleSheet, Image } from '@react-pdf/renderer';

const styles = StyleSheet.create({
  page: { padding: 40, fontFamily: 'Helvetica', fontSize: 10, color: '#1a1a1a' },
  header: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 24 },
  brandName: { fontSize: 20, fontWeight: 'bold', color: '#C8102E' },
  brandSub: { fontSize: 10, color: '#888' },
  orderNumber: { fontSize: 14, fontWeight: 'bold', textAlign: 'right' },
  section: { marginBottom: 16 },
  sectionTitle: { fontSize: 11, fontWeight: 'bold', marginBottom: 6, color: '#C8102E', borderBottomWidth: 1, borderBottomColor: '#eee', paddingBottom: 4 },
  row: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 },
  tableHeader: { flexDirection: 'row', backgroundColor: '#F0EAD6', padding: 6, fontWeight: 'bold' },
  tableRow: { flexDirection: 'row', padding: 6, borderBottomWidth: 1, borderBottomColor: '#f0f0f0' },
  col40: { width: '40%' },
  col20: { width: '20%', textAlign: 'center' },
  col20R: { width: '20%', textAlign: 'right' },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', padding: 6 },
  totalFinal: { fontSize: 13, fontWeight: 'bold', color: '#C8102E' },
  footer: { marginTop: 24, textAlign: 'center', fontSize: 9, color: '#999' },
});

export function ReceiptDocument({ order }: { order: any }) {
  const customerName = order.user?.name || order.guestName;
  const customerEmail = order.user?.email || order.guestEmail;
  const paidDate = order.paidAt
    ? new Date(order.paidAt).toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })
    : '-';

  return (
    <Document>
      <Page size="A4" style={styles.page}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.brandName}>德卡 DEKAKA</Text>
            <Text style={styles.brandSub}>Dapur Dekaka — Frozen Dimsum Premium</Text>
            <Text style={styles.brandSub}>Jl. Sinom V no. 7, Turangga, Bandung</Text>
          </View>
          <View>
            <Text style={styles.orderNumber}>{order.orderNumber}</Text>
            <Text style={{ textAlign: 'right', fontSize: 9, color: '#888', marginTop: 4 }}>
              Tanggal: {paidDate}
            </Text>
          </View>
        </View>

        {/* Customer Info */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Informasi Pembeli</Text>
          <View style={styles.row}><Text>Nama:</Text><Text>{customerName}</Text></View>
          <View style={styles.row}><Text>Email:</Text><Text>{customerEmail}</Text></View>
          {order.deliveryMethod === 'delivery' && (
            <View style={styles.row}>
              <Text>Alamat:</Text>
              <Text style={{ maxWidth: '60%', textAlign: 'right' }}>
                {order.shippingAddressLine}, {order.shippingCity}, {order.shippingProvince} {order.shippingPostalCode}
              </Text>
            </View>
          )}
          {order.deliveryMethod === 'pickup' && (
            <View style={styles.row}><Text>Metode:</Text><Text>Ambil Sendiri di Toko</Text></View>
          )}
        </View>

        {/* Order Items */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Detail Pesanan</Text>
          <View style={styles.tableHeader}>
            <Text style={styles.col40}>Produk</Text>
            <Text style={styles.col20}>Harga</Text>
            <Text style={styles.col20}>Qty</Text>
            <Text style={styles.col20R}>Subtotal</Text>
          </View>
          {order.items.map((item: any) => (
            <View key={item.id} style={styles.tableRow}>
              <Text style={styles.col40}>{item.productName} - {item.variantName}</Text>
              <Text style={styles.col20}>Rp {item.price.toLocaleString('id-ID')}</Text>
              <Text style={styles.col20}>{item.quantity}</Text>
              <Text style={styles.col20R}>Rp {item.subtotal.toLocaleString('id-ID')}</Text>
            </View>
          ))}
        </View>

        {/* Totals */}
        <View style={[styles.section, { borderTopWidth: 1, borderTopColor: '#eee', paddingTop: 12 }]}>
          <View style={styles.totalRow}><Text>Subtotal</Text><Text>Rp {order.subtotal.toLocaleString('id-ID')}</Text></View>
          {order.shippingCost > 0 && (
            <View style={styles.totalRow}><Text>Ongkos Kirim ({order.courierName})</Text><Text>Rp {order.shippingCost.toLocaleString('id-ID')}</Text></View>
          )}
          {order.couponDiscount > 0 && (
            <View style={styles.totalRow}><Text>Diskon Kupon ({order.couponCode})</Text><Text style={{ color: '#16a34a' }}>- Rp {order.couponDiscount.toLocaleString('id-ID')}</Text></View>
          )}
          {order.pointsDiscount > 0 && (
            <View style={styles.totalRow}><Text>Poin Digunakan</Text><Text style={{ color: '#16a34a' }}>- Rp {order.pointsDiscount.toLocaleString('id-ID')}</Text></View>
          )}
          <View style={[styles.totalRow, { marginTop: 8 }]}>
            <Text style={styles.totalFinal}>TOTAL</Text>
            <Text style={styles.totalFinal}>Rp {order.totalAmount.toLocaleString('id-ID')}</Text>
          </View>
          {order.pointsEarned > 0 && (
            <View style={[styles.totalRow, { marginTop: 4 }]}>
              <Text style={{ color: '#d97706', fontSize: 9 }}>🌟 Poin diperoleh dari transaksi ini: +{order.pointsEarned} poin</Text>
            </View>
          )}
        </View>

        {/* Footer */}
        <View style={styles.footer}>
          <Text>Terima kasih telah berbelanja di Dapur Dekaka!</Text>
          <Text>dapurdekaka.com | wa.me/{process.env.NEXT_PUBLIC_WHATSAPP_NUMBER}</Text>
          <Text style={{ marginTop: 4, fontSize: 8 }}>Dokumen ini dibuat secara otomatis dan sah tanpa tanda tangan.</Text>
        </View>
      </Page>
    </Document>
  );
}
```

### 7.2 PDF Download Button (Client Component)
```typescript
'use client';

import { useState } from 'react';
import dynamic from 'next/dynamic';
import { Button } from '@/components/ui/button';

// Dynamically import PDF renderer — NEVER in main bundle
const PDFDownloadLink = dynamic(
  () => import('@react-pdf/renderer').then(mod => mod.PDFDownloadLink),
  { ssr: false }
);
const ReceiptDocument = dynamic(
  () => import('@/components/pdf/ReceiptDocument').then(mod => mod.ReceiptDocument),
  { ssr: false }
);

export function DownloadReceiptButton({ order }: { order: any }) {
  const [isReady, setIsReady] = useState(false);

  return (
    <PDFDownloadLink
      document={<ReceiptDocument order={order} />}
      fileName={`Kwitansi-${order.orderNumber}.pdf`}
    >
      {({ loading }) => (
        <Button variant="outline" disabled={loading}>
          {loading ? 'Menyiapkan PDF...' : '⬇ Unduh Kwitansi'}
        </Button>
      )}
    </PDFDownloadLink>
  );
}
```

---

## 8. ADMIN DASHBOARD ENGINE

### 8.1 `app/(admin)/admin/dashboard/page.tsx` — SSR KPI Dashboard
```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { orders } from '@/lib/db/schema';
import { eq, gte, sum, count, and, ne } from 'drizzle-orm';
import { KPICard } from '@/components/admin/dashboard/KPICard';
import { RevenueChart } from '@/components/admin/dashboard/RevenueChart';
import { RecentOrders } from '@/components/admin/dashboard/RecentOrders';

export default async function AdminDashboardPage() {
  const session = await auth();
  if (!session || !['superadmin', 'owner'].includes(session.user.role)) {
    redirect('/admin/inventory');
  }

  // Last 30 days
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const [revenueResult] = await db
    .select({ total: sum(orders.totalAmount) })
    .from(orders)
    .where(and(
      eq(orders.status, 'paid'),
      gte(orders.createdAt, thirtyDaysAgo)
    ));

  const [orderCountResult] = await db
    .select({ count: count() })
    .from(orders)
    .where(and(
      ne(orders.status, 'cancelled'),
      gte(orders.createdAt, thirtyDaysAgo)
    ));

  const [pendingCount] = await db
    .select({ count: count() })
    .from(orders)
    .where(eq(orders.status, 'pending_payment'));

  const recentOrders = await db.query.orders.findMany({
    orderBy: (o, { desc }) => [desc(o.createdAt)],
    limit: 10,
    with: { items: true },
  });

  return (
    <div className="p-6 space-y-6">
      <h1 className="text-2xl font-bold">Dashboard</h1>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <KPICard
          title="Revenue (30 hari)"
          value={`Rp ${Number(revenueResult?.total ?? 0).toLocaleString('id-ID')}`}
          icon="💰"
        />
        <KPICard
          title="Total Pesanan"
          value={orderCountResult?.count ?? 0}
          icon="📦"
        />
        <KPICard
          title="Menunggu Pembayaran"
          value={pendingCount?.count ?? 0}
          icon="⏳"
          highlight={Number(pendingCount?.count) > 0}
        />
      </div>

      <RecentOrders orders={recentOrders} />
    </div>
  );
}
```

---

## 9. AI CAPTION GENERATOR ENGINE

### 9.1 `app/api/ai/generate-caption/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function POST(request: NextRequest) {
  const session = await auth();
  if (!session || session.user.role !== 'superadmin') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const { productName, productDescription, platform, language } = await request.json();

  const prompt = `
    Kamu adalah content creator food brand Indonesia yang ahli dan berpengalaman.
    Buat caption ${platform === 'tiktok' ? 'TikTok' : 'Instagram'} untuk produk berikut:

    Nama Produk: ${productName}
    Deskripsi: ${productDescription}
    Brand: Dapur Dekaka (德卡) — frozen dimsum premium, warisan Chinese-Indonesian
    Website: dapurdekaka.com

    Requirements:
    - Bahasa: ${language === 'id' ? 'Bahasa Indonesia yang natural, hangat, dan menggiurkan' : 'Engaging English'}
    - Tone: Warm, appetizing, heritage feel — bukan hard selling
    - Length: ${platform === 'tiktok' ? '150-200 kata' : '100-150 kata'}
    - Sertakan call to action ke dapurdekaka.com
    - Pisahkan 15 hashtag yang relevan

    Respond dengan JSON: { "caption": "...", "hashtags": ["#tag1", ...] }
  `;

  try {
    const response = await fetch(
      `${process.env.MINIMAX_BASE_URL}/text/chatcompletion_v2`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${process.env.MINIMAX_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          model: process.env.MINIMAX_MODEL || 'MiniMax-M2.7',
          messages: [{ role: 'user', content: prompt }],
          response_format: { type: 'json_object' },
          temperature: 0.8,
          max_tokens: 1024,
        }),
      }
    );

    if (!response.ok) throw new Error(`Minimax API error: ${response.status}`);

    const data = await response.json();
    const content = data.choices?.?.message?.content;
    if (!content) throw new Error('Empty response from Minimax');

    const parsed = JSON.parse(content);
    return NextResponse.json(parsed);
  } catch (error) {
    console.error('[POST /api/ai/generate-caption]', error);
    return NextResponse.json({ error: 'Caption generation failed' }, { status: 500 });
  }
}
```

---

## 10. AUTHENTICATION FLOW ENGINE

### 10.1 `lib/auth/index.ts` — Complete NextAuth v5 Config
```typescript
import NextAuth from 'next-auth';
import Google from 'next-auth/providers/google';
import Credentials from 'next-auth/providers/credentials';
import { DrizzleAdapter } from '@auth/drizzle-adapter';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';

export const { handlers, auth, signIn, signOut } = NextAuth({
  adapter: DrizzleAdapter(db),
  providers: [
    Google({
      clientId: process.env.AUTH_GOOGLE_ID!,
      clientSecret: process.env.AUTH_GOOGLE_SECRET!,
    }),
    Credentials({
      credentials: {
        email: { type: 'email' },
        password: { type: 'password' },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) return null;

        const user = await db.query.users.findFirst({
          where: eq(users.email, credentials.email as string),
        });

        if (!user || !user.password) return null;
        if (!user.isActive) return null;

        const passwordMatch = await bcrypt.compare(
          credentials.password as string,
          user.password
        );

        if (!passwordMatch) return null;

        return {
          id: user.id,
          name: user.name,
          email: user.email,
          image: user.image,
          role: user.role,
        };
      },
    }),
  ],
  session: {
    strategy: 'database',
    maxAge: 30 * 24 * 60 * 60, // 30 days
  },
  callbacks: {
    async session({ session, user }) {
      // Attach role to session
      const dbUser = await db.query.users.findFirst({
        where: eq(users.id, user.id),
      });
      session.user.id = user.id;
      session.user.role = dbUser?.role ?? 'customer';
      return session;
    },
    async signIn({ user, account }) {
      // Block inactive users
      if (account?.provider === 'credentials') return true;
      // For Google OAuth: auto-create customer account if not exists
      return true;
    },
  },
  pages: {
    signIn: '/auth/login',
    error: '/auth/login',
  },
});
```

### 10.2 `types/next-auth.d.ts` — Extend Session Types
```typescript
import { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: 'customer' | 'b2b' | 'warehouse' | 'owner' | 'superadmin';
    } & DefaultSession['user'];
  }
  interface User {
    role: 'customer' | 'b2b' | 'warehouse' | 'owner' | 'superadmin';
  }
}
```

### 10.3 `app/api/auth/register/route.ts` — Email Registration
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';

const registerSchema = z.object({
  name: z.string().min(3, 'Nama minimal 3 karakter').max(100),
  email: z.string().email('Format email tidak valid'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
});

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const parsed = registerSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
    }

    const { name, email, password } = parsed.data;

    const existing = await db.query.users.findFirst({ where: eq(users.email, email) });
    if (existing) {
      return NextResponse.json({ error: 'Email sudah terdaftar. Silakan login.' }, { status: 409 });
    }

    const hashedPassword = await bcrypt.hash(password, 12);

    await db.insert(users).values({
      name,
      email,
      password: hashedPassword,
      role: 'customer',
      isActive: true,
    });

    return NextResponse.json({ message: 'Akun berhasil dibuat! Silakan login.' }, { status: 201 });
  } catch (error) {
    console.error('[POST /api/auth/register]', error);
    return NextResponse.json({ error: 'Registrasi gagal. Coba lagi.' }, { status: 500 });
  }
}
```

### 10.4 `app/api/auth/forgot-password/route.ts`
```typescript
import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, passwordResetTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import crypto from 'crypto';
import { resend } from '@/lib/resend/client';

export async function POST(request: NextRequest) {
  try {
    const { email } = await request.json();
    const user = await db.query.users.findFirst({ where: eq(users.email, email) });

    // Always return success — don't reveal if email exists
    if (!user || !user.password) {
      return NextResponse.json({ message: 'Jika email terdaftar, link reset akan dikirim.' });
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    await db.insert(passwordResetTokens).values({
      userId: user.id,
      token,
      expiresAt,
    });

    const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password?token=${token}`;

    await resend.emails.send({
      from: `${process.env.RESEND_FROM_NAME} <${process.env.RESEND_FROM_EMAIL}>`,
      to: email,
      subject: 'Reset Password — Dapur Dekaka',
      html: `
        <p>Klik link berikut untuk reset password Anda (berlaku 1 jam):</p>
        <a href="${resetUrl}">${resetUrl}</a>
        <p>Jika Anda tidak meminta reset password, abaikan email ini.</p>
      `,
    });

    return NextResponse.json({ message: 'Jika email terdaftar, link reset akan dikirim.' });
  } catch (error) {
    console.error('[POST /api/auth/forgot-password]', error);
    return NextResponse.json({ error: 'Gagal mengirim email.' }, { status: 500 });
  }
}
```

---

## 11. INTERNATIONALIZATION ENGINE

### 11.1 `i18n/routing.ts`
```typescript
import { defineRouting } from 'next-intl/routing';

export const routing = defineRouting({
  locales: ['id', 'en'],
  defaultLocale: 'id',
  localePrefix: 'as-needed', // /en/products, /products (ID = no prefix)
});
```

### 11.2 `i18n/request.ts`
```typescript
import { getRequestConfig } from 'next-intl/server';
import { routing } from './routing';

export default getRequestConfig(async ({ requestLocale }) => {
  let locale = await requestLocale;
  if (!locale || !routing.locales.includes(locale as any)) {
    locale = routing.defaultLocale;
  }
  return {
    locale,
    messages: (await import(`./messages/${locale}.json`)).default,
  };
});
```

### 11.3 `i18n/messages/id.json` — Core Indonesian Strings
```json
{
  "nav": {
    "products": "Produk",
    "cart": "Keranjang",
    "account": "Akun",
    "blog": "Blog",
    "b2b": "Pemesanan B2B"
  },
  "product": {
    "outOfStock": "Habis",
    "lowStock": "Tersisa {count} pcs",
    "addToCart": "Tambah ke Keranjang",
    "weight": "Berat: {weight}g",
    "halal": "Halal"
  },
  "cart": {
    "empty": "Keranjang kosong",
    "emptySubtitle": "Yuk, mulai tambahkan produk favoritmu!",
    "shopNow": "Belanja Sekarang",
    "total": "Total",
    "checkout": "Lanjut ke Pembayaran"
  },
  "checkout": {
    "guestInfo": "Informasi Pemesan",
    "deliveryMethod": "Metode Pengiriman",
    "delivery": "Kirim ke Alamat",
    "pickup": "Ambil Sendiri",
    "address": "Alamat Pengiriman",
    "shippingOption": "Pilih Layanan Pengiriman",
    "noShipping": "Maaf, pengiriman frozen ke daerah ini belum tersedia. Silakan hubungi WhatsApp kami.",
    "coupon": "Kode Kupon",
    "apply": "Terapkan",
    "points": "Gunakan Poin",
    "pointsBalance": "Saldo Poin: {balance} poin",
    "review": "Ringkasan Pesanan",
    "payNow": "Bayar Sekarang",
    "subtotal": "Subtotal",
    "shipping": "Ongkos Kirim",
    "discount": "Diskon",
    "pointsUsed": "Poin Digunakan",
    "total": "Total Pembayaran"
  },
  "order": {
    "success": "Pesanan Berhasil!",
    "pending": "Menunggu Pembayaran",
    "failed": "Pembayaran Gagal",
    "tryAgain": "Coba Lagi",
    "payAgain": "Bayar Lagi",
    "downloadReceipt": "Unduh Kwitansi",
    "trackOrder": "Lacak Pesanan"
  },
  "status": {
    "pending_payment": "Menunggu Pembayaran",
    "paid": "Dibayar",
    "processing": "Diproses",
    "packed": "Dikemas",
    "shipped": "Dikirim",
    "delivered": "Tiba",
    "cancelled": "Dibatalkan",
    "refunded": "Dikembalikan"
  },
  "errors": {
    "required": "Field ini wajib diisi",
    "invalidEmail": "Format email tidak valid",
    "invalidPhone": "Format nomor HP tidak valid",
    "outOfStock": "Stok tidak mencukupi",
    "serverError": "Terjadi kesalahan. Silakan coba lagi."
  }
}
```

### 11.4 `i18n/messages/en.json` — English Strings
```json
{
  "nav": {
    "products": "Products",
    "cart": "Cart",
    "account": "Account",
    "blog": "Blog",
    "b2b": "B2B Orders"
  },
  "product": {
    "outOfStock": "Out of Stock",
    "lowStock": "Only {count} left",
    "addToCart": "Add to Cart",
    "weight": "Weight: {weight}g",
    "halal": "Halal"
  },
  "cart": {
    "empty": "Your cart is empty",
    "emptySubtitle": "Start adding your favorite products!",
    "shopNow": "Shop Now",
    "total": "Total",
    "checkout": "Proceed to Checkout"
  },
  "checkout": {
    "guestInfo": "Your Information",
    "deliveryMethod": "Delivery Method",
    "delivery": "Ship to Address",
    "pickup": "Store Pickup",
    "address": "Shipping Address",
    "shippingOption": "Select Shipping",
    "noShipping": "Sorry, frozen delivery to your area is not yet available. Please contact us via WhatsApp.",
    "coupon": "Coupon Code",
    "apply": "Apply",
    "points": "Use Points",
    "pointsBalance": "Points Balance: {balance} points",
    "review": "Order Summary",
    "payNow": "Pay Now",
    "subtotal": "Subtotal",
    "shipping": "Shipping",
    "discount": "Discount",
    "pointsUsed": "Points Used",
    "total": "Total Payment"
  },
  "order": {
    "success": "Order Placed!",
    "pending": "Awaiting Payment",
    "failed": "Payment Failed",
    "tryAgain": "Try Again",
    "payAgain": "Pay Again",
    "downloadReceipt": "Download Receipt",
    "trackOrder": "Track Order"
  },
  "status": {
    "pending_payment": "Awaiting Payment",
    "paid": "Paid",
    "processing": "Processing",
    "packed": "Packed",
    "shipped": "Shipped",
    "delivered": "Delivered",
    "cancelled": "Cancelled",
    "refunded": "Refunded"
  },
  "errors": {
    "required": "This field is required",
    "invalidEmail": "Invalid email format",
    "invalidPhone": "Invalid phone number",
    "outOfStock": "Insufficient stock",
    "serverError": "Something went wrong. Please try again."
  }
}
```

---

## 12. INVENTORY MANAGEMENT ENGINE

### 12.1 `app/(admin)/admin/inventory/page.tsx` — Mobile-Optimized
```typescript
import { auth } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { db } from '@/lib/db';
import { productVariants } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { StockEditor } from '@/components/admin/inventory/StockEditor';

export default async function InventoryPage() {
  const session = await auth();
  if (!session || !['superadmin', 'owner', 'warehouse'].includes(session.user.role)) {
    redirect('/auth/login');
  }

  const variants = await db.query.productVariants.findMany({
    where: eq(productVariants.isActive, true),
    with: { product: true },
    orderBy: (v, { asc }) => [asc(v.sku)],
  });

  // Group by product for display
  const grouped = variants.reduce((acc, variant) => {
    const key = variant.productId;
    if (!acc[key]) acc[key] = { product: variant.product, variants: [] };
    acc[key].variants.push(variant);
    return acc;
  }, {} as Record<string, { product: any; variants: typeof variants }>);

  return (
    <div className="p-4 max-w-lg mx-auto">
      <h1 className="text-xl font-bold mb-4">Manajemen Stok</h1>
      <div className="space-y-4">
        {Object.values(grouped).map(({ product, variants }) => (
          <div key={product.id} className="bg-white rounded-xl border p-4 shadow-sm">
            <h2 className="font-semibold text-gray-900 mb-3">{product.name}</h2>
            <div className="space-y-2">
              {variants.map(variant => (
                <StockEditor key={variant.id} variant={variant} />
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### 12.2 `components/admin/inventory/StockEditor.tsx`
```typescript
'use client';

import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

export function StockEditor({ variant }: { variant: any }) {
  const [stock, setStock] = useState(variant.stock);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  const handleSave = async () => {
    setIsSaving(true);
    try {
      const res = await fetch('/api/admin/inventory', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ variantId: variant.id, newStock: stock }),
      });
      if (res.ok) {
        setIsEditing(false);
        setSaved(true);
        setTimeout(() => setSaved(false), 2000);
      }
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="flex items-center gap-3 p-2 rounded-lg bg-gray-50">
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium truncate">{variant.name}</p>
        <p className="text-xs text-gray-500">{variant.sku}</p>
      </div>
      {isEditing ? (
        <div className="flex items-center gap-2">
          <Input
            type="number"
            value={stock}
            onChange={e => setStock(Math.max(0, parseInt(e.target.value) || 0))}
            className="w-20 text-center h-8"
            min={0}
            autoFocus
          />
          <Button size="sm" onClick={handleSave} disabled={isSaving} className="h-8">
            {isSaving ? '...' : 'Simpan'}
          </Button>
          <Button size="sm" variant="outline" onClick={() => { setIsEditing(false); setStock(variant.stock); }} className="h-8">
            Batal
          </Button>
        </div>
      ) : (
        <div className="flex items-center gap-2">
          <Badge
            variant={stock === 0 ? 'destructive' : stock < 5 ? 'secondary' : 'default'}
            className="min-w-[48px] justify-center"
          >
            {stock === 0 ? 'Habis' : `${stock} pcs`}
          </Badge>
          {saved && <span className="text-green-600 text-xs">✓</span>}
          <Button size="sm" variant="outline" onClick={() => setIsEditing(true)} className="h-8">
            Edit
          </Button>
        </div>
      )}
    </div>
  );
}
```

***

*End of ENGINE_IMPLEMENTATION.md*