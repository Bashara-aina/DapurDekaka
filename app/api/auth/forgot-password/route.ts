import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, passwordResetTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';
import { resend } from '@/lib/resend/client';
import { success, validationError, notFound, serverError } from '@/lib/utils/api-response';
import { withRateLimit } from '@/lib/utils/rate-limit';

const forgotPasswordSchema = z.object({
  email: z.string().email('Format email tidak valid'),
});

export const POST = withRateLimit(
  async (req: NextRequest) => {
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

      if (!user) {
        return notFound('Email tidak ditemukan');
      }

      await db.delete(passwordResetTokens).where(eq(passwordResetTokens.userId, user.id));

      const token = crypto.randomBytes(32).toString('hex');
      const tokenHash = bcrypt.hashSync(token, 10);
      const expiresAt = new Date(Date.now() + 60 * 60 * 1000);

      await db.insert(passwordResetTokens).values({
        userId: user.id,
        tokenHash,
        expiresAt,
      });

      const resetUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password/${token}`;

      try {
        await resend.emails.send({
          from: 'Dapur Dekaka <noreply@dapurdekaka.com>',
          to: user.email,
          subject: 'Reset Password — Dapur Dekaka',
          html: `
          <div style="font-family: 'Inter', sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
            <div style="background: #F0EAD6; padding: 24px; text-align: center;">
              <h1 style="color: #C8102E; font-size: 24px; margin: 0;">Dapur Dekaka</h1>
            </div>
            <div style="padding: 32px 24px; background: #FFFFFF;">
              <h2 style="color: #1A1A1A; font-size: 20px; margin: 0 0 16px;">Reset Password</h2>
              <p style="color: #6B6B6B; font-size: 14px; line-height: 1.6;">
                Halo ${user.name},
              </p>
              <p style="color: #6B6B6B; font-size: 14px; line-height: 1.6;">
                Kami menerima permintaan untuk reset password akun Dapur Dekaka kamu.
                Klik tombol di bawah untuk membuat password baru:
              </p>
              <div style="text-align: center; margin: 32px 0;">
                <a href="${resetUrl}" style="background: #C8102E; color: #FFFFFF; padding: 14px 32px; border-radius: 8px; text-decoration: none; font-weight: 600; display: inline-block;">
                  Reset Password
                </a>
              </div>
              <p style="color: #6B6B6B; font-size: 14px; line-height: 1.6;">
                Link ini berlaku selama 1 jam. Jika kamu tidak meminta reset password, abaikan email ini.
              </p>
              <hr style="border: none; border-top: 1px solid #E0D4BC; margin: 24px 0;">
              <p style="color: #ABABAB; font-size: 12px;">
                Dapur Dekaka — 德卡<br>
                Jl. Sinom V no. 7, Turangga, Bandung
              </p>
            </div>
          </div>
        `,
        });
      } catch (emailError) {
        console.error('[forgot-password] Email error:', emailError);
      }

      return success({ message: 'Link reset password telah dikirim ke email kamu' });

    } catch (error) {
      console.error('[auth/forgot-password]', error);
      return serverError(error);
    }
  },
  { windowMs: 60000, maxRequests: 3 }
);