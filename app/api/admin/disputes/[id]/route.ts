import { NextRequest } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { disputes } from '@/lib/db/schema';
import { success, unauthorized, forbidden, validationError, serverError } from '@/lib/utils/api-response';
import { eq } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';
import { withRateLimit } from '@/lib/utils/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const patchSchema = z.object({
  status: z.enum(['open', 'in_progress', 'resolved', 'rejected']).optional(),
  ownerNotes: z.string().max(2000).optional(),
});

export const PATCH = withRateLimit(async (req: NextRequest, ctx: { params: Promise<{ id: string }> } | undefined) => {
  try {
    if (!ctx) return unauthorized('Bad request');
    const { id } = await ctx.params;
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');
    if (!['superadmin', 'owner'].includes(session.user.role)) return forbidden();

    const body = await req.json();
    const parsed = patchSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const updates: {
      status?: 'open' | 'in_progress' | 'resolved' | 'rejected';
      ownerNotes?: string;
      resolvedAt?: Date;
    } = {};
    if (parsed.data.status) {
      updates.status = parsed.data.status;
      if (parsed.data.status === 'resolved') updates.resolvedAt = new Date();
    }
    if (parsed.data.ownerNotes !== undefined) updates.ownerNotes = parsed.data.ownerNotes;

    if (Object.keys(updates).length === 0) return success({ ok: true, noop: true });

    await db.update(disputes).set(updates).where(eq(disputes.id, id));
    return success({ ok: true });
  } catch (error) {
    logger.error('[admin/disputes PATCH]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}, 'admin');