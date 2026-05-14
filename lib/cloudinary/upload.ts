import { v2 as cloudinary } from 'cloudinary';
import fs from 'fs/promises';
import path from 'path';

cloudinary.config({
  cloud_name: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
  api_key: process.env.CLOUDINARY_API_KEY!,
  api_secret: process.env.CLOUDINARY_API_SECRET!,
});

export const CLOUDINARY_FOLDERS = {
  products: 'dapurdekaka/products',
  blog: 'dapurdekaka/blog',
  carousel: 'dapurdekaka/carousel',
  avatars: 'dapurdekaka/avatars',
  gallery: 'dapurdekaka/gallery',
  sauces: 'dapurdekaka/sauces',
} as const;

export type CloudinaryFolder = keyof typeof CLOUDINARY_FOLDERS;

export interface SignedUploadResult {
  signature: string;
  timestamp: number;
  cloudName: string;
  apiKey: string;
  folder: string;
  publicId?: string;
  maxFileSize?: number;
  allowedFormats?: string[];
}

export interface ServerUploadResult {
  url: string;
  publicId: string;
}

/**
 * Generate signed upload parameters for client-side upload.
 */
export function generateSignedUploadParams({
  folder,
  publicId,
  maxFileSize = 5 * 1024 * 1024, // 5MB default
  allowedFormats = ['jpg', 'jpeg', 'png', 'webp'],
}: {
  folder: CloudinaryFolder;
  publicId?: string;
  maxFileSize?: number;
  allowedFormats?: string[];
}): SignedUploadResult {
  const folderPath = CLOUDINARY_FOLDERS[folder];
  const timestamp = Math.round(Date.now() / 1000);

  const params: Record<string, string | number | boolean> = {
    timestamp,
    folder: folderPath,
    max_file_size: maxFileSize,
    allowed_formats: allowedFormats.join(','),
  };

  if (publicId) {
    params.public_id = publicId;
  }

  const signature = cloudinary.utils.api_sign_request(
    params,
    process.env.CLOUDINARY_API_SECRET!
  );

  return {
    signature,
    timestamp,
    cloudName: process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME!,
    apiKey: process.env.CLOUDINARY_API_KEY!,
    folder: folderPath,
    publicId,
    maxFileSize,
    allowedFormats,
  };
}

/**
 * Server-side upload from a local file path.
 * Used by admin for direct uploads.
 */
export async function serverSideUpload(
  filePath: string,
  folder: CloudinaryFolder,
  publicId?: string
): Promise<ServerUploadResult> {
  const absolutePath = path.resolve(filePath);

  // Verify file exists
  await fs.access(absolutePath);

  const folderPath = CLOUDINARY_FOLDERS[folder];
  const result = await cloudinary.uploader.upload(absolutePath, {
    folder: folderPath,
    resource_type: 'image',
    use_filename: true,
    unique_filename: true,
    overwrite: Boolean(publicId),
    ...(publicId ? { public_id: publicId } : {}),
  });

  // Clean up temp file after upload
  try {
    await fs.unlink(absolutePath);
  } catch {
    // Non-critical - temp file will be cleaned up by OS eventually
  }

  return {
    url: result.secure_url,
    publicId: result.public_id as string,
  };
}

/**
 * Delete an image from Cloudinary by public ID.
 */
export async function deleteImage(publicId: string): Promise<void> {
  await cloudinary.uploader.destroy(publicId, {
    resource_type: 'image',
  });
}