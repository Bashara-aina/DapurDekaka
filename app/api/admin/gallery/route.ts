import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { cmsGalleryImages } from '@/lib/db/schema';
import { and, asc, eq } from 'drizzle-orm';
import { z } from 'zod';
import {
  success,
  created,
  forbidden,
  validationError,
  serverError,
} from '@/lib/utils/api-response';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const usageEnum = z.enum(['instagram_feed', 'about_hero', 'og', 'general']);

const createGallerySchema = z.object({
  publicId: z.string().min(1, 'Public ID wajib diisi').max(255),
  altId: z.string().max(255).optional().nullable(),
  altEn: z.string().max(255).optional().nullable(),
  sortOrder: z.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
  usage: usageEnum.default('general'),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['superadmin', 'owner'].includes(session.user.role ?? '')) {
      return forbidden('Akses ditolak');
    }

    const usage = req.nextUrl.searchParams.get('usage');
    const activeOnly = req.nextUrl.searchParams.get('active') === 'true';

    const conditions = [];
    if (usage) {
      const parsedUsage = usageEnum.safeParse(usage);
      if (parsedUsage.success) conditions.push(eq(cmsGalleryImages.usage, parsedUsage.data));
    }
    if (activeOnly) conditions.push(eq(cmsGalleryImages.isActive, true));

    const whereClause =
      conditions.length > 1 ? and(...conditions) : conditions[0];

    const data = await db.query.cmsGalleryImages.findMany({
      where: whereClause,
      orderBy: [asc(cmsGalleryImages.sortOrder), asc(cmsGalleryImages.createdAt)],
    });

    return success(data);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['superadmin', 'owner'].includes(session.user.role ?? '')) {
      return forbidden('Akses ditolak');
    }

    const body = await req.json();
    const parsed = createGallerySchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const [image] = await db
      .insert(cmsGalleryImages)
      .values({
        publicId: parsed.data.publicId,
        altId: parsed.data.altId ?? null,
        altEn: parsed.data.altEn ?? null,
        sortOrder: parsed.data.sortOrder,
        isActive: parsed.data.isActive,
        usage: parsed.data.usage,
      })
      .returning();

    return created(image);
  } catch (error) {
    return serverError(error);
  }
}
