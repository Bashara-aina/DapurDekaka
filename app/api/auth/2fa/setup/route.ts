import { NextRequest } from 'next/server';
import QRCode from 'qrcode';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, unauthorized, serverError, conflict } from '@/lib/utils/api-response';
import { logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { withCsrf } from '@/lib/utils/csrf';
import { getClientIp } from '@/lib/utils/request-meta';
import { newTotpSecret, buildOtpauthUrl, encryptTotpSecret } from '@/lib/auth/two-factor';
import { requireTwoFactorUser } from '../_common';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/**
 * POST /api/auth/2fa/setup — generate a fresh secret + QR code.
 * Stores the secret encrypted with enabled=false until verified.
 * CSRF-protected (state-changing, cookie-authenticated).
 */
export const POST = withRateLimit(
  withCsrf(async (req: NextRequest) => {
    try {
      const { user, error } = await requireTwoFactorUser(req);
      if (error || !user) return error ?? unauthorized('Silakan login');

      if (user.twoFactorEnabled) {
        return conflict('2FA sudah aktif di akun ini');
      }

      const secret = newTotpSecret();
      const otpauthUrl = buildOtpauthUrl(secret, user.email);
      const qrDataUrl = await QRCode.toDataURL(otpauthUrl, { width: 256, margin: 1 });

      await db
        .update(users)
        .set({ twoFactorSecret: encryptTotpSecret(secret), updatedAt: new Date() })
        .where(eq(users.id, user.id));

      logger.info('[2fa/setup] secret issued', { userId: user.id, ip: getClientIp(req) });
      return success({ otpauthUrl, qrDataUrl, manualKey: secret });
    } catch (err) {
      logger.error('[2fa/setup]', { error: err instanceof Error ? err.message : String(err) });
      return serverError(err);
    }
  }),
  'auth'
);
