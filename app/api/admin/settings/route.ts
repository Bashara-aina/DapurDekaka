import { NextRequest } from 'next/server';
import { asc } from 'drizzle-orm';
import { success, unauthorized, forbidden, serverError, validationError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { systemSettings, adminActivityLogs } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const settings = await db.query.systemSettings.findMany({
      orderBy: [asc(systemSettings.key)],
    });

    const settingsWithType = settings.map(s => {
      let type: 'string' | 'number' | 'boolean' = 'string';
      const lowerValue = s.value.toLowerCase();
      if (lowerValue === 'true' || lowerValue === 'false') {
        type = 'boolean';
      } else if (!isNaN(Number(s.value)) && s.value !== '') {
        type = 'number';
      }
      return { ...s, type };
    });

    return success(settingsWithType);
  } catch (error) {
    console.error('[Admin/Settings/GET]', error);
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
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses untuk mengubah pengaturan');
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
    console.error('[Admin/Settings/PATCH]', error);
    return serverError(error);
  }
}