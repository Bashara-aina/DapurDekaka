/**
 * Shared types and helpers for CMS seed data modules.
 */

export interface CmsSectionSeed {
  sectionKey: string;
  sortOrder: number;
  titleId?: string;
  titleEn?: string;
  bodyId?: string;
  bodyEn?: string;
  ctaLabelId?: string;
  ctaLabelEn?: string;
  ctaHref?: string;
  imagePublicId?: string;
  meta?: Record<string, unknown>;
}

export interface CmsPageSeed {
  slug: string;
  title: string;
  sections: CmsSectionSeed[];
}

export function listSections(
  prefix: string,
  itemsId: readonly string[],
  itemsEn: readonly string[],
  startOrder: number,
  metaList: string
): CmsSectionSeed[] {
  return itemsId.map((bodyId, i) => ({
    sectionKey: `${prefix}_${i + 1}`,
    sortOrder: startOrder + i,
    bodyId,
    bodyEn: itemsEn[i] ?? bodyId,
    meta: { list: metaList },
  }));
}

export function policyBlock(
  key: string,
  order: number,
  titleId: string,
  titleEn: string,
  bodyId: string,
  bodyEn: string
): CmsSectionSeed {
  return { sectionKey: key, sortOrder: order, titleId, titleEn, bodyId, bodyEn };
}

export function featureSections(
  prefix: string,
  items: ReadonlyArray<{ titleId: string; titleEn: string; bodyId: string; bodyEn: string }>,
  startOrder = 1
): CmsSectionSeed[] {
  return items.map((item, i) => ({
    sectionKey: `${prefix}_${i}`,
    sortOrder: startOrder + i,
    titleId: item.titleId,
    titleEn: item.titleEn,
    bodyId: item.bodyId,
    bodyEn: item.bodyEn,
  }));
}
