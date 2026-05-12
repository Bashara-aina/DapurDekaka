import 'dotenv/config';
import { getPoolExporter } from '../lib/db/index';
import * as schema from '../lib/db/schema';
import { drizzle } from 'drizzle-orm/node-postgres';
import { eq } from 'drizzle-orm';

const pool = getPoolExporter();
const db = drizzle(pool, { schema });

// Cloudinary base URL helper
const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'demo';
const CLOUDINARY_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_webp,q_auto,w_800`;

// ─────────────────────────────────────────
// PRODUCT CATALOG — from Shopee data
// ─────────────────────────────────────────

interface ProductInput {
  row: number;
  rawName: string;
  slug: string;
  nameId: string;
  nameEn: string;
  shortDescriptionId: string;
  shortDescriptionEn: string;
  categorySlug: string;
  sku: string;
  price: number;
  stock: number;
  weightGram: number;
  isPreOrder: boolean;
  isHalal: boolean;
  cloudinaryPublicId: string;
  altTextId: string;
  altTextEn: string;
  variant25: {
    nameId: string;
    nameEn: string;
    sku: string;
    price: number;
    weightGram: number;
  } | null;
}

const CATALOG: ProductInput[] = [
  { row: 1, rawName: 'Dimsum Mix (Siomay) Frozen 50 pcs', slug: 'dimsum-mix-siomay', nameId: 'Dimsum Mix (Siomay)', nameEn: 'Dimsum Mix (Siomay)', shortDescriptionId: 'Mix siomay frozen 50 pcs, halal dan segar', shortDescriptionEn: 'Mix siomay frozen 50 pcs, halal and fresh', categorySlug: 'dimsum-klasik', sku: 'DDK-DIMS-MIX-50', price: 78000, stock: 100, weightGram: 600, isPreOrder: false, isHalal: true, cloudinaryPublicId: 'dapurdekaka/products/dimsum-crabstick', altTextId: 'Dimsum Mix Siomay 50 pcs', altTextEn: 'Dimsum Mix Siomay 50 pcs', variant25: { nameId: '25 pcs', nameEn: '25 pcs', sku: 'DDK-DIMS-MIX-25', price: 42000, weightGram: 300 } },
  { row: 2, rawName: 'Dimsum Rambutan Frozen 50 pcs', slug: 'dimsum-rambutan', nameId: 'Dimsum Rambutan', nameEn: 'Dimsum Rambutan', shortDescriptionId: 'Dimsum rambutan frozen 50 pcs, halal dan segar', shortDescriptionEn: 'Dimsum rambutan frozen 50 pcs, halal and fresh', categorySlug: 'dimsum-spesial', sku: 'DDK-RAMB-50', price: 143000, stock: 50, weightGram: 600, isPreOrder: false, isHalal: true, cloudinaryPublicId: 'dapurdekaka/products/dimsum-rambutan', altTextId: 'Dimsum Rambutan 50 pcs', altTextEn: 'Dimsum Rambutan 50 pcs', variant25: { nameId: '25 pcs', nameEn: '25 pcs', sku: 'DDK-RAMB-25', price: 75000, weightGram: 300 } },
  { row: 3, rawName: '[Pre-order] Dimsum Full Wortel Frozen', slug: 'dimsum-full-wortel', nameId: 'Dimsum Full Wortel', nameEn: 'Dimsum Full Carrot', shortDescriptionId: 'Dimsum full wortel frozen, pre-order', shortDescriptionEn: 'Dimsum full carrot frozen, pre-order', categorySlug: 'dimsum-klasik', sku: 'DDK-WORT-50', price: 138000, stock: 0, weightGram: 600, isPreOrder: true, isHalal: true, cloudinaryPublicId: 'dapurdekaka/products/dimsum-jamur', altTextId: 'Dimsum Full Wortel', altTextEn: 'Dimsum Full Carrot', variant25: null },
  { row: 4, rawName: 'Lumpia (Kulit Tahu) Frozen 50 pcs', slug: 'lumpia-kulit-tahu', nameId: 'Lumpia (Kulit Tahu)', nameEn: 'Lumpia (Tofu Skin)', shortDescriptionId: 'Lumpia dengan kulit tahu tipis, renyah di luar', shortDescriptionEn: 'Crispy lumpia wrapped in thin tofu skin', categorySlug: 'lumpia-ekado', sku: 'DDK-LUMP-50', price: 83000, stock: 80, weightGram: 500, isPreOrder: false, isHalal: true, cloudinaryPublicId: 'dapurdekaka/products/lumpia-kulit-tahu', altTextId: 'Lumpia Kulit Tahu 50 pcs', altTextEn: 'Lumpia Tofu Skin 50 pcs', variant25: { nameId: '25 pcs', nameEn: '25 pcs', sku: 'DDK-LUMP-25', price: 45000, weightGram: 250 } },
  { row: 5, rawName: 'Dimsum Goreng Keju Lumer', slug: 'dimsum-goreng-keju', nameId: 'Dimsum Goreng Keju Lumer', nameEn: 'Fried Cheese Dimsum', shortDescriptionId: 'Dimsum goreng dengan keju lumer yang creamy', shortDescriptionEn: 'Fried dimsum with creamy melted cheese', categorySlug: 'dimsum-premium', sku: 'DDK-GOR-KEJ-50', price: 39795, stock: 60, weightGram: 400, isPreOrder: false, isHalal: true, cloudinaryPublicId: 'dapurdekaka/products/dimsum-mozarella', altTextId: 'Dimsum Goreng Keju Lumer', altTextEn: 'Fried Cheese Dimsum', variant25: { nameId: '25 pcs', nameEn: '25 pcs', sku: 'DDK-GOR-KEJ-25', price: 22000, weightGram: 200 } },
  { row: 6, rawName: 'Dimsum Mozza (Siomay) Frozen 50 pcs', slug: 'dimsum-mozarella', nameId: 'Dimsum Mozarella', nameEn: 'Dimsum Mozzarella', shortDescriptionId: 'Dimsum dengan lelehan keju mozarella yang creamy', shortDescriptionEn: 'Dimsum with creamy melted mozzarella cheese', categorySlug: 'dimsum-premium', sku: 'DDK-MOZZ-50', price: 85000, stock: 75, weightGram: 550, isPreOrder: false, isHalal: true, cloudinaryPublicId: 'dapurdekaka/products/dimsum-mozarella', altTextId: 'Dimsum Mozarella 50 pcs', altTextEn: 'Dimsum Mozzarella 50 pcs', variant25: { nameId: '25 pcs', nameEn: '25 pcs', sku: 'DDK-MOZZ-25', price: 45000, weightGram: 275 } },
  { row: 7, rawName: 'Dimsum Nori (Siomay) Frozen 50 pcs', slug: 'dimsum-nori', nameId: 'Dimsum Nori', nameEn: 'Dimsum Nori', shortDescriptionId: 'Dimsum dengan lapisan nori yang umami', shortDescriptionEn: 'Dimsum topped with umami nori seaweed', categorySlug: 'dimsum-klasik', sku: 'DDK-NORI-50', price: 80000, stock: 65, weightGram: 550, isPreOrder: false, isHalal: true, cloudinaryPublicId: 'dapurdekaka/products/dimsum-nori', altTextId: 'Dimsum Nori 50 pcs', altTextEn: 'Dimsum Nori 50 pcs', variant25: { nameId: '25 pcs', nameEn: '25 pcs', sku: 'DDK-NORI-25', price: 42000, weightGram: 275 } },
  { row: 8, rawName: 'Dimsum PANGSIT Frozen 50 pcs', slug: 'pangsit-ayam', nameId: 'Pangsit Ayam', nameEn: 'Chicken Pangsit', shortDescriptionId: 'Pangsit ayam dengan kulit tipis dan isian meresap', shortDescriptionEn: 'Thin-skinned pangsit with flavorful chicken filling', categorySlug: 'pangsit', sku: 'DDK-PANG-50', price: 77000, stock: 90, weightGram: 450, isPreOrder: false, isHalal: true, cloudinaryPublicId: 'dapurdekaka/products/pangsit-ayam', altTextId: 'Pangsit Ayam 50 pcs', altTextEn: 'Chicken Pangsit 50 pcs', variant25: { nameId: '25 pcs', nameEn: '25 pcs', sku: 'DDK-PANG-25', price: 40000, weightGram: 225 } },
  { row: 9, rawName: 'Dimsum Pedas (Siomay) Frozen 50 pcs', slug: 'dimsum-pedas', nameId: 'Dimsum Pedas', nameEn: 'Spicy Dimsum', shortDescriptionId: 'Dimsum dengan level pedas menggugah selera', shortDescriptionEn: 'Spicy dimsum that excites your taste buds', categorySlug: 'dimsum-spesial', sku: 'DDK-PEDA-50', price: 78000, stock: 70, weightGram: 530, isPreOrder: false, isHalal: true, cloudinaryPublicId: 'dapurdekaka/products/dimsum-pedas', altTextId: 'Dimsum Pedas 50 pcs', altTextEn: 'Spicy Dimsum 50 pcs', variant25: { nameId: '25 pcs', nameEn: '25 pcs', sku: 'DDK-PEDA-25', price: 42000, weightGram: 265 } },
  { row: 10, rawName: 'Ekado', slug: 'ekado', nameId: 'Ekado', nameEn: 'Ekado', shortDescriptionId: 'Ekado renyah dengan isian sayuran dan udang', shortDescriptionEn: 'Crispy ekado with vegetables and shrimp filling', categorySlug: 'lumpia-ekado', sku: 'DDK-EKAD-50', price: 90000, stock: 55, weightGram: 500, isPreOrder: false, isHalal: true, cloudinaryPublicId: 'dapurdekaka/products/ekado', altTextId: 'Ekado', altTextEn: 'Ekado', variant25: { nameId: '25 pcs', nameEn: '25 pcs', sku: 'DDK-EKAD-25', price: 48000, weightGram: 250 } },
  { row: 11, rawName: 'Chili Oil Dapur Dekaka 100/250 Ml', slug: 'chili-oil', nameId: 'Chili Oil', nameEn: 'Chili Oil', shortDescriptionId: 'Chili oil pelengkap dimsum, 100/250 ml', shortDescriptionEn: 'Chili oil for dimsum, 100/250 ml', categorySlug: 'sauce', sku: 'DDK-CHOI-100', price: 40000, stock: 200, weightGram: 150, isPreOrder: false, isHalal: true, cloudinaryPublicId: 'dapurdekaka/sauces/chilli-oil', altTextId: 'Chili Oil Dapur Dekaka', altTextEn: 'Dapur Dekaka Chili Oil', variant25: null },
  { row: 12, rawName: 'Saos Mentai Mayo, Mayo Keju, dan Saos Tartar Dapur Dekaka', slug: 'saos-mentai-mayo', nameId: 'Saos Mentai Mayo', nameEn: 'Mentai Mayo Sauce', shortDescriptionId: 'Saos mentai mayo, mayo keju, dan saos tartar Dapur Dekaka', shortDescriptionEn: 'Mentai mayo, cheese mayo, and tartar sauce by Dapur Dekaka', categorySlug: 'sauce', sku: 'DDK-MENT-100', price: 25115, stock: 150, weightGram: 120, isPreOrder: false, isHalal: true, cloudinaryPublicId: 'dapurdekaka/sauces/saos-mentai-mayo', altTextId: 'Saos Mentai Mayo Dapur Dekaka', altTextEn: 'Mentai Mayo Sauce Dapur Dekaka', variant25: null },
  { row: 13, rawName: 'Dimsum Campur 3 Varian Isi 15 Pcs by Dapur Dekaka', slug: 'dimsum-campur', nameId: 'Dimsum Campur 3 Varian', nameEn: 'Mixed Dimsum 3 Variants', shortDescriptionId: 'Dimsum campur dengan 3 varian isian, isi 15 pcs', shortDescriptionEn: 'Mixed dimsum with 3 filling variants, 15 pcs', categorySlug: 'dimsum-klasik', sku: 'DDK-CAMP-15', price: 75000, stock: 40, weightGram: 300, isPreOrder: false, isHalal: true, cloudinaryPublicId: 'dapurdekaka/products/dimsum-crabstick', altTextId: 'Dimsum Campur 3 Varian', altTextEn: 'Mixed Dimsum 3 Variants', variant25: null },
  { row: 14, rawName: '[Pre-order] Dimsum Full Crabstick FROZEN', slug: 'dimsum-full-crabstick', nameId: 'Dimsum Full Crabstick', nameEn: 'Dimsum Full Crabstick', shortDescriptionId: 'Dimsum full crabstick frozen, pre-order', shortDescriptionEn: 'Dimsum full crabstick frozen, pre-order', categorySlug: 'dimsum-klasik', sku: 'DDK-CRAB-50', price: 75000, stock: 0, weightGram: 500, isPreOrder: true, isHalal: true, cloudinaryPublicId: 'dapurdekaka/products/dimsum-crabstick', altTextId: 'Dimsum Full Crabstick', altTextEn: 'Dimsum Full Crabstick', variant25: null },
  { row: 15, rawName: '(FROZEN) Dimsum Adek Ukuran Mini 70 Pcs By Dapur Dekaka', slug: 'dimsum-adek-mini', nameId: 'Dimsum Adek Ukuran Mini', nameEn: 'Little Sister Mini Dimsum', shortDescriptionId: 'Dimsum adek ukuran mini 70 pcs, frozen', shortDescriptionEn: 'Little sister mini dimsum 70 pcs, frozen', categorySlug: 'dimsum-klasik', sku: 'DDK-ADEX-70', price: 150000, stock: 0, weightGram: 700, isPreOrder: false, isHalal: true, cloudinaryPublicId: 'dapurdekaka/products/dimsum-jamur', altTextId: 'Dimsum Adek Ukuran Mini 70 Pcs', altTextEn: 'Little Sister Mini Dimsum 70 Pcs', variant25: null },
  { row: 16, rawName: '[Pre-order] Dimsum Full Jamur Frozen', slug: 'dimsum-full-jamur', nameId: 'Dimsum Full Jamur', nameEn: 'Dimsum Full Mushroom', shortDescriptionId: 'Dimsum full jamur frozen, pre-order', shortDescriptionEn: 'Dimsum full mushroom frozen, pre-order', categorySlug: 'dimsum-klasik', sku: 'DDK-JAMU-50', price: 75000, stock: 0, weightGram: 500, isPreOrder: true, isHalal: true, cloudinaryPublicId: 'dapurdekaka/products/dimsum-jamur', altTextId: 'Dimsum Full Jamur', altTextEn: 'Dimsum Full Mushroom', variant25: null },
  { row: 17, rawName: '[LUAR KOTA] DIMSUM MIX DAPUR DEKAKA 50 PCS', slug: 'dimsum-mix-luar-kota', nameId: 'Dimsum Mix (Luar Kota)', nameEn: 'Dimsum Mix (Outside City)', shortDescriptionId: 'Dimsum mix untuk luar kota, 50 pcs, frozen', shortDescriptionEn: 'Dimsum mix for outside city delivery, 50 pcs, frozen', categorySlug: 'dimsum-klasik', sku: 'DDK-LUAR-50', price: 130000, stock: 0, weightGram: 700, isPreOrder: false, isHalal: true, cloudinaryPublicId: 'dapurdekaka/products/dimsum-crabstick', altTextId: 'Dimsum Mix Luar Kota 50 pcs', altTextEn: 'Dimsum Mix Outside City 50 pcs', variant25: null },
  { row: 18, rawName: '[Pre-order] Dimsum Full Tuna Frozen', slug: 'dimsum-full-tuna', nameId: 'Dimsum Full Tuna', nameEn: 'Dimsum Full Tuna', shortDescriptionId: 'Dimsum full tuna frozen, pre-order', shortDescriptionEn: 'Dimsum full tuna frozen, pre-order', categorySlug: 'dimsum-premium', sku: 'DDK-TUNA-50', price: 75000, stock: 0, weightGram: 520, isPreOrder: true, isHalal: true, cloudinaryPublicId: 'dapurdekaka/products/dimsum-tuna', altTextId: 'Dimsum Full Tuna', altTextEn: 'Dimsum Full Tuna', variant25: null },
  { row: 19, rawName: '[Pre-order] Dimsum Smoked Beef Frozen', slug: 'dimsum-smoked-beef', nameId: 'Dimsum Smoked Beef', nameEn: 'Dimsum Smoked Beef', shortDescriptionId: 'Dimsum smoked beef frozen, pre-order', shortDescriptionEn: 'Dimsum smoked beef frozen, pre-order', categorySlug: 'dimsum-spesial', sku: 'DDK-SMOK-50', price: 75000, stock: 0, weightGram: 500, isPreOrder: true, isHalal: true, cloudinaryPublicId: 'dapurdekaka/products/dimsum-pedas', altTextId: 'Dimsum Smoked Beef', altTextEn: 'Dimsum Smoked Beef', variant25: null },
];

// ─────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────

function formatPrice(price: number): string {
  return `Rp ${price.toLocaleString('id-ID')}`;
}

async function getCategoryIdBySlug(slug: string): Promise<string | null> {
  const [cat] = await db.select({ id: schema.categories.id }).from(schema.categories).where(eq(schema.categories.slug, slug)).limit(1);
  return cat?.id ?? null;
}

async function getProductBySlug(slug: string) {
  const [p] = await db.select().from(schema.products).where(eq(schema.products.slug, slug)).limit(1);
  return p ?? null;
}

async function getVariantBySku(sku: string) {
  const [v] = await db.select().from(schema.productVariants).where(eq(schema.productVariants.sku, sku)).limit(1);
  return v ?? null;
}

async function upsertProductVariant(productId: string, variant: ProductInput['variant25'] & { nameId: string; nameEn: string; sku: string; price: number; weightGram: number }, sortOrder: number) {
  const existing = await getVariantBySku(variant.sku);
  if (existing) {
    await db.update(schema.productVariants).set({ price: variant.price, stock: variant.price === 0 ? 0 : (existing.stock === 0 ? 50 : existing.stock), weightGram: variant.weightGram, nameId: variant.nameId, nameEn: variant.nameEn, isActive: true }).where(eq(schema.productVariants.id, existing.id));
    console.log(`  → Updated variant ${variant.sku} (stock: ${existing.stock} → ${variant.price === 0 ? 0 : (existing.stock === 0 ? 50 : existing.stock)})`);
    return existing.id;
  } else {
    const [inserted] = await db.insert(schema.productVariants).values({ productId, nameId: variant.nameId, nameEn: variant.nameEn, sku: variant.sku, price: variant.price, b2bPrice: Math.floor(variant.price * 0.85), stock: variant.price === 0 ? 0 : 50, weightGram: variant.weightGram, sortOrder, isActive: true }).returning();
    console.log(`  → Created variant ${variant.sku} @ ${formatPrice(variant.price)}`);
    return inserted!.id;
  }
}

async function upsertProductImage(productId: string, item: ProductInput, sortOrder: number) {
  const [existingImg] = await db.select().from(schema.productImages).where(eq(schema.productImages.productId, productId)).limit(1);
  const cloudinaryUrl = `${CLOUDINARY_BASE}/${item.cloudinaryPublicId}`;
  if (existingImg) {
    await db.update(schema.productImages).set({ cloudinaryUrl, cloudinaryPublicId: item.cloudinaryPublicId, altTextId: item.altTextId, altTextEn: item.altTextEn }).where(eq(schema.productImages.id, existingImg.id));
    console.log(`  → Updated image for ${item.slug}`);
  } else {
    await db.insert(schema.productImages).values({ productId, cloudinaryUrl, cloudinaryPublicId: item.cloudinaryPublicId, altTextId: item.altTextId, altTextEn: item.altTextEn, sortOrder });
    console.log(`  → Created image for ${item.slug}`);
  }
}

// ─────────────────────────────────────────
// MAIN SEED
// ─────────────────────────────────────────

async function seedProducts() {
  console.log('Starting products seed (Supabase via pg)...\n');
  let createdProducts = 0;
  let updatedProducts = 0;

  for (const item of CATALOG) {
    console.log(`\n[Row ${item.row}] ${item.nameId} (${item.slug})`);
    console.log(`  Price: ${formatPrice(item.price)} | Stock: ${item.stock === 0 ? 'SOLD OUT' : item.stock + ' pcs'} | Pre-order: ${item.isPreOrder ? 'YES' : 'no'}`);

    const categoryId = await getCategoryIdBySlug(item.categorySlug);
    if (!categoryId) {
      console.log(`  ⚠️  Category '${item.categorySlug}' not found — skipping.`);
      continue;
    }

    const existingProduct = await getProductBySlug(item.slug);

    if (existingProduct) {
      await db.update(schema.products).set({ nameId: item.nameId, nameEn: item.nameEn, shortDescriptionId: item.shortDescriptionId, shortDescriptionEn: item.shortDescriptionEn, weightGram: item.weightGram, isActive: true, isPreOrder: item.isPreOrder }).where(eq(schema.products.id, existingProduct.id));
      console.log(`  → Updated product '${item.slug}'`);
      updatedProducts++;

      const primaryVariant = { nameId: '50 pcs', nameEn: '50 pcs', sku: item.sku, price: item.price, weightGram: item.weightGram };
      await upsertProductVariant(existingProduct.id, primaryVariant, 1);
      if (item.variant25) await upsertProductVariant(existingProduct.id, item.variant25, 0);
      await upsertProductImage(existingProduct.id, item, 1);
    } else {
      const [newProduct] = await db.insert(schema.products).values({ categoryId, nameId: item.nameId, nameEn: item.nameEn, slug: item.slug, shortDescriptionId: item.shortDescriptionId, shortDescriptionEn: item.shortDescriptionEn, weightGram: item.weightGram, isHalal: item.isHalal, isActive: true, isFeatured: false, isB2bAvailable: true, sortOrder: item.row, shopeeUrl: 'https://shopee.co.id/dapurdekaka' }).returning();
      console.log(`  → Created product '${item.slug}'`);
      createdProducts++;

      const primaryVariant = { nameId: '50 pcs', nameEn: '50 pcs', sku: item.sku, price: item.price, weightGram: item.weightGram };
      await upsertProductVariant(newProduct!.id, primaryVariant, 1);
      if (item.variant25) await upsertProductVariant(newProduct!.id, item.variant25, 0);
      await upsertProductImage(newProduct!.id, item, 1);
    }
  }

  console.log(`\n\n✅ Products seed complete!`);
  console.log(`   Created: ${createdProducts} products`);
  console.log(`   Updated: ${updatedProducts} products`);
  console.log(`   Total items in catalog: ${CATALOG.length}`);

  await pool.end();
}

seedProducts().catch(async (err) => {
  console.error('Seed failed:', err);
  await pool.end();
  process.exit(1);
});