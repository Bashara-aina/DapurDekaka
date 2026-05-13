import { db } from '@/lib/db';
import { adminActivityLogs } from '@/lib/db/schema';

export interface AdminActivityInput {
  userId: string;
  action: string;
  targetType: string;
  targetId?: string;
  beforeState?: Record<string, unknown>;
  afterState?: Record<string, unknown>;
  ipAddress?: string;
  userAgent?: string;
}

/**
 * Log admin activity for audit trail.
 * Non-blocking — failures are logged but never block the operation.
 */
export async function logAdminActivity(input: AdminActivityInput): Promise<void> {
  try {
    db.insert(adminActivityLogs)
      .values({
        userId: input.userId,
        action: input.action,
        entityType: input.targetType,
        entityId: input.targetId,
        beforeState: input.beforeState ?? null,
        afterState: input.afterState ?? null,
        ipAddress: input.ipAddress ?? null,
        userAgent: input.userAgent ?? null,
      })
      .catch((err) => {
        console.error('[Audit] Failed to log activity:', err);
      });
  } catch (error) {
    // Non-blocking - just log the error
    console.error('[Audit] Error preparing activity log:', error);
  }
}