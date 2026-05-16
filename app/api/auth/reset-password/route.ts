import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, passwordResetTokens } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { success, validationError, serverError, unauthorized } from '@/lib/utils/api-response';
import { withRateLimit } from '@/lib/utils/rate-limit';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token diperlukan'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
});

export const POST = withRateLimit(
  async (req: NextRequest) => {
    try {
      const body = await req.json();
      const parsed = resetPasswordSchema.safeParse(body);

      if (!parsed.success) {
        return validationError(parsed.error);
      }

      const { token, password } = parsed.data;
      const tokenPrefix = token.slice(0, 8);

      const record = await db.query.passwordResetTokens.findFirst({
        where: and(
          eq(passwordResetTokens.tokenPrefix, tokenPrefix),
          gt(passwordResetTokens.expiresAt, new Date())
        ),
      });

      if (!record || !(await bcrypt.compare(token, record.tokenHash))) {
        return unauthorized('Token tidak valid atau sudah kedaluwarsa');
      }

      const passwordHash = await bcrypt.hash(password, 12);

      await db.update(users)
        .set({ passwordHash, updatedAt: new Date() })
        .where(eq(users.id, record.userId));

      await db.update(passwordResetTokens)
        .set({ usedAt: new Date() })
        .where(eq(passwordResetTokens.id, record.id));

      return success({ message: 'Password berhasil direset' });

    } catch (error) {
      console.error('[auth/reset-password]', error);
      return serverError(error);
    }
  },
  { windowMs: 60000, maxRequests: 5 }
);