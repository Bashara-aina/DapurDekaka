/**
 * Deterministic fallback cover for blog posts that have no `coverImageUrl`.
 *
 * The seed data ships without covers, which previously rendered as an empty
 * cream box with the title printed twice (once as a placeholder, once as the
 * heading). That is the main reason /blog "looks wrong".
 *
 * We map any slug/id to one of the gallery photos on Cloudinary (the same
 * `dapurdekaka/gallery/gallery-NN` ids the CMS seed uses), so every card and
 * hero always has real food photography. The local copies were removed to
 * keep the repo and deploys small.
 */
const GALLERY_COUNT = 33;
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dsnhwfuxh';

function hashString(input: string): number {
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = (hash * 31 + input.charCodeAt(i)) >>> 0;
  }
  return hash;
}

export function getBlogFallbackImage(seed: string | null | undefined): string {
  const key = seed?.trim() || 'dapur-dekaka';
  const index = (hashString(key) % GALLERY_COUNT) + 1;
  const id = String(index).padStart(2, '0');
  return `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_auto,q_auto,w_1200/dapurdekaka/gallery/gallery-${id}`;
}

export function getBlogCoverImage(
  coverImageUrl: string | null | undefined,
  seed: string | null | undefined,
): string {
  if (coverImageUrl?.trim()) return coverImageUrl;
  return getBlogFallbackImage(seed);
}
