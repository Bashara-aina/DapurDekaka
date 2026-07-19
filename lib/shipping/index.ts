export {
  getShippingRates,
  findQuoteById,
  parseQuoteId,
  type GetRatesInput,
} from './get-rates';

export { applyMarkup, getMarkupAmount, verifyCustomerShippingCost } from './markup';
export { checkEligibility } from './eligibility';
export { calculateInsuranceFee, verifyInsuranceFee } from './insurance';
export { computeCartDimensions } from './weight-dims';
export { createBiteshipOrder } from './providers/biteship/orders';
export { fetchBiteshipTracking } from './providers/biteship/tracking';
export { reverseGeocodeArea, searchAreas } from './providers/biteship/maps';
export type {
  ShippingTier,
  InsuranceType,
  QuoteOption,
  ShippingItemInput,
  ShippingRatesResult,
  DispatchResult,
} from './types';

import { getShippingRates, findQuoteById, type GetRatesInput } from './get-rates';

/**
 * Re-validate a selected quote at checkout initiate time.
 */
export async function validateSelectedQuote(
  selectedQuoteId: string,
  input: GetRatesInput,
  expectedCustomerCost: number,
  expectedActualCost: number
): Promise<import('./types').QuoteOption | null> {
  const rates = await getShippingRates(input);
  const option = findQuoteById(rates, selectedQuoteId);
  if (!option) return null;
  if (option.customerCost !== expectedCustomerCost) return null;
  if (option.actualCost !== expectedActualCost) return null;
  return option;
}
