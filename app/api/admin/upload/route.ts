import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/utils/logger';
import { validateImageFile, writeTempUploadFile } from '@/lib/utils/upload-validation';
import { serverSideUpload } from '@/lib/cloudinary/upload';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';
import { withRateLimit } from '@/lib/utils/rate-limit';
import { auth } from '@/lib/auth';
import type { CloudinaryFolder } from '@/lib/cloudinary/upload';
import { z } from 'zod';
export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const folderSchema = z.object({
  folder: z.enum(['products', 'blog', 'carousel', 'avatars', 'gallery', 'sauces', 'cms']),
});

/**
 * Admin server-side upload from multipart form data.
 * Authenticated superadmin/owner only.
 */
export const POST = withRateLimit(async (req: NextRequest) => {
  try {
    const session = await auth();

    if (!session?.user) {
      return unauthorized('Silakan login terlebih dahulu');
    }

    const role = (session.user as { role?: string }).role;
    if (!role || !['superadmin', 'owner'].includes(role)) {
      return forbidden('Anda tidak memiliki akses untuk upload');
    }

    let formData: FormData;
    try {
      formData = await req.formData();
    } catch (err) {
      logger.warn('[admin/upload] invalid form data', {
        error: err instanceof Error ? err.message : String(err),
      });
      return NextResponse.json(
        { success: false, error: 'Invalid form data', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    const file = formData.get('file') as File | null;
    // Size + claimed MIME + magic-byte verification (shared guard).
    // (Cloudinary resource_type:'image' re-validates server-side as depth.)
    const validated = await validateImageFile(file);
    if ('error' in validated) {
      if (validated.error === 'No file provided') {
        return NextResponse.json(
          { success: false, error: 'No file provided', code: 'VALIDATION_ERROR' },
          { status: 422 }
        );
      }
      if (validated.error.startsWith('Ukuran file')) {
        return NextResponse.json(
          { success: false, error: validated.error, code: 'VALIDATION_ERROR' },
          { status: 422 }
        );
      }
      logger.warn('[admin/upload] rejected upload', { claimedType: (file as File | null)?.type, error: validated.error });
      return NextResponse.json(
        { success: false, error: validated.error, code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }
    const { buffer, ext } = validated;

    const folderValue = formData.get('folder') as string | null;
    if (!folderValue) {
      return NextResponse.json(
        { success: false, error: 'Folder is required', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    const parsed = folderSchema.safeParse({ folder: folderValue });
    if (!parsed.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid folder value', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    // Write file to temp location under a random, traversal-safe name.
    // (Never interpolate the client-supplied filename into a path.)
    const tmpPath = await writeTempUploadFile(buffer, ext);

    // Upload to Cloudinary (serverSideUpload unlinks the temp file in finally)
    const result = await serverSideUpload(tmpPath, folderValue as CloudinaryFolder);

    return success({
      url: result.url,
      publicId: result.publicId,
    });
  } catch (error) {
    // serverError() already logs — no duplicate console.error.
    return serverError(error);
  }
}, 'admin');