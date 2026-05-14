import { NextRequest, NextResponse } from 'next/server';
import { desc } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';

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