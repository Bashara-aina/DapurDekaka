import { NextRequest, NextResponse } from 'next/server';
import { eq } from 'drizzle-orm';
import { success, notFound, unauthorized, forbidden, serverError, conflict } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { b2bProfiles } from '@/lib/db/schema';
import { z } from 'zod';

const ApproveSchema = z.object({
  isApproved: z.boolean(),
  isNet30Approved: z.boolean().optional().default(false),
  notes: z.string().optional(),
  assignedWaContact: z.string().optional(),
});

export async function POST(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const { id } = await params;
    const body = await req.json();
    const parsed = ApproveSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        {
          success: false,
          error: 'Validasi gagal',
          code: 'VALIDATION_ERROR',
          details: parsed.error.flatten().fieldErrors,
        },
        { status: 422 }
      );
    }

    const profile = await db.query.b2bProfiles.findFirst({
      where: eq(b2bProfiles.id, id),
      with: { user: true },
    });

    if (!profile) {
      return notFound('Profil B2B tidak ditemukan');
    }

    const [updated] = await db
      .update(b2bProfiles)
      .set({
        isApproved: parsed.data.isApproved,
        isNet30Approved: parsed.data.isNet30Approved ?? profile.isNet30Approved,
        approvedBy: parsed.data.isApproved ? session.user.id : null,
        approvedAt: parsed.data.isApproved ? new Date() : null,
        assignedWaContact: parsed.data.assignedWaContact ?? profile.assignedWaContact,
        notes: parsed.data.notes ?? profile.notes,
      })
      .where(eq(b2bProfiles.id, id))
      .returning();

    return success(updated);
  } catch (error) {
    console.error('[Admin B2B Profiles Approve POST]', error);
    return serverError(error);
  }
}