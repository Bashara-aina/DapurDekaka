'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import nextDynamic from 'next/dynamic';
import { toast } from 'sonner';
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
import { SavedAddressPicker } from '@/components/store/checkout/SavedAddressPicker';
import type { SavedAddress } from '@/components/store/checkout/SavedAddressPicker';
import { ChevronDown, Loader2 } from 'lucide-react';

const MidtransPayment = nextDynamic(
  () => import('@/components/store/checkout/MidtransPayment').then((m) => m.MidtransPayment),
  { ssr: false }
);

interface StoreHours {
  openDays: string;
  openHours: string;
}

const STEPS = [
  { id: 'identity', label: 'Identitas' },
  { id: 'delivery', label: 'Pengiriman' },
  { id: 'courier', label: 'Kurir' },
  { id: 'payment', label: 'Bayar' },
];

const STEPS_PICKUP = [
  { id: 'identity', label: 'Identitas' },
  { id: 'delivery', label: 'Pengiriman' },
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
  const [storeHours, setStoreHours] = useState<StoreHours>({ openDays: 'Senin - Sabtu', openHours: '08.00 - 17.00 WIB' });
  const [serverTotalAmount, setServerTotalAmount] = useState<number>(0);

  // FIX 13: Persist checkout state to sessionStorage so refresh doesn't lose progress
  useEffect(() => {
    const draft = sessionStorage.getItem('checkout-draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        setFormData(parsed.formData);
        setStep(parsed.step || 'identity');
      } catch {
        // ignore corrupt data
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (snapToken) return; // don't save once order is initiated
    sessionStorage.setItem('checkout-draft', JSON.stringify({ formData, step }));
  }, [formData, step, snapToken]);

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
  const [couponType, setCouponType] = useState<string | null>(null);
  const [isFreeShippingCoupon, setIsFreeShippingCoupon] = useState(false);
  const [couponBuyXgetY, setCouponBuyXgetY] = useState<{ buyQuantity: number; getQuantity: number } | null>(null);
  const [shippingOptions, setShippingOptions] = useState<ShippingOption[]>([]);
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [usePoints, setUsePoints] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);
  const [showAddressPicker, setShowAddressPicker] = useState(false);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);
  const [showOrderReview, setShowOrderReview] = useState(false);

  const { data: pointsData } = useQuery({
    queryKey: ['account', 'points'],
    queryFn: async () => {
      const res = await fetch('/api/account/points');
      const json = await res.json();
      return json.success ? json.data : { balance: 0, history: [], expiringCount: 0 };
    },
    enabled: !!session?.user,
  });

  // FIX 4: Fetch profile to pre-fill phone number for logged-in users
  const { data: profileData } = useQuery({
    queryKey: ['account', 'profile'],
    queryFn: async () => {
      const res = await fetch('/api/account/profile');
      const json = await res.json();
      return json.success ? json.data : null;
    },
    enabled: !!session?.user,
  });

  const pointsBalance = pointsData?.balance ?? 0;

  // Auto-skip identity step for logged-in users (name + email from session)
  useEffect(() => {
    if (session?.user && step === 'identity') {
      updateForm({
        recipientName: session.user.name || '',
        recipientEmail: session.user.email || '',
      });
      setStep('delivery');
      // Sync local cart to DB for logged-in user
      const syncCart = useCartStore.getState().syncToDb;
      syncCart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user]);

  // Pre-fill phone from profile data (separate effect so it doesn't race with auto-skip)
  useEffect(() => {
    if (profileData?.phone) {
      updateForm({ recipientPhone: profileData.phone });
    }
  }, [profileData]);

  // Fetch saved addresses when logged-in user reaches delivery step
  const { data: addressesData } = useQuery({
    queryKey: ['account', 'addresses'],
    queryFn: async () => {
      const res = await fetch('/api/account/addresses');
      const json = await res.json();
      return json.success ? json.data : [];
    },
    enabled: !!session?.user && step === 'delivery',
  });

  // Sync saved addresses when data changes
  useEffect(() => {
    if (addressesData) {
      setSavedAddresses(addressesData as SavedAddress[]);
    }
  }, [addressesData]);

  // Fetch store hours from system settings
  useEffect(() => {
    async function fetchStoreHours() {
      try {
        const res = await fetch('/api/settings/public');
        const json = await res.json();
        if (json.success && json.data) {
          const openDays = json.data.store_open_days?.value ?? 'Senin - Sabtu';
          const openHours = json.data.store_opening_hours?.value ?? '08.00 - 17.00 WIB';
          setStoreHours({ openDays, openHours });
        }
      } catch {
        // Use defaults on error
      }
    }
    fetchStoreHours();
  }, []);

  const activeSteps = formData.deliveryMethod === 'pickup' ? STEPS_PICKUP : STEPS;

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
    ? formData.pointsUsed * POINTS_VALUE_IDR
    : 0;
  const effectiveShippingCost = isFreeShippingCoupon && formData.deliveryMethod === 'delivery'
    ? 0
    : formData.shippingCost;
  const totalAmount = subtotal - couponDiscount - pointsDiscount + effectiveShippingCost;

  const updateForm = (updates: Partial<CheckoutFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  // Step 1: Identity
  const handleIdentitySubmit = (data: IdentityFormData) => {
    updateForm({
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail,
      recipientPhone: data.recipientPhone,
      customerNote: data.customerNote || '',
    });
    setStep('delivery');
  };

  // Step 2: Delivery method
  const handleDeliveryMethodChange = async (method: 'delivery' | 'pickup') => {
    updateForm({ deliveryMethod: method, shippingCost: 0 });
    if (method === 'pickup' && step === 'courier') {
      setStep('delivery');
    }
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
        toast.error(data.error || 'Gagal menghitung ongkir');
        setLoadingShipping(false);
        return;
      }

      setShippingOptions(data.data.services);
      setStep('courier');
    } catch {
      toast.error('Gagal menghitung ongkir');
    }
    setLoadingShipping(false);
  };

  const fetchShippingCost = async (cityId: string) => {
    try {
      const res = await fetch('/api/shipping/cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: cityId, weight: totalWeight }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || 'Gagal menghitung ongkir');
        setLoadingShipping(false);
        return;
      }
      setShippingOptions(data.data.services);
      setStep('courier');
    } catch {
      toast.error('Gagal menghitung ongkir');
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
        body: JSON.stringify({ code: formData.couponCode, subtotal, userId: session?.user?.id ?? null }),
      });
      const data = await res.json();

      if (!data.success) {
        setCouponError(data.error || 'Kupon tidak valid');
        setCouponDiscount(0);
        setCouponType(null);
        setCouponBuyXgetY(null);
        setIsFreeShippingCoupon(false);
        return;
      }

      setCouponDiscount(data.data.discountAmount);
      setCouponType(data.data.type ?? null);
      setCouponBuyXgetY(data.data.buyXgetY ?? null);
      setCouponError('');
      setIsFreeShippingCoupon(data.data.type === 'free_shipping');
    } catch {
      setCouponError('Gagal validasi kupon');
    }
  };

  const handlePointsToggle = (use: boolean) => {
    setUsePoints(use);
    if (!use) {
      updateForm({ pointsUsed: 0 });
    } else {
      // Calculate max points based on 50% of subtotal-cap, converted from IDR to points (1pt = 10 IDR)
      const maxPointsInIDR = Math.floor((subtotal - couponDiscount) * 0.5);
      const maxPointsFromIDR = Math.floor(maxPointsInIDR / 10); // 1pt = 10 IDR
      const maxPoints = Math.min(pointsBalance, maxPointsFromIDR);
      const pointsToUse = Math.floor(maxPoints / POINTS_MIN_REDEEM) * POINTS_MIN_REDEEM; // Round to min 100
      updateForm({ pointsUsed: pointsToUse });
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
        toast.error(data.error || 'Gagal membuat pesanan');
        setIsLoading(false);
        return;
      }

      // Handle Net-30 B2B orders (skip Midtrans, go directly to success)
      if (data.data.net30) {
        clearCart();
        router.push(`/checkout/success?order=${data.data.orderNumber}&net30=1`);
        return;
      }

      setSnapToken(data.data.snapToken);
      setOrderNumber(data.data.orderNumber);
      setServerTotalAmount(data.data.totalAmount);
    } catch {
      toast.error('Gagal membuat pesanan');
      setIsLoading(false);
    }
  };

  const handleMidtransSuccess = () => {
    clearCart();
    router.push(`/checkout/success?order=${orderNumber}`);
  };

  // Step back navigation
  const handleBack = () => {
    const stepOrder = activeSteps.map(s => s.id);
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex > 0) {
      setStep(stepOrder[currentIndex - 1] as CheckoutStep);
    }
  };

  const currentStepIndex = activeSteps.findIndex((s) => s.id === step);

  return (
    <div className="min-h-screen bg-brand-cream pb-24 md:pb-0">
      {/* FIX 11: Mobile sticky total bar */}
      <div className="lg:hidden sticky top-[76px] z-10 bg-white border-b border-brand-cream-dark px-4 py-2 flex justify-between text-sm">
        <span className="text-text-secondary">{items.reduce((acc, i) => acc + i.quantity, 0)} item</span>
        <span className="font-bold text-brand-red">{formatIDR(totalAmount)}</span>
      </div>

      {/* Header with stepper */}
      <div className="bg-white border-b border-brand-cream-dark sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <h1 className="font-display text-xl font-bold">Checkout</h1>
          <div className="mt-4">
            <CheckoutStepper
              steps={activeSteps}
              currentStepId={step}
              onStepClick={(stepId) => {
                // Only allow going back to completed steps
                const stepOrder = activeSteps.map(s => s.id);
                const targetIndex = stepOrder.indexOf(stepId);
                const currentIndex = stepOrder.indexOf(step);
                if (targetIndex < currentIndex) {
                  setStep(stepId as CheckoutStep);
                }
              }}
            />
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main form area */}
          <div className="lg:col-span-2">
            {step === 'identity' && (
              <>
                <IdentityForm
                  defaultValues={{
                    recipientName: formData.recipientName || session?.user?.name || '',
                    recipientEmail: formData.recipientEmail || session?.user?.email || '',
                    recipientPhone: formData.recipientPhone || '',
                    customerNote: formData.customerNote,
                  }}
                  onSubmit={handleIdentitySubmit}
                  onBack={handleBack}
                />
                {!session?.user && (
                  <p className="mt-4 text-center text-sm text-text-secondary">
                    Sudah punya akun?{' '}
                    <Link href={`/login?callbackUrl=${encodeURIComponent('/checkout')}`} className="text-brand-red font-medium hover:underline">
                      Masuk di sini
                    </Link>
                  </p>
                )}
              </>
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
                    {loadingShipping && (
                      <div className="bg-white rounded-card p-6 shadow-card mb-4">
                        <div className="flex items-center justify-center py-12">
                          <Loader2 className="w-6 h-6 animate-spin text-brand-red" />
                          <span className="ml-2 text-text-secondary">Menghitung ongkir...</span>
                        </div>
                      </div>
                    )}
                    {session?.user && savedAddresses.length > 0 && !showNewAddressForm ? (
                      <>
                        <SavedAddressPicker
                          addresses={savedAddresses}
                          selectedId={selectedSavedAddressId}
                          onSelect={(address) => {
                            if (address === null) {
                              setShowNewAddressForm(true);
                            } else {
                              setSelectedSavedAddressId(address.id);
                              updateForm({
                                addressLine: address.addressLine,
                                district: address.district,
                                city: address.city,
                                cityId: address.cityId,
                                province: address.province,
                                provinceId: address.provinceId,
                                postalCode: address.postalCode,
                              });
                            }
                          }}
                          onBack={handleBack}
                        />
                        <button
                  type="button"
                  onClick={() => {
                    if (!selectedSavedAddressId) return;
                    setLoadingShipping(true);
                    const address = savedAddresses.find(a => a.id === selectedSavedAddressId);
                    if (address) {
                      updateForm({
                        addressLine: address.addressLine,
                        district: address.district,
                        city: address.city,
                        cityId: address.cityId,
                        province: address.province,
                        provinceId: address.provinceId,
                        postalCode: address.postalCode,
                      });
                      fetchShippingCost(address.cityId);
                    }
                  }}
                  disabled={!selectedSavedAddressId || loadingShipping}
                  className="w-full h-12 bg-brand-red text-white font-bold rounded-button mt-4 disabled:opacity-50"
                >
                  {loadingShipping ? 'Menghitung ongkir...' : 'Lanjut ke Kurir'}
                </button>
                      </>
                    ) : (
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
                        onSubmit={(data) => {
                          setShowNewAddressForm(false);
                          handleAddressSubmit(data);
                        }}
                        onBack={() => {
                          if (session?.user && savedAddresses.length > 0) {
                            setShowNewAddressForm(false);
                            setShowAddressPicker(true);
                          } else {
                            handleBack();
                          }
                        }}
                      />
                    )}
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
                      <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
                        <h3 className="font-semibold text-green-800 mb-2">📍 Lokasi Pengambilan</h3>
                        <p className="text-sm text-green-700 mb-1">
                          <strong>Dapur Dekaka</strong><br/>
                          Jl. Sinom V No. 7, Turangga<br/>
                          Bandung, Jawa Barat
                        </p>
                        <p className="text-xs text-green-600 mt-2">
                          {storeHours.openDays}: {storeHours.openHours}<br/>
                        </p>
                      </div>
                      <div className="flex gap-4 mt-4">
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

                {/* Order Review Collapsible */}
                <button
                  type="button"
                  onClick={() => setShowOrderReview(!showOrderReview)}
                  className="w-full flex items-center justify-between py-3 border-b border-brand-cream-dark mb-4"
                  aria-expanded={showOrderReview}
                >
                  <span className="font-medium text-sm text-text-primary">Review Pesanan</span>
                  <ChevronDown className={cn('w-4 h-4 text-text-secondary transition-transform', showOrderReview && 'rotate-180')} />
                </button>

                {showOrderReview && (
                  <div className="mb-6 p-4 bg-brand-cream rounded-lg text-sm space-y-2">
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Penerima</span>
                      <span className="font-medium">{formData.recipientName}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-text-secondary">No. HP</span>
                      <span className="font-medium">{formData.recipientPhone}</span>
                    </div>
                    {formData.deliveryMethod === 'delivery' && (
                      <>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Alamat</span>
                          <span className="font-medium text-right max-w-[60%]">
                            {formData.addressLine}, {formData.district}, {formData.city}, {formData.province}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-text-secondary">Kurir</span>
                          <span className="font-medium">{formData.courierName} {formData.courierService}</span>
                        </div>
                      </>
                    )}
                    {formData.deliveryMethod === 'pickup' && (
                      <div className="flex justify-between">
                        <span className="text-text-secondary">Metode</span>
                        <span className="font-medium">Ambil di Toko</span>
                      </div>
                    )}
                    <div className="border-t border-brand-cream-dark pt-2 mt-2 space-y-1">
                      <div className="flex justify-between text-xs text-text-secondary">
                        <span>Subtotal</span>
                        <span>{formatIDR(subtotal)}</span>
                      </div>
                      {couponDiscount > 0 && (
                        <div className="flex justify-between text-xs text-success">
                          <span>Diskon</span>
                          <span>-{formatIDR(couponDiscount)}</span>
                        </div>
                      )}
                      {pointsDiscount > 0 && (
                        <div className="flex justify-between text-xs text-success">
                          <span>Points ({formData.pointsUsed} pt)</span>
                          <span>-{formatIDR(pointsDiscount)}</span>
                        </div>
                      )}
                      {formData.shippingCost > 0 && (
                        <div className="flex justify-between text-xs text-text-secondary">
                          <span>Ongkir</span>
                          <span>{formatIDR(formData.shippingCost)}</span>
                        </div>
                      )}
                      <div className="flex justify-between font-bold text-brand-red pt-1">
                        <span>Total Bayar</span>
                        <span>{formatIDR(totalAmount)}</span>
                      </div>
                    </div>
                  </div>
                )}

                {/* Coupon */}
                <div role="alert" aria-live="polite" className="mb-6">
                  <CouponInput
                    code={formData.couponCode}
                    onCodeChange={(code) => updateForm({ couponCode: code })}
                    onClearError={() => setCouponError('')}
                    onApply={handleApplyCoupon}
                    discountAmount={couponDiscount}
                    error={couponError}
                    isLoading={false}
                  />
                  {couponType === 'buy_x_get_y' && couponBuyXgetY && (
                    <div className="mt-2 p-3 bg-green-50 border border-green-200 rounded-lg">
                      <p className="text-sm text-green-700">
                        <span className="font-semibold">Kupon gratis item aktif!</span>
                        <br />
                        Beli {couponBuyXgetY.buyQuantity} item, dapat {couponBuyXgetY.getQuantity} item gratis otomatis.
                      </p>
                    </div>
                  )}
                </div>

                {/* Points */}
                <div role="status" aria-live="polite" className="mb-6">
                  <PointsRedeemer
                    pointsBalance={pointsBalance}
                    subtotal={subtotal - couponDiscount}
                    usedPoints={formData.pointsUsed}
                    onToggle={handlePointsToggle}
                  />
                </div>


                // FIX 4: Payment button shows client total pre-order with note
                <button
                  type="button"
                  onClick={handleBack}
                  className="text-sm text-text-secondary hover:underline mb-4 text-left"
                >
                  ← Kembali ke Kurir
                </button>

                <button
                  type="button"
                  onClick={handlePlaceOrder}
                  disabled={isLoading}
                  className="w-full h-14 bg-brand-red text-white font-bold rounded-button disabled:opacity-50"
                >
                  {isLoading ? 'Memproses...' : `Bayar Sekarang — ${formatIDR(totalAmount)}`}
                  <span className="block text-xs font-normal mt-0.5 opacity-80">(dikonfirmasi setelah pesanan dibuat)</span>
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
            onPending: () => router.push(`/checkout/pending?order=${orderNumber}`),
            onError: () => {
              setSnapToken(null);
              setIsLoading(false);
              toast.error('Pembayaran gagal. Silakan coba lagi.');
            },
            onClose: () => {
              setSnapToken(null);
              setIsLoading(false);
            },
          }}
        />
      )}
    </div>
  );
}