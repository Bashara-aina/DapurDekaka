import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq, desc } from 'drizzle-orm';
import { z } from 'zod';
import { success, serverError, unauthorized, forbidden } from '@/lib/utils/api-response';
import DOMPurify from 'isomorphic-dompurify';

const CreatePostSchema = z.object({
  titleId: z.string().min(1),
  titleEn: z.string().min(1),
  slug: z.string().min(1),
  excerptId: z.string().optional(),
  excerptEn: z.string().optional(),
  contentId: z.string().optional(),
  contentEn: z.string().optional(),
  coverImageUrl: z.string().url().optional().nullable(),
  categoryId: z.string().uuid().optional().nullable(),
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
      return NextResponse.json(
        { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    // Sanitize HTML content to prevent XSS
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

    const [post] = await db.insert(blogPosts).values({
      ...parsed.data,
      contentId: cleanContentId,
      contentEn: cleanContentEn,
      publishedAt: parsed.data.publishedAt ? new Date(parsed.data.publishedAt) : null,
      authorId: session.user.id,
    }).returning();

    return success(post, 201);
  } catch (error) {
    console.error('[Admin Blog POST]', error);
    return serverError(error);
  }
}