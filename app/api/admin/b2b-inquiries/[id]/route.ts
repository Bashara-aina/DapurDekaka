import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { db } from '@/lib/db';
import { b2bInquiries } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { success, notFound, serverError, unauthorized, forbidden } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role as string)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { id } = await params;
    const inquiry = await db.query.b2bInquiries.findFirst({
      where: eq(b2bInquiries.id, id),
    });

    if (!inquiry) {
      return notFound('Inquiry tidak ditemukan');
    }

    return success(inquiry);
  } catch (error) {
    return serverError(error);
  }
}

const UpdateSchema = z.object({
  status: z.enum(['new', 'contacted', 'converted', 'rejected']).optional(),
  internalNotes: z.string().optional(),
});

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role as string)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = UpdateSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Data tidak valid' },
        { status: 422 }
      );
    }

    const existing = await db.query.b2bInquiries.findFirst({
      where: eq(b2bInquiries.id, id),
    });

    if (!existing) {
      return notFound('Inquiry tidak ditemukan');
    }

    const updateData: Record<string, unknown> = {};
    if (parsed.data.status) {
      updateData.status = parsed.data.status;
    }
    if (parsed.data.internalNotes !== undefined) {
      updateData.internalNotes = parsed.data.internalNotes;
    }

    await db.update(b2bInquiries)
      .set(updateData)
      .where(eq(b2bInquiries.id, id));

    return success({ message: 'Inquiry berhasil diupdate' });
  } catch (error) {
    return serverError(error);
  }
}