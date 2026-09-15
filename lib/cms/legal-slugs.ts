/** Legal CMS pages — write restricted to superadmin only. */
export const LEGAL_CMS_SLUGS = ['privacy', 'refund', 'terms'] as const;

export type LegalCmsSlug = (typeof LEGAL_CMS_SLUGS)[number];

export function isLegalCmsSlug(slug: string): slug is LegalCmsSlug {
  return (LEGAL_CMS_SLUGS as readonly string[]).includes(slug);
}

export function canWriteCmsPage(role: string, slug: string): boolean {
  if (!['superadmin', 'owner'].includes(role)) return false;
  if (isLegalCmsSlug(slug)) return role === 'superadmin';
  return true;
}
