import crypto from 'crypto';
import {
  TIER_COURIER_CONFIG,
  COURIER_DISPLAY_NAMES,
  WAREHOUSE_ORIGIN_LAT,
  WAREHOUSE_ORIGIN_LNG,
  matchesTierServiceFilter,
} from './constants';
import { checkEligibility, excludeBorzo } from './eligibility';
import { applyMarkup } from './markup';
import { pickRecommendedOptionId, rankOptions } from './ranking';
import { computeCartDimensions } from './weight-dims';
import { fetchBiteshipRates, buildRateItems } from './providers/biteship/rates';
import type {
  QuoteOption,
  ShippingItemInput,
  ShippingRatesResult,
  ShippingTier,
  TierQuotes,
} from './types';

export interface GetRatesInput {
  originLat?: number;
  originLng?: number;
  destLat: number;
  destLng: number;
  items: ShippingItemInput[];
  subtotal: number;
}

function buildQuoteId(
  tier: ShippingTier,
  courierCode: string,
  courierType: string
): string {
  return `${tier}:${courierCode}:${courierType}`;
}

function filterByService(courierType: string, serviceFilter?: RegExp): boolean {
  return matchesTierServiceFilter(courierType, serviceFilter);
}

function toQuoteOption(
  tier: ShippingTier,
  row: {
    courier_company: string;
    courier_type: string;
    price: number;
    duration?: string;
    shipment_duration_range?: string;
    available_for_insurance?: boolean;
    available_for_cash_on_delivery?: boolean;
  },
  totalWeightGram: number
): QuoteOption {
  const courierCode = row.courier_company.toLowerCase();
  const eligibility = checkEligibility({ courierCode, tier, totalWeightGram });
  const displayName =
    COURIER_DISPLAY_NAMES[courierCode] ?? row.courier_company.toUpperCase();
  const duration = row.duration ?? row.shipment_duration_range ?? '1-3 hari';

  return {
    id: buildQuoteId(tier, courierCode, row.courier_type),
    courierCode,
    courierType: row.courier_type,
    displayName: `${displayName} ${row.courier_type}`,
    tier,
    actualCost: row.price,
    customerCost: applyMarkup(row.price),
    estimatedDuration: duration,
    disabled: eligibility.disabled || !eligibility.eligible,
    disabledReason: eligibility.disabledReason,
      insuranceAvailable: row.available_for_insurance ?? true,
      cashOnDeliveryAvailable: row.available_for_cash_on_delivery ?? false,
  };
}

async function fetchTierQuotes(
  tierConfig: (typeof TIER_COURIER_CONFIG)[number],
  input: GetRatesInput,
  dims: ReturnType<typeof computeCartDimensions>,
  rateItems: ReturnType<typeof buildRateItems>
): Promise<TierQuotes> {
  const couriers = excludeBorzo(tierConfig.couriers).join(',');
  const originLat = input.originLat ?? WAREHOUSE_ORIGIN_LAT;
  const originLng = input.originLng ?? WAREHOUSE_ORIGIN_LNG;

  let pricing: Array<{
    courier_company: string;
    courier_type: string;
    price: number;
    duration?: string;
    shipment_duration_range?: string;
    available_for_insurance?: boolean;
  }> = [];

  try {
    pricing = await fetchBiteshipRates({
      originLatitude: originLat,
      originLongitude: originLng,
      destinationLatitude: input.destLat,
      destinationLongitude: input.destLng,
      couriers,
      items: rateItems,
    });
  } catch {
    pricing = [];
  }

  const options: QuoteOption[] = pricing
    .filter((row) => filterByService(row.courier_type, tierConfig.serviceFilter))
    .map((row) => toQuoteOption(tierConfig.tier, row, dims.totalWeightGram));

  const ranked = rankOptions(options);
  return {
    options: ranked,
    recommendedOptionId: pickRecommendedOptionId(ranked),
  };
}

/**
 * Fetch all tier quotes from Biteship with eligibility and markup applied.
 */
export async function getShippingRates(
  input: GetRatesInput
): Promise<ShippingRatesResult> {
  const dims = computeCartDimensions(input.items);
  const rateItems = buildRateItems(
    input.items.map((item) => ({
      name: item.name,
      value: item.value,
      weightGram: item.weightGram,
      lengthCm: item.lengthCm,
      widthCm: item.widthCm,
      heightCm: item.heightCm,
      quantity: item.quantity,
    }))
  );

  const tierResults = await Promise.all(
    TIER_COURIER_CONFIG.map((cfg) =>
      fetchTierQuotes(cfg, input, dims, rateItems)
    )
  );

  const express = tierResults[0] ?? { options: [], recommendedOptionId: null };
  const frozenSameDay = tierResults[1] ?? { options: [], recommendedOptionId: null };
  const frozenExpress = tierResults[2] ?? { options: [], recommendedOptionId: null };

  const fingerprint = crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        dest: [input.destLat, input.destLng],
        weight: dims.totalWeightGram,
        items: input.items.map((i) => `${i.variantId}:${i.quantity}`),
      })
    )
    .digest('hex')
    .slice(0, 16);

  return {
    tiers: { express, frozenSameDay, frozenExpress },
    totalWeightGram: dims.totalWeightGram,
    quoteFingerprint: fingerprint,
  };
}

/**
 * Find a specific quote option by id across all tiers.
 */
export function findQuoteById(
  result: ShippingRatesResult,
  quoteId: string
): QuoteOption | null {
  const all = [
    ...result.tiers.express.options,
    ...result.tiers.frozenSameDay.options,
    ...result.tiers.frozenExpress.options,
  ];
  return all.find((o) => o.id === quoteId && !o.disabled) ?? null;
}

/**
 * Parse courier code and type from quote id.
 */
export function parseQuoteId(quoteId: string): {
  tier: ShippingTier;
  courierCode: string;
  courierType: string;
} {
  const [tier, courierCode, ...rest] = quoteId.split(':');
  return {
    tier: (tier as ShippingTier) ?? 'frozen_express',
    courierCode: courierCode ?? '',
    courierType: rest.join(':') ?? '',
  };
}
