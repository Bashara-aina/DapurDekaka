/**
 * Centralized launch-time feature-flag registry.
 *
 * Every feature that has been deferred or hidden per the L4 kill list must
 * gate here. Reads from env (process.env.NEXT_PUBLIC_FLAG_*) at startup; falls back to
 * the documented default. Use `isFlagEnabled('name')` from any UI guard or
 * middleware to keep the gate declarative.
 *
 * Hard rule from L4: kill list (B2B portal, blog CMS, AI tools, vouchers,
 * insurance UI) is binding for 90 days regardless of audit findings. Re-enable
 * only via founder decision.
 */

export interface FlagConfig {
  readonly default: boolean;
  readonly envKey: string;
  readonly note: string;
}

export const FLAGS = {
  insuranceUI: {
    default: false,
    envKey: 'NEXT_PUBLIC_FLAG_INSURANCE_UI',
    note: 'Hide insurance selector until L1 Decision 3 resolved (L4 kill list)',
  },
  b2bPortal: {
    default: false,
    envKey: 'NEXT_PUBLIC_FLAG_B2B_PORTAL',
    note: 'Hide /b2b/portal/* routes; keep landing + WA inquiry only (L5 Decision 3)',
  },
  blogCMS: {
    default: false,
    envKey: 'NEXT_PUBLIC_FLAG_BLOG_CMS',
    note: 'Hide admin blog editor; keep public blog listing (L4 kill list)',
  },
  aiContent: {
    default: false,
    envKey: 'NEXT_PUBLIC_FLAG_AI_CONTENT',
    note: 'Hide /admin/ai-content (L4 kill list)',
  },
  vouchersPage: {
    default: false,
    envKey: 'NEXT_PUBLIC_FLAG_VOUCHERS',
    note: 'Hide /account/vouchers (L4 kill list)',
  },
  softLaunch: {
    default: false,
    envKey: 'NEXT_PUBLIC_FLAG_SOFT_LAUNCH',
    note: 'Soft-launch banner + noindex robots (L5 Week 0–2). Set to true during soft launch.',
  },
  samplerPromo: {
    default: false,
    envKey: 'NEXT_PUBLIC_FLAG_SAMPLER_PROMO',
    note: 'Free SKU add-on for orders ≥ Rp 150k (L5 Decision 3 + SAMPLER_MIN)',
  },
} as const satisfies Record<string, FlagConfig>;

export type FlagName = keyof typeof FLAGS;

/**
 * Resolve a flag's effective value: env wins over default.
 */
export function isFlagEnabled(name: FlagName): boolean {
  const flag = FLAGS[name];
  const env = process.env[flag.envKey];
  if (env === undefined) return flag.default;
  return env === '1' || env.toLowerCase() === 'true';
}

/**
 * Resolve all flag values at once — used by the daily ops card to render state.
 */
export function resolveAllFlags(): Record<FlagName, boolean> {
  return Object.fromEntries(
    (Object.keys(FLAGS) as FlagName[]).map((k) => [k, isFlagEnabled(k)])
  ) as Record<FlagName, boolean>;
}
