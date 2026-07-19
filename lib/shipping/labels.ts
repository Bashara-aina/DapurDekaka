/**
 * Customer-facing tier label resolver (L1 Decision 1).
 *
 * Internally the codebase still uses `express / frozen_same_day / frozen_express /
 * pickup`. Customer UI must render the bundled, honest labels per L1:
 *   - express → "Kilat (Bandung, kurir motor)"
 *   - frozen_same_day → "Frozen Same-Day"
 *   - frozen_express → "Frozen Express"
 *   - pickup → "Ambil di Toko"
 */

import type { ShippingTier } from './types';

export type Locale = 'id' | 'en';

const TIER_LABEL: Record<ShippingTier, Record<Locale, string>> = {
  express: {
    id: 'Kilat (Bandung, kurir motor)',
    en: 'Kilat (Bandung, motorcycle courier)',
  },
  frozen_same_day: {
    id: 'Frozen Same-Day',
    en: 'Frozen Same-Day',
  },
  frozen_express: {
    id: 'Frozen Express',
    en: 'Frozen Express',
  },
  pickup: {
    id: 'Ambil di Toko',
    en: 'Pickup at Store',
  },
};

/**
 * Customer-facing display label for a tier.
 */
export function tierLabel(tier: ShippingTier, locale: Locale = 'id'): string {
  return TIER_LABEL[tier][locale];
}

/**
 * Returns the i18n message key for a tier's display label.
 * Useful for components using next-intl `t('key')` to respect the locale.
 */
export function tierLabelKey(tier: ShippingTier): 'tier.express' | 'tier.frozenSameDay' | 'tier.frozenExpress' | 'tier.pickup' {
  switch (tier) {
    case 'express':
      return 'tier.express';
    case 'frozen_same_day':
      return 'tier.frozenSameDay';
    case 'frozen_express':
      return 'tier.frozenExpress';
    case 'pickup':
      return 'tier.pickup';
  }
}
