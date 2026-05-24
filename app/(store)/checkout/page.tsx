'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import nextDynamic from 'next/dynamic';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useCartStore } from '@/store/cart.store';
import { formatIDR } from '@/lib/utils/format-currency';
import { POINTS_MIN_REDEEM, POINTS_VALUE_IDR } from '@/lib/constants/points';

export const dynamic = 'force-dynamic';

import { CheckoutStepper } from '@/components/store/checkout/CheckoutStepper';
import { IdentityForm } from '@/components/store/checkout/IdentityForm';
import type { IdentityFormData } from '@/components/store/checkout/IdentityForm';
import { DeliveryMethodToggle } from '@/components/store/checkout/DeliveryMethodToggle';
import { ShippingOptions } from '@/components/store/checkout/ShippingOptions';
import type { ShippingOption } from '@/components/store/checkout/ShippingOptions';
import { OrderSummaryCard } from '@/components/store/checkout/OrderSummaryCard';
import { EmptyState } from '@/components/store/common/EmptyState';
import { PaymentStep } from '@/components/store/checkout/PaymentStep';
import { PickupInfoPanel } from '@/components/store/checkout/PickupInfoPanel';
import { CheckoutAddressStep } from '@/components/store/checkout/CheckoutAddressStep';
import type { SavedAddress } from '@/components/store/checkout/SavedAddressPicker';

const MidtransPayment = nextDynamic(
  () => import('@/components/store/checkout/MidtransPayment').then((m) => m.MidtransPayment),
  { ssr: false }
);

interface StoreHours {
  openDays: string;
  openHours: string;
}

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
  const t = useTranslations('checkout');
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
  const [pickupAddress, setPickupAddress] = useState<string | null>(null);
  const [serverTotalAmount, setServerTotalAmount] = useState<number>(0);
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
    if (snapToken) return;
    sessionStorage.setItem('checkout-draft', JSON.stringify({ formData, step }));
  }, [formData, step, snapToken]);

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

  const { data: pointsData } = useQuery({
    queryKey: ['account', 'points'],
    queryFn: async () => {
      const res = await fetch('/api/account/points');
      const json = await res.json();
      return json.success ? json.data : { balance: 0, history: [], expiringCount: 0 };
    },
    enabled: !!session?.user,
  });

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

  useEffect(() => {
    if (session?.user && step === 'identity') {
      updateForm({
        recipientName: session.user.name || '',
        recipientEmail: session.user.email || '',
      });
      setStep('delivery');
      const syncCart = useCartStore.getState().syncToDb;
      syncCart();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.user]);

  useEffect(() => {
    if (profileData?.phone) {
      updateForm({ recipientPhone: profileData.phone });
    }
  }, [profileData]);

  const { data: addressesData } = useQuery({
    queryKey: ['account', 'addresses'],
    queryFn: async () => {
      const res = await fetch('/api/account/addresses');
      const json = await res.json();
      return json.success ? json.data : [];
    },
    enabled: !!session?.user && step === 'delivery',
  });

  useEffect(() => {
    if (addressesData) {
      setSavedAddresses(addressesData as SavedAddress[]);
    }
  }, [addressesData]);

  useEffect(() => {
    async function fetchStoreSettings() {
      try {
        const res = await fetch('/api/settings/public');
        const json = await res.json();
        if (json.success && json.data) {
          setStoreHours({
            openDays: json.data.store_open_days ?? 'Senin - Sabtu',
            openHours: json.data.store_opening_hours ?? '08.00 - 17.00 WIB',
          });
          setPickupAddress(json.data.store_address ?? null);
        }
      } catch {
        // Use defaults on error
      }
    }
    fetchStoreSettings();
  }, []);

  const stepsDelivery = [
    { id: 'identity', label: t('stepIdentity') },
    { id: 'delivery', label: t('stepDelivery') },
    { id: 'courier', label: t('stepCourier') },
    { id: 'payment', label: t('stepPayment') },
  ];

  const stepsPickup = [
    { id: 'identity', label: t('stepIdentity') },
    { id: 'delivery', label: t('stepDelivery') },
    { id: 'payment', label: t('stepPayment') },
  ];

  const activeSteps = formData.deliveryMethod === 'pickup' ? stepsPickup : stepsDelivery;

  if (items.length === 0) {
    return (
      <div className="min-h-screen bg-brand-cream">
        <EmptyState
          variant="cart"
          title={t('cartEmpty')}
          description={t('cartEmptySubtitle')}
          action={{ label: t('startShopping'), href: '/products' }}
        />
      </div>
    );
  }

  const subtotal = getSubtotal();
  const totalWeight = getTotalWeight();
  const pointsDiscount = usePoints && formData.pointsUsed > 0
    ? formData.pointsUsed * POINTS_VALUE_IDR
    : 0;
  const totalAmount = subtotal - couponDiscount - pointsDiscount + formData.shippingCost;

  const updateForm = (updates: Partial<CheckoutFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  };

  const handleIdentitySubmit = (data: IdentityFormData) => {
    updateForm({
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail,
      recipientPhone: data.recipientPhone,
      customerNote: data.customerNote || '',
    });
    setStep('delivery');
  };

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

    setLoadingShipping(true);
    try {
      const res = await fetch('/api/shipping/cost', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ destination: addressData.cityId, weight: totalWeight }),
      });
      const data = await res.json();

      if (!data.success) {
        toast.error(data.error || t('shippingCostError'));
        setLoadingShipping(false);
        return;
      }

      setShippingOptions(data.data.services);
      setStep('courier');
    } catch {
      toast.error(t('shippingCostError'));
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
        toast.error(data.error || t('shippingCostError'));
        setLoadingShipping(false);
        return;
      }
      setShippingOptions(data.data.services);
      setStep('courier');
    } catch {
      toast.error(t('shippingCostError'));
    }
    setLoadingShipping(false);
  };

  const handleCourierSelect = (option: ShippingOption) => {
    updateForm({
      courierCode: option.courier,
      courierService: option.service,
      courierName: option.displayName,
      shippingCost: option.cost,
    });
    setStep('payment');
  };

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
        setCouponError(data.error || t('couponNotValid'));
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
      setCouponError(t('couponValidateError'));
    }
  };

  const handlePointsToggle = (use: boolean) => {
    setUsePoints(use);
    if (!use) {
      updateForm({ pointsUsed: 0 });
    } else {
      const maxPointsInIDR = Math.floor((subtotal - couponDiscount) * 0.5);
      const maxPointsFromIDR = Math.floor(maxPointsInIDR / 10);
      const maxPoints = Math.min(pointsBalance, maxPointsFromIDR);
      const pointsToUse = Math.floor(maxPoints / POINTS_MIN_REDEEM) * POINTS_MIN_REDEEM;
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
        toast.error(data.error || t('orderCreateError'));
        setIsLoading(false);
        return;
      }

      if (data.data.net30) {
        clearCart();
        router.push(`/checkout/success?order=${data.data.orderNumber}&net30=1`);
        return;
      }

      setSnapToken(data.data.snapToken);
      setOrderNumber(data.data.orderNumber);
      setServerTotalAmount(data.data.totalAmount);
    } catch {
      toast.error(t('orderCreateError'));
      setIsLoading(false);
    }
  };

  const handleMidtransSuccess = () => {
    clearCart();
    router.push(`/checkout/success?order=${orderNumber}`);
  };

  const handleBack = () => {
    const stepOrder = activeSteps.map(s => s.id);
    const currentIndex = stepOrder.indexOf(step);
    if (currentIndex > 0) {
      setStep(stepOrder[currentIndex - 1] as CheckoutStep);
    }
  };

  const currentStepIndex = activeSteps.findIndex((s) => s.id === step);

  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);

  const effectiveShippingCost = isFreeShippingCoupon && formData.deliveryMethod === 'delivery'
    ? 0
    : formData.shippingCost;
  const finalTotal = subtotal - couponDiscount - pointsDiscount + effectiveShippingCost;

  return (
    <div className="min-h-screen bg-brand-cream pb-24 md:pb-0">
      {/* Mobile sticky total bar */}
      <div className="lg:hidden sticky top-[76px] z-10 bg-white border-b border-brand-cream-dark px-4 py-2 flex justify-between text-sm">
        <span className="text-text-secondary">{t('mobileStickyItem', { count: itemCount })}</span>
        <span className="font-bold text-brand-red">{formatIDR(finalTotal)}</span>
      </div>

      {/* Header with stepper */}
      <div className="bg-white border-b border-brand-cream-dark sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <h1 className="font-display text-xl font-bold">{t('title')}</h1>
          <div className="mt-4">
            <CheckoutStepper
              steps={activeSteps}
              currentStepId={step}
              onStepClick={(stepId) => {
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
                    {t('alreadyHaveAccount')}{' '}
                    <Link href={`/login?callbackUrl=${encodeURIComponent('/checkout')}`} className="text-brand-red font-medium hover:underline">
                      {t('loginHere')}
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
                  pickupAddress={pickupAddress ?? undefined}
                />

                {formData.deliveryMethod === 'delivery' && (
                  <CheckoutAddressStep
                    session={session ?? undefined}
                    savedAddresses={savedAddresses}
                    selectedSavedAddressId={selectedSavedAddressId}
                    showNewAddressForm={showNewAddressForm}
                    loadingShipping={loadingShipping}
                    formData={formData}
                    totalWeight={totalWeight}
                    updateForm={updateForm}
                    fetchShippingCost={fetchShippingCost}
                    onAddressSubmit={handleAddressSubmit}
                    onBack={handleBack}
                    onShowNewAddressForm={() => setShowNewAddressForm(true)}
                    onHideNewAddressForm={() => setShowNewAddressForm(false)}
                    onSelectSavedAddress={(address) => {
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
                  />
                )}

                {formData.deliveryMethod === 'pickup' && (
                  <div className="mt-4">
                    <PickupInfoPanel
                      storeHours={storeHours}
                      pickupAddress={pickupAddress}
                      onBack={handleBack}
                      onNext={() => setStep('payment')}
                    />
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
              <PaymentStep
                formData={formData}
                subtotal={subtotal}
                couponDiscount={couponDiscount}
                couponType={couponType}
                couponBuyXgetY={couponBuyXgetY}
                isFreeShippingCoupon={isFreeShippingCoupon}
                pointsBalance={pointsBalance}
                pointsDiscount={pointsDiscount}
                totalAmount={finalTotal}
                updateForm={updateForm}
                onCouponApply={handleApplyCoupon}
                onPointsToggle={handlePointsToggle}
                onPlaceOrder={handlePlaceOrder}
                onBack={handleBack}
                isLoading={isLoading}
                couponError={couponError}
                onClearCouponError={() => setCouponError('')}
              />
            )}
          </div>

          {/* Order summary sidebar */}
          <div className="lg:col-span-1">
            <OrderSummaryCard
              items={items}
              subtotal={subtotal}
              discountAmount={couponDiscount}
              shippingCost={effectiveShippingCost}
              pointsDiscount={pointsDiscount}
              totalAmount={finalTotal}
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
              toast.error(t('paymentFailed'));
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