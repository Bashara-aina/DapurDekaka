import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { systemSettings } from '@/lib/db/schema';
import { like, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  success,
  unauthorized,
  forbidden,
  validationError,
  serverError,
} from '@/lib/utils/api-response';
import { FLAGS } from '@/lib/config/feature-flags';
import { logger } from '@/lib/utils/logger';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const bulkSchema = z.object({
  flags: z.array(z.object({
    name: z.string().min(1),
    value: z.boolean(),
  })).min(1),
});

export async function GET() {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');
    if ((session.user as { role?: string }).role !== 'superadmin') {
      return forbidden('Hanya superadmin');
    }

    const stored = await db
      .select()
      .from(systemSettings)
      .where(like(systemSettings.key, 'feature_flag_%'))
      .orderBy(asc(systemSettings.key));

    const storedByKey: Record<string, typeof stored[number]> = {};
    for (const s of stored) storedByKey[s.key] = s;

    const result = Object.entries(FLAGS).map(([name, cfg]) => {
      const key = `feature_flag_${name}`;
      const row = storedByKey[key] ?? null;
      return {
        name,
        envKey: cfg.envKey,
        note: cfg.note,
        default: cfg.default,
        value: row ? row.value === 'true' : cfg.default,
        storedAt: row?.updatedAt ?? null,
      };
    });

    return success(result);
  } catch (error) {
    logger.error('[admin/feature-flags GET]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) return unauthorized('Silakan login');
    if ((session.user as { role?: string }).role !== 'superadmin') {
      return forbidden('Hanya superadmin');
    }

    const body = await req.json();
    const parsed = bulkSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const updates: Array<{ name: string; value: boolean; storedAt: Date }> = [];
    const unknown: string[] = [];

    for (const item of parsed.data.flags) {
      if (!(item.name in FLAGS)) {
        unknown.push(item.name);
        continue;
      }
      const key = `feature_flag_${item.name}`;
      const now = new Date();
      const [row] = await db
        .insert(systemSettings)
        .values({
          key,
          value: item.value ? 'true' : 'false',
          type: 'boolean',
          description: FLAGS[item.name as keyof typeof FLAGS].note,
          updatedBy: session.user.id,
          updatedAt: now,
        })
        .onConflictDoUpdate({
          target: systemSettings.key,
          set: {
            value: item.value ? 'true' : 'false',
            updatedBy: session.user.id,
            updatedAt: now,
          },
        })
        .returning();
      if (row) updates.push({ name: item.name, value: item.value, storedAt: row.updatedAt });
    }

    return success({
      updated: updates.length,
      unknown,
      updates,
    });
  } catch (error) {
    logger.error('[admin/feature-flags PATCH]', { error: error instanceof Error ? error.message : String(error) });
    return serverError(error);
  }
}