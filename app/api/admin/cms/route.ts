import { NextRequest } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { cmsPages } from '@/lib/db/schema';
import { asc } from 'drizzle-orm';
import { z } from 'zod';
import {
  success,
  created,
  forbidden,
  validationError,
  serverError,
  conflict,
} from '@/lib/utils/api-response';
import { canWriteCmsPage } from '@/lib/cms/legal-slugs';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const createPageSchema = z.object({
  slug: z
    .string()
    .min(1, 'Slug wajib diisi')
    .max(100)
    .regex(/^[a-z0-9-]+$/, 'Slug hanya huruf kecil, angka, dan tanda hubung'),
  title: z.string().min(1, 'Judul wajib diisi').max(255),
  isPublished: z.boolean().default(true),
});

export async function GET(_req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user || !['superadmin', 'owner'].includes(session.user.role ?? '')) {
      return forbidden('Akses ditolak');
    }

    const pages = await db.query.cmsPages.findMany({
      orderBy: [asc(cmsPages.slug)],
      with: { sections: { columns: { id: true } } },
    });

    const data = pages.map((p) => ({
      id: p.id,
      slug: p.slug,
      title: p.title,
      isPublished: p.isPublished,
      sectionCount: p.sections.length,
      createdAt: p.createdAt,
      updatedAt: p.updatedAt,
    }));

    return success(data);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    const role = session?.user?.role ?? '';
    if (!session?.user || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Akses ditolak');
    }

    const body = await req.json();
    const parsed = createPageSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    if (!canWriteCmsPage(role, parsed.data.slug)) {
      return forbidden('Halaman legal hanya dapat diedit oleh superadmin');
    }

    const existing = await db.query.cmsPages.findFirst({
      where: (p, { eq }) => eq(p.slug, parsed.data.slug),
    });
    if (existing) return conflict('Slug halaman sudah digunakan');

    const [page] = await db
      .insert(cmsPages)
      .values(parsed.data)
      .returning();

    return created(page);
  } catch (error) {
    return serverError(error);
  }
}
