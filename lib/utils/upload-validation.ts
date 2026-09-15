/**
 * Shared server-side upload guards (used by /api/admin/upload and
 * /api/admin/products/[id]/images).
 *
 * - `file.type` is client-supplied and spoofable → verify magic bytes.
 * - Never interpolate client filenames into paths (traversal) → random names.
 */

import { writeFile } from 'fs/promises';
import path from 'path';
import { randomUUID } from 'crypto';

export const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;

export type SupportedImageExt = '.jpg' | '.png' | '.gif' | '.webp';

/**
 * JPEG (FF D8 FF), PNG (89 50 4E 47), GIF (47 49 46 38), WebP (RIFF....WEBP).
 * Returns the verified extension, or null when content is not an image.
 */
export function extensionForImageBuffer(buf: Buffer): SupportedImageExt | null {
  if (buf.length < 12) return null;
  if (buf[0] === 0xff && buf[1] === 0xd8 && buf[2] === 0xff) return '.jpg';
  if (buf[0] === 0x89 && buf[1] === 0x50 && buf[2] === 0x4e && buf[3] === 0x47) return '.png';
  if (buf[0] === 0x47 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x38) return '.gif';
  if (
    buf[0] === 0x52 && buf[1] === 0x49 && buf[2] === 0x46 && buf[3] === 0x46 &&
    buf[8] === 0x57 && buf[9] === 0x45 && buf[10] === 0x42 && buf[11] === 0x50
  ) return '.webp';
  return null;
}

export function isSupportedImageBuffer(buf: Buffer): boolean {
  return extensionForImageBuffer(buf) !== null;
}

/**
 * Validate a multipart File (size + claimed MIME + magic bytes).
 * Returns the verified buffer + extension, or an error message for the client.
 */
export async function validateImageFile(
  file: unknown,
  maxBytes = 10 * 1024 * 1024
): Promise<{ buffer: Buffer; ext: SupportedImageExt } | { error: string }> {
  if (!file || !(file instanceof File) || file.size === 0) {
    return { error: 'No file provided' };
  }
  if (file.size > maxBytes) {
    return { error: `Ukuran file maksimal ${Math.round(maxBytes / 1024 / 1024)}MB` };
  }
  if (!(ALLOWED_IMAGE_TYPES as readonly string[]).includes(file.type)) {
    return { error: 'Format file tidak didukung. Gunakan JPG, PNG, WebP, atau GIF' };
  }
  const buffer = Buffer.from(await file.arrayBuffer());
  const ext = extensionForImageBuffer(buffer);
  if (!ext) {
    return { error: 'Format file tidak didukung. Gunakan JPG, PNG, WebP, atau GIF' };
  }
  return { buffer, ext };
}

/**
 * Write a verified buffer to /tmp under a random, traversal-safe name.
 * Callers must delete (or hand to serverSideUpload, which unlinks in finally).
 */
export async function writeTempUploadFile(buffer: Buffer, ext: SupportedImageExt): Promise<string> {
  const tmpPath = path.join('/tmp', `upload-${Date.now()}-${randomUUID()}${ext}`);
  await writeFile(tmpPath, buffer);
  return tmpPath;
}
