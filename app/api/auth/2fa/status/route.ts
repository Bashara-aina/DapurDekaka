import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, unauthorized, serverError } from '@/lib/utils/api-response';
import { withRateLimit } from '@/lib/utils/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * GET /api/auth/2fa/status — whether 2FA is enabled for the current user.
 * Safe method: no CSRF challenge, IP-keyed auth-tier rate limit.
 */
export const GET = withRateLimit(async (_req: NextRequest) => {
  try {
    const session = await auth();
    if (!session?.user?.id) return unauthorized('Silakan login terlebih dahulu');
    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
      columns: { twoFactorEnabled: true, twoFactorEnabledAt: true },
    });
    if (!user) return unauthorized('Silakan login terlebih dahulu');
    return success({
      enabled: user.twoFactorEnabled === true,
      enabledAt: user.twoFactorEnabledAt,
    });
  } catch (error) {
    return serverError(error);
  }
}, 'auth');
