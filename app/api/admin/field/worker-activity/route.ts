import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { adminActivityLogs, users } from '@/lib/db/schema';
import { eq, and, gte, lt } from 'drizzle-orm';
import { success, serverError, forbidden } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Anda harus login');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner', 'warehouse'].includes(role)) {
      return forbidden('Anda tidak memiliki akses ke fitur ini');
    }

    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 7, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 7, 0, 0);

    const activities = await db.query.adminActivityLogs.findMany({
      where: and(
        gte(adminActivityLogs.createdAt, startOfDay),
        lt(adminActivityLogs.createdAt, endOfDay)
      ),
      orderBy: (logs, { desc }) => [desc(logs.createdAt)],
    });

    const userIds = [...new Set(activities.map((a) => a.userId))];
    const usersMap: Record<string, string> = {};
    if (userIds.length > 0) {
      const users = await db.query.users.findMany({
        where: userIds.length > 0 ? undefined : undefined,
      });
      // fetch individually to avoid complex query
      for (const uid of userIds) {
        const user = await db.query.users.findFirst({
          where: eq(users.id, uid),
        });
        if (user) usersMap[uid] = user.name;
      }
    }

    const grouped: Record<string, {
      userId: string;
      userName: string;
      actions: {
        action: string;
        entityType: string;
        entityId: string | null;
        timestamp: Date;
      }[];
    }> = {};

    for (const activity of activities) {
      const userId = activity.userId;
      if (!grouped[userId]) {
        grouped[userId] = {
          userId,
          userName: usersMap[userId] || 'Unknown',
          actions: [],
        };
      }
      grouped[userId].actions.push({
        action: activity.action,
        entityType: activity.entityType,
        entityId: activity.entityId,
        timestamp: activity.createdAt,
      });
    }

    return success(Object.values(grouped));
  } catch (error) {
    console.error('[admin/field/worker-activity GET]', error);
    return serverError(error);
  }
}