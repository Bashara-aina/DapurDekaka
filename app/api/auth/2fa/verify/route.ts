import { NextRequest } from 'next/server';
import { z } from 'zod';
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
import {
  decryptTotpSecret,
  verifyTotpCode,
  generateBackupCodes,
  hashBackupCodes,
} from '@/lib/auth/two-factor';
import { requireTwoFactorUser, isAdminRole } from '../_common';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const verifySchema = z.object({
  token: z.string().min(6).max(12),
});

/**
 * POST /api/auth/2fa/verify — confirm setup with a 6-digit code.
 * Enables 2FA and returns one-time backup codes (display once).
 */
export const POST = withRateLimit(
  withCsrf(async (req: NextRequest) => {
    try {
      const { user, error } = await requireTwoFactorUser(req);
      if (error || !user) return error ?? unauthorized('Silakan login');

      const parsed = verifySchema.safeParse(await req.json().catch(() => ({})));
      if (!parsed.success) return validationError(parsed.error);
      if (!user.twoFactorSecret) {
        return conflict('Belum ada secret 2FA. Jalankan setup terlebih dahulu.');
      }

      let plaintext: string;
      try {
        plaintext = decryptTotpSecret(user.twoFactorSecret);
      } catch {
        return serverError(new Error('2FA secret rusak. Ulangi setup dari awal.'));
      }

      if (!(await verifyTotpCode(plaintext, parsed.data.token))) {
        logger.warn('[2fa/verify] invalid code', { userId: user.id, ip: getClientIp(req) });
        return forbidden('Kode authenticator salah atau kedaluwarsa');
      }

      const backupCodes = generateBackupCodes();
      await db
        .update(users)
        .set({
          twoFactorEnabled: true,
          twoFactorEnabledAt: new Date(),
          twoFactorBackupCodes: await hashBackupCodes(backupCodes),
          updatedAt: new Date(),
        })
        .where(eq(users.id, user.id));

      if (isAdminRole(user.role)) {
        logAdminActivity({
          userId: user.id,
          action: 'auth.2fa_enabled',
          targetType: 'user',
          targetId: user.id,
          ipAddress: getClientIp(req),
          userAgent: getUserAgent(req),
        });
      }
      logger.info('[2fa/verify] 2FA enabled', { userId: user.id });
      // Backup codes are shown ONCE — the client must render them immediately.
      return success({ enabled: true, backupCodes });
    } catch (err) {
      logger.error('[2fa/verify]', { error: err instanceof Error ? err.message : String(err) });
      return serverError(err);
    }
  }),
  'auth'
);
