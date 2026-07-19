'use client';

import { useTranslations } from 'next-intl';
import { Label } from '@/components/ui/label';

interface InstantDeliveryAckProps {
  checked: boolean;
  onChange: (checked: boolean) => void;
}

/**
 * Required acknowledgment for the Kilat (express) tier — "promise the method,
 * not the outcome" (L1 Decision 2). Must require an explicit checkbox before
 * the express tier can be confirmed at checkout.
 */
export function InstantDeliveryAck({ checked, onChange }: InstantDeliveryAckProps) {
  const t = useTranslations('shippingInstantAck');

  return (
    <div className="bg-amber-50 border border-amber-200 rounded-card p-4 flex gap-3">
      <input
        id="instant-ack"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-1 h-4 w-4 rounded border-amber-300 text-brand-red focus:ring-brand-red"
        aria-required="true"
      />
      <div>
        <Label htmlFor="instant-ack" className="text-sm font-semibold text-text-primary cursor-pointer block mb-1">
          {t('title')}
        </Label>
        <Label htmlFor="instant-ack" className="text-sm text-text-secondary leading-relaxed cursor-pointer">
          {t('message')}
        </Label>
      </div>
    </div>
  );
}
