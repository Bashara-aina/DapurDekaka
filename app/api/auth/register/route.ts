import { NextRequest, NextResponse } from 'next/server';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { success, validationError, serverError, conflict } from '@/lib/utils/api-response';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { logger } from '@/lib/utils/logger';

const registerSchema = z.object({
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  email: z.string().email('Format email tidak valid'),
  password: z
    .string()
    .min(8, 'Password minimal 8 karakter')
    .regex(/[A-Z]/, 'Password harus memiliki minimal 1 huruf besar')
    .regex(/[a-z]/, 'Password harus memiliki minimal 1 huruf kecil')
    .regex(/[0-9]/, 'Password harus memiliki minimal 1 angka'),
});

export const POST = withRateLimit(
  async (req: NextRequest) => {
    let requestEmail = '';
    try {
      const body = await req.json();
      const parsed = registerSchema.safeParse(body);
      requestEmail = parsed.data?.email ?? '';

      if (!parsed.success) {
        return validationError(parsed.error);
      }

      const { name, email, password } = parsed.data;

      const existing = await db.query.users.findFirst({
        where: eq(users.email, email.toLowerCase()),
      });

      if (existing) {
        return conflict('Email sudah terdaftar');
      }

      const passwordHash = await bcrypt.hash(password, 12);

      const [newUser] = await db.insert(users).values({
        name,
        email: email.toLowerCase(),
        passwordHash,
        role: 'customer',
        isActive: true,
        pointsBalance: 0,
        languagePreference: 'id',
      }).returning();

      if (!newUser) {
        return serverError(new Error('Failed to create user'));
      }

      return success({
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
      }, 201);

    } catch (error) {
      logger.error('[auth/register]', { error: String(error), email: requestEmail });
      return serverError(error);
    }
  },
  'auth'
);
