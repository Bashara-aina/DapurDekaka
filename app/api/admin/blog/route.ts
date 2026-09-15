import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq, desc, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { success, serverError, unauthorized, forbidden, validationError, conflict } from '@/lib/utils/api-response';
import { sanitizeRichText, sanitizeExcerpt, sanitizePlainText } from '@/lib/utils/sanitize-html';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const CreatePostSchema = z.object({
  titleId: z.string().min(1),
  titleEn: z.string().min(1),
  slug: z.string().min(1),
  excerptId: z.string().optional(),
  excerptEn: z.string().optional(),
  contentId: z.string().optional(),
  contentEn: z.string().optional(),
  coverImageUrl: z.string().url().optional().nullable(),
  blogCategoryId: z.string().uuid().optional().nullable(),
  metaTitleId: z.string().optional(),
  metaDescriptionId: z.string().optional(),
  metaTitleEn: z.string().optional(),
  metaDescriptionEn: z.string().optional(),
  isPublished: z.boolean().default(false),
  publishedAt: z.string().datetime().optional().nullable(),
});

export async function GET(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role as string)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const posts = await db.query.blogPosts.findMany({
      where: isNull(blogPosts.deletedAt),
      orderBy: [desc(blogPosts.createdAt)],
    });

    return success(posts);
  } catch (error) {
    return serverError(error);
  }
}

export async function POST(req: NextRequest) {
  try {
    const session = await auth();
    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = session.user.role;
    if (!['superadmin', 'owner'].includes(role as string)) {
      return forbidden('Anda tidak memiliki akses');
    }

    const body = await req.json();
    const parsed = CreatePostSchema.safeParse(body);

    if (!parsed.success) {
      return validationError(parsed.error);
    }

    // Sanitize ALL text fields to prevent XSS (centralized policies).
    const cleanTitleId = sanitizePlainText(parsed.data.titleId);
    const cleanTitleEn = sanitizePlainText(parsed.data.titleEn);
    const cleanExcerptId = parsed.data.excerptId ? sanitizeExcerpt(parsed.data.excerptId) : '';
    const cleanExcerptEn = parsed.data.excerptEn ? sanitizeExcerpt(parsed.data.excerptEn) : '';
    const cleanContentId = parsed.data.contentId ? sanitizeRichText(parsed.data.contentId) : '';
    const cleanContentEn = parsed.data.contentEn ? sanitizeRichText(parsed.data.contentEn) : '';

    const existingSlug = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.slug, parsed.data.slug),
    });
    if (existingSlug) {
      return conflict('Slug sudah digunakan oleh post lain');
    }

    const [post] = await db.insert(blogPosts).values({
      titleId: cleanTitleId,
      titleEn: cleanTitleEn,
      slug: parsed.data.slug,
      excerptId: cleanExcerptId,
      excerptEn: cleanExcerptEn,
      contentId: cleanContentId,
      contentEn: cleanContentEn,
      coverImageUrl: parsed.data.coverImageUrl,
      blogCategoryId: parsed.data.blogCategoryId,
      metaTitleId: sanitizePlainText(parsed.data.metaTitleId),
      metaDescriptionId: sanitizePlainText(parsed.data.metaDescriptionId),
      metaTitleEn: sanitizePlainText(parsed.data.metaTitleEn),
      metaDescriptionEn: sanitizePlainText(parsed.data.metaDescriptionEn),
      isPublished: parsed.data.isPublished,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null,
      authorId: session.user.id,
    }).returning();

    if (!post) {
      return serverError(new Error('Failed to create post'));
    }

    return success(post, 201);
  } catch (error) {
    return serverError(error);
  }
}