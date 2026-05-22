import 'dotenv/config';
import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../lib/db/schema';
import { eq, and } from 'drizzle-orm';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function seed() {
  console.log('Starting minimal seed (carousel slides + featured products)...\n');

  // ── 1. Seed carousel slides (upsert — skip if already exists) ─────────────
  console.log('[1/3] Seeding carousel slides...');

  const existingSlides = await db.query.carouselSlides.findMany({});
  if (existingSlides.length > 0) {
    console.log(`  → ${existingSlides.length} slides already exist, skipping carousel`);
  } else {
    const slides = [
      {
        type: 'product_hero' as const,
        titleId: 'Dimsum Segar Langsung dari Dapur',
        titleEn: 'Fresh Dimsum Straight from the Kitchen',
        subtitleId: 'Dikirim ke Seluruh Indonesia',
        subtitleEn: 'Shipped All Across Indonesia',
        imageUrl: '/assets/gallery/1.jpg',
        imagePublicId: 'dapurdekaka/gallery/gallery-01',
        ctaLabelId: 'Pesan Sekarang',
        ctaLabelEn: 'Order Now',
        ctaUrl: '/products',
        badgeText: null,
        sortOrder: 1,
        isActive: true,
        startsAt: null,
        endsAt: null,
      },
      {
        type: 'promo' as const,
        titleId: 'PROMO 10% OFF',
        titleEn: '10% OFF PROMO',
        subtitleId: 'Untuk pembelian pertama kamu',
        subtitleEn: 'For your first purchase',
        imageUrl: '/assets/gallery/2.jpg',
        imagePublicId: 'dapurdekaka/gallery/gallery-02',
        ctaLabelId: 'Klaim Sekarang',
        ctaLabelEn: 'Claim Now',
        ctaUrl: '/products',
        badgeText: 'SELAMATDATANG',
        sortOrder: 2,
        isActive: true,
        startsAt: null,
        endsAt: null,
      },
      {
        type: 'brand_story' as const,
        titleId: '德卡',
        titleEn: 'Dapur Dekaka',
        subtitleId: 'Warisan rasa yang tak tergantikan',
        subtitleEn: 'A taste heritage that cannot be replaced',
        imageUrl: '/assets/gallery/3.jpg',
        imagePublicId: 'dapurdekaka/gallery/gallery-03',
        ctaLabelId: null,
        ctaLabelEn: null,
        ctaUrl: '/products',
        badgeText: null,
        sortOrder: 3,
        isActive: true,
        startsAt: null,
        endsAt: null,
      },
    ];

    await db.insert(schema.carouselSlides).values(slides);
    console.log(`  → Created ${slides.length} carousel slides`);
  }

  // ── 2. Mark featured products ─────────────────────────────────────────────
  console.log('\n[2/3] Marking products as featured...');

  const featuredSlugs = [
    'dimsum-crabstick',
    'dimsum-mozarella',
    'dimsum-golden',
    'lumpia-kulit-tahu',
    'pangsit-ayam',
  ];

  // First check how many are already featured
  const currentlyFeatured = await db.query.products.findMany({
    where: and(eq(schema.products.isFeatured, true), eq(schema.products.isActive, true)),
  });
  console.log(`  → ${currentlyFeatured.length} products currently marked as featured`);

  // Mark the 5 products as featured (update even if already set)
  for (const slug of featuredSlugs) {
    await db
      .update(schema.products)
      .set({ isFeatured: true, updatedAt: new Date() })
      .where(and(eq(schema.products.slug, slug), eq(schema.products.isActive, true)));
  }

  const updatedFeatured = await db.query.products.findMany({
    where: and(eq(schema.products.isFeatured, true), eq(schema.products.isActive, true)),
  });
  console.log(`  → ${updatedFeatured.length} products now marked as featured`);

  // ── 3. Add PROMO settings if missing ─────────────────────────────────────
  console.log('\n[3/3] Ensuring promo settings exist...');

  const promoKeys = ['PROMO_CODE', 'PROMO_TITLE', 'PROMO_SUBTITLE', 'CAROUSEL_SPEED_MS'];
  const { inArray } = require('drizzle-orm');
  const existingSettings = await db.query.systemSettings.findMany({
    where: inArray(schema.systemSettings.key, promoKeys),
  });

  const existingKeys = new Set(existingSettings.map(s => s.key));
  const toInsert = [];

  if (!existingKeys.has('PROMO_CODE')) {
    toInsert.push({ key: 'PROMO_CODE', value: 'SELAMATDATANG', type: 'string' });
  }
  if (!existingKeys.has('PROMO_TITLE')) {
    toInsert.push({ key: 'PROMO_TITLE', value: 'Untuk pembelian pertama kamu', type: 'string' });
  }
  if (!existingKeys.has('PROMO_SUBTITLE')) {
    toInsert.push({ key: 'PROMO_SUBTITLE', value: 'Gunakan kode:', type: 'string' });
  }
  if (!existingKeys.has('CAROUSEL_SPEED_MS')) {
    toInsert.push({ key: 'CAROUSEL_SPEED_MS', value: '5000', type: 'integer' });
  }

  if (toInsert.length > 0) {
    await db.insert(schema.systemSettings).values(toInsert);
    console.log(`  → Created ${toInsert.length} promo settings`);
  } else {
    console.log('  → All promo settings already exist');
  }

  console.log('\n✅ Minimal seed completed!');
  console.log('\nNext: run `npm run build && vercel --prod` to deploy the fix.');
}

seed().catch((err) => {
  console.error('❌ Seed failed:', err);
  process.exit(1);
});