import { NextRequest } from 'next/server';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { requireActiveUser } from '@/lib/auth/require-active';
import { db } from '@/lib/db';
import { addresses, users } from '@/lib/db/schema';
import {
  success,
  unauthorized,
  serverError,
  validationError,
  forbidden,
} from '@/lib/utils/api-response';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { isSameOriginRequest, sameOriginRejected } from '@/lib/utils/same-origin';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const DeleteSchema = z.object({
  confirm: z.literal('HAPUS AKUN'),
});

/**
 * UU PDP — soft-delete / anonymise account.
 * Order financial records are retained (userId kept; PII on user row cleared).
 * Admin/staff accounts cannot self-delete via this route.
 */
export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    if (!isSameOriginRequest(req)) return sameOriginRejected();

    const session = await auth();
    if (!session?.user?.id) return unauthorized('Silakan masuk terlebih dahulu');

    const activeUser = await requireActiveUser();
    if (!activeUser) return unauthorized('Akun Anda dinonaktifkan');

    const role = session.user.role;
    if (role && ['superadmin', 'owner', 'warehouse'].includes(role)) {
      return forbidden('Akun staf tidak dapat dihapus lewat portal pelanggan');
    }

    const body = await req.json();
    const parsed = DeleteSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const userId = session.user.id;
    const anonymisedEmail = `deleted+${userId.slice(0, 8)}@anonymised.local`;

    const current = await db.query.users.findFirst({
      where: eq(users.id, userId),
      columns: { tokenVersion: true },
    });

    await db.transaction(async (tx) => {
      await tx.delete(addresses).where(eq(addresses.userId, userId));
      await tx
        .update(users)
        .set({
          name: 'Akun Dihapus',
          email: anonymisedEmail,
          phone: null,
          passwordHash: null,
          image: null,
          isActive: false,
          deletedAt: new Date(),
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: [],
          pointsBalance: 0,
          tokenVersion: (current?.tokenVersion ?? 0) + 1,
          updatedAt: new Date(),
        })
        .where(eq(users.id, userId));
    });

    logger.info('[account/delete] account anonymised', { userId });
    return success({ deleted: true });
  } catch (error) {
    logger.error('[account/delete]', {
      error: error instanceof Error ? error.message : String(error),
    });
    return serverError(error);
  }
}, 'auth');
