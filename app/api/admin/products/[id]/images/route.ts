import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { productImages, products } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { logger } from '@/lib/utils/logger';
import { serverSideUpload } from '@/lib/cloudinary/upload';
import type { CloudinaryFolder } from '@/lib/cloudinary/upload';
import { validateImageFile, writeTempUploadFile } from '@/lib/utils/upload-validation';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(
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
    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return NextResponse.json(
        { success: false, error: 'Forbidden', code: 'FORBIDDEN' },
        { status: 403 }
      );
    }

    const product = await db.query.products.findFirst({
      where: and(eq(products.id, params.id), isNull(products.deletedAt)),
    });
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Produk tidak ditemukan', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (err) {
      logger.warn('[admin/product-images] invalid form data', {
        productId: params.id,
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { success: false, error: 'Invalid form data', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    // Shared guard: size + MIME + magic bytes (see lib/utils/upload-validation).
    const validated = await validateImageFile(formData.get('file'));
    if ('error' in validated) {
      if (validated.error !== 'No file provided' && !validated.error.startsWith('Ukuran file')) {
        logger.warn('[admin/product-images] rejected upload', { productId: params.id, error: validated.error });
      }
      const message =
        validated.error === 'No file provided' ? 'Tidak ada file yang diunggah' : validated.error;
      return NextResponse.json(
        { success: false, error: message, code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }
    const { buffer, ext } = validated;

    const altTextId = (formData.get('altTextId') as string | null) ?? '';
    const altTextEn = (formData.get('altTextEn') as string | null) ?? '';
    const sortOrderStr = formData.get('sortOrder') as string | null;
    const sortOrder = sortOrderStr ? parseInt(sortOrderStr, 10) : 0;

    // Traversal-safe random tmp name (never the client filename).
    const tmpPath = await writeTempUploadFile(buffer, ext);

    const uploadResult = await serverSideUpload(tmpPath, 'products' as CloudinaryFolder);

    const [created] = await db
      .insert(productImages)
      .values({
        productId: params.id,
        cloudinaryUrl: uploadResult.url,
        cloudinaryPublicId: uploadResult.publicId,
        altTextId: altTextId || null,
        altTextEn: altTextEn || null,
        sortOrder,
      })
      .returning();

    return NextResponse.json({ success: true, data: created }, { status: 201 });
  } catch (error) {
    // Logged centrally by the error path below — single structured log line.
    logger.error('[admin/product-images] POST failed', {
      productId: params.id,
      error: error instanceof Error ? error.message : String(error),
    });
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}