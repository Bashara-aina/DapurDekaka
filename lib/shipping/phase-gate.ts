/**
 * Phase-criteria gate for frozen tier checkouts (L3).
 *
 * `systemSettings.shipping_phase` declares intent — 'phase0' | 'phase1' | 'phase2'.
 * The numeric criteria from L3 Decision 1 (50 orders / <2% spoilage / <5% dispatch
 * failure) act as a *gating override*: even if the admin flips the setting to
 * phase1/phase2, the effective phase is forced back to phase0 until metrics prove
 * readiness. This helper exposes that override to the checkout route so we reject
 * frozen-tier checkouts early instead of after we have already started a Midtrans
 * transaction.
 */

import { eq, and, ne, count } from 'drizzle-orm';
import { db } from '@/lib/db';
import { orders, disputes } from '@/lib/db/schema';
import { getSetting } from '@/lib/settings/get-settings';
import { gatePhase1, type PhaseMetrics } from './geo-policy';
import { INTERCITY_MIN_SUBTOTAL_IDR } from '@/lib/constants/financial-rules';
import type { ShippingTier, ShippingRatesResult, TierQuotes } from './types';

export type ShippingPhase = 'phase0' | 'phase1' | 'phase2';

export type PhaseGateCode = 'phase_not_ready' | 'intercity_min_order';

export interface PhaseGateResult {
  readonly ok: boolean;
  readonly httpStatus: number;
  readonly code: PhaseGateCode | null;
  readonly message: string | null;
  readonly effectivePhase: ShippingPhase;
}

const DEFAULT_PHASE: ShippingPhase = 'phase0';
const ZERO_METRICS: PhaseMetrics = {
  phase0OrderCount: 0,
  spoilageRatePercent: 0,
  dispatchFailureRatePercent: 0,
};

/**
 * Read `systemSettings.shipping_phase`. Returns 'phase0' when the setting is
 * missing or carries an unexpected value — the safe default per L3.
 */
export async function readShippingPhase(): Promise<ShippingPhase> {
  const raw = await getSetting<string>('shipping_phase', 'string');
  if (raw === 'phase1' || raw === 'phase2' || raw === 'phase0') return raw;
  return DEFAULT_PHASE;
}

/**
 * Compute the numeric metrics used by `gatePhase1`.
 *
 * Counts delivery orders that completed (paid or beyond) for the order base,
 * derives the spoilage rate from dispute rows tagged `category = 'spoilage'`,
 * and the dispatch failure rate from orders whose `dispatch_status = 'failed'`.
 */
export async function computePhaseMetrics(): Promise<PhaseMetrics> {
  const [orderRow] = await db
    .select({ value: count() })
    .from(orders)
    .where(
      and(
        eq(orders.deliveryMethod, 'delivery'),
        ne(orders.status, 'pending_payment'),
        ne(orders.status, 'cancelled')
      )
    );
  const totalDeliveryOrders = Number(orderRow?.value ?? 0);

  if (totalDeliveryOrders === 0) return ZERO_METRICS;

  const [spoilageRow] = await db
    .select({ value: count() })
    .from(disputes)
    .innerJoin(orders, eq(disputes.orderId, orders.id))
    .where(
      and(
        eq(disputes.category, 'spoilage'),
        eq(orders.deliveryMethod, 'delivery'),
        ne(orders.status, 'pending_payment'),
        ne(orders.status, 'cancelled')
      )
    );
  const spoilageOrders = Number(spoilageRow?.value ?? 0);

  const [failedRow] = await db
    .select({ value: count() })
    .from(orders)
    .where(
      and(
        eq(orders.deliveryMethod, 'delivery'),
        eq(orders.dispatchStatus, 'failed'),
        ne(orders.status, 'pending_payment'),
        ne(orders.status, 'cancelled')
      )
    );
  const dispatchFailedOrders = Number(failedRow?.value ?? 0);

  return {
    phase0OrderCount: totalDeliveryOrders,
    spoilageRatePercent: (spoilageOrders / totalDeliveryOrders) * 100,
    dispatchFailureRatePercent: (dispatchFailedOrders / totalDeliveryOrders) * 100,
  };
}

/**
 * Force the configured phase back to phase0 until phase1 criteria are met.
 */
export async function resolveEffectivePhase(): Promise<ShippingPhase> {
  const configured = await readShippingPhase();
  if (configured === 'phase0') return 'phase0';
  const metrics = await computePhaseMetrics();
  return gatePhase1(metrics) ? configured : 'phase0';
}

/**
 * Decide whether the chosen shipping tier is allowed at checkout.
 *
 * - `pickup` and `express` are always permitted.
 * - `frozen_same_day` requires effective phase >= phase1.
 * - `frozen_express` requires effective phase >= phase2 AND subtotal meets the
 *   intercity minimum (Rp 250k) per L3 Decision 3.
 *
 * Returns a discriminated result so the route can map it onto the matching
 * api-response helper (503 vs 422).
 */
export async function enforceShippingPhaseGates(
  tier: ShippingTier,
  subtotal: number
): Promise<PhaseGateResult> {
  if (tier === 'pickup' || tier === 'express') {
    return { ok: true, httpStatus: 200, code: null, message: null, effectivePhase: 'phase0' };
  }

  const effectivePhase = await resolveEffectivePhase();

  if (tier === 'frozen_same_day') {
    if (effectivePhase === 'phase0') {
      return {
        ok: false,
        httpStatus: 503,
        code: 'phase_not_ready',
        message: 'Layanan Same-Day belum tersedia — kriteria operasional belum terpenuhi.',
        effectivePhase,
      };
    }
    return { ok: true, httpStatus: 200, code: null, message: null, effectivePhase };
  }

  // tier === 'frozen_express'
  if (effectivePhase !== 'phase2') {
    return {
      ok: false,
      httpStatus: 503,
      code: 'phase_not_ready',
      message: 'Layanan Same-Day belum tersedia — kriteria operasional belum terpenuhi.',
      effectivePhase,
    };
  }

  if (subtotal < INTERCITY_MIN_SUBTOTAL_IDR) {
    return {
      ok: false,
      httpStatus: 422,
      code: 'intercity_min_order',
      message: `Minimal pembelian ${formatIdr(INTERCITY_MIN_SUBTOTAL_IDR)} untuk Frozen Express antar kota.`,
      effectivePhase,
    };
  }

  return { ok: true, httpStatus: 200, code: null, message: null, effectivePhase };
}

function formatIdr(value: number): string {
  return `Rp ${value.toLocaleString('id-ID')}`;
}

/**
 * FD#2: lock frozen tiers at the rates endpoint so phase0/unmet-criteria tiers
 * are surfaced as disabled (not freely selectable then 503'd at pay time).
 *
 * - `express` is always selectable.
 * - `frozen_same_day` requires effective phase >= phase1.
 * - `frozen_express` requires effective phase2 AND subtotal >= intercity min.
 */
export function applyPhaseLockToRates(
  result: ShippingRatesResult,
  effectivePhase: ShippingPhase,
  subtotal: number
): ShippingRatesResult {
  const sameDayLocked = effectivePhase === 'phase0';
  const expressPhaseLocked = effectivePhase !== 'phase2';
  const expressMinLocked = !expressPhaseLocked && subtotal < INTERCITY_MIN_SUBTOTAL_IDR;

  return {
    ...result,
    tiers: {
      express: result.tiers.express,
      frozenSameDay: sameDayLocked ? lockTier(result.tiers.frozenSameDay, 'phase_locked') : result.tiers.frozenSameDay,
      frozenExpress: expressPhaseLocked
        ? lockTier(result.tiers.frozenExpress, 'phase_locked')
        : expressMinLocked
          ? lockTier(result.tiers.frozenExpress, 'intercity_min_order')
          : result.tiers.frozenExpress,
    },
  };
}

function lockTier(tier: TierQuotes, reason: string): TierQuotes {
  return {
    recommendedOptionId: null,
    options: tier.options.map((option) => ({
      ...option,
      disabled: true,
      disabledReason: reason,
    })),
  };
}
