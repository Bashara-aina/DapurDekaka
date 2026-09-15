import type { ReactElement } from 'react';
import { sanitizeCmsHtml } from '@/lib/utils/sanitize-html';
import { getCmsPage, pickSection, sectionText, type CmsPageDTO } from '@/lib/cms/get-page';

function cleanHtml(input: string): string {
  return sanitizeCmsHtml(input);
}

/**
 * Renders CMS page sections as stacked prose blocks with i18n fallbacks.
 */
export function CmsProseSections({
  page,
  locale = 'id',
  fallbacks,
}: {
  page: CmsPageDTO | null;
  locale?: 'id' | 'en';
  fallbacks?: Array<{ key: string; title: string; body: string }>;
}): ReactElement {
  const sections =
    page && page.sections.length > 0
      ? page.sections
      : (fallbacks ?? []).map((f, i) => ({
          sectionKey: f.key,
          sortOrder: i,
          titleId: f.title,
          titleEn: f.title,
          bodyId: f.body,
          bodyEn: f.body,
          ctaLabelId: null,
          ctaLabelEn: null,
          ctaHref: null,
          imagePublicId: null,
          meta: null,
        }));

  return (
    <div className="space-y-8">
      {sections.map((section) => {
        const title = sectionText(section, locale, 'title');
        const body = sectionText(section, locale, 'body');
        if (!title && !body) return null;
        const safeBody = body ? cleanHtml(body) : '';
        return (
          <section key={section.sectionKey}>
            {title ? (
              <h2 className="font-display text-xl font-semibold text-text-primary mb-3">
                {title}
              </h2>
            ) : null}
            {safeBody ? (
              <div
                className="prose prose-sm max-w-none text-text-secondary"
                dangerouslySetInnerHTML={{ __html: safeBody }}
              />
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

export async function loadCmsOrNull(slug: string): Promise<CmsPageDTO | null> {
  return getCmsPage(slug).catch(() => null);
}

export { pickSection, sectionText };
