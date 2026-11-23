import { db } from '../lib/db';
import {
  blogPosts,
  carouselSlides,
  coupons,
  cmsGalleryImages,
  cmsPages,
  testimonials,
} from '../lib/db/schema';

async function main(): Promise<void> {
  const [allCoupons, blogs, cms, testi, car, gal] = await Promise.all([
    db.select({ code: coupons.code, type: coupons.type, active: coupons.isActive }).from(coupons),
    db
      .select({
        slug: blogPosts.slug,
        published: blogPosts.isPublished,
      })
      .from(blogPosts),
    db.select({ slug: cmsPages.slug, published: cmsPages.isPublished }).from(cmsPages),
    db.select({ id: testimonials.id }).from(testimonials),
    db.select({ id: carouselSlides.id, title: carouselSlides.titleId }).from(carouselSlides),
    db.select({ usage: cmsGalleryImages.usage }).from(cmsGalleryImages),
  ]);

  const galleryUsages: Record<string, number> = {};
  for (const g of gal) {
    const key = g.usage || 'none';
    galleryUsages[key] = (galleryUsages[key] ?? 0) + 1;
  }

  console.log(
    JSON.stringify(
      {
        allCoupons,
        blogs,
        cms,
        testiCount: testi.length,
        carousel: car,
        galleryUsages,
      },
      null,
      2
    )
  );
}

main()
  .then(() => process.exit(0))
  .catch((err: unknown) => {
    console.error(err);
    process.exit(1);
  });
