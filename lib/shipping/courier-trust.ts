/**
 * Courier trust tiers (L3) — primary / fallback / probation / never.
 *
 * Mirrors the courier allowlist in the Biteship dashboard (where enforcement
 * actually happens). This module is used by the rates provider to demote /
 * exclude couriers at the code layer in addition to the dashboard.
 */

export type CourierTrustTier = 'primary' | 'fallback' | 'probation' | 'never';

export const COURIER_TRUST_TIER: Record<string, CourierTrustTier> = {
  paxel: 'primary',
  gojek: 'primary',
  grab: 'fallback',
  anteraja: 'fallback',
  sicepat: 'fallback',
  jne: 'probation',
  borzo: 'never',
  ninja: 'never',
  lion: 'never',
};

/**
 * Whether a courier may be served quotes at all in the customer UI.
 */
export function isCourierAllowed(code: string): boolean {
  const tier = COURIER_TRUST_TIER[code.toLowerCase()];
  if (!tier) return true; // unknown courier — let Biteship decide at booking
  return tier !== 'never';
}

/**
 * Demote a quote's selected state if its courier is probation or worse.
 * Used by the booking flow — probation is allowed, but tagged for ops awareness.
 */
export function reliabilityScoreFor(code: string): number {
  const tier = COURIER_TRUST_TIER[code.toLowerCase()];
  switch (tier) {
    case 'primary':
      return 1;
    case 'fallback':
      return 0.85;
    case 'probation':
      return 0.7;
    case 'never':
      return 0;
    default:
      return 0.9;
  }
}
