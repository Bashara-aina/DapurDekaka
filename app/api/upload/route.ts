import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { generateSignedUploadParams } from '@/lib/cloudinary/upload';
import { success, unauthorized, serverError, forbidden } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';

const uploadParamsSchema = z.object({
  folder: z.enum(['products', 'blog', 'carousel', 'avatars', 'gallery', 'sauces']),
  publicId: z.string().optional(),
});

/**
 * Generate signed upload parameters for client-side upload.
 * Authenticated admin/owner/superadmin only.
 */
export async function POST(req: NextRequest) {
  try {
    const session = await auth();

    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses untuk upload');
    }

    const body = await req.json();
    const parsed = uploadParamsSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Validation failed', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    const { folder, publicId } = parsed.data;
    const signedParams = generateSignedUploadParams({ folder, publicId });

    return success(signedParams);
  } catch (error) {
    console.error('[Upload] Error generating signed params:', error);
    return serverError(error);
  }
}