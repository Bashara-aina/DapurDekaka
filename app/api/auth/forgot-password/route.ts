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
import { withRateLimit } from '@/lib/utils/rate-limit';
import { sendEmail } from '@/lib/resend/send-email';
import { PasswordResetEmail } from '@/lib/resend/templates/PasswordReset';

const forgotPasswordSchema = z.object({
  email: z.string().email('Format email tidak valid'),
});

export const POST = withRateLimit(
  async (req: NextRequest) => {
    let emailSent = false;
    try {
      const body = await req.json();
      const parsed = forgotPasswordSchema.safeParse(body);

      if (!parsed.success) {
        return validationError(parsed.error);
      }

      const { email } = parsed.data;

      const user = await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase()),
      });

      if (user) {
        // Check if user registered via Google (no password)
        const isGoogleOnlyAccount = !user.passwordHash;

        if (isGoogleOnlyAccount) {
          // Still generate token for security consistency, but note in email
          const token = crypto.randomBytes(32).toString('hex');
          const hashedToken = await bcrypt.hash(token, 10);
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

          await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));

          await db.insert(passwordResetTokens).values({
            userId: user.id,
            tokenKey: token,
            tokenHash: hashedToken,
            expiresAt,
          });

          const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${token}`;

          await sendEmail({
            to: user.email,
            subject: 'Reset Password — Dapur Dekaka',
            react: PasswordResetEmail({
              resetUrl,
              userName: user.name,
              isGoogleAccount: true,
            }),
          });
        } else {
          const token = crypto.randomBytes(32).toString('hex');
          const hashedToken = await bcrypt.hash(token, 10);
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

          await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));

          await db.insert(passwordResetTokens).values({
            userId: user.id,
            tokenKey: token,
            tokenHash: hashedToken,
            expiresAt,
          });

          const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password/${token}`;

          await sendEmail({
            to: user.email,
            subject: 'Reset Password — Dapur Dekaka',
            react: PasswordResetEmail({
              resetUrl,
              userName: user.name,
            }),
          });
        }
        emailSent = true;
      }

      return success({ message: 'Link reset password telah dikirim ke email kamu' });
    } catch (error) {
      console.error('[auth/forgot-password]', error);
      return serverError(error);
    } finally {
      // Timing normalization — always delay, whether user exists or not
      if (!emailSent) {
        await new Promise(resolve => setTimeout(resolve, 400));
      }
    }
  },
  { windowMs: 60000, maxRequests: 3 }
);
