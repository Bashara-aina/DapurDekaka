import { NextRequest, NextResponse } from 'next/server';
import { serverSideUpload } from '@/lib/cloudinary/upload';
import { success, unauthorized, forbidden, serverError } from '@/lib/utils/api-response';
import { auth } from '@/lib/auth';
import type { CloudinaryFolder } from '@/lib/cloudinary/upload';
import { z } from 'zod';

const folderSchema = z.object({
  folder: z.enum(['products', 'blog', 'carousel', 'avatars', 'gallery', 'sauces']),
});

/**
 * Admin server-side upload from multipart form data.
 * Authenticated superadmin/owner only.
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
        { success: false, error: 'No file provided', code: 'VALIDATION_ERROR' },
        { status: 422 }
      );
    }

    // Max 10MB
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

    // Write file to temp location
    const arrayBuffer = await file.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    const tmpPath = `/tmp/upload-${Date.now()}-${file.name}`;

    const { writeFile } = await import('fs/promises');
    await writeFile(tmpPath, buffer);

    // Upload to Cloudinary
    const result = await serverSideUpload(tmpPath, folderValue as CloudinaryFolder);

    return success({
      url: result.url,
      publicId: result.publicId,
    });
  } catch (error) {
    console.error('[AdminUpload] Error:', error);
    return serverError(error);
  }
}