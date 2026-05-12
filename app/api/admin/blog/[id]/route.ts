import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { eq } from 'drizzle-orm';
import { z } from 'zod';

export async function GET(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    if (!['superadmin', 'owner'].includes(session.user.role as string)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const post = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, params.id),
    });

    if (!post) {
      return NextResponse.json(
        { success: false, error: 'Post not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    return NextResponse.json({ success: true, data: post });
  } catch (error) {
    console.error('[Admin Blog GET:id]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    if (!['superadmin', 'owner'].includes(session.user.role as string)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const body = await req.json();
    const schema = z.object({
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
    const parsed = schema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR', details: parsed.error.flatten().fieldErrors },
        { status: 422 }
      );
    }

    const existing = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, params.id),
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Post not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const data = parsed.data;
    const updateData: Record<string, unknown> = { updatedAt: new Date() };
    
    if (data.titleId !== undefined) updateData.titleId = data.titleId;
    if (data.titleEn !== undefined) updateData.titleEn = data.titleEn;
    if (data.slug !== undefined) updateData.slug = data.slug;
    if (data.excerptId !== undefined) updateData.excerptId = data.excerptId;
    if (data.excerptEn !== undefined) updateData.excerptEn = data.excerptEn;
    if (data.contentId !== undefined) updateData.contentId = data.contentId;
    if (data.contentEn !== undefined) updateData.contentEn = data.contentEn;
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
    if (data.metaTitleId !== undefined) updateData.metaTitleId = data.metaTitleId;
    if (data.metaTitleEn !== undefined) updateData.metaTitleEn = data.metaTitleEn;
    if (data.metaDescriptionId !== undefined) updateData.metaDescriptionId = data.metaDescriptionId;
    if (data.metaDescriptionEn !== undefined) updateData.metaDescriptionEn = data.metaDescriptionEn;

    const [updated] = await db
      .update(blogPosts)
      .set(updateData)
      .where(eq(blogPosts.id, params.id))
      .returning();

    return NextResponse.json({ success: true, data: updated });
  } catch (error) {
    console.error('[Admin Blog PUT]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const session = await auth();
    if (!session?.user) {
      return NextResponse.json(
        { success: false, error: 'Unauthorized', code: 'UNAUTHORIZED' },
        { status: 401 }
      );
    }
    if (!['superadmin', 'owner'].includes(session.user.role as string)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const existing = await db.query.blogPosts.findFirst({
      where: eq(blogPosts.id, params.id),
    });
    if (!existing) {
      return NextResponse.json(
        { success: false, error: 'Post not found', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    await db.delete(blogPosts).where(eq(blogPosts.id, params.id));

    return NextResponse.json({ success: true, data: { id: params.id } });
  } catch (error) {
    console.error('[Admin Blog DELETE]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}