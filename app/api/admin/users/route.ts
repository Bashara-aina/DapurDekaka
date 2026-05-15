import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError, validationError, conflict } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { z } from 'zod';
import bcrypt from 'bcryptjs';

const CreateUserSchema = z.object({
  name: z.string().min(2),
  email: z.string().email(),
  password: z.string().min(8),
  role: z.enum(['warehouse', 'owner', 'b2b', 'superadmin']),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const allUsers = await db.query.users.findMany({
      orderBy: [desc(users.createdAt)],
      limit: 100,
      columns: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        isActive: true,
        pointsBalance: true,
        createdAt: true,
      },
    });

    return success(allUsers);
  } catch (error) {
    console.error('[Admin/Users/GET]', error);
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login');
    }

    if (session.user.role !== 'superadmin') {
      return forbidden('Hanya superadmin yang dapat membuat pengguna');
    }

    const body = await req.json();
    const parsed = CreateUserSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const { name, email, password, role } = parsed.data;

    const existing = await db.query.users.findFirst({
      where: (users, { eq }) => eq(users.email, email),
    });
    if (existing) {
      return conflict('Email sudah terdaftar');
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const [created] = await db.insert(users).values({
      name,
      email,
      passwordHash,
      role,
      isActive: true,
    }).returning({ id: users.id, email: users.email, role: users.role });

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    console.error('[Admin/Users/POST]', error);
    return serverError(error);
  }
}