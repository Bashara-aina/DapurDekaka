/**
 * Idempotent CMS seed — pages, sections, gallery images from i18n migration data.
 * Safe to re-run: skips existing pages by slug and existing gallery rows by publicId.
 */

import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import { and, eq } from 'drizzle-orm';
import * as schema from '../lib/db/schema';
import { CMS_PAGE_SEEDS, GALLERY_IMAGE_SEEDS } from './cms-seed-data';

if (process.env.NODE_ENV === 'production') {
  console.error('ABORT: Cannot run CMS seed script in production.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('ABORT: DATABASE_URL is not set.');
  process.exit(1);
}

const sql = neon(process.env.DATABASE_URL);
const db = drizzle(sql, { schema });

async function seedCmsPages(): Promise<void> {
  console.log('Seeding CMS pages...');

  for (const pageSeed of CMS_PAGE_SEEDS) {
    const existing = await db.query.cmsPages.findFirst({
      where: eq(schema.cmsPages.slug, pageSeed.slug),
      columns: { id: true, slug: true },
    });

    if (existing) {
      console.log(`  Skip page "${pageSeed.slug}" — already exists.`);
      continue;
    }

    const [page] = await db
      .insert(schema.cmsPages)
      .values({
        slug: pageSeed.slug,
        title: pageSeed.title,
        isPublished: true,
      })
      .returning({ id: schema.cmsPages.id });

    if (!page) {
      throw new Error(`Failed to insert CMS page: ${pageSeed.slug}`);
    }

    await db.insert(schema.cmsPageSections).values(
      pageSeed.sections.map((section) => ({
        pageId: page.id,
        sectionKey: section.sectionKey,
        sortOrder: section.sortOrder,
        titleId: section.titleId ?? null,
        titleEn: section.titleEn ?? null,
        bodyId: section.bodyId ?? null,
        bodyEn: section.bodyEn ?? null,
        ctaLabelId: section.ctaLabelId ?? null,
        ctaLabelEn: section.ctaLabelEn ?? null,
        ctaHref: section.ctaHref ?? null,
        imagePublicId: section.imagePublicId ?? null,
        meta: section.meta ?? null,
      }))
    );

    console.log(`  Created page "${pageSeed.slug}" with ${pageSeed.sections.length} sections.`);
  }
}

async function seedGalleryImages(): Promise<void> {
  console.log('Seeding CMS gallery images...');

  let created = 0;
  let skipped = 0;

  for (const image of GALLERY_IMAGE_SEEDS) {
    const existing = await db.query.cmsGalleryImages.findFirst({
      where: and(
        eq(schema.cmsGalleryImages.publicId, image.publicId),
        eq(schema.cmsGalleryImages.usage, image.usage)
      ),
      columns: { id: true },
    });

    if (existing) {
      skipped += 1;
      continue;
    }

    await db.insert(schema.cmsGalleryImages).values({
      publicId: image.publicId,
      altId: image.altId,
      altEn: image.altEn,
      sortOrder: image.sortOrder,
      isActive: true,
      usage: image.usage,
    });
    created += 1;
  }

  console.log(`  Gallery: ${created} created, ${skipped} skipped (already exist).`);
}

async function seedCms(): Promise<void> {
  console.log('Starting CMS seed...');
  await seedCmsPages();
  await seedGalleryImages();
  console.log('CMS seed completed successfully.');
}

seedCms().catch((err: unknown) => {
  console.error('CMS seed failed:', err);
  process.exit(1);
});
