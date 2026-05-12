import type { Metadata } from 'next';
import { db } from '@/lib/db';
import { products, productVariants, productImages } from '@/lib/db/schema';
import { eq, and } from 'drizzle-orm';
import { notFound } from 'next/navigation';

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: ProductDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  
  const product = await db.query.products.findFirst({
    where: and(eq(products.slug, slug), eq(products.isActive, true)),
    with: {
      category: true,
      images: { limit: 1 },
    },
  });

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
    where: and(eq(products.slug, slug), eq(products.isActive, true)),
    with: {
      variants: { where: eq(productVariants.isActive, true) },
      images: { orderBy: (images, { asc }) => [asc(images.sortOrder)] },
      category: true,
    },
  });

  if (!product) {
    notFound();
  }

  // This is a placeholder - actual product detail page would render here
  // For now just showing basic structure
  return (
    <div className="bg-brand-cream min-h-screen pb-20">
      {/* Product detail implementation would go here */}
      <div className="container mx-auto py-8">
        <h1 className="font-display text-2xl font-bold">{product.nameId}</h1>
      </div>
    </div>
  );
}