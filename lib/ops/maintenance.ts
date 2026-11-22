/**
 * Maintenance / circuit breaker (L4 Decision) — when founder is offline or
 * dispatch has failed twice, the public site switches to pickup-only with
 * a WhatsApp fallback banner.
 *
 * Maintenance mode is a single boolean in `systemSettings` (`maintenance_mode`).
 *
 * Split for Neon bill / Edge safety:
 * - Edge middleware: env kill-switch only (`MAINTENANCE_MODE`) — never opens DB.
 * - Node store layout: DB-backed admin toggle via `isMaintenanceMode()` (5-min
 *   settings snapshot cache).
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
  // Invalidate so the next Node layout read picks up the change.
  invalidateSetting('maintenance_mode');
  invalidateSetting('maintenance_mode_updated_at');
  invalidateSetting('maintenance_mode_updated_by');
  return readMaintenanceStatus();
}

/**
 * Check whether maintenance mode is active (Node / RSC only).
 *
 * Fast-path: env-var kill-switch (deploy-time).
 * Slow-path: DB-backed setting (admin panel, 5-min snapshot cache).
 *
 * Do not call from Edge middleware — use `isMaintenanceModeEnv()` there.
 */
export async function isMaintenanceMode(): Promise<boolean> {
  if (isMaintenanceModeEnv()) return true;
  return (await getSetting<boolean>('maintenance_mode', 'boolean')) ?? false;
}

/**
 * Sync env-only check safe for Edge middleware (no Neon connection).
 */
export function isMaintenanceModeEnv(): boolean {
  return process.env.MAINTENANCE_MODE === 'true';
}
