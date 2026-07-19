import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { products, productVariants, productImages } from '@/lib/db/schema';
import { eq, and, ne, isNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { headers } from 'next/headers';
import { ProductDetailClient } from '@/components/store/products/ProductDetailClient';

export const revalidate = 60;

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const headersList = await headers();
  const acceptLanguage = headersList.get('accept-language') || 'id';
  const isIndonesian = acceptLanguage.startsWith('id');

  const product = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.isActive, true), isNull(products.deletedAt)),
    with: {
      category: true,
      images: { limit: 1 },
    },
  }) as ({
    nameId: string;
    nameEn: string;
    slug: string;
    category: { id: string; nameId: string; nameEn: string; slug: string } | null;
    metaTitleId: string | null;
    metaTitleEn: string | null;
    metaDescriptionId: string | null;
    metaDescriptionEn: string | null;
    shortDescriptionId: string | null;
    shortDescriptionEn: string | null;
    images: Array<{ id: string; cloudinaryUrl: string }>;
  } | null);

  if (!product) {
    return {
      title: isIndonesian ? 'Produk Tidak Ditemukan - Dapur Dekaka' : 'Product Not Found - Dapur Dekaka',
    };
  }

  const description = isIndonesian
    ? (product.metaDescriptionId || product.shortDescriptionId)
    : (product.metaDescriptionEn || product.shortDescriptionEn);

  const title = isIndonesian
    ? (product.metaTitleId || `${product.nameId} - Dapur Dekaka`)
    : (product.metaTitleEn || `${product.nameEn} - Dapur Dekaka`);

  return {
    title,
    description: description ?? undefined,
    keywords: [
      product.nameId,
      product.nameEn,
      product.category?.nameId,
      'frozen food',
      'halal',
      'dapur dekaka',
    ].filter(Boolean) as string[],
    alternates: {
      canonical: `https://dapurdekaka.com/products/${slug}`,
    },
    openGraph: {
      title: title,
      description: description ?? undefined,
      url: `https://dapurdekaka.com/products/${slug}`,
      type: 'website',
      images: product.images[0] ? [
        {
          url: product.images[0].cloudinaryUrl,
          width: 800,
          height: 600,
          alt: product.nameId,
        },
      ] : [],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description: description ?? undefined,
      images: product.images[0] ? [product.images[0].cloudinaryUrl] : [],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export async function generateStaticParams() {
  // If DB is unavailable during build, return empty array.
  // The dynamic = 'force-static' ensures the page is still accessible
  // and will fetch data at request time rather than being pre-rendered.
  try {
    const activeProducts = await db.query.products.findMany({
      where: and(eq(products.isActive, true), isNull(products.deletedAt)),
      columns: { slug: true },
    });
    return activeProducts.map((p) => ({ slug: p.slug }));
  } catch {
    // Log but don't fail — page will be rendered dynamically at runtime
    console.error('[ProductDetail] generateStaticParams failed, falling back to dynamic rendering');
    return [];
  }
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;

  const product = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.isActive, true), isNull(products.deletedAt)),
    with: {
      variants: { where: eq(productVariants.isActive, true) },
      images: { orderBy: (images, { asc }) => [asc(images.sortOrder)] },
      category: true,
    },
  }) as {
    id: string;
    nameId: string;
    nameEn: string;
    slug: string;
    descriptionId: string | null;
    shortDescriptionId: string | null;
    isHalal: boolean;
    isActive: boolean;
    category: { id: string; nameId: string; slug: string } | null;
    variants: Array<{ id: string; nameId: string; nameEn: string; sku: string; price: number; stock: number; weightGram: number; isActive: boolean; sortOrder: number }>;
    images: Array<{ id: string; cloudinaryUrl: string; sortOrder: number }>;
  } | null;

  if (!product) {
    notFound();
  }

  const selectedVariant = product.variants.find(v => v.isActive) ?? product.variants[0];
  const primaryImage = product.images[0];

  // Fetch related products from same category (excluding current product)
  let relatedProducts: Array<{
    id: string;
    nameId: string;
    nameEn: string;
    slug: string;
    isHalal: boolean;
    category: { id: string; nameId: string; slug: string } | null;
    variants: Array<{ id: string; nameId: string; nameEn: string; price: number; stock: number; isActive: boolean; sortOrder: number; sku: string; weightGram: number }>;
    images: Array<{ id: string; cloudinaryUrl: string; sortOrder: number }>;
  }> = [];

  if (product.category) {
    relatedProducts = await db.query.products.findMany({
      where: and(
        eq(products.categoryId, product.category.id),
        eq(products.isActive, true),
        ne(products.slug, slug),
        isNull(products.deletedAt)
      ),
      with: {
        variants: { where: eq(productVariants.isActive, true) },
        images: { orderBy: (images, { asc }) => [asc(images.sortOrder)] },
        category: true,
      },
      limit: 8,
    }) as typeof relatedProducts;
  }

  // Build enhanced product JSON-LD
  const cheapestVariant = product.variants.reduce((min, v) =>
    v.price < min.price ? v : min, product.variants[0]!);

  const productJsonLd = {
    '@context': 'https://schema.org',
    '@type': 'Product',
    name: product.nameId,
    description: product.shortDescriptionId || product.descriptionId || `${product.nameId} - frozen food premium dari Dapur Dekaka Bandung`,
    image: product.images.map(img => img.cloudinaryUrl),
    brand: {
      '@type': 'Brand',
      name: 'Dapur Dekaka',
    },
    manufacturer: {
      '@type': 'Organization',
      name: 'Dapur Dekaka',
      url: 'https://dapurdekaka.com',
    },
    offers: {
      '@type': 'Offer',
      priceCurrency: 'IDR',
      price: cheapestVariant?.price?.toString() ?? '0',
      priceValidUntil: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
      availability: (cheapestVariant?.stock ?? 0) > 0
        ? 'https://schema.org/InStock'
        : 'https://schema.org/OutOfStock',
      seller: {
        '@type': 'Organization',
        name: 'Dapur Dekaka',
      },
      url: `https://dapurdekaka.com/products/${slug}`,
      shippingDetails: {
        '@type': 'OfferShippingDetails',
        shippingRate: {
          '@type': 'MonetaryAmount',
          currency: 'IDR',
          value: '0',
        },
        shippingDestination: {
          '@type': 'DefinedRegion',
          addressCountry: 'ID',
        },
        deliveryTime: {
          '@type': 'ShippingDeliveryTime',
          handlingTime: {
            '@type': 'QuantitativeValue',
            minValue: 1,
            maxValue: 2,
            unitCode: 'DAY',
          },
          transitTime: {
            '@type': 'QuantitativeValue',
            minValue: 1,
            maxValue: 5,
            unitCode: 'DAY',
          },
        },
      },
    },
    additionalProperty: [
      {
        '@type': 'PropertyValue',
        name: 'Halal Status',
        value: product.isHalal ? 'Bersertifikat Halal MUI' : 'Tidak Berlabel Halal',
      },
      {
        '@type': 'PropertyValue',
        name: 'Storage',
        value: 'Simpan di freezer -18°C',
      },
    ],
  };

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(productJsonLd) }}
      />
      <ProductDetailClient product={product} relatedProducts={relatedProducts} />
    </>
  );
}