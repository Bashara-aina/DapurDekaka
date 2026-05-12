'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/store/cart.store';
import { formatIDR } from '@/lib/utils/format-currency';
import { StockBadge } from '@/components/store/common/StockBadge';
import { HalalBadge } from '@/components/store/common/HalalBadge';
import { cn } from '@/lib/utils/cn';
import type { Product, ProductVariant } from '@/lib/db/schema';

interface ProductCardHorizontalProps {
  product: Product & { imageUrl?: string };
  variant: ProductVariant;
  className?: string;
}

export function ProductCardHorizontal({ product, variant, className }: ProductCardHorizontalProps) {
  const addItem = useCartStore((s) => s.addItem);
  const isOutOfStock = variant.stock === 0;

  const handleAddToCart = (e: React.MouseEvent) => {
    e.preventDefault();
    if (isOutOfStock) return;
    addItem({
      variantId: variant.id,
      productId: product.id,
      productNameId: product.nameId,
      productNameEn: product.nameEn,
      variantNameId: variant.nameId,
      variantNameEn: variant.nameEn,
      sku: variant.sku,
      imageUrl: product.imageUrl || '/assets/logo/logo.png',
      unitPrice: variant.price,
      weightGram: variant.weightGram,
      stock: variant.stock,
    });
  };

  return (
    <Link
      href={`/products/${product.slug}`}
      className={cn(
        'group bg-white rounded-card shadow-card hover:shadow-card-hover transition-all overflow-hidden flex',
        className
      )}
    >
      {/* Image - left side */}
      <div className="relative w-24 h-24 md:w-32 md:h-32 flex-shrink-0 bg-brand-cream">
        <Image
          src={product.imageUrl || '/assets/logo/logo.png'}
          alt={product.nameId}
          fill
          className="object-cover"
          sizes="120px"
        />
        <div className="absolute top-1 right-1">
          <HalalBadge />
        </div>
      </div>

      {/* Content - right side */}
      <div className="flex-1 p-3 md:p-4 flex flex-col justify-between">
        <div>
          <h3 className="font-display font-medium text-sm md:text-base text-text-primary line-clamp-1 mb-0.5">
            {product.nameId}
          </h3>
          <p className="text-text-secondary text-xs md:text-sm">{variant.nameId}</p>
        </div>

        <div className="flex items-end justify-between mt-2">
          <div className="flex flex-col gap-1">
            <p className="font-body font-bold text-brand-red text-sm md:text-base">
              {formatIDR(variant.price)}
            </p>
            {isOutOfStock ? (
              <StockBadge stock={0} />
            ) : variant.stock < 5 ? (
              <StockBadge stock={variant.stock} />
            ) : null}
          </div>
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={cn(
              'h-9 w-9 md:h-11 md:w-11 rounded-full flex items-center justify-center transition-colors flex-shrink-0',
              isOutOfStock
                ? 'bg-text-disabled text-white cursor-not-allowed'
                : 'bg-brand-red text-white hover:bg-brand-red-dark'
            )}
            aria-label="Tambah ke keranjang"
          >
            <ShoppingCart className="w-4 h-4 md:w-5 md:h-5" />
          </button>
        </div>
      </div>
    </Link>
  );
}