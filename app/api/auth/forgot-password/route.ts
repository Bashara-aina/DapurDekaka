import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { db } from '@/lib/db';
import { users, passwordResetTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { success, validationError, serverError } from '@/lib/utils/api-response';
import { withRateLimit, checkRateLimitAsync } from '@/lib/utils/rate-limit';
import { sendEmail } from '@/lib/resend/send-email';
import { PasswordResetEmail } from '@/lib/resend/templates/PasswordReset';
import { logger } from '@/lib/utils/logger';

const forgotPasswordSchema = z.object({
  email: z.string().email('Format email tidak valid'),
});

function getClientIp(req: NextRequest): string {
  return (
    req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    req.headers.get('x-real-ip') ??
    'unknown'
  );
}

export const POST = withRateLimit(
  async (req: NextRequest) => {
    const ip = getClientIp(req);
    try {
      const body = await req.json();
      const parsed = forgotPasswordSchema.safeParse(body);

      if (!parsed.success) {
        return validationError(parsed.error);
      }

      const { email } = parsed.data;
      const normalizedEmail = email.toLowerCase();

      // FRESH-AUDIT-05 BUG-05 hardening: per-email rate limit on forgot-password
      // (the global tier only throttles by IP, which can be rotated).
      const perEmailLimit = await checkRateLimitAsync(`forgot:${normalizedEmail}`, 'password-reset');
      if (!perEmailLimit.success) {
        return new Response(
          JSON.stringify({
            success: false,
            error: 'Terlalu banyak permintaan reset password untuk email ini. Coba lagi nanti.',
            code: 'RATE_LIMITED',
            retryAfter: Math.ceil((perEmailLimit.resetAt - Date.now()) / 1000),
          }),
          { status: 429, headers: { 'Content-Type': 'application/json' } }
        );
      }

      const user = await db.query.users.findFirst({
        where: eq(users.email, normalizedEmail),
      });

      if (user) {
        const token = crypto.randomBytes(32).toString('hex');
        const tokenPrefix = token.slice(0, 8);
        const hashedToken = await bcrypt.hash(token, 10);
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

        await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));

        await db.insert(passwordResetTokens).values({
          userId: user.id,
          tokenPrefix,
          tokenHash: hashedToken,
          expiresAt,
        });

        const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${token}`;

        // Non-blocking email send — user sees success even if email fails
        sendEmail({
          to: user.email,
          subject: 'Reset Password — Dapur Dekaka',
          react: PasswordResetEmail({
            resetUrl,
            userName: user.name,
            expiresAt: '1 jam',
          }),
        }).catch((err: unknown) => {
          logger.error('[auth/forgot-password] Email send failed', { error: err });
        });

        logger.info('[auth/forgot-password] Reset email dispatched', { email: normalizedEmail, ip });
      } else {
        // FRESH-AUDIT-05 BUG-05 fix: normalize timing across the "user-not-found" path.
        // Happy path: bcrypt (~100ms) + sendEmail HTTP (~200-500ms) ≈ 300-600ms.
        // We pad the not-found path with a deterministic delay + bcrypt-sized
        // dummy work so an attacker cannot enumerate emails via timing.
        await bcrypt.hash(crypto.randomBytes(16).toString('hex'), 10);
        await new Promise(resolve => setTimeout(resolve, 350));
      }

      return success({ message: 'Link reset password telah dikirim ke email kamu' });

    } catch (error) {
      logger.error('[auth/forgot-password]', { error, ip });
      return serverError(error);
    }
  },
  'password-reset'
);
