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
import { generateBackupCodes, hashBackupCodes } from '@/lib/auth/two-factor';
import { requireTwoFactorUser, isAdminRole } from '../_common';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const regenSchema = z.object({
  password: z.string().min(1, 'Password diperlukan untuk membuat kode baru'),
});

/**
 * POST /api/auth/2fa/backup-codes — regenerate backup codes.
 * Invalidates all previous codes. Display-once response.
 */
export const POST = withRateLimit(
  withCsrf(async (req: NextRequest) => {
    try {
      const { user, error } = await requireTwoFactorUser(req);
      if (error || !user) return error ?? unauthorized('Silakan login');

      const parsed = regenSchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) return validationError(parsed.error);
      if (!user.twoFactorEnabled) return conflict('2FA belum aktif');

      if (!user.passwordHash) {
        return forbidden('Akun Google-only: hubungi admin untuk membuat kode baru');
      }
      const pwOk = await bcrypt.compare(parsed.data.password, user.passwordHash);
      if (!pwOk) {
        logger.warn('[2fa/backup-codes] wrong password', {
          userId: user.id,
          ip: getClientIp(req),
        });
        return forbidden('Password salah');
      }

      const backupCodes = generateBackupCodes();
      await db
        .update(users)
        .set({
          twoFactorBackupCodes: await hashBackupCodes(backupCodes),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      if (isAdminRole(user.role)) {
        logAdminActivity({
          userId: user.id,
          action: 'auth.2fa_backup_codes_regenerated',
          targetType: 'user',
          targetId: user.id,
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
        });
      }
      logger.info('[2fa/backup-codes] regenerated', { userId: user.id });
      return success({ backupCodes });
    } catch (err) {
      logger.error('[2fa/backup-codes]', {
        error: err instanceof Error ? err.message : String(err),
      });
      return serverError(err);
    }
  }),
  'auth'
);
