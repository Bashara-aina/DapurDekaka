/**
 * Helper hiring trigger (L4 — Capacity model).
 *
 * Sustained weeks exceeding the trigger threshold should pre-commit a hire
 * decision. We surface weeks-over-eighty rather than wait for the order
 * queue to silently degrade.
 */

import { HELPER_TRIGGER_ORDERS_PER_WEEK } from '@/lib/constants/financial-rules';

export interface HiringTriggerInput {
  readonly ordersPerWeek: ReadonlyArray<{ readonly weekStartIso: string; readonly orderCount: number }>;
  readonly consecutiveWeeks: number;
}

export interface HiringTriggerResult {
  readonly triggered: boolean;
  readonly weeksOverEighty: number;
  readonly recommendation: string;
}

export function evaluateHiringTrigger(input: HiringTriggerInput): HiringTriggerResult {
  const recent = input.ordersPerWeek.slice(-input.consecutiveWeeks);
  const weeksOverEighty = recent.filter((w) => w.orderCount >= HELPER_TRIGGER_ORDERS_PER_WEEK).length;
  const triggered = weeksOverEighty >= 2;
  const recommendation = triggered
    ? `Waktu perekrutan helper — ${weeksOverEighty} minggu terakhir di atas ${HELPER_TRIGGER_ORDERS_PER_WEEK} pesanan/minggu.`
    : `Belum perlu helper. Threshold: ${HELPER_TRIGGER_ORDERS_PER_WEEK} pesanan/minggu selama ${input.consecutiveWeeks} minggu berturut-turut.`;
  return { triggered, weeksOverEighty, recommendation };
}
