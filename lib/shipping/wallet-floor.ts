/**
 * Biteship wallet floor (L2 Rule 9) — operator MUST keep the Biteship wallet
 * topped up to 2× the previous week's dispatch cost. Wallet-empty halts all
 * dispatch.
 *
 * The Biteship balance API requires production credentials we don't have at
 * build time; we read from an env var (`BITESHIP_WALLET_BALANCE_IDR`) populated
 * by an external polling cron, falling back to a safe minimum.
 */

import { WALLET_FLOOR_MULTIPLIER } from '@/lib/constants/financial-rules';

export interface WalletFloorCheck {
  readonly balance: number;
  readonly floorAmount: number;
  readonly ok: boolean;
  readonly shortfall: number;
  readonly weeklyDispatchCost: number;
  readonly source: 'env' | 'fallback';
}

function parseEnvBalance(): number | null {
  const raw = process.env.BITESHIP_WALLET_BALANCE_IDR;
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Resolve the wallet floor check given last 7-day dispatch cost.
 * @param weeklyDispatchCost Sum of biteshipActualCost for paid+booked orders.
 */
export function getWalletFloorCheck(weeklyDispatchCost: number = 0): WalletFloorCheck {
  const balance = parseEnvBalance();
  const floorAmount = Math.max(0, Math.floor(weeklyDispatchCost * WALLET_FLOOR_MULTIPLIER));
  if (balance === null) {
    return {
      balance: 0,
      floorAmount,
      ok: false,
      shortfall: floorAmount,
      weeklyDispatchCost,
      source: 'fallback',
    };
  }
  return {
    balance,
    floorAmount,
    ok: balance >= floorAmount,
    shortfall: Math.max(0, floorAmount - balance),
    weeklyDispatchCost,
    source: 'env',
  };
}
