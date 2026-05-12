'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import nextDynamic from 'next/dynamic';
import { useCartStore } from '@/store/cart.store';
import { formatIDR } from '@/lib/utils/format-currency';
import { cn } from '@/lib/utils/cn';
import { POINTS_MIN_REDEEM, POINTS_VALUE_IDR } from '@/lib/constants/points';

import { CheckoutStepper } from '@/components/store/checkout/CheckoutStepper';
import { IdentityForm } from '@/components/store/checkout/IdentityForm';
import type { IdentityFormData } from '@/components/store/checkout/IdentityForm';
import { DeliveryMethodToggle } from '@/components/store/checkout/DeliveryMethodToggle';
import { AddressForm } from '@/components/store/checkout/AddressForm';
import { ShippingOptions } from '@/components/store/checkout/ShippingOptions';
import type { ShippingOption } from '@/components/store/checkout/ShippingOptions';
import { CouponInput } from '@/components/store/checkout/CouponInput';
import { PointsRedeemer } from '@/components/store/checkout/PointsRedeemer';
import { OrderSummaryCard } from '@/components/store/checkout/OrderSummaryCard';
import { EmptyState } from '@/components/store/common/EmptyState';

const MidtransPayment = nextDynamic(
  () => import('@/components/store/checkout/MidtransPayment').then((m) => m.MidtransPayment),
  { ssr: false }
);

const STEPS = [
  { id: 'identity', label: 'Identitas' },
  { id: 'delivery', label: 'Pengiriman' },
  { id: 'courier', label: 'Kurir' },
  { id: 'payment', label: 'Bayar' },
];

type CheckoutStep = 'identity' | 'delivery' | 'courier' | 'payment';

interface CheckoutFormData {
  recipientName: string;
  recipientEmail: string;
  recipientPhone: string;
  deliveryMethod: 'delivery' | 'pickup';
  addressLine: string;
  district: string;
  city: string;
  cityId: string;
  province: string;
  provinceId: string;
  postalCode: string;
  courierCode: string;
  courierService: string;
  courierName: string;
  shippingCost: number;
  couponCode: string;
  pointsUsed: number;
  customerNote: string;
}

export default function CheckoutPage() {
  const router = useRouter();
  const { data: session } = useSession();
  const items = useCartStore((s) => s.items);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const getTotalWeight = useCartStore((s) => s.getTotalWeight);
  const clearCart = useCartStore((s) => s.clearCart);

  const [step, setStep] = useState<CheckoutStep>('identity');
  const [isLoading, setIsLoading] = useState(false);
  const [snapToken, setSnapToken] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);

  const [formData, setFormData] = useState<CheckoutFormData>({
    recipientName: '',
    recipientEmail: '',
    recipientPhone: '',
    deliveryMethod: 'delivery',
    addressLine: '',
    district: '',
    city: '',
    cityId: '',
    province: '',
    provinceId: '',
    postalCode: '',
    courierCode: '',
    courierService: '',
    courierName: '',
    shippingCost: 0,
    couponCode: '',
    pointsUsed: 0,
    customerNote: '',
  });

  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [usePoints, setUsePoints] = useState(false);
  // TODO: Fetch points balance from DB for logged-in users
  const pointsBalance = session?.user ? 0 : 0;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-brand-cream">
        <EmptyState
          variant="cart"
          title="Keranjangmu kosong"
          description="Tambahkan produk terlebih dahulu"
          action={{ label: 'Mulai Belanja', href: '/products' }}
        />
      </div>
    );
  }

  const subtotal = getSubtotal();
  const totalWeight = getTotalWeight();
  const pointsDiscount = usePoints && formData.pointsUsed > 0
    ? Math.floor(formData.pointsUsed / POINTS_VALUE_IDR) * POINTS_VALUE_IDR
    : 0;
  const totalAmount = subtotal - couponDiscount - pointsDiscount + formData.shippingCost;

  const updateForm = (updates: Partial<CheckoutFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  // Step 1: Identity
  const handleIdentitySubmit = (data: IdentityFormData) => {
    updateForm({
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail,
      recipientPhone: data.recipientPhone,
    });
    setStep('delivery');
  };

  // Step 2: Delivery method
  const handleDeliveryMethodChange = async (method: 'delivery' | 'pickup') => {
    updateForm({ deliveryMethod: method, shippingCost: 0 });
  };

  const handleAddressSubmit = async (addressData: {
    addressLine: string;
    district: string;
    city: string;
    cityId: string;
    province: string;
    provinceId: string;
    postalCode?: string;
  }) => {
    updateForm(addressData);

    if (formData.deliveryMethod === 'pickup') {
      setStep('payment');
      return;
    }

    // Fetch shipping costs
    setLoadingShipping(true);
    try {
      const res = await fetch('/api/shipping/cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: addressData.cityId, weight: totalWeight }),
      });
      const data = await res.json();

      if (!data.success) {
        alert(data.error || 'Gagal menghitung ongkir');
        setLoadingShipping(false);
        return;
      }

      setShippingOptions(data.data.services);
      setStep('courier');
    } catch {
      alert('Gagal menghitung ongkir');
    }
    setLoadingShipping(false);
  };

  // Step 3: Courier selection
  const handleCourierSelect = (option: ShippingOption) => {
    updateForm({
      courierCode: option.courier,
      courierService: option.service,
      courierName: option.displayName,
      shippingCost: option.cost,
    });
    setStep('payment');
  };

  // Step 4: Payment
  const handleApplyCoupon = async () => {
    if (!formData.couponCode) return;

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code: formData.couponCode, subtotal }),
      });
      const data = await res.json();

      if (!data.success) {
        setCouponError(data.error || 'Kupon tidak valid');
        setCouponDiscount(0);
        return;
      }

      setCouponDiscount(data.data.discountAmount);
      setCouponError('');
    } catch {
      setCouponError('Gagal validasi kupon');
    }
  };

  const handlePointsToggle = (use: boolean) => {
    setUsePoints(use);
    if (!use) {
      updateForm({ pointsUsed: 0 });
    }
  };

  const handlePlaceOrder = async () => {
    setIsLoading(true);

    try {
      const res = await fetch('/api/checkout/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: items.map((item) => ({
            variantId: item.variantId,
            productId: item.productId,
            productNameId: item.productNameId,
            productNameEn: item.productNameEn,
            variantNameId: item.variantNameId,
            variantNameEn: item.variantNameEn,
            sku: item.sku,
            imageUrl: item.imageUrl,
            unitPrice: item.unitPrice,
            quantity: item.quantity,
            weightGram: item.weightGram,
          })),
          ...formData,
          subtotal,
          discountAmount: couponDiscount,
          pointsDiscount,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        alert(data.error || 'Gagal membuat pesanan');
        setIsLoading(false);
        return;
      }

      setSnapToken(data.data.snapToken);
      setOrderNumber(data.data.orderNumber);
    } catch {
      alert('Gagal membuat pesanan');
      setIsLoading(false);
    }
  };

  const handleMidtransSuccess = () => {
    clearCart();
  };

  // Step back navigation
  const handleBack = () => {
    switch (step) {
      case 'payment':
        setStep(formData.deliveryMethod === 'pickup' ? 'delivery' : 'courier');
        break;
      case 'courier':
        setStep('delivery');
        break;
      case 'delivery':
        setStep('identity');
        break;
    }
  };

  const currentStepIndex = STEPS.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen bg-brand-cream pb-24 md:pb-0">
      {/* Header with stepper */}
      <div className="bg-white border-b border-brand-cream-dark sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <h1 className="font-display text-xl font-bold">Checkout</h1>
          <div className="mt-4">
            <CheckoutStepper steps={STEPS} currentStepId={step} />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main form area */}
          <div className="lg:col-span-2">
            {step === 'identity' && (
              <IdentityForm
                defaultValues={{
                  recipientName: formData.recipientName,
                  recipientEmail: formData.recipientEmail,
                  recipientPhone: formData.recipientPhone,
                }}
                onSubmit={handleIdentitySubmit}
              />
            )}

            {step === 'delivery' && (
              <>
                <DeliveryMethodToggle
                  value={formData.deliveryMethod}
                  onChange={handleDeliveryMethodChange}
                  onBack={handleBack}
                />

                {formData.deliveryMethod === 'delivery' && (
                  <div className="mt-4">
                    <AddressForm
                      defaultValues={{
                        addressLine: formData.addressLine,
                        district: formData.district,
                        city: formData.city,
                        cityId: formData.cityId,
                        province: formData.province,
                        provinceId: formData.provinceId,
                        postalCode: formData.postalCode,
                      }}
                      onSubmit={handleAddressSubmit}
                      onBack={handleBack}
                    />
                  </div>
                )}

                {formData.deliveryMethod === 'pickup' && (
                  <div className="mt-4">
                    <div className="bg-white rounded-card p-6 shadow-card">
                      <h2 className="font-semibold text-lg mb-4">Ambil di Toko</h2>
                      <p className="text-text-secondary mb-4">
                        Setelah pembayaran berhasil, Anda akan mendapat instruksi pengambilan.
                        Tunjukkan nomor pesanan ke staff toko.
                      </p>
                      <div className="flex gap-4">
                        <button
                          type="button"
                          onClick={handleBack}
                          className="flex-1 h-12 border border-brand-cream-dark text-text-primary font-medium rounded-button"
                        >
                          Kembali
                        </button>
                        <button
                          type="button"
                          onClick={() => setStep('payment')}
                          className="flex-1 h-12 bg-brand-red text-white font-bold rounded-button"
                        >
                          Lanjut ke Pembayaran
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </>
            )}

            {step === 'courier' && (
              <ShippingOptions
                options={shippingOptions}
                selected={
                  formData.courierCode
                    ? {
                        courier: formData.courierCode,
                        service: formData.courierService,
                        displayName: formData.courierName,
                        cost: formData.shippingCost,
                        estimatedDays: '',
                      }
                    : null
                }
                onSelect={handleCourierSelect}
                onBack={handleBack}
                isLoading={loadingShipping}
              />
            )}

            {step === 'payment' && (
              <div className="bg-white rounded-card p-6 shadow-card">
                <h2 className="font-semibold text-lg mb-4">Pembayaran</h2>

                {/* Coupon */}
                <div className="mb-6">
                  <CouponInput
                    code={formData.couponCode}
                    onCodeChange={(code) => updateForm({ couponCode: code })}
                    onApply={handleApplyCoupon}
                    discountAmount={couponDiscount}
                    error={couponError}
                    isLoading={false}
                  />
                </div>

                {/* Points */}
                {session?.user && pointsBalance >= POINTS_MIN_REDEEM && (
                  <div className="mb-6">
                    <PointsRedeemer
                      pointsBalance={pointsBalance}
                      subtotal={subtotal - couponDiscount}
                      usedPoints={usePoints ? Math.min(pointsBalance, Math.floor((subtotal - couponDiscount) * 0.5 / POINTS_VALUE_IDR) * POINTS_VALUE_IDR) : 0}
                      onToggle={handlePointsToggle}
                    />
                  </div>
                )}

                {/* Customer note */}
                <div className="mb-6">
                  <label className="block text-sm font-medium mb-2">
                    Catatan Pesanan (opsional)
                  </label>
                  <textarea
                    value={formData.customerNote}
                    onChange={(e) => updateForm({ customerNote: e.target.value })}
                    className="w-full px-3 py-2 border border-brand-cream-dark rounded-lg focus:border-brand-red focus:ring-2 focus:ring-brand-red/10 outline-none"
                    rows={2}
                    placeholder="Contoh: Tanpa sambal, pisahkan dengan kuah"
                  />
                </div>

                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full h-12 border border-brand-cream-dark text-text-primary font-medium rounded-button mb-4"
                >
                  Kembali
                </button>

                <button
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={isLoading}
                  className="w-full h-14 bg-brand-red text-white font-bold rounded-button disabled:opacity-50"
                >
                  {isLoading ? 'Memproses...' : `Bayar Sekarang — ${formatIDR(totalAmount)}`}
                </button>
              </div>
            )}
          </div>

          {/* Order summary sidebar */}
          <div className="lg:col-span-1">
            <OrderSummaryCard
              items={items}
              subtotal={subtotal}
              discountAmount={couponDiscount}
              shippingCost={formData.shippingCost}
              pointsDiscount={pointsDiscount}
              totalAmount={totalAmount}
            />
          </div>
        </div>
      </div>

      {/* Midtrans Payment Modal */}
      {snapToken && orderNumber && (
        <MidtransPayment
          snapToken={snapToken}
          callbacks={{
            onSuccess: handleMidtransSuccess,
          }}
        />
      )}
    </div>
  );
}