import { ProductCard } from './ProductCard';
import type { Product, ProductVariant } from '@/lib/db/schema';
import { productImages } from '@/lib/db/schema';

interface ProductWithVariantsAndImages extends Product {
  variants: ProductVariant[];
  images: typeof productImages.$inferSelect[];
  category: { id: string; nameId: string; slug: string } | null;
}

interface ProductGridProps {
  products: ProductWithVariantsAndImages[];
}

export function ProductGrid({ products }: ProductGridProps) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
      {products.map((product) => {
        const primaryVariant = product.variants.find((v) => v.sortOrder === 0) || product.variants[0];
        const primaryImage = product.images.find((img) => img.sortOrder === 0) || product.images[0];

        if (!primaryVariant) return null;

        return (
          <ProductCard
            key={product.id}
            product={{
              ...product,
              imageUrl: primaryImage?.cloudinaryUrl,
            }}
            variant={primaryVariant}
          />
        );
      })}
    </div>
  );
}