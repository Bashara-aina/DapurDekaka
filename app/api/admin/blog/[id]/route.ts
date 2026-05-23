import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { success, notFound, serverError, unauthorized, forbidden, validationError, conflict } from '@/lib/utils/api-response';
import DOMPurify from 'isomorphic-dompurify';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }
    if (!['superadmin', 'owner'].includes(session.user.role as string)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const post = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, params.id),
    });

    if (!post) {
      return notFound('Post tidak ditemukan');
    }

    return success(post);
  } catch (error) {
    console.error('[Admin Blog GET:id]', error);
    return serverError(error);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }
    if (!['superadmin', 'owner'].includes(session.user.role as string)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const body = await req.json();
    const BlogUpdateSchema = z.object({
      titleId: z.string().min(1).optional(),
      titleEn: z.string().min(1).optional(),
      slug: z.string().min(1).optional(),
      excerptId: z.string().optional(),
      excerptEn: z.string().optional(),
      contentId: z.string().min(1).optional(),
      contentEn: z.string().min(1).optional(),
      coverImageUrl: z.string().optional().nullable(),
      coverImagePublicId: z.string().optional().nullable(),
      blogCategoryId: z.string().uuid().optional().nullable(),
      isPublished: z.boolean().optional(),
      isAiAssisted: z.boolean().optional(),
      metaTitleId: z.string().optional(),
      metaTitleEn: z.string().optional(),
      metaDescriptionId: z.string().optional(),
      metaDescriptionEn: z.string().optional(),
    });
    const parsed = BlogUpdateSchema.safeParse(body);
    if (!parsed.success) {
      return validationError(parsed.error);
    }

    const existing = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, params.id),
    });
    if (!existing) {
      return notFound('Post tidak ditemukan');
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };

    // Sanitize HTML content to prevent XSS
    if (data.contentId !== undefined) {
      updateData.contentId = DOMPurify.sanitize(data.contentId, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'a', 'img', 'blockquote', 'code', 'pre'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target', 'rel'],
      });
    }
    if (data.contentEn !== undefined) {
      updateData.contentEn = DOMPurify.sanitize(data.contentEn, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'a', 'img', 'blockquote', 'code', 'pre'],
        ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target', 'rel'],
      });
    }

    if (data.titleId !== undefined) updateData.titleId = DOMPurify.sanitize(data.titleId, { ALLOWED_TAGS: [] });
    if (data.titleEn !== undefined) updateData.titleEn = DOMPurify.sanitize(data.titleEn, { ALLOWED_TAGS: [] });
    if (data.slug !== undefined) {
      updateData.slug = data.slug;
      // M-05: Check slug uniqueness excluding current post
      if (data.slug !== existing.slug) {
        const slugConflict = await db.query.blogPosts.findFirst({
          where: and(
            eq(blogPosts.slug, data.slug),
            isNull(blogPosts.deletedAt),
          ),
        });
        if (slugConflict && slugConflict.id !== params.id) {
          return conflict('Slug sudah digunakan oleh post lain');
        }
      }
    }
    if (data.excerptId !== undefined) {
      updateData.excerptId = DOMPurify.sanitize(data.excerptId, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'a', 'blockquote', 'code', 'pre'],
        ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
      });
    }
    if (data.excerptEn !== undefined) {
      updateData.excerptEn = DOMPurify.sanitize(data.excerptEn, {
        ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'a', 'blockquote', 'code', 'pre'],
        ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
      });
    }
    if (data.coverImageUrl !== undefined) updateData.coverImageUrl = data.coverImageUrl;
    if (data.coverImagePublicId !== undefined) updateData.coverImagePublicId = data.coverImagePublicId;
    if (data.blogCategoryId !== undefined) updateData.blogCategoryId = data.blogCategoryId;
    if (data.isPublished !== undefined) {
      updateData.isPublished = data.isPublished;
      if (data.isPublished && !existing.publishedAt) {
        updateData.publishedAt = new Date();
      }
    }
    if (data.isAiAssisted !== undefined) updateData.isAiAssisted = data.isAiAssisted;
    if (data.metaTitleId !== undefined) updateData.metaTitleId = DOMPurify.sanitize(data.metaTitleId ?? '', { ALLOWED_TAGS: [] });
    if (data.metaTitleEn !== undefined) updateData.metaTitleEn = DOMPurify.sanitize(data.metaTitleEn ?? '', { ALLOWED_TAGS: [] });
    if (data.metaDescriptionId !== undefined) updateData.metaDescriptionId = DOMPurify.sanitize(data.metaDescriptionId ?? '', { ALLOWED_TAGS: [] });
    if (data.metaDescriptionEn !== undefined) updateData.metaDescriptionEn = DOMPurify.sanitize(data.metaDescriptionEn ?? '', { ALLOWED_TAGS: [] });

    const [updated] = await db
      .update(blogPosts)
      .set(updateData)
      .where(eq(blogPosts.id, params.id))
      .returning();

    return success(updated);
  } catch (error) {
    console.error('[Admin Blog PUT]', error);
    return serverError(error);
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }
    if (!['superadmin', 'owner'].includes(session.user.role as string)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const existing = await db.query.blogPosts.findFirst({
      where: and(eq(blogPosts.id, params.id), isNull(blogPosts.deletedAt)),
    });
    if (!existing) {
      return notFound('Post tidak ditemukan');
    }

    await db
      .update(blogPosts)
      .set({ deletedAt: new Date() })
      .where(eq(blogPosts.id, params.id));

    return success({ id: params.id });
  } catch (error) {
    console.error('[Admin Blog DELETE]', error);
    return serverError(error);
  }
}