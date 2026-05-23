import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq, desc, isNull } from 'drizzle-orm';
import { z } from 'zod';
import { success, serverError, unauthorized, forbidden, validationError, conflict } from '@/lib/utils/api-response';
import DOMPurify from 'isomorphic-dompurify';
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
    console.error('[Admin Blog GET]', error);
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

    // Sanitize ALL text fields to prevent XSS
    const cleanTitleId = DOMPurify.sanitize(parsed.data.titleId, { ALLOWED_TAGS: [] });
    const cleanTitleEn = DOMPurify.sanitize(parsed.data.titleEn, { ALLOWED_TAGS: [] });
    const cleanExcerptId = parsed.data.excerptId
      ? DOMPurify.sanitize(parsed.data.excerptId, {
          ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'a', 'blockquote', 'code', 'pre'],
          ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
        })
      : '';
    const cleanExcerptEn = parsed.data.excerptEn
      ? DOMPurify.sanitize(parsed.data.excerptEn, {
          ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'a', 'blockquote', 'code', 'pre'],
          ALLOWED_ATTR: ['href', 'class', 'target', 'rel'],
        })
      : '';
    const cleanContentId = parsed.data.contentId
      ? DOMPurify.sanitize(parsed.data.contentId, {
          ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'a', 'img', 'blockquote', 'code', 'pre'],
          ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target', 'rel'],
        })
      : '';
    const cleanContentEn = parsed.data.contentEn
      ? DOMPurify.sanitize(parsed.data.contentEn, {
          ALLOWED_TAGS: ['p', 'br', 'strong', 'em', 'ul', 'ol', 'li', 'h2', 'h3', 'a', 'img', 'blockquote', 'code', 'pre'],
          ALLOWED_ATTR: ['href', 'src', 'alt', 'class', 'target', 'rel'],
        })
      : '';

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
      metaTitleId: DOMPurify.sanitize(parsed.data.metaTitleId ?? '', { ALLOWED_TAGS: [] }),
      metaDescriptionId: DOMPurify.sanitize(parsed.data.metaDescriptionId ?? '', { ALLOWED_TAGS: [] }),
      metaTitleEn: DOMPurify.sanitize(parsed.data.metaTitleEn ?? '', { ALLOWED_TAGS: [] }),
      metaDescriptionEn: DOMPurify.sanitize(parsed.data.metaDescriptionEn ?? '', { ALLOWED_TAGS: [] }),
      isPublished: parsed.data.isPublished,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null,
      authorId: session.user.id,
    }).returning();

    if (!post) {
      return serverError(new Error('Failed to create post'));
    }

    return success(post, 201);
  } catch (error) {
    console.error('[Admin Blog POST]', error);
    return serverError(error);
  }
}