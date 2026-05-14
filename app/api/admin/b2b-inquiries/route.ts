import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
import { b2bInquiries } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { success, serverError, unauthorized, forbidden } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role as string)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const inquiries = await db.query.b2bInquiries.findMany({
      orderBy: [desc(b2bInquiries.createdAt)],
    });

    return success(inquiries);
  } catch (error) {
    return serverError(error);
  }
}