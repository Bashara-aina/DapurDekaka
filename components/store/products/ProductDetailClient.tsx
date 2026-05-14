'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Minus, Plus, ShoppingCart } from 'lucide-react';
import { useCartStore } from '@/store/cart.store';
import { formatIDR } from '@/lib/utils/format-currency';
import { StockBadge } from '@/components/store/common/StockBadge';
import { HalalBadge } from '@/components/store/common/HalalBadge';
import { cn } from '@/lib/utils/cn';
import type { Product, ProductVariant } from '@/lib/db/schema';
import { productImages } from '@/lib/db/schema';

interface ProductDetailClientProps {
  product: {
    id: string;
    nameId: string;
    nameEn: string;
    descriptionId: string | null;
    shortDescriptionId: string | null;
    isHalal: boolean;
    isActive: boolean;
    category: { id: string; nameId: string; slug: string } | null;
    variants: Array<{
      id: string;
      nameId: string;
      nameEn: string;
      price: number;
      stock: number;
      isActive: boolean;
      sortOrder: number;
      sku: string;
      weightGram: number;
    }>;
    images: Array<{
      id: string;
      cloudinaryUrl: string;
      sortOrder: number;
    }>;
  };
}

export function ProductDetailClient({ product }: ProductDetailClientProps) {
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const addItem = useCartStore((s) => s.addItem);

  const selectedVariant = product.variants[selectedVariantIndex];
  const primaryImage = product.images[0];
  const isOutOfStock = selectedVariant?.stock === 0;

  const handleAddToCart = () => {
    if (isOutOfStock || !selectedVariant) return;
    
    addItem({
      variantId: selectedVariant.id,
      productId: product.id,
      productNameId: product.nameId,
      productNameEn: product.nameEn,
      variantNameId: selectedVariant.nameId,
      variantNameEn: selectedVariant.nameEn,
      sku: selectedVariant.sku,
      imageUrl: primaryImage?.cloudinaryUrl || '/assets/logo/logo.png',
      unitPrice: selectedVariant.price,
      weightGram: selectedVariant.weightGram,
      stock: selectedVariant.stock,
    });
  };

  return (
    <div className="bg-brand-cream min-h-screen pb-24">
      {/* Image Gallery */}
      <div className="relative aspect-[4/3] bg-brand-cream-dark">
        {primaryImage ? (
          <Image
            src={primaryImage.cloudinaryUrl}
            alt={product.nameId}
            fill
            className="object-cover"
            priority
            sizes="(max-width: 768px) 100vw, (max-width: 1200px) 60vw, 800px"
          />
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl">🥟</span>
          </div>
        )}
        
        {/* Back Button */}
        <a
          href="/products"
          className="absolute top-4 left-4 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center"
        >
          ←
        </a>

        {/* Badges */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          {product.isHalal && <HalalBadge />}
          {product.isHalal && (
            <span className="text-[10px] text-text-muted bg-white/60 px-1 rounded">
              MUI 001/2020
            </span>
          )}
        </div>
      </div>

      {/* Thumbnails */}
      {product.images.length > 1 && (
        <div className="flex gap-2 p-4 overflow-x-auto">
          {product.images.map((img, i) => (
            <button
              key={img.id}
              className={cn(
                'w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border-2',
                i === 0 ? 'border-brand-red' : 'border-transparent'
              )}
              aria-label={`Lihat foto ${i + 1} ${product.nameId}`}
            >
              <Image src={img.cloudinaryUrl} alt={`${product.nameId} - foto ${i + 1}`} width={64} height={64} className="object-cover" />
            </button>
          ))}
        </div>
      )}

      {/* Product Info */}
      <div className="px-4">
        <div className="bg-white rounded-card p-6 shadow-card">
          {/* Category */}
          {product.category && (
            <span className="text-text-secondary text-sm">{product.category.nameId}</span>
          )}

          {/* Name */}
          <h1 className="font-display text-2xl font-bold text-text-primary mt-1">
            {product.nameId}
          </h1>

          {/* Variants */}
          <div className="mt-4">
            <p className="text-text-secondary text-sm mb-2">Pilih Varian:</p>
            <div className="flex flex-wrap gap-2">
              {product.variants.map((variant, i) => (
                <button
                  key={variant.id}
                  onClick={() => setSelectedVariantIndex(i)}
                  disabled={variant.stock === 0}
                  className={cn(
                    'px-4 py-2 rounded-button border text-sm font-medium transition-colors',
                    i === selectedVariantIndex
                      ? 'border-brand-red bg-brand-red text-white'
                      : variant.stock === 0
                      ? 'border-gray-200 bg-gray-50 text-text-disabled cursor-not-allowed'
                      : 'border-brand-cream-dark text-text-primary hover:border-brand-red'
                  )}
                >
                  {variant.nameId}
                </button>
              ))}
            </div>
          </div>

          {/* Price */}
          <div className="mt-4">
            <p className="font-body font-bold text-brand-red text-2xl">
              {formatIDR(selectedVariant?.price || 0)}
            </p>
          </div>

          {/* Stock */}
          <div className="mt-2">
            <StockBadge stock={selectedVariant?.stock || 0} />
          </div>

          {/* Description */}
          {product.descriptionId && (
            <div className="mt-4 pt-4 border-t border-brand-cream-dark">
              <h3 className="font-semibold text-text-primary mb-2">Deskripsi</h3>
              <p className="text-text-secondary text-sm whitespace-pre-line">
                {product.descriptionId}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-20 md:bottom-0 left-0 right-0 bg-white border-t border-brand-cream-dark p-4">
        <div className="container mx-auto flex items-center gap-4">
          {/* Quantity Stepper */}
          <div className="flex items-center border border-brand-cream-dark rounded-button">
            <button
              onClick={() => setQuantity(Math.max(1, quantity - 1))}
              className="w-11 h-11 flex items-center justify-center text-brand-red"
              disabled={quantity <= 1}
              aria-label="Kurangi jumlah"
            >
              <Minus className="w-4 h-4" />
            </button>
            <span className="w-12 text-center font-bold">{quantity}</span>
            <button
              onClick={() => setQuantity(Math.min(99, quantity + 1))}
              className="w-11 h-11 flex items-center justify-center text-brand-red"
              disabled={quantity >= 99}
              aria-label="Tambah jumlah"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Add to Cart Button */}
          <button
            onClick={handleAddToCart}
            disabled={isOutOfStock}
            className={cn(
              'flex-1 h-12 flex items-center justify-center gap-2 font-bold rounded-button transition-colors',
              isOutOfStock
                ? 'bg-text-disabled text-white cursor-not-allowed'
                : 'bg-brand-red text-white hover:bg-brand-red-dark'
            )}
          >
            <ShoppingCart className="w-5 h-5" />
            {isOutOfStock ? 'Stok Habis' : 'Tambah ke Keranjang'}
          </button>
        </div>
      </div>
    </div>
  );
}