import { NextRequest } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import {
  success,
  unauthorized,
  forbidden,
  serverError,
  validationError,
  conflict,
} from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { withCsrf } from '@/lib/utils/csrf';
import { logAdminActivity } from '@/lib/services/audit.service';
import { getClientIp, getUserAgent } from '@/lib/utils/request-meta';
import { requireTwoFactorUser, isAdminRole } from '../_common';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const disableSchema = z.object({
  password: z.string().min(1, 'Password diperlukan untuk menonaktifkan 2FA'),
});

/**
 * POST /api/auth/2fa/disable — turn off 2FA after password re-authentication.
 * Clears the secret + backup codes and bumps tokenVersion so in-flight JWTs die.
 */
export const POST = withRateLimit(
  withCsrf(async (req: NextRequest) => {
    try {
      const { user, error } = await requireTwoFactorUser(req);
      if (error || !user) return error ?? unauthorized('Silakan login');

      const parsed = disableSchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) return validationError(parsed.error);
      if (!user.twoFactorEnabled) return conflict('2FA belum aktif');

      if (!user.passwordHash) {
        return forbidden('Akun Google-only: hubungi admin untuk menonaktifkan 2FA');
      }
      const pwOk = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!pwOk) {
        logger.warn('[2fa/disable] wrong password', { userId: user.id, ip: getClientIp(req) });
        return forbidden('Password salah');
      }

      await db
        .update(users)
        .set({
          twoFactorEnabled: false,
          twoFactorSecret: null,
          twoFactorBackupCodes: [],
          twoFactorEnabledAt: null,
          tokenVersion: user.tokenVersion + 1,
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      if (isAdminRole(user.role)) {
        logAdminActivity({
          userId: user.id,
          action: 'auth.2fa_disabled',
          targetType: 'user',
          targetId: user.id,
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
        });
      }
      logger.info('[2fa/disable] 2FA disabled', { userId: user.id });
      return success({ enabled: false });
    } catch (err) {
      logger.error('[2fa/disable]', { error: err instanceof Error ? err.message : String(err) });
      return serverError(err);
    }
  }),
  'auth'
);
