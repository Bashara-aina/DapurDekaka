import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  success,
  unauthorized,
  forbidden,
  notFound,
  validationError,
  serverError,
} from '@/lib/utils/api-response';
import { FLAGS } from '@/lib/config/feature-flags';
import { logger } from '@/lib/utils/logger';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const putSchema = z.object({
  value: z.boolean(),
});

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');
    if ((session.user as { role?: string }).role !== 'superadmin') {
      return forbidden('Hanya superadmin');
    }

    const { name } = await params;
    if (!(name in FLAGS)) {
      return notFound(`Feature flag "${name}" tidak dikenali`);
    }

    const body = await req.json();
    const parsed = putSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const key = `feature_flag_${name}`;
    const now = new Date();

    const [row] = await db
      .insert(systemSettings)
      .values({
        key,
        value: parsed.data.value ? 'true' : 'false',
        type: 'boolean',
        description: FLAGS[name as keyof typeof FLAGS].note,
        updatedBy: session.user.id,
        updatedAt: now,
      })
      .onConflictDoUpdate({
        target: systemSettings.key,
        set: {
          value: parsed.data.value ? 'true' : 'false',
          updatedBy: session.user.id,
          updatedAt: now,
        },
      })
      .returning();

    return success(row);
  } catch (error) {
    logger.error('[admin/feature-flags/[name] PUT]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ name: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');
    if ((session.user as { role?: string }).role !== 'superadmin') {
      return forbidden('Hanya superadmin');
    }

    const { name } = await params;
    if (!(name in FLAGS)) {
      return notFound(`Feature flag "${name}" tidak dikenali`);
    }

    const key = `feature_flag_${name}`;
    const row = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, key),
    });

    return success({
      name,
      value: row ? row.value === 'true' : FLAGS[name as keyof typeof FLAGS].default,
      stored: row ?? null,
    });
  } catch (error) {
    logger.error('[admin/feature-flags/[name] GET]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}