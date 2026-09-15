export function cloudinaryUrl(publicId: string | null | undefined): string | undefined {
  if (!publicId) return undefined;
  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
  if (!cloudName) return undefined;
  return `https://res.cloudinary.com/${cloudName}/image/upload/${publicId}`;
}