import { NextRequest } from 'next/server';
import { asc } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError, validationError, conflict, created } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { systemSettings, adminActivityLogs } from '@/lib/db/schema';
import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Hanya superadmin yang dapat membaca pengaturan');
    }

    const keysParam = req.nextUrl.searchParams.get('keys');
    const keys = keysParam ? keysParam.split(',').map((k) => k.trim()) : null;

    let settings;
    if (keys) {
      const rows = await db
        .select()
        .from(systemSettings)
        .where(sql`${systemSettings.key} IN (${sql.join(keys.map((k) => sql`${k}`), sql`, `)})`);
      settings = rows;
    } else {
      settings = await db.query.systemSettings.findMany({
        orderBy: [asc(systemSettings.key)],
      });
    }

    const settingsWithType = settings.map((s) => {
      const type = s.type as 'string' | 'number' | 'boolean';
      return { ...s, type };
    });

    return success(settingsWithType);
  } catch (error) {
    return serverError(error);
  }
}

const createSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-z][a-z0-9_]*$/, 'Key harus snake_case'),
  value: z.union([z.string(), z.number(), z.boolean()]),
  type: z.enum(['string', 'number', 'integer', 'boolean']).default('string'),
  description: z.string().nullable().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = (session.user as { role?: string }).role;
    if (!role || role !== 'superadmin') {
      return forbidden('Hanya superadmin yang dapat membuat pengaturan');
    }

    const body = await req.json();
    const parsed = createSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const existing = await db.query.systemSettings.findFirst({
      where: eq(systemSettings.key, parsed.data.key),
    });
    if (existing) {
      return conflict('Key pengaturan sudah ada');
    }

    const [createdRow] = await db
      .insert(systemSettings)
      .values({
        key: parsed.data.key,
        value: String(parsed.data.value),
        type: parsed.data.type,
        description: parsed.data.description ?? null,
        updatedBy: session.user.id,
      })
      .returning();

    return created(createdRow);
  } catch (error) {
    return serverError(error);
  }
}

const bulkUpdateSchema = z.object({
  settings: z.array(z.object({
    key: z.string().min(1),
    value: z.union([z.string(), z.number(), z.boolean()]),
  })).min(1),
});

export async function PATCH(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = (session.user as { role?: string }).role;
    if (!role || role !== 'superadmin') {
      return forbidden('Hanya superadmin yang dapat mengubah pengaturan');
    }

    const body = await req.json();
    const parsed = bulkUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const updatedSettings = [];
    for (const item of parsed.data.settings) {
      const existing = await db.query.systemSettings.findFirst({
        where: eq(systemSettings.key, item.key),
      });

      if (!existing) continue;

      const [updated] = await db
        .update(systemSettings)
        .set({
          value: String(item.value),
          updatedAt: new Date(),
          updatedBy: session.user.id,
        })
        .where(eq(systemSettings.key, item.key))
        .returning();

      updatedSettings.push(updated);
    }

    return success({ updated: updatedSettings.length, settings: updatedSettings });
  } catch (error) {
    return serverError(error);
  }
}