import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { b2bProfiles, users } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, unauthorized, forbidden } from '@/lib/utils/api-response';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Login diperlukan');

    if (session.user.role !== 'b2b' && session.user.role !== 'superadmin') {
      return forbidden('Akses ditolak');
    }

    const profile = await db.query.b2bProfiles.findFirst({
      where: eq(b2bProfiles.userId, session.user.id),
    });

    if (!profile) {
      return success(null);
    }

    return success({
      id: profile.id,
      companyName: profile.companyName,
      companyType: profile.companyType,
      isApproved: profile.isApproved,
      isNet30Approved: profile.isNet30Approved,
      assignedWaContact: profile.assignedWaContact,
      picName: profile.picName,
      picPhone: profile.picPhone,
      picEmail: profile.picEmail,
    });
  } catch (error) {
    console.error('[b2b/profile GET]', error);
    return new Response(
      JSON.stringify({ success: false, error: 'Internal server error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}