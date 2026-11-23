'use client';

import { useCallback, useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useTranslations } from 'next-intl';
import { PickupInvitation } from '@/components/store/orders/PickupInvitation';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

interface PickupGateProps {
  orderNumber: string;
  storeAddress: string;
  googleMapsUrl: string;
  whatsappNumber: string;
  openingHours: string;
}

interface PickupPayload {
  pickupCode: string | null;
  deliveryMethod: string;
}

/**
 * Reveals pickup code only after session email match or verified guest email.
 * Never falls back to order number as the handover code.
 */
export function PickupGate({
  orderNumber,
  storeAddress,
  googleMapsUrl,
  whatsappNumber,
  openingHours,
}: PickupGateProps): React.ReactElement {
  const t = useTranslations('checkout');
  const { data: session, status: sessionStatus } = useSession();
  const [email, setEmail] = useState('');
  const [pickupCode, setPickupCode] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [autoTried, setAutoTried] = useState(false);

  const fetchOrder = useCallback(
    async (verifyEmail: string): Promise<void> => {
      setLoading(true);
      setError('');
      try {
        const res = await fetch(
          `/api/orders/${encodeURIComponent(orderNumber)}?email=${encodeURIComponent(verifyEmail)}`
        );
        const json = (await res.json()) as {
          success: boolean;
          data?: PickupPayload;
          error?: string;
        };
        if (!json.success || !json.data) {
          setError(json.error ?? t('pickupVerifyFailed'));
          setPickupCode(null);
          return;
        }
        if (json.data.deliveryMethod !== 'pickup') {
          setError(t('pickupNotPickupOrder'));
          return;
        }
        if (!json.data.pickupCode) {
          setError(t('pickupCodeMissing'));
          return;
        }
        setPickupCode(json.data.pickupCode);
      } catch {
        setError(t('pickupVerifyFailed'));
      } finally {
        setLoading(false);
      }
    },
    [orderNumber, t]
  );

  useEffect(() => {
    if (autoTried || pickupCode) return;
    if (sessionStatus !== 'authenticated' || !session?.user?.email) return;
    setAutoTried(true);
    void fetchOrder(session.user.email);
  }, [autoTried, pickupCode, sessionStatus, session?.user?.email, fetchOrder]);

  if (pickupCode) {
    return (
      <PickupInvitation
        pickupCode={pickupCode}
        orderNumber={orderNumber}
        storeAddress={storeAddress}
        googleMapsUrl={googleMapsUrl}
        whatsappNumber={whatsappNumber}
        openingHours={openingHours}
      />
    );
  }

  return (
    <div className="bg-white rounded-card p-6 shadow-card max-w-md mx-auto space-y-4">
      <p className="text-sm text-text-secondary">{t('pickupVerifyHint')}</p>
      <div>
        <Label htmlFor="pickup-email">{t('email')}</Label>
        <Input
          id="pickup-email"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder={t('emailPlaceholder')}
          className="mt-1"
          disabled={loading || sessionStatus === 'loading'}
        />
      </div>
      {error ? <p className="text-sm text-error">{error}</p> : null}
      <Button
        type="button"
        className="w-full bg-brand-red hover:bg-brand-red-dark"
        disabled={loading || !email.trim()}
        onClick={() => void fetchOrder(email.trim())}
      >
        {loading ? t('verifying') : t('verifyEmail')}
      </Button>
    </div>
  );
}
