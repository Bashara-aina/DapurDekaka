import {
  BORZO_EXCLUDED,
  INSTANT_BIKE_MAX_WEIGHT_GRAM,
  PAXEL_MAX_WEIGHT_GRAM,
} from './constants';
import type { ShippingTier } from './types';

export interface EligibilityInput {
  courierCode: string;
  tier: ShippingTier;
  totalWeightGram: number;
}

export interface EligibilityResult {
  eligible: boolean;
  disabled: boolean;
  disabledReason: string | null;
}

/**
 * Hard filters for courier eligibility per tier and weight limits.
 */
export function checkEligibility(input: EligibilityInput): EligibilityResult {
  const code = input.courierCode.toLowerCase();

  if (code === BORZO_EXCLUDED) {
    return { eligible: false, disabled: true, disabledReason: 'courier_excluded' };
  }

  if (input.tier === 'express' && input.totalWeightGram > INSTANT_BIKE_MAX_WEIGHT_GRAM) {
    return {
      eligible: false,
      disabled: true,
      disabledReason: 'instant_weight_exceeded',
    };
  }

  if (input.tier === 'frozen_same_day' && code === 'paxel') {
    if (input.totalWeightGram > PAXEL_MAX_WEIGHT_GRAM) {
      return {
        eligible: true,
        disabled: true,
        disabledReason: 'paxel_weight_exceeded',
      };
    }
  }

  return { eligible: true, disabled: false, disabledReason: null };
}

/**
 * Filter out Borzo from all courier lists.
 */
export function excludeBorzo(courierCodes: string[]): string[] {
  return courierCodes.filter((c) => c.toLowerCase() !== BORZO_EXCLUDED);
}
