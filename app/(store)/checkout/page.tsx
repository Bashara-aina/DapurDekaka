'use client';

import Link from 'next/link';
import nextDynamic from 'next/dynamic';
import { formatIDR } from '@/lib/utils/format-currency';
import { useCheckout } from './use-checkout';

export const dynamic = 'force-dynamic';

import { Button } from '@/components/ui/button';
import { CheckoutStepper } from '@/components/store/checkout/CheckoutStepper';
import { IdentityForm } from '@/components/store/checkout/IdentityForm';
import { DeliveryMethodToggle } from '@/components/store/checkout/DeliveryMethodToggle';
import { OrderSummaryCard } from '@/components/store/checkout/OrderSummaryCard';
import { EmptyState } from '@/components/store/common/EmptyState';
import { PaymentStep } from '@/components/store/checkout/PaymentStep';
import { PickupInfoPanel } from '@/components/store/checkout/PickupInfoPanel';
import { AddressMapPicker } from '@/components/store/checkout/AddressMapPicker';
import { CheckoutShippingStep } from '@/components/store/checkout/CheckoutShippingStep';
import { SavedAddressPicker } from '@/components/store/checkout/SavedAddressPicker';

const MidtransPayment = nextDynamic(
  () => import('@/components/store/checkout/MidtransPayment').then((m) => m.MidtransPayment),
  { ssr: false }
);

// Thin render shell: all state and server interaction lives in useCheckout().
// (Midtrans Snap.js needs `window`, hence the ssr:false boundary above.)
export default function CheckoutPage() {
  const c = useCheckout();
  const {
    t, session, items, subtotal, pointsBalance, pointsDiscount,
    step, setStep, formData, updateForm,
    couponDiscount, couponType, couponBuyXgetY, isFreeShippingCoupon,
    shippingRates, loadingShipping, usePoints,
    savedAddresses, selectedSavedAddressId, showNewAddressForm, setShowNewAddressForm,
    storeHours, pickupAddress, storeLocation,
    snapToken, orderNumber, isLoading, couponError, setCouponError,
    activeSteps, itemCount, effectiveShippingCost, finalTotal, midtransCallbacks,
    handleIdentitySubmit, handleDeliveryMethodChange, handleMapPinConfirm,
    handleShippingConfirm, handleApplyCoupon, handlePointsToggle, handlePlaceOrder,
    handleBack, handleStepClick, handleSavedAddressSelect,
  } = c;

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
              onStepClick={handleStepClick}
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

                {session?.user && savedAddresses.length > 0 && !showNewAddressForm && (
                  <div className="mb-4">
                    <SavedAddressPicker
                      addresses={savedAddresses}
                      selectedId={selectedSavedAddressId}
                      onSelect={handleSavedAddressSelect}
                      onAddNew={() => setShowNewAddressForm(true)}
                    />
                  </div>
                )}

                {formData.deliveryMethod === 'delivery' && (
                  <div className="mt-4 bg-white rounded-card p-4 shadow-card">
                    {loadingShipping ? (
                      <p className="text-center py-8 text-text-secondary">{t('calculatingShipping')}</p>
                    ) : (
                      <AddressMapPicker
                        defaultValues={{
                          latitude: formData.latitude || undefined,
                          longitude: formData.longitude || undefined,
                          addressLine: formData.addressLine,
                          district: formData.district,
                          city: formData.city,
                          province: formData.province,
                          postalCode: formData.postalCode,
                        }}
                        onConfirm={handleMapPinConfirm}
                        onBack={handleBack}
                        defaultCity={storeLocation.city}
                        defaultProvince={storeLocation.province}
                      />
                    )}
                  </div>
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

            {step === 'courier' && shippingRates && (
              <CheckoutShippingStep
                rates={shippingRates}
                subtotal={subtotal}
                isLoading={loadingShipping}
                onConfirm={handleShippingConfirm}
                onBack={handleBack}
              />
            )}

            {step === 'courier' && !shippingRates && (
              <div className="bg-white rounded-card p-6 shadow-card space-y-4">
                <p className="text-text-secondary text-sm">{t('courierRatesMissing')}</p>
                <Button
                  type="button"
                  className="w-full bg-brand-red hover:bg-brand-red-dark"
                  onClick={() => setStep('delivery')}
                >
                  {t('recalculateShipping')}
                </Button>
              </div>
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
          callbacks={midtransCallbacks}
        />
      )}
    </div>
  );
}
