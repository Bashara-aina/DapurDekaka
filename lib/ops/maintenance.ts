/**
 * Maintenance / circuit breaker (L4 Decision) — when founder is offline or
 * dispatch has failed twice, the public site switches to pickup-only with
 * a WhatsApp fallback banner.
 *
 * Maintenance mode is a single boolean in `systemSettings` (`maintenance_mode`).
 * Setting it true flips the maintenance middleware to refuse non-pickup
 * checkout flows; setting it false restores full commerce.
 *
 * The middleware checks BOTH the env var AND the DB setting, using the env
 * var as a fast bypass.  The admin toggle writes to the DB; the middleware
 * reads from the DB (with 5-min cache via getSetting), so flipping the
 * toggle in the admin panel now actually takes effect at the edge.
 */

import { getSetting, invalidateSetting } from '@/lib/settings/get-settings';
import { setSetting } from '@/lib/settings/set-settings';

export interface MaintenanceStatus {
  readonly enabled: boolean;
  readonly updatedAt: Date | null;
  readonly updatedBy: string | null;
}

export async function readMaintenanceStatus(): Promise<MaintenanceStatus> {
  const enabled = (await getSetting<boolean>('maintenance_mode', 'boolean')) ?? false;
  const updatedAt = await getSetting<string>('maintenance_mode_updated_at', 'string');
  const updatedBy = await getSetting<string>('maintenance_mode_updated_by', 'string');
  return {
    enabled,
    updatedAt: updatedAt ? new Date(updatedAt) : null,
    updatedBy: updatedBy ?? null,
  };
}

export async function setMaintenanceMode(
  ownerId: string,
  enabled: boolean,
  options?: { etaBackAt?: string }
): Promise<MaintenanceStatus> {
  await setSetting('maintenance_mode', 'boolean', enabled ? 'true' : 'false');
  await setSetting('maintenance_mode_updated_by', 'string', ownerId);
  await setSetting('maintenance_mode_updated_at', 'string', new Date().toISOString());
  if (options?.etaBackAt) {
    await setSetting('maintenance_mode_eta', 'string', options.etaBackAt);
  } else if (!enabled) {
    await setSetting('maintenance_mode_eta', 'string', '');
  }
  // Invalidate the cache so the next middleware invocation picks up the change.
  invalidateSetting('maintenance_mode');
  invalidateSetting('maintenance_mode_updated_at');
  invalidateSetting('maintenance_mode_updated_by');
  return readMaintenanceStatus();
}

/**
 * Check whether maintenance mode is active.
 *
 * Fast-path: env-var check (settable at deploy-time).
 * Slow-path: DB-backed setting (toggleable from admin panel, 5-min cache).
 *
 * Either being true puts the site into maintenance.  This ensures that both
 * the deploy-time toggle AND the runtime admin toggle work.
 */
export async function isMaintenanceMode(): Promise<boolean> {
  if (process.env.MAINTENANCE_MODE === 'true') return true;
  return (await getSetting<boolean>('maintenance_mode', 'boolean')) ?? false;
}

/**
 * Cheap sync check used by legacy callers that cannot await.
 * Only reads the env var — does NOT check the DB.
 * Prefer `isMaintenanceMode()` for new code.
 */
export function isMaintenanceModeEnv(): boolean {
  return process.env.MAINTENANCE_MODE === 'true';
}
