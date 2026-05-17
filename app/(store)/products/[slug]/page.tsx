import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { products, productVariants, productImages } from '@/lib/db/schema';
import { eq, and, ne, isNull } from 'drizzle-orm';
import { notFound } from 'next/navigation';
import { ProductDetailClient } from '@/components/store/products/ProductDetailClient';

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  
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
    category: { id: string; nameId: string; slug: string } | null;
    metaTitleId: string | null;
    metaDescriptionId: string | null;
    shortDescriptionId: string | null;
    images: Array<{ id: string; cloudinaryUrl: string }>;
  } | null);

  if (!product) {
    return {
      title: 'Produk Tidak Ditemukan - Dapur Dekaka',
    };
  }

  const description = product.metaDescriptionId || 
    product.shortDescriptionId || 
    `Beli ${product.nameId} online. Harga terbaik, kirim ke seluruh Indonesia. ${product.category?.nameId || 'Frozen food'} premium dari Dapur Dekaka.`;

  const title = product.metaTitleId || `${product.nameId} - Dapur Dekaka`;

  return {
    title,
    description,
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
      description,
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
      description,
      images: product.images[0] ? [product.images[0].cloudinaryUrl] : [],
    },
    robots: {
      index: true,
      follow: true,
    },
  };
}

export const revalidate = 60;

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
        ne(products.slug, slug)
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