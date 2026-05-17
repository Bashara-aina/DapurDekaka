import { NextRequest } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { b2bInquiries } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, validationError, serverError, notFound, unauthorized, forbidden } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const patchSchema = z.object({
  status: z.enum(['new', 'contacted', 'converted', 'rejected']),
  internalNotes: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login terlebih dahulu');
    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role as string)) return forbidden('Anda tidak memiliki akses');

    const { id } = await params;
    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const inquiry = await db.query.b2bInquiries.findFirst({ where: eq(b2bInquiries.id, id) });
    if (!inquiry) return notFound('Inquiry tidak ditemukan');

    const [updated] = await db
      .update(b2bInquiries)
      .set({
        status: parsed.data.status,
        ...(parsed.data.internalNotes !== undefined && { internalNotes: parsed.data.internalNotes }),
        handledBy: session.user.id,
        updatedAt: new Date(),
      })
      .where(eq(b2bInquiries.id, id))
      .returning();

    return success(updated);
  } catch (error) {
    return serverError(error);
  }
}

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login terlebih dahulu');
    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role as string)) return forbidden('Anda tidak memiliki akses');

    const { id } = await params;
    const inquiry = await db.query.b2bInquiries.findFirst({ where: eq(b2bInquiries.id, id) });
    if (!inquiry) return notFound('Inquiry tidak ditemukan');

    return success(inquiry);
  } catch (error) {
    return serverError(error);
  }
}