import { neon } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-http';
import * as schema from '../lib/db/schema';
import bcrypt from 'bcryptjs';

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

async function seed() {
  console.log('Starting seed...');

  // 1. Create superadmin user
  console.log('Creating superadmin user...');
  const adminPassword = process.env.SEED_ADMIN_PASSWORD || 'adminpassword123';
  const passwordHash = await bcrypt.hash(adminPassword, 12);
  
  const [adminUser] = await db.insert(schema.users).values({
    name: 'Bashara',
    email: process.env.SEED_ADMIN_EMAIL || 'bashara@dapurdekaka.com',
    passwordHash,
    role: 'superadmin',
    isActive: true,
    pointsBalance: 0,
    languagePreference: 'id',
  }).returning();

  if (!adminUser) {
    throw new Error('Failed to create admin user');
  }

  console.log(`Created admin user: ${adminUser.email}`);

  // 2. Create categories
  console.log('Creating categories...');
  const categories = [
    { nameId: 'Dimsum Premium', nameEn: 'Premium Dimsum', slug: 'dimsum-premium', sortOrder: 1 },
    { nameId: 'Dimsum Klasik', nameEn: 'Classic Dimsum', slug: 'dimsum-klasik', sortOrder: 2 },
    { nameId: 'Dimsum Spesial', nameEn: 'Special Dimsum', slug: 'dimsum-spesial', sortOrder: 3 },
    { nameId: 'Lumpia & Ekado', nameEn: 'Lumpia & Ekado', slug: 'lumpia-ekado', sortOrder: 4 },
    { nameId: 'Pangsit', nameEn: 'Pangsit', slug: 'pangsit', sortOrder: 5 },
  ];

  const insertedCategories = await db.insert(schema.categories).values(
    categories.map(c => ({ ...c, isActive: true }))
  ).returning();
  
  console.log(`Created ${insertedCategories.length} categories`);

  // 3. Create system settings
  console.log('Creating system settings...');
  const settings = [
    { key: 'store_whatsapp_number', value: '6281234567890', type: 'string' },
    { key: 'store_opening_hours', value: '09:00 - 17:00 WIB', type: 'string' },
    { key: 'store_open_days', value: 'Senin - Sabtu', type: 'string' },
    { key: 'points_earn_rate', value: '1', type: 'integer' },
    { key: 'points_per_idr', value: '1000', type: 'integer' },
    { key: 'points_expiry_days', value: '365', type: 'integer' },
    { key: 'points_min_redeem', value: '100', type: 'integer' },
    { key: 'points_max_redeem_pct', value: '50', type: 'integer' },
    { key: 'payment_expiry_minutes', value: '15', type: 'integer' },
    { key: 'payment_max_retries', value: '3', type: 'integer' },
    { key: 'rajaongkir_origin_city_id', value: '23', type: 'string' },
    { key: 'min_order_weight_gram', value: '1000', type: 'integer' },
    { key: 'b2b_points_multiplier', value: '2', type: 'integer' },
    { key: 'maintenance_mode', value: 'false', type: 'boolean' },
    { key: 'instagram_handle', value: '@dapurdekaka', type: 'string' },
  ];

  await db.insert(schema.systemSettings).values(
    settings.map(s => ({ ...s, updatedBy: adminUser!.id }))
  );
  
  console.log(`Created ${settings.length} system settings`);

  // 4. Create sample coupons
  console.log('Creating sample coupons...');
  const coupons = [
    {
      code: 'SELAMATDATANG',
      type: 'percentage' as const,
      nameId: 'Selamat Datang',
      nameEn: 'Welcome Discount',
      discountValue: 10,
      minOrderAmount: 50000,
      maxUses: 1000,
      isPublic: true,
      createdBy: adminUser!.id,
    },
    {
      code: 'GRATISONGKIR',
      type: 'free_shipping' as const,
      nameId: 'Gratis Ongkir',
      nameEn: 'Free Shipping',
      minOrderAmount: 150000,
      maxUses: 500,
      isPublic: true,
      createdBy: adminUser!.id,
    },
  ];

  await db.insert(schema.coupons).values(coupons);
  console.log(`Created ${coupons.length} coupons`);

  // 5. Create sample products with all 11 menu items
  console.log('Creating products (all 11 menu items)...');

  // Dimsum Premium category
  const premiumCat = insertedCategories.find(c => c.slug === 'dimsum-premium')!;
  // Dimsum Klasik category
  const klasikCat = insertedCategories.find(c => c.slug === 'dimsum-klasik')!;
  // Dimsum Spesial category
  const spesialCat = insertedCategories.find(c => c.slug === 'dimsum-spesial')!;
  // Lumpia & Ekado category
  const lumpiaEkadoCat = insertedCategories.find(c => c.slug === 'lumpia-ekado')!;
  // Pangsit category
  const pangsitCat = insertedCategories.find(c => c.slug === 'pangsit')!;

  // Cloudinary URLs per ASSETS.md Section 3 mapping
  // Folder: dapurdekaka/products/
  const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'demo';
  const CLOUDINARY_PRODUCTS_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_webp,q_auto,w_800/dapurdekaka/products`;

  const products = [
    // 1. Dimsum Crabstick → Dimsum Klasik
    {
      categoryId: klasikCat.id,
      nameId: 'Dimsum Crabstick',
      nameEn: 'Dimsum Crabstick',
      slug: 'dimsum-crabstick',
      shortDescriptionId: 'Dimsum crabstick lezat dengan isian udang pilihan',
      shortDescriptionEn: 'Delicious crabstick dimsum with premium shrimp filling',
      weightGram: 500,
      isHalal: true,
      isActive: true,
      isFeatured: true,
      isB2bAvailable: true,
      sortOrder: 1,
      shopeeUrl: 'https://shopee.co.id/dapurdekaka',
    },
    // 2. Dimsum Jamur → Dimsum Klasik
    {
      categoryId: klasikCat.id,
      nameId: 'Dimsum Jamur',
      nameEn: 'Dimsum Mushroom',
      slug: 'dimsum-jamur',
      shortDescriptionId: 'Dimsum jamur dengan tekstur lembut dan rasa gurih',
      shortDescriptionEn: 'Soft texture mushroom dimsum with savory taste',
      weightGram: 400,
      isHalal: true,
      isActive: true,
      isFeatured: false,
      isB2bAvailable: true,
      sortOrder: 2,
      shopeeUrl: 'https://shopee.co.id/dapurdekaka',
    },
    // 3. Dimsum Mozarella → Dimsum Premium
    {
      categoryId: premiumCat.id,
      nameId: 'Dimsum Mozarella',
      nameEn: 'Dimsum Mozzarella',
      slug: 'dimsum-mozarella',
      shortDescriptionId: 'Dimsum dengan lelehan keju mozarella yang creamy',
      shortDescriptionEn: 'Dimsum with creamy melted mozzarella cheese',
      weightGram: 450,
      isHalal: true,
      isActive: true,
      isFeatured: true,
      isB2bAvailable: true,
      sortOrder: 3,
      shopeeUrl: 'https://shopee.co.id/dapurdekaka',
    },
    // 4. Dimsum Tuna → Dimsum Premium
    {
      categoryId: premiumCat.id,
      nameId: 'Dimsum Tuna',
      nameEn: 'Dimsum Tuna',
      slug: 'dimsum-tuna',
      shortDescriptionId: 'Dimsum tuna segar pilihan dengan bumbu spesial',
      shortDescriptionEn: 'Premium fresh tuna dimsum with special seasoning',
      weightGram: 420,
      isHalal: true,
      isActive: true,
      isFeatured: false,
      isB2bAvailable: true,
      sortOrder: 4,
      shopeeUrl: 'https://shopee.co.id/dapurdekaka',
    },
    // 5. Dimsum Golden → Dimsum Premium
    {
      categoryId: premiumCat.id,
      nameId: 'Dimsum Golden',
      nameEn: 'Dimsum Golden',
      slug: 'dimsum-golden',
      shortDescriptionId: 'Dimsum premium dengan tampilan emas yang elegan',
      shortDescriptionEn: 'Premium dimsum with elegant golden appearance',
      weightGram: 480,
      isHalal: true,
      isActive: true,
      isFeatured: true,
      isB2bAvailable: true,
      sortOrder: 5,
      shopeeUrl: 'https://shopee.co.id/dapurdekaka',
    },
    // 6. Dimsum Pedas → Dimsum Spesial
    {
      categoryId: spesialCat.id,
      nameId: 'Dimsum Pedas',
      nameEn: 'Spicy Dimsum',
      slug: 'dimsum-pedas',
      shortDescriptionId: 'Dimsum dengan level pedas menggugah selera',
      shortDescriptionEn: 'Spicy dimsum that excites your taste buds',
      weightGram: 430,
      isHalal: true,
      isActive: true,
      isFeatured: false,
      isB2bAvailable: true,
      sortOrder: 6,
      shopeeUrl: 'https://shopee.co.id/dapurdekaka',
    },
    // 7. Lumpia (Kulit Tahu) → Lumpia & Ekado
    {
      categoryId: lumpiaEkadoCat.id,
      nameId: 'Lumpia (Kulit Tahu)',
      nameEn: 'Lumpia (Tofu Skin)',
      slug: 'lumpia-kulit-tahu',
      shortDescriptionId: 'Lumpia dengan kulit tahu tipis, renyah di luar',
      shortDescriptionEn: 'Crispy lumpia wrapped in thin tofu skin',
      weightGram: 400,
      isHalal: true,
      isActive: true,
      isFeatured: true,
      isB2bAvailable: true,
      sortOrder: 7,
      shopeeUrl: 'https://shopee.co.id/dapurdekaka',
    },
    // 8. Dimsum Nori → Dimsum Klasik
    {
      categoryId: klasikCat.id,
      nameId: 'Dimsum Nori',
      nameEn: 'Dimsum Nori',
      slug: 'dimsum-nori',
      shortDescriptionId: 'Dimsum dengan lapisan nori海苔 yang umami',
      shortDescriptionEn: 'Dimsum topped with umami nori seaweed',
      weightGram: 450,
      isHalal: true,
      isActive: true,
      isFeatured: false,
      isB2bAvailable: true,
      sortOrder: 8,
      shopeeUrl: 'https://shopee.co.id/dapurdekaka',
    },
    // 9. Dimsum Rambutan → Dimsum Spesial
    {
      categoryId: spesialCat.id,
      nameId: 'Dimsum Rambutan',
      nameEn: 'Dimsum Rambutan',
      slug: 'dimsum-rambutan',
      shortDescriptionId: 'Dimsum bulat dengan tekstur rambutan yang unik',
      shortDescriptionEn: 'Unique round dimsum with rambutan texture',
      weightGram: 480,
      isHalal: true,
      isActive: true,
      isFeatured: false,
      isB2bAvailable: true,
      sortOrder: 9,
      shopeeUrl: 'https://shopee.co.id/dapurdekaka',
    },
    // 10. Ekado → Lumpia & Ekado
    {
      categoryId: lumpiaEkadoCat.id,
      nameId: 'Ekado',
      nameEn: 'Ekado',
      slug: 'ekado',
      shortDescriptionId: 'Ekado renyah dengan isian sayuran dan udang',
      shortDescriptionEn: 'Crispy ekado with vegetables and shrimp filling',
      weightGram: 400,
      isHalal: true,
      isActive: true,
      isFeatured: false,
      isB2bAvailable: true,
      sortOrder: 10,
      shopeeUrl: 'https://shopee.co.id/dapurdekaka',
    },
    // 11. Pangsit Ayam → Pangsit
    {
      categoryId: pangsitCat.id,
      nameId: 'Pangsit Ayam',
      nameEn: 'Chicken Pangsit',
      slug: 'pangsit-ayam',
      shortDescriptionId: 'Pangsit ayam dengan kulit tipis dan isian meresap',
      shortDescriptionEn: 'Thin-skinned pangsit with flavorful chicken filling',
      weightGram: 350,
      isHalal: true,
      isActive: true,
      isFeatured: true,
      isB2bAvailable: true,
      sortOrder: 11,
      shopeeUrl: 'https://shopee.co.id/dapurdekaka',
    },
  ];

  const insertedProducts = await db.insert(schema.products).values(products).returning();
  console.log(`Created ${insertedProducts.length} products`);

  // 6. Create variants for each product (25 pcs + 50 pcs)
  console.log('Creating product variants...');

  // Base prices per product type (in IDR, integer)
  // Following PRD: website prices 15-20% below Shopee
  const productBasePrices: Record<string, number> = {
    'dimsum-crabstick': 65000,
    'dimsum-jamur': 55000,
    'dimsum-mozarella': 68000,
    'dimsum-tuna': 70000,
    'dimsum-golden': 85000,
    'dimsum-pedas': 62000,
    'lumpia-kulit-tahu': 58000,
    'dimsum-nori': 72000,
    'dimsum-rambutan': 75000,
    'ekado': 60000,
    'pangsit-ayam': 52000,
  };

  const insertedVariants = [];
  for (const product of insertedProducts) {
    const basePrice = productBasePrices[product.slug] || 65000;
    const variants = [
      {
        nameId: '25 pcs',
        nameEn: '25 pcs',
        price: basePrice,
        b2bPrice: Math.floor(basePrice * 0.85),
        stock: 50,
        weightGram: product.weightGram,
        sku: `DDK-${product.slug.toUpperCase().slice(0, 6)}-25`,
        sortOrder: 1,
      },
      {
        nameId: '50 pcs',
        nameEn: '50 pcs',
        price: basePrice * 2,
        b2bPrice: Math.floor(basePrice * 2 * 0.85),
        stock: 30,
        weightGram: product.weightGram * 2,
        sku: `DDK-${product.slug.toUpperCase().slice(0, 6)}-50`,
        sortOrder: 2,
      },
    ];

    const inserted = await db.insert(schema.productVariants).values(
      variants.map(v => ({
        ...v,
        productId: product.id,
        isActive: true,
      }))
    ).returning();
    insertedVariants.push(...inserted);
  }
  console.log(`Created ${insertedVariants.length} variants for ${insertedProducts.length} products`);

  // 7. Create product images for each product (Cloudinary URLs per ASSETS.md)
  console.log('Creating product images...');

  // Cloudinary public IDs per ASSETS.md Section 3
  const productImageMap: Record<string, { cloudinaryPublicId: string; altTextId: string; altTextEn: string }> = {
    'dimsum-crabstick': { cloudinaryPublicId: 'dapurdekaka/products/dimsum-crabstick', altTextId: 'Dimsum Crabstick 25 pcs', altTextEn: 'Dimsum Crabstick 25 pcs' },
    'dimsum-jamur': { cloudinaryPublicId: 'dapurdekaka/products/dimsum-jamur', altTextId: 'Dimsum Jamur 25 pcs', altTextEn: 'Dimsum Mushroom 25 pcs' },
    'dimsum-mozarella': { cloudinaryPublicId: 'dapurdekaka/products/dimsum-mozarella', altTextId: 'Dimsum Mozarella 25 pcs', altTextEn: 'Dimsum Mozzarella 25 pcs' },
    'dimsum-tuna': { cloudinaryPublicId: 'dapurdekaka/products/dimsum-tuna', altTextId: 'Dimsum Tuna 25 pcs', altTextEn: 'Dimsum Tuna 25 pcs' },
    'dimsum-golden': { cloudinaryPublicId: 'dapurdekaka/products/dimsum-golden', altTextId: 'Dimsum Golden 25 pcs', altTextEn: 'Dimsum Golden 25 pcs' },
    'dimsum-pedas': { cloudinaryPublicId: 'dapurdekaka/products/dimsum-pedas', altTextId: 'Dimsum Pedas 25 pcs', altTextEn: 'Spicy Dimsum 25 pcs' },
    'lumpia-kulit-tahu': { cloudinaryPublicId: 'dapurdekaka/products/lumpia-kulit-tahu', altTextId: 'Lumpia Kulit Tahu', altTextEn: 'Lumpia Tofu Skin' },
    'dimsum-nori': { cloudinaryPublicId: 'dapurdekaka/products/dimsum-nori', altTextId: 'Dimsum Nori 25 pcs', altTextEn: 'Dimsum Nori 25 pcs' },
    'dimsum-rambutan': { cloudinaryPublicId: 'dapurdekaka/products/dimsum-rambutan', altTextId: 'Dimsum Rambutan 25 pcs', altTextEn: 'Dimsum Rambutan 25 pcs' },
    'ekado': { cloudinaryPublicId: 'dapurdekaka/products/ekado', altTextId: 'Ekado', altTextEn: 'Ekado' },
    'pangsit-ayam': { cloudinaryPublicId: 'dapurdekaka/products/pangsit-ayam', altTextId: 'Pangsit Ayam 25 pcs', altTextEn: 'Chicken Pangsit 25 pcs' },
  };

  type ProductImageInsert = {
  productId: string;
  cloudinaryUrl: string;
  cloudinaryPublicId: string;
  altTextId: string;
  altTextEn: string;
  sortOrder: number;
};

const productImages = insertedProducts.map((product, index): ProductImageInsert | null => {
    const imgData = productImageMap[product.slug];
    if (!imgData) {
      console.warn(`No image mapping found for product: ${product.slug}`);
      return null;
    }
    return {
      productId: product.id,
      cloudinaryUrl: `${CLOUDINARY_PRODUCTS_BASE}/${imgData.cloudinaryPublicId}`,
      cloudinaryPublicId: imgData.cloudinaryPublicId,
      altTextId: imgData.altTextId,
      altTextEn: imgData.altTextEn,
      sortOrder: index + 1,
    };
  }).filter((img): img is ProductImageInsert => img !== null);

  await db.insert(schema.productImages).values(productImages);
  console.log(`Created ${productImages.length} product images`);

  // 8. Create carousel slides
  console.log('Creating carousel slides...');
  const slides = [
    {
      type: 'product_hero' as const,
      titleId: 'Dimsum Segar Langsung dari Dapur',
      titleEn: 'Fresh Dimsum Straight from the Kitchen',
      subtitleId: 'Dikirim ke Seluruh Indonesia',
      subtitleEn: 'Shipped All Across Indonesia',
      imageUrl: '/assets/gallery/1.jpg',
      imagePublicId: 'slides/hero-1',
      ctaLabelId: 'Pesan Sekarang',
      ctaLabelEn: 'Order Now',
      ctaUrl: '/products',
      sortOrder: 1,
      isActive: true,
    },
    {
      type: 'promo' as const,
      titleId: 'PROMO 10% OFF',
      titleEn: '10% OFF PROMO',
      subtitleId: 'Untuk pembelian pertama kamu',
      subtitleEn: 'For your first purchase',
      imageUrl: '/assets/gallery/2.jpg',
      imagePublicId: 'slides/promo-1',
      badgeText: 'SELAMATDATANG',
      ctaLabelId: 'Klaim Sekarang',
      ctaLabelEn: 'Claim Now',
      ctaUrl: '/products',
      sortOrder: 2,
      isActive: true,
    },
    {
      type: 'brand_story' as const,
      titleId: '德卡',
      titleEn: 'Dapur Dekaka',
      subtitleId: 'Warisan rasa yang tak tergantikan',
      subtitleEn: 'A taste heritage that cannot be replaced',
      imageUrl: '/assets/gallery/3.jpg',
      imagePublicId: 'slides/brand-1',
      sortOrder: 3,
      isActive: true,
    },
  ];

  await db.insert(schema.carouselSlides).values(slides);
  console.log(`Created ${slides.length} carousel slides`);

  console.log('Seed completed successfully!');
}

seed().catch(console.error);