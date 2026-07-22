import type { QuoteOption } from './types';

const ETA_PENALTY_PER_DAY = 500;
const COD_BONUS = -3000;

/**
 * Parse estimated duration string to approximate days for ranking.
 */
function parseEtaDays(duration: string): number {
  const lower = duration.toLowerCase();
  const hourMatch = lower.match(/(\d+)\s*jam/);
  if (hourMatch) return 0.5;
  const dayMatch = lower.match(/(\d+)\s*hari/);
  if (dayMatch) return Number(dayMatch[1]);
  if (lower.includes('instant') || lower.includes('same')) return 0;
  return 2;
}

/**
 * Score option for auto-pick: lower is better (price + ETA penalty - COD bonus).
 */
function scoreOption(option: QuoteOption): number {
  let score = option.customerCost + parseEtaDays(option.estimatedDuration) * ETA_PENALTY_PER_DAY;
  if (option.cashOnDeliveryAvailable) score += COD_BONUS;
  return score;
}

/**
 * Sort options: eligible first (by score), disabled at bottom.
 */
export function rankOptions(options: QuoteOption[]): QuoteOption[] {
  const enabled = options.filter((o) => !o.disabled);
  const disabled = options.filter((o) => o.disabled);

  enabled.sort((a, b) => scoreOption(a) - scoreOption(b));
  disabled.sort((a, b) => scoreOption(a) - scoreOption(b));

  return [...enabled, ...disabled];
}

/**
 * Pick recommended option id from ranked list.
 */
export function pickRecommendedOptionId(options: QuoteOption[]): string | null {
  const ranked = rankOptions(options);
  const first = ranked.find((o) => !o.disabled);
  return first?.id ?? null;
}
