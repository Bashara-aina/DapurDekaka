import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, serverError, conflict, forbidden, badRequest } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';

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

    // Generate temporary password
    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    // Create user with temporary password
    const [newUser] = await db
      .insert(users)
      .values({
        email: email.toLowerCase(),
        name,
        passwordHash,
        role: userRole,
        isActive: true,
        pointsBalance: 0,
        languagePreference: 'id',
      })
      .returning();

    if (!newUser) {
      throw new Error('Failed to create user');
    }
    // For now, log the temp password (in production, send via email)
    console.log(`[Invite User] Created user ${newUser.email} with temp password: ${tempPassword}`);

    return success({
      user: newUser,
      tempPassword, // In production, don't return this — send via email instead
      message: `Pengguna berhasil diundang. Password sementara: ${tempPassword}`,
    });
  } catch (error) {
    console.error('[admin/users/invite]', error);
    return serverError(error);
  }
}

function generateTempPassword(): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';
  let password = '';
  for (let i = 0; i < 12; i++) {
    password += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return password;
}