import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { users, passwordResetTokens } from '@/lib/db/schema';
import { eq, and, gt } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { success, validationError, notFound, serverError, unauthorized } from '@/lib/utils/api-response';

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token diperlukan'),
  password: z.string().min(8, 'Password minimal 8 karakter'),
});

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const parsed = resetPasswordSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { token, password } = parsed.data;

    const allTokens = await db.query.passwordResetTokens.findMany({
      where: gt(passwordResetTokens.expiresAt, new Date()),
    });

    let validToken = null;
    for (const storedToken of allTokens) {
      const isValid = await bcrypt.compare(token, storedToken.tokenHash);
      if (isValid) {
        validToken = storedToken;
        break;
      }
    }

    if (!validToken) {
      return unauthorized('Token tidak valid atau sudah kedaluwarsa');
    }

    const passwordHash = await bcrypt.hash(password, 12);

    await db.update(users)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(users.id, validToken.userId));

    await db.update(passwordResetTokens)
      .set({ usedAt: new Date() })
      .where(eq(passwordResetTokens.id, validToken.id));

    return success({ message: 'Password berhasil direset' });

  } catch (error) {
    console.error('[auth/reset-password]', error);
    return serverError(error);
  }
}