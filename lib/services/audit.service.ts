import { db } from '@/lib/db';
import { adminActivityLogs } from '@/lib/db/schema';
import { logger } from '@/lib/utils/logger';

export interface AdminActivityInput {
  userId: string;
  action: string;
  targetType: string;
  targetId?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Log admin activity for audit trail.
 *
 * Always returns void and never throws — the operation must not be blocked by
 * an audit failure. Failures are logged via the structured logger at WARN so
 * they show up in Vercel/Logtail.
 */
export async function logAdminActivity(input: AdminActivityInput): Promise<void> {
  try {
    await db
      .insert(adminActivityLogs)
      .values({
        userId: input.userId,
        action: input.action,
        entityType: input.targetType,
        entityId: input.targetId ?? null,
        beforeState: input.beforeState ?? null,
        afterState: input.afterState ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      })
      .catch((err) => {
        logger.warn('[Audit] Failed to insert activity log', {
          action: input.action,
          targetType: input.targetType,
          targetId: input.targetId,
          error: err instanceof Error ? err.message : String(err),
        });
      });
  } catch (error) {
    logger.warn('[Audit] Error preparing activity log', {
      error: error instanceof Error ? error.message : String(error),
    });
  }
}