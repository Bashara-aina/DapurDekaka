export type ShippingTier = 'express' | 'frozen_same_day' | 'frozen_express' | 'pickup';

export type InsuranceType = 'none' | 'basic' | 'premium';

export type DispatchStatus =
  | 'not_required'
  | 'pending'
  | 'booking'
  | 'booked'
  | 'failed'
  | 'retrying';

export interface ShippingItemInput {
  variantId: string;
  quantity: number;
  weightGram: number;
  lengthCm: number;
  widthCm: number;
  heightCm: number;
  name: string;
  value: number;
}

export interface QuoteOption {
  id: string;
  courierCode: string;
  courierType: string;
  displayName: string;
  tier: ShippingTier;
  actualCost: number;
  customerCost: number;
  estimatedDuration: string;
  disabled: boolean;
  disabledReason: string | null;
  insuranceAvailable: boolean;
}

export interface TierQuotes {
  options: QuoteOption[];
  recommendedOptionId: string | null;
}

export interface ShippingRatesResult {
  tiers: {
    express: TierQuotes;
    frozenSameDay: TierQuotes;
    frozenExpress: TierQuotes;
  };
  totalWeightGram: number;
  quoteFingerprint: string;
}

export interface DispatchResult {
  biteshipOrderId: string;
  waybillId: string | null;
  trackingUrl: string | null;
  actualCost: number;
}

export interface BiteshipCoordinate {
  latitude: number;
  longitude: number;
}

export interface InsuranceFeeResult {
  basic: number;
  premium: number;
}
