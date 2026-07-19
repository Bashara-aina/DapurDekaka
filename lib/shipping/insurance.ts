import { INSURANCE_RATES } from './constants';
import type { InsuranceType } from './types';

/**
 * Calculate insurance pass-through fee from subtotal.
 */
export function calculateInsuranceFee(
  insuranceType: InsuranceType,
  subtotal: number
): number {
  if (insuranceType === 'none' || subtotal <= 0) return 0;
  const rate = INSURANCE_RATES[insuranceType];
  return Math.ceil(subtotal * rate);
}

/**
 * Verify client-submitted insurance fee matches server calculation.
 */
export function verifyInsuranceFee(
  insuranceType: InsuranceType,
  subtotal: number,
  submittedFee: number
): boolean {
  return submittedFee === calculateInsuranceFee(insuranceType, subtotal);
}
