import { waitUntil } from '@vercel/functions';
import { logger } from '@/lib/utils/logger';

/**
 * Run a notification after the response without relying on the request
 * lifecycle. On Vercel, un-awaited promises can be frozen the moment a handler
 * returns; `waitUntil` keeps the invocation alive until the task settles.
 *
 * Falls back to a detached promise in local/unit-test contexts where the
 * Vercel request context is unavailable.
 */
export function scheduleBackground(
  task: Promise<unknown>,
  label = 'background task'
): void {
  const settled = task.catch((error) => {
    logger.error(`[background] ${label} failed`, {
      error: error instanceof Error ? error.message : String(error),
    });
  });

  try {
    waitUntil(settled);
  } catch {
    void settled;
  }
}
