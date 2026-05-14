import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import { db } from '@/lib/db';
import { productImages, products } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { deleteImage } from '@/lib/cloudinary/upload';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string; imageId: string } }
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
      where: eq(products.id, params.id),
    });
    if (!product) {
      return NextResponse.json(
        { success: false, error: 'Produk tidak ditemukan', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    const image = await db.query.productImages.findFirst({
      where: and(
        eq(productImages.id, params.imageId),
        eq(productImages.productId, params.id)
      ),
    });
    if (!image) {
      return NextResponse.json(
        { success: false, error: 'Gambar tidak ditemukan', code: 'NOT_FOUND' },
        { status: 404 }
      );
    }

    try {
      await deleteImage(image.cloudinaryPublicId);
    } catch (cloudinaryError) {
      console.warn('[Admin Product Image DELETE] Cloudinary deletion failed:', cloudinaryError);
    }

    await db
      .delete(productImages)
      .where(eq(productImages.id, params.imageId));

    return NextResponse.json({ success: true, data: { id: params.imageId } });
  } catch (error) {
    console.error('[Admin Product Image DELETE]', error);
    return NextResponse.json(
      { success: false, error: 'Internal server error', code: 'INTERNAL_ERROR' },
      { status: 500 }
    );
  }
}