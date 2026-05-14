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

interface ProductCardProps {
  product: {
    id: string;
    nameId: string;
    nameEn: string;
    slug: string;
    isHalal: boolean;
    imageUrl?: string;
  };
  variant: {
    id: string;
    nameId: string;
    nameEn: string;
    sku: string;
    price: number;
    stock: number;
    weightGram: number;
  };
  className?: string;
}

export function ProductCard({ product, variant, className }: ProductCardProps) {
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
        'group bg-white rounded-card shadow-card hover:shadow-card-hover transition-all overflow-hidden',
        className
      )}
    >
      {/* Image */}
      <div className="relative aspect-square bg-brand-cream">
        <Image
          src={product.imageUrl || '/assets/logo/logo.png'}
          alt={product.nameId}
          fill
          className="object-cover"
          sizes="(max-width: 768px) 100vw, (max-width: 1024px) 50vw, 25vw"
        />
        {/* Badges */}
        <div className="absolute top-2 right-2 flex flex-col gap-1">
          <HalalBadge />
          {product.isHalal && (
            <span className="text-[8px] text-text-muted bg-white/60 px-1 rounded text-center">
              MUI 001/2020
            </span>
          )}
          {isOutOfStock && (
            <span className="px-2 py-1 bg-text-secondary text-white text-xs font-bold rounded">
              HABIS
            </span>
          )}
        </div>
        {!isOutOfStock && variant.stock < 5 && (
          <div className="absolute top-2 left-2">
            <StockBadge stock={variant.stock} />
          </div>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-display font-medium text-text-primary line-clamp-2 mb-1">
          {product.nameId}
        </h3>
        <p className="text-text-secondary text-xs mb-3">{variant.nameId}</p>

        <div className="flex items-center justify-between">
          <div>
            <p className="font-body font-bold text-brand-red text-lg">
              {formatIDR(variant.price)}
            </p>
          </div>
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={cn(
              'h-11 w-11 rounded-full flex items-center justify-center transition-colors',
              isOutOfStock
                ? 'bg-text-disabled text-white cursor-not-allowed'
                : 'bg-brand-red text-white hover:bg-brand-red-dark'
            )}
            aria-label="Tambah ke keranjang"
          >
            <ShoppingCart className="w-5 h-5" />
          </button>
        </div>
      </div>
    </Link>
  );
}