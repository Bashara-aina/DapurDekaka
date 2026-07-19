/**
 * Maintenance / circuit breaker (L4 Decision) — when founder is offline or
 * dispatch has failed twice, the public site switches to pickup-only with
 * a WhatsApp fallback banner.
 *
 * Maintenance mode is a single boolean in `systemSettings` (`maintenance_mode`).
 * Setting it true flips the maintenance middleware to refuse non-pickup
 * checkout flows; setting it false restores full commerce.
 */

import { getSetting } from '@/lib/settings/get-settings';
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
  return readMaintenanceStatus();
}

/**
 * Cheap sync check used by middleware (no DB call). Reads from env so the
 * middleware can short-circuit without contacting the database. Set
 * `MAINTENANCE_MODE=true` at the edge to force a redirect even if the DB
 * setting differs.
 */
export function isMaintenanceModeEnv(): boolean {
  return process.env.MAINTENANCE_MODE === 'true';
}
