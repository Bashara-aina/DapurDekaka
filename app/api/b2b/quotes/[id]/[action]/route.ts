import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { b2bQuotes } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, unauthorized, forbidden, notFound, serverError } from '@/lib/utils/api-response';

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string; action: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Login diperlukan');

    if (session.user.role !== 'b2b' && session.user.role !== 'superadmin' && session.user.role !== 'owner') {
      return forbidden('Akses ditolak');
    }

    const { id, action } = await params;

    if (action !== 'accept' && action !== 'reject') {
      return notFound('Action tidak valid');
    }

    const quote = await db.query.b2bQuotes.findFirst({
      where: eq(b2bQuotes.id, id),
    });

    if (!quote) {
      return notFound('Quote tidak ditemukan');
    }

    const newStatus = action === 'accept' ? 'accepted' : 'rejected';

    await db
      .update(b2bQuotes)
      .set({ status: newStatus })
      .where(eq(b2bQuotes.id, id));

    return success({ id, status: newStatus });
  } catch (error) {
    console.error('[B2B Quote Action POST]', error);
    return serverError(error);
  }
}