/**
 * Geographic shipping policy (L3) — phased hard blocks with phase gates.
 *
 * Hard rule from L3: outside polygon = WhatsApp CTA, no checkout. Soft
 * warnings are not acceptable for cold-chain safety. Phases are gated on
 * numeric criteria (50 orders / <2% spoilage / 5 dispatch-failure) before
 * the phase setting in `systemSettings.shipping_phase` is honored.
 */

import type { ShippingTier } from './types';

/** Lat/lng bounding-box polygon. Bandung Raya center ≈ (-6.92, 107.60). */
export interface GeoPolygon {
  readonly name: 'bandung' | 'jabodetabek' | 'jawa48h' | 'beyond';
  readonly minLat: number;
  readonly maxLat: number;
  readonly minLng: number;
  readonly maxLng: number;
  readonly couriers: ReadonlyArray<'kilat' | 'same_day' | 'frozen_express'>;
  readonly maxWeightGram: number;
  readonly intercity: boolean;
}

export const POLYGONS: ReadonlyArray<GeoPolygon> = [
  {
    name: 'bandung',
    minLat: -7.15,
    maxLat: -6.83,
    minLng: 107.5,
    maxLng: 107.78,
    couriers: ['kilat', 'same_day', 'frozen_express'],
    maxWeightGram: 15_000,
    intercity: false,
  },
  {
    name: 'jabodetabek',
    minLat: -6.45,
    maxLat: -6.05,
    minLng: 106.65,
    maxLng: 107.05,
    couriers: ['same_day', 'frozen_express'],
    maxWeightGram: 15_000,
    intercity: true,
  },
  {
    name: 'jawa48h',
    minLat: -7.85,
    maxLat: -5.85,
    minLng: 105.1,
    maxLng: 114.6,
    couriers: ['frozen_express'],
    maxWeightGram: 15_000,
    intercity: true,
  },
];

export type DestinationClass = 'bandung' | 'jabodetabek' | 'jawa48h' | 'beyond';

/**
 * Classify a destination coordinate into a polygon.
 */
export function classifyDestination(lat: number, lng: number): DestinationClass {
  for (const polygon of POLYGONS) {
    if (
      lat >= polygon.minLat &&
      lat <= polygon.maxLat &&
      lng >= polygon.minLng &&
      lng <= polygon.maxLng
    ) {
      return polygon.name === 'jawa48h' ? 'jawa48h' : polygon.name;
    }
  }
  return 'beyond';
}

/**
 * Map courier category from our internal tiers to the polygon's courier field.
 */
function courierForTier(tier: ShippingTier): GeoPolygon['couriers'][number] | null {
  if (tier === 'express' || tier === 'pickup') return 'kilat';
  if (tier === 'frozen_same_day') return 'same_day';
  if (tier === 'frozen_express') return 'frozen_express';
  return null;
}

export interface ServiceabilityResult {
  readonly ok: boolean;
  readonly reason: string | null;
  readonly destinationClass: DestinationClass;
  readonly applicablePolygon: GeoPolygon | null;
}

/**
 * Decide whether a destination is serviceable for a given tier and weight,
 * under a shipping phase setting (phase0 | phase1 | phase2).
 */
export function isServiceable(
  lat: number,
  lng: number,
  tier: ShippingTier,
  totalWeightGram: number,
  phase: 'phase0' | 'phase1' | 'phase2' = 'phase0',
  subtotal: number = 0
): ServiceabilityResult {
  const destinationClass = classifyDestination(lat, lng);
  if (destinationClass === 'beyond') {
    return {
      ok: false,
      reason: 'beyond_polygon_contact_whatsapp',
      destinationClass,
      applicablePolygon: null,
    };
  }

  const polygon = POLYGONS.find((p) => p.name === destinationClass);
  if (!polygon) {
    return {
      ok: false,
      reason: 'beyond_polygon_contact_whatsapp',
      destinationClass,
      applicablePolygon: null,
    };
  }

  if (tier === 'pickup') {
    return { ok: true, reason: null, destinationClass, applicablePolygon: polygon };
  }

  // Phase gates — refuse tiers beyond the current phase.
  const allowedByPhase = tierVisibilityForPhase(phase);
  if (!allowedByPhase.has(tier)) {
    return {
      ok: false,
      reason: `tier_locked_for_phase_${phase}`,
      destinationClass,
      applicablePolygon: polygon,
    };
  }

  const courier = courierForTier(tier);
  if (!courier || !polygon.couriers.includes(courier)) {
    return {
      ok: false,
      reason: `courier_unavailable_for_polygon_${destinationClass}`,
      destinationClass,
      applicablePolygon: polygon,
    };
  }

  if (totalWeightGram > polygon.maxWeightGram) {
    return {
      ok: false,
      reason: 'weight_exceeded_polygon_max',
      destinationClass,
      applicablePolygon: polygon,
    };
  }

  // Phase 2 minimum-subtotal guardrail for intercity lanes (L3 Decision 3)
  if (phase === 'phase2' && destinationClass === 'jawa48h' && subtotal < 250_000) {
    return {
      ok: false,
      reason: 'intercity_min_subtotal_not_met',
      destinationClass,
      applicablePolygon: polygon,
    };
  }

  return { ok: true, reason: null, destinationClass, applicablePolygon: polygon };
}

/**
 * Which tiers may be offered for a given shipping phase.
 */
export function tierVisibilityForPhase(phase: 'phase0' | 'phase1' | 'phase2'): Set<ShippingTier> {
  if (phase === 'phase0') return new Set<ShippingTier>(['pickup', 'express']);
  if (phase === 'phase1') return new Set<ShippingTier>(['pickup', 'express', 'frozen_same_day']);
  return new Set<ShippingTier>(['pickup', 'express', 'frozen_same_day', 'frozen_express']);
}

export interface PhaseMetrics {
  readonly phase0OrderCount: number;
  readonly spoilageRatePercent: number;
  readonly dispatchFailureRatePercent: number;
}

/**
 * Numeric entry criteria from L3 Decision 1.
 */
export const PHASE1_CRITERIA = {
  minPhase0Orders: 50,
  maxSpoilagePercent: 2,
  maxDispatchFailurePercent: 5,
} as const;

/**
 * Decide whether Phase 1 is unlocked based on observable metrics.
 * Phase is forced back to phase0 until criteria are met.
 */
export function gatePhase1(metrics: PhaseMetrics): boolean {
  return (
    metrics.phase0OrderCount >= PHASE1_CRITERIA.minPhase0Orders &&
    metrics.spoilageRatePercent < PHASE1_CRITERIA.maxSpoilagePercent &&
    metrics.dispatchFailureRatePercent < PHASE1_CRITERIA.maxDispatchFailurePercent
  );
}
