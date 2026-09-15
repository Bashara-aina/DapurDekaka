/**
 * Deterministic fallback cover for blog posts that have no `coverImageUrl`.
 *
 * The seed data ships without covers, which previously rendered as an empty
 * cream box with the title printed twice (once as a placeholder, once as the
 * heading). That is the main reason /blog "looks wrong".
 *
 * We map any slug/id to one of the local gallery photos so every card and
 * hero always has real food photography. Local assets need no Cloudinary
 * config and work offline.
 */
const GALLERY_COUNT = 33;

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
  return `/assets/gallery/${index}.jpg`;
}

export function getBlogCoverImage(
  coverImageUrl: string | null | undefined,
  seed: string | null | undefined,
): string {
  if (coverImageUrl?.trim()) return coverImageUrl;
  return getBlogFallbackImage(seed);
}
