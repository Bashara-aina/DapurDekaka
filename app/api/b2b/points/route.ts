import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, unauthorized, forbidden } from '@/lib/utils/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Login diperlukan');

    if (session.user.role !== 'b2b' && session.user.role !== 'superadmin') {
      return forbidden('Akses ditolak');
    }

    const user = await db.query.users.findFirst({
      where: eq(users.id, session.user.id),
    });

    return success({
      pointsBalance: user?.pointsBalance ?? 0,
      isB2b: true,
      multiplier: 2,
    });
  } catch (error) {
    console.error('[b2b/points GET]', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}