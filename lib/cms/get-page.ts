/**
 * Read published CMS page sections by slug.
 * Returns null when page missing or unpublished so callers can fall back to i18n.
 */

import { db } from '@/lib/db';
import { cmsPages, cmsPageSections, cmsGalleryImages } from '@/lib/db/schema';
import { and, asc, eq } from 'drizzle-orm';

export interface CmsSectionDTO {
  sectionKey: string;
  sortOrder: number;
  titleId: string | null;
  titleEn: string | null;
  bodyId: string | null;
  bodyEn: string | null;
  ctaLabelId: string | null;
  ctaLabelEn: string | null;
  ctaHref: string | null;
  imagePublicId: string | null;
  meta: Record<string, unknown> | null;
}

export interface CmsPageDTO {
  slug: string;
  title: string;
  sections: CmsSectionDTO[];
}

export async function getCmsPage(slug: string): Promise<CmsPageDTO | null> {
  const page = await db.query.cmsPages.findFirst({
    where: and(eq(cmsPages.slug, slug), eq(cmsPages.isPublished, true)),
  });

  if (!page) return null;

  const sections = await db.query.cmsPageSections.findMany({
    where: eq(cmsPageSections.pageId, page.id),
    orderBy: [asc(cmsPageSections.sortOrder)],
  });

  return {
    slug: page.slug,
    title: page.title,
    sections: sections.map((s) => ({
      sectionKey: s.sectionKey,
      sortOrder: s.sortOrder,
      titleId: s.titleId,
      titleEn: s.titleEn,
      bodyId: s.bodyId,
      bodyEn: s.bodyEn,
      ctaLabelId: s.ctaLabelId,
      ctaLabelEn: s.ctaLabelEn,
      ctaHref: s.ctaHref,
      imagePublicId: s.imagePublicId,
      meta: (s.meta as Record<string, unknown> | null) ?? null,
    })),
  };
}

export function pickSection(
  page: CmsPageDTO | null,
  key: string
): CmsSectionDTO | null {
  if (!page) return null;
  return page.sections.find((s) => s.sectionKey === key) ?? null;
}

export function sectionText(
  section: CmsSectionDTO | null,
  locale: 'id' | 'en',
  field: 'title' | 'body' | 'ctaLabel'
): string {
  if (!section) return '';
  if (field === 'title') {
    return (locale === 'en' ? section.titleEn : section.titleId) ?? section.titleId ?? '';
  }
  if (field === 'body') {
    return (locale === 'en' ? section.bodyEn : section.bodyId) ?? section.bodyId ?? '';
  }
  return (locale === 'en' ? section.ctaLabelEn : section.ctaLabelId) ?? section.ctaLabelId ?? '';
}

export interface GalleryImageDTO {
  id: string;
  publicId: string;
  altId: string | null;
  altEn: string | null;
  sortOrder: number;
}

export async function getGalleryByUsage(
  usage: 'instagram_feed' | 'about_hero' | 'og' | 'general',
  limit = 12
): Promise<GalleryImageDTO[]> {
  const rows = await db.query.cmsGalleryImages.findMany({
    where: and(eq(cmsGalleryImages.usage, usage), eq(cmsGalleryImages.isActive, true)),
    orderBy: [asc(cmsGalleryImages.sortOrder)],
    limit,
  });

  return rows.map((r) => ({
    id: r.id,
    publicId: r.publicId,
    altId: r.altId,
    altEn: r.altEn,
    sortOrder: r.sortOrder,
  }));
}
