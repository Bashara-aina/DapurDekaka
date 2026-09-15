'use client';

/**
 * All checkout-page state and server interactions, extracted from page.tsx
 * (which was a 780-line god component). The page keeps JSX only; this hook
 * owns steps, form data, coupon/points/shipping flows, draft persistence,
 * and order placement. No behavior changes — pure move + dead-state removal.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useQuery } from '@tanstack/react-query';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useCartStore } from '@/store/cart.store';
import { POINTS_MIN_REDEEM, POINTS_VALUE_IDR } from '@/lib/constants/points';
import type { ShippingRatesResult } from '@/lib/shipping/types';
import { clearCheckoutDraft } from '@/lib/checkout/draft';
import { logger } from '@/lib/utils/logger';
import type { IdentityFormData } from '@/components/store/checkout/IdentityForm';
import type { ShippingSelection } from '@/components/store/checkout/CheckoutShippingStep';
import type { SavedAddress } from '@/components/store/checkout/SavedAddressPicker';

export interface StoreHours {
  openDays: string;
  openHours: string;
}

export interface StoreLocationDefaults {
  city: string;
  province: string;
}

export type CheckoutStep = 'identity' | 'delivery' | 'courier' | 'payment';

export interface CheckoutFormData {
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
  latitude: number;
  longitude: number;
  shippingTier: string;
  selectedQuoteId: string;
  biteshipActualCost: number;
  customerShippingCost: number;
  insuranceType: 'none' | 'basic' | 'premium';
  insuranceFee: number;
  courierInstantAck: boolean;
  cashOnDelivery: boolean;
  couponCode: string;
  pointsUsed: number;
  customerNote: string;
}

// Initial form state, hoisted so the restore-on-mount effect can reference it
// without capturing component-scope state (keeps exhaustive-deps honest).
export const INITIAL_FORM: CheckoutFormData = {
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
  latitude: 0,
  longitude: 0,
  shippingTier: '',
  selectedQuoteId: '',
  biteshipActualCost: 0,
  customerShippingCost: 0,
  insuranceType: 'none',
  insuranceFee: 0,
  courierInstantAck: false,
  cashOnDelivery: false,
  couponCode: '',
  pointsUsed: 0,
  customerNote: '',
};

export function useCheckout() {
  const t = useTranslations('checkout');
  const router = useRouter();
  const { data: session } = useSession();
  const items = useCartStore((s) => s.items);
  const getSubtotal = useCartStore((s) => s.getSubtotal);
  const clearCart = useCartStore((s) => s.clearCart);

  const [step, setStep] = useState<CheckoutStep>('identity');
  const [isLoading, setIsLoading] = useState(false);
  const [snapToken, setSnapToken] = useState<string | null>(null);
  const [orderNumber, setOrderNumber] = useState<string | null>(null);
  const [storeHours, setStoreHours] = useState<StoreHours>({ openDays: '', openHours: '' });
  const [pickupAddress, setPickupAddress] = useState<string | null>(null);
  const [storeLocation, setStoreLocation] = useState<StoreLocationDefaults>({ city: '', province: '' });
  const [formData, setFormData] = useState<CheckoutFormData>(INITIAL_FORM);

  const [couponDiscount, setCouponDiscount] = useState(0);
  const [couponError, setCouponError] = useState('');
  const [couponType, setCouponType] = useState<string | null>(null);
  const [isFreeShippingCoupon, setIsFreeShippingCoupon] = useState(false);
  const [couponBuyXgetY, setCouponBuyXgetY] = useState<{ buyQuantity: number; getQuantity: number } | null>(null);
  const [shippingRates, setShippingRates] = useState<ShippingRatesResult | null>(null);
  const [loadingShipping, setLoadingShipping] = useState(false);
  const [usePoints, setUsePoints] = useState(false);
  const [savedAddresses, setSavedAddresses] = useState<SavedAddress[]>([]);
  const [selectedSavedAddressId, setSelectedSavedAddressId] = useState<string | null>(null);
  const [showNewAddressForm, setShowNewAddressForm] = useState(false);

  // Stable updater (setFormData is stable) — safe to list in effect deps.
  const updateForm = useCallback((updates: Partial<CheckoutFormData>) => {
    setFormData((prev) => ({ ...prev, ...updates }));
  }, []);

  // HIGH-4: Persist coupon, points, and shipping state to sessionStorage so mid-checkout
  // refresh doesn't wipe these values (couponDiscount, couponType, isFreeShippingCoupon,
  // shippingOptions, usePoints are React state that were previously lost on refresh).
  // Restore-on-mount only: references INITIAL_FORM (module const) and stable
  // setters, so [] is the complete dep list — no disable comment needed.
  useEffect(() => {
    const draft = sessionStorage.getItem('checkout-draft');
    if (draft) {
      try {
        const parsed = JSON.parse(draft);
        const restoredForm = parsed.formData ?? INITIAL_FORM;
        const hasIdentity = Boolean(
          restoredForm.recipientName?.trim() &&
            restoredForm.recipientEmail?.trim() &&
            restoredForm.recipientPhone?.trim()
        );
        let restoredStep = parsed.step || 'identity';
        const restoredRates = parsed.shippingRates ?? null;

        // Don't land on payment/courier with incomplete identity or missing rates.
        if ((restoredStep === 'payment' || restoredStep === 'courier') && !hasIdentity) {
          restoredStep = 'identity';
        }
        if (restoredStep === 'courier' && !restoredRates) {
          restoredStep = 'delivery';
        }
        if (
          restoredStep === 'payment' &&
          restoredForm.deliveryMethod === 'delivery' &&
          !restoredForm.selectedQuoteId
        ) {
          restoredStep = restoredRates ? 'courier' : 'delivery';
        }

        setFormData(restoredForm);
        setStep(restoredStep);
        setCouponDiscount(parsed.couponDiscount ?? 0);
        setCouponError(parsed.couponError ?? '');
        setCouponType(parsed.couponType ?? null);
        setIsFreeShippingCoupon(parsed.isFreeShippingCoupon ?? false);
        setCouponBuyXgetY(parsed.couponBuyXgetY ?? null);
        setShippingRates(restoredRates);
        setUsePoints(parsed.usePoints ?? false);
      } catch (err) {
        // Corrupt draft — start fresh rather than crash checkout.
        logger.warn('[checkout] corrupt draft, resetting', {
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }
  }, []);

  useEffect(() => {
    if (snapToken) return;
    sessionStorage.setItem('checkout-draft', JSON.stringify({
      formData,
      step,
      couponDiscount,
      couponError,
      couponType,
      isFreeShippingCoupon,
      couponBuyXgetY,
      shippingRates,
      usePoints,
    }));
  }, [formData, step, snapToken, couponDiscount, couponError, couponType, isFreeShippingCoupon, couponBuyXgetY, shippingRates, usePoints]);

  const fetchShippingRates = useCallback(async (
    lat: number,
    lng: number,
    addressUpdates: Partial<CheckoutFormData>,
    snapshot: { addressLine: string; postalCode: string; items: Array<{ variantId: string; quantity: number }>; subtotal: number }
  ) => {
    setLoadingShipping(true);
    updateForm(addressUpdates);
    try {
      const res = await fetch('/api/shipping/rates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          destLat: lat,
          destLng: lng,
          destAddress: addressUpdates.addressLine ?? snapshot.addressLine,
          postalCode: addressUpdates.postalCode ?? snapshot.postalCode,
          items: snapshot.items,
          subtotal: snapshot.subtotal,
        }),
      });
      const data = await res.json();
      if (!data.success) {
        toast.error(data.error || t('shippingCostError'));
        return;
      }
      setShippingRates(data.data);
      setStep('courier');
    } catch (err) {
      logger.warn('[checkout] shipping rates fetch failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error(t('shippingCostError'));
    } finally {
      setLoadingShipping(false);
    }
  }, [t, updateForm]);

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

  // Runs when the session arrives AND while still on identity: pre-fills the
  // form once, then advances. `step` in deps is loop-safe (guard requires
  // 'identity', which this effect itself leaves).
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
  }, [session?.user, step, updateForm]);

  useEffect(() => {
    if (profileData?.phone) {
      updateForm({ recipientPhone: profileData.phone });
    }
  }, [profileData, updateForm]);

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
    // Runtime-shape guard: never trust the wire, even from our own API.
    if (Array.isArray(addressesData)) {
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
            openDays: json.data.store_open_days ?? '',
            openHours: json.data.store_opening_hours ?? '',
          });
          setPickupAddress(json.data.store_address ?? null);
          setStoreLocation({
            city: json.data.store_city ?? '',
            province: json.data.store_province ?? '',
          });
        }
      } catch (err) {
        // Non-fatal: pickup panel falls back to empty defaults.
        logger.warn('[checkout] store settings fetch failed', {
          error: err instanceof Error ? err.message : String(err),
        });
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

  const subtotal = getSubtotal();
  const pointsDiscount = usePoints && formData.pointsUsed > 0
    ? formData.pointsUsed * POINTS_VALUE_IDR
    : 0;

  const handleIdentitySubmit = useCallback((data: IdentityFormData) => {
    updateForm({
      recipientName: data.recipientName,
      recipientEmail: data.recipientEmail,
      recipientPhone: data.recipientPhone,
      customerNote: data.customerNote || '',
    });
    setStep('delivery');
  }, [updateForm]);

  const handleDeliveryMethodChange = useCallback(async (method: 'delivery' | 'pickup') => {
    updateForm({ deliveryMethod: method, shippingCost: 0 });
    setStep((prev) => (method === 'pickup' && prev === 'courier' ? 'delivery' : prev));
  }, [updateForm]);

  // Snapshot cart data at call time so the async fetch never closes over a
  // stale render's items/subtotal. Address fallback reads the latest form via
  // ref (parity with the previous render-scope fallback behavior).
  const formDataRef = useRef(formData);
  formDataRef.current = formData;
  const requestShippingRates = useCallback(async (
    lat: number,
    lng: number,
    addressUpdates: Partial<CheckoutFormData>
  ) => {
    const state = useCartStore.getState();
    const current = formDataRef.current;
    await fetchShippingRates(lat, lng, addressUpdates, {
      addressLine: addressUpdates.addressLine ?? current.addressLine,
      postalCode: addressUpdates.postalCode ?? current.postalCode,
      items: state.items.map((i) => ({ variantId: i.variantId, quantity: i.quantity })),
      subtotal: state.getSubtotal(),
    });
  }, [fetchShippingRates]);

  const handleMapPinConfirm = useCallback(async (pin: {
    latitude: number;
    longitude: number;
    addressLine: string;
    district: string;
    city: string;
    province: string;
    postalCode: string;
  }) => {
    await requestShippingRates(pin.latitude, pin.longitude, {
      latitude: pin.latitude,
      longitude: pin.longitude,
      addressLine: pin.addressLine,
      district: pin.district,
      city: pin.city,
      province: pin.province,
      postalCode: pin.postalCode,
    });
  }, [requestShippingRates]);

  const handleShippingConfirm = useCallback((selection: ShippingSelection) => {
    updateForm({
      shippingTier: selection.shippingTier,
      selectedQuoteId: selection.selectedQuoteId,
      courierCode: selection.courierCode,
      courierService: selection.courierService,
      courierName: selection.courierName,
      shippingCost: selection.shippingCost,
      biteshipActualCost: selection.biteshipActualCost,
      customerShippingCost: selection.customerShippingCost,
      insuranceType: selection.insuranceType,
      insuranceFee: selection.insuranceFee,
      courierInstantAck: selection.courierInstantAck,
      cashOnDelivery: selection.cashOnDelivery,
    });
    setStep('payment');
  }, [updateForm]);

  const handleApplyCoupon = useCallback(async () => {
    const code = formData.couponCode;
    if (!code) return;

    try {
      const res = await fetch('/api/coupons/validate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code, subtotal, userId: session?.user?.id ?? null }),
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
    } catch (err) {
      logger.warn('[checkout] coupon validation failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      setCouponError(t('couponValidateError'));
    }
  }, [formData.couponCode, subtotal, session?.user?.id, t]);

  const handlePointsToggle = useCallback((use: boolean) => {
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
  }, [subtotal, couponDiscount, pointsBalance, updateForm]);

  const handlePlaceOrder = useCallback(async () => {
    setIsLoading(true);

    try {
      const state = useCartStore.getState();
      const liveSubtotal = state.getSubtotal();
      const livePointsDiscount = usePoints && formData.pointsUsed > 0
        ? formData.pointsUsed * POINTS_VALUE_IDR
        : 0;
      const res = await fetch('/api/checkout/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          items: state.items.map((item) => ({
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
          subtotal: liveSubtotal,
          discountAmount: couponDiscount,
          pointsDiscount: livePointsDiscount,
        }),
      });

      const data = await res.json();

      if (!data.success) {
        if (data.code === 'PHASE_NOT_READY') {
          toast.error(t('phaseNotReady'));
          setStep('courier');
        } else if (data.code === 'INTERCITY_MIN_ORDER') {
          toast.error(t('intercityMinOrder'));
          setStep('courier');
        } else if (res.status === 409 && data.error?.includes('Stok')) {
          toast.error(data.error);
          router.push('/cart');
        } else if (data.error?.includes('pilih ulang kurir') || data.error?.includes('Tarif ongkir')) {
          toast.error(data.error);
          setStep('courier');
        } else {
          toast.error(data.error || t('orderCreateError'));
        }
        setIsLoading(false);
        return;
      }

      clearCheckoutDraft();

      if (data.data.net30) {
        clearCart();
        router.push(`/checkout/success?order=${data.data.orderNumber}&net30=1`);
        return;
      }

      setSnapToken(data.data.snapToken);
      setOrderNumber(data.data.orderNumber);
    } catch (err) {
      logger.error('[checkout] place order failed', {
        error: err instanceof Error ? err.message : String(err),
      });
      toast.error(t('orderCreateError'));
      setIsLoading(false);
    }
  }, [formData, couponDiscount, usePoints, t, router, clearCart]);

  const handleMidtransSuccess = useCallback(() => {
    // Do NOT clear cart here — webhook confirms payment asynchronously.
    // Cart clearing is handled by the success page after verifying order is paid.
    router.push(`/checkout/success?order=${orderNumber}`);
  }, [router, orderNumber]);

  const handleBack = useCallback(() => {
    setStep((prev) => {
      const order = activeSteps.map((s) => s.id);
      const currentIndex = order.indexOf(prev);
      return (currentIndex > 0 ? order[currentIndex - 1] : prev) as CheckoutStep;
    });
  }, [activeSteps]);

  const handleStepClick = useCallback((stepId: string) => {
    setStep((prev) => {
      const order = activeSteps.map((s) => s.id);
      const targetIndex = order.indexOf(stepId);
      const currentIndex = order.indexOf(prev);
      return (targetIndex < currentIndex ? stepId : prev) as CheckoutStep;
    });
  }, [activeSteps]);

  const handleSavedAddressSelect = useCallback(async (address: SavedAddress | null) => {
    if (!address) {
      setShowNewAddressForm(true);
      return;
    }
    setSelectedSavedAddressId(address.id);
    const updates: Partial<CheckoutFormData> = {
      addressLine: address.addressLine ?? '',
      district: address.district ?? '',
      city: address.city ?? '',
      province: address.province ?? '',
      postalCode: address.postalCode ?? '',
      latitude: address.latitude ?? 0,
      longitude: address.longitude ?? 0,
    };
    updateForm(updates);
    if (address.latitude && address.longitude) {
      await requestShippingRates(address.latitude, address.longitude, updates);
    }
  }, [updateForm, requestShippingRates]);

  const itemCount = items.reduce((acc, i) => acc + i.quantity, 0);

  const effectiveShippingCost = isFreeShippingCoupon && formData.deliveryMethod === 'delivery'
    ? 0
    : formData.shippingCost;
  const finalTotal = subtotal - couponDiscount - pointsDiscount + effectiveShippingCost + formData.insuranceFee;

  const midtransCallbacks = {
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
  };

  return {
    t,
    session,
    items,
    subtotal,
    pointsBalance,
    pointsDiscount,
    step,
    setStep,
    isLoading,
    snapToken,
    orderNumber,
    storeHours,
    pickupAddress,
    storeLocation,
    formData,
    updateForm,
    couponDiscount,
    couponError,
    setCouponError,
    couponType,
    couponBuyXgetY,
    isFreeShippingCoupon,
    shippingRates,
    loadingShipping,
    usePoints,
    savedAddresses,
    selectedSavedAddressId,
    showNewAddressForm,
    setShowNewAddressForm,
    activeSteps,
    itemCount,
    effectiveShippingCost,
    finalTotal,
    midtransCallbacks,
    handleIdentitySubmit,
    handleDeliveryMethodChange,
    handleMapPinConfirm,
    handleShippingConfirm,
    handleApplyCoupon,
    handlePointsToggle,
    handlePlaceOrder,
    handleBack,
    handleStepClick,
    handleSavedAddressSelect,
    requestShippingRates,
  };
}

export type UseCheckoutReturn = ReturnType<typeof useCheckout>;
