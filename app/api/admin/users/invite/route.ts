import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { randomBytes } from 'crypto';
import { db } from '@/lib/db';
import { users, passwordResetTokens } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, serverError, conflict, forbidden, badRequest } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { sendEmail } from '@/lib/resend/send-email';
import { TeamInviteEmail } from '@/lib/resend/templates/TeamInvite';

const inviteSchema = z.object({
  email: z.string().email('Email tidak valid'),
  name: z.string().min(2, 'Nama minimal 2 karakter'),
  role: z.enum(['warehouse', 'owner', 'b2b', 'customer']),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return forbidden('Anda harus login');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Hanya superadmin atau owner yang dapat mengundang pengguna');
    }

    const body = await req.json();
    const parsed = inviteSchema.safeParse(body);

    if (!parsed.success) {
      const firstError = parsed.error.errors[0];
      return badRequest(firstError ? firstError.message : 'Validasi gagal');
    }

    const { email, name, role: userRole } = parsed.data;

    // Check if email already exists
    const existingUser = await db.query.users.findFirst({
      where: eq(users.email, email.toLowerCase()),
    });

    if (existingUser) {
      return conflict('Email sudah terdaftar. Gunakan email lain.');
    }

    // Create user with temporary placeholder password (they will set real password via reset link)
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        name,
        passwordHash: await bcrypt.hash(randomBytes(16).toString('hex'), 12),
        role: userRole,
        isActive: true,
        pointsBalance: 0,
        languagePreference: 'id',
      })
      .returning();

    if (!newUser) {
      throw new Error('Failed to create user');
    }

    // Create password reset token for first-time login
    const token = randomBytes(32).toString('hex');
    const tokenPrefix = token.slice(0, 8);
    const hashedToken = await bcrypt.hash(token, 12);
    const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000); // 7 days

    await db.insert(passwordResetTokens).values({
      userId: newUser.id,
      tokenPrefix,
      tokenHash: hashedToken,
      expiresAt,
    });

    const inviteUrl = `${process.env.NEXT_PUBLIC_APP_URL}/auth/reset-password/${token}`;

    // Send invite email using React Email template
    await sendEmail({
      to: email,
      subject: 'Undangan Bergabung — Dapur Dekaka',
      react: TeamInviteEmail({
        inviteUrl,
        inviterName: session.user.name ?? 'Admin',
        role: userRole,
      }),
    });

    return success({
      user: {
        id: newUser.id,
        email: newUser.email,
        name: newUser.name,
        role: newUser.role,
      },
      message: 'Pengguna berhasil diundang. Email undangan telah dikirim.',
    });
  } catch (error) {
    console.error('[admin/users/invite]', error);
    return serverError(error);
  }
}