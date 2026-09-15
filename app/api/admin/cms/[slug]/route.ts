import { NextRequest } from 'next/server';
import { sanitizeNullableCmsHtml } from '@/lib/utils/sanitize-html';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { cmsPages, cmsPageSections } from '@/lib/db/schema';
import { and, asc, eq, inArray } from 'drizzle-orm';
import { z } from 'zod';
import {
  success,
  forbidden,
  notFound,
  validationError,
  serverError,
} from '@/lib/utils/api-response';
import { canWriteCmsPage } from '@/lib/cms/legal-slugs';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

// CMS body sanitization — centralized policy (lib/utils/sanitize-html.ts).
// Null semantics preserved: empty/missing input stays `null`.
const sanitizeHtml = sanitizeNullableCmsHtml;

const sectionSchema = z.object({
  sectionKey: z.string().min(1, 'Section key wajib diisi').max(100),
  sortOrder: z.number().int().min(0).default(0),
  titleId: z.string().max(500).optional().nullable(),
  titleEn: z.string().max(500).optional().nullable(),
  bodyId: z.string().optional().nullable(),
  bodyEn: z.string().optional().nullable(),
  ctaLabelId: z.string().max(255).optional().nullable(),
  ctaLabelEn: z.string().max(255).optional().nullable(),
  ctaHref: z.string().max(500).optional().nullable(),
  imagePublicId: z.string().max(255).optional().nullable(),
  meta: z.record(z.unknown()).optional().nullable(),
});

const patchPageSchema = z.object({
  title: z.string().min(1).max(255).optional(),
  isPublished: z.boolean().optional(),
  sections: z.array(sectionSchema).optional(),
  removeSectionKeys: z.array(z.string().min(1).max(100)).optional(),
});

export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    if (!session?.user || !['superadmin', 'owner'].includes(session.user.role ?? '')) {
      return forbidden('Akses ditolak');
    }

    const { slug } = await params;
    const page = await db.query.cmsPages.findFirst({
      where: eq(cmsPages.slug, slug),
    });
    if (!page) return notFound('Halaman CMS tidak ditemukan');

    const sections = await db.query.cmsPageSections.findMany({
      where: eq(cmsPageSections.pageId, page.id),
      orderBy: [asc(cmsPageSections.sortOrder)],
    });

    return success({ page, sections });
  } catch (error) {
    return serverError(error);
  }
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    const role = session?.user?.role ?? '';
    if (!session?.user || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Akses ditolak');
    }

    const { slug } = await params;
    if (!canWriteCmsPage(role, slug)) {
      return forbidden('Halaman legal hanya dapat diedit oleh superadmin');
    }

    const page = await db.query.cmsPages.findFirst({
      where: eq(cmsPages.slug, slug),
    });
    if (!page) return notFound('Halaman CMS tidak ditemukan');

    const body = await req.json();
    const parsed = patchPageSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const result = await db.transaction(async (tx) => {
      const pageUpdates: Partial<typeof cmsPages.$inferInsert> = {};
      if (parsed.data.title !== undefined) pageUpdates.title = parsed.data.title;
      if (parsed.data.isPublished !== undefined) {
        pageUpdates.isPublished = parsed.data.isPublished;
      }

      let updatedPage = page;
      if (Object.keys(pageUpdates).length > 0) {
        const [row] = await tx
          .update(cmsPages)
          .set({ ...pageUpdates, updatedAt: new Date() })
          .where(eq(cmsPages.id, page.id))
          .returning();
        updatedPage = row ?? page;
      }

      if (parsed.data.sections) {
        for (const section of parsed.data.sections) {
          await tx
            .insert(cmsPageSections)
            .values({
              pageId: page.id,
              sectionKey: section.sectionKey,
              sortOrder: section.sortOrder,
              titleId: section.titleId ?? null,
              titleEn: section.titleEn ?? null,
              bodyId: sanitizeHtml(section.bodyId),
              bodyEn: sanitizeHtml(section.bodyEn),
              ctaLabelId: section.ctaLabelId ?? null,
              ctaLabelEn: section.ctaLabelEn ?? null,
              ctaHref: section.ctaHref ?? null,
              imagePublicId: section.imagePublicId ?? null,
              meta: section.meta ?? null,
            })
            .onConflictDoUpdate({
              target: [cmsPageSections.pageId, cmsPageSections.sectionKey],
              set: {
                sortOrder: section.sortOrder,
                titleId: section.titleId ?? null,
                titleEn: section.titleEn ?? null,
                bodyId: sanitizeHtml(section.bodyId),
                bodyEn: sanitizeHtml(section.bodyEn),
                ctaLabelId: section.ctaLabelId ?? null,
                ctaLabelEn: section.ctaLabelEn ?? null,
                ctaHref: section.ctaHref ?? null,
                imagePublicId: section.imagePublicId ?? null,
                meta: section.meta ?? null,
                updatedAt: new Date(),
              },
            });
        }
      }

      if (parsed.data.removeSectionKeys && parsed.data.removeSectionKeys.length > 0) {
        await tx
          .delete(cmsPageSections)
          .where(
            and(
              eq(cmsPageSections.pageId, page.id),
              inArray(cmsPageSections.sectionKey, parsed.data.removeSectionKeys)
            )
          );
      }

      const sections = await tx.query.cmsPageSections.findMany({
        where: eq(cmsPageSections.pageId, page.id),
        orderBy: [asc(cmsPageSections.sortOrder)],
      });

      return { page: updatedPage, sections };
    });

    return success(result);
  } catch (error) {
    return serverError(error);
  }
}

export async function DELETE(
  _req: NextRequest,
  { params }: { params: Promise<{ slug: string }> }
) {
  try {
    const session = await auth();
    const role = session?.user?.role ?? '';
    if (!session?.user || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Akses ditolak');
    }

    const { slug } = await params;
    if (!canWriteCmsPage(role, slug)) {
      return forbidden('Halaman legal hanya dapat dihapus oleh superadmin');
    }

    const page = await db.query.cmsPages.findFirst({
      where: eq(cmsPages.slug, slug),
    });
    if (!page) return notFound('Halaman CMS tidak ditemukan');

    await db.transaction(async (tx) => {
      await tx.delete(cmsPageSections).where(eq(cmsPageSections.pageId, page.id));
      await tx.delete(cmsPages).where(eq(cmsPages.id, page.id));
    });

    logger.info('[admin/cms/[slug] DELETE]', { slug, userId: session.user.id });
    return success({ slug });
  } catch (error) {
    logger.error('[admin/cms/[slug] DELETE]', { error });
    return serverError(error);
  }
}
