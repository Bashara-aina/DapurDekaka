import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { productImages, products } from '@/lib/db/schema';
import { eq, and, isNull } from 'drizzle-orm';
import { serverSideUpload } from '@/lib/cloudinary/upload';
import type { CloudinaryFolder } from '@/lib/cloudinary/upload';

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
    } catch {
      return NextResponse.json(
        { success: false, error: 'Invalid form data', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    const file = formData.get('file') as File | null;
    if (!file || !(file instanceof File) || file.size === 0) {
      return NextResponse.json(
        { success: false, error: 'Tidak ada file yang diunggah', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    const MAX_SIZE = 10 * 1024 * 1024;
    if (file.size > MAX_SIZE) {
      return NextResponse.json(
        { success: false, error: 'Ukuran file maksimal 10MB', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      return NextResponse.json(
        { success: false, error: 'Format file tidak didukung. Gunakan JPG, PNG, WebP, atau GIF', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    const altTextId = (formData.get('altTextId') as string | null) ?? '';
    const altTextEn = (formData.get('altTextEn') as string | null) ?? '';
    const sortOrderStr = formData.get('sortOrder') as string | null;
    const sortOrder = sortOrderStr ? parseInt(sortOrderStr, 10) : 0;

    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tmpPath = `/tmp/upload-${Date.now()}-${file.name}`;

    const { writeFile } = await import('fs/promises');
    await writeFile(tmpPath, buffer);

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
    console.error('[Admin Product Images POST]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}