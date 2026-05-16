'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { Minus, Plus, ShoppingCart } from 'lucide-react';
import { toast } from 'sonner';
import { useCartStore } from '@/store/cart.store';
import { formatIDR } from '@/lib/utils/format-currency';
import { StockBadge } from '@/components/store/common/StockBadge';
import { HalalBadge } from '@/components/store/common/HalalBadge';
import { cn } from '@/lib/utils/cn';
import type { Product, ProductVariant } from '@/lib/db/schema';
import { productImages } from '@/lib/db/schema';

interface RelatedProduct {
  id: string;
  nameId: string;
  nameEn: string;
  slug: string;
  isHalal: boolean;
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
}

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
  relatedProducts?: RelatedProduct[];
}

export function ProductDetailClient({ product, relatedProducts }: ProductDetailClientProps) {
  const defaultVariantIndex = product.variants.findIndex(v => v.stock > 0 && v.isActive);
  const [selectedVariantIndex, setSelectedVariantIndex] = useState(Math.max(0, defaultVariantIndex));
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [quantity, setQuantity] = useState(1);
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const router = useRouter();
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
    }, quantity);
    toast.success(`${product.nameId} ditambahkan ke keranjang`, {
      action: {
        label: 'Lihat Keranjang',
        onClick: () => router.push('/cart'),
      },
    });
  };

  return (
    <div className="bg-brand-cream min-h-screen pb-24">
      {/* Image Gallery */}
      <div className="relative aspect-[4/3] bg-brand-cream-dark">
        {product.images[selectedImageIndex] ? (
          <button
            onClick={() => setLightboxOpen(true)}
            className="relative w-full h-full cursor-zoom-in"
            aria-label="Perbesar gambar"
          >
            <Image
              src={product.images[selectedImageIndex].cloudinaryUrl}
              alt={product.nameId}
              fill
              className="object-cover"
              priority
              sizes="(max-width: 768px) 100vw, (max-width: 1200px) 60vw, 800px"
            />
          </button>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center">
            <span className="text-6xl">🥟</span>
          </div>
        )}
        
        {/* Back Button */}
        <button
          onClick={() => {
            if (window.history.length > 1) {
              router.back();
            } else {
              router.push('/products');
            }
          }}
          className="absolute top-4 left-4 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center"
        >
          ←
        </button>

        {/* Badges */}
        <div className="absolute top-4 right-4 flex flex-col gap-2">
          {product.isHalal && <HalalBadge />}
        </div>
      </div>

      {/* Thumbnails */}
      {product.images.length > 1 && (
        <div className="flex gap-2 p-4 overflow-x-auto">
          {product.images.map((img, i) => (
            <button
              key={img.id}
              onClick={() => setSelectedImageIndex(i)}
              className={cn(
                'w-16 h-16 flex-shrink-0 rounded-lg overflow-hidden border-2',
                i === selectedImageIndex ? 'border-brand-red' : 'border-transparent'
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
                  onClick={() => {
                    setSelectedVariantIndex(i);
                    setQuantity(1);
                  }}
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

      {/* Related Products Section */}
      {relatedProducts && relatedProducts.length > 0 && (
        <div className="px-4 mt-6">
          <h2 className="font-display text-xl font-bold text-text-primary mb-4">
            Produk Lainnya
          </h2>
          <div className="grid grid-cols-2 gap-3">
            {relatedProducts.slice(0, 4).map((related) => {
              const firstImage = related.images[0];
              const firstVariant = related.variants.find(v => v.isActive) ?? related.variants[0];
              return (
                <a
                  key={related.id}
                  href={`/products/${related.slug}`}
                  className="bg-white rounded-card overflow-hidden shadow-sm hover:shadow-md transition-shadow"
                >
                  <div className="aspect-square relative bg-brand-cream-dark">
                    {firstImage ? (
                      <Image
                        src={firstImage.cloudinaryUrl}
                        alt={related.nameId}
                        fill
                        className="object-cover"
                        sizes="50vw"
                      />
                    ) : (
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-4xl">🥟</span>
                      </div>
                    )}
                    {related.isHalal && (
                      <div className="absolute top-2 right-2 w-8 h-8">
                        <Image
                          src="/assets/logo/halal.png"
                          alt="Halal"
                          fill
                          className="object-contain"
                        />
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <p className="text-sm font-medium text-text-primary line-clamp-1">
                      {related.nameId}
                    </p>
                    {firstVariant && (
                      <p className="text-sm font-bold text-brand-red mt-1">
                        {formatIDR(firstVariant.price)}
                      </p>
                    )}
                  </div>
                </a>
              );
            })}
          </div>
          {product.category && (
            <Link
              href={`/products?category=${product.category.slug}`}
              className="mt-4 flex items-center justify-center gap-1 text-brand-red text-sm font-medium hover:underline"
            >
              Lihat semua {product.category.nameId} →
            </Link>
          )}
        </div>
      )}

      {/* Sticky Bottom Bar */}
      <div className="fixed bottom-[calc(5rem+env(safe-area-inset-bottom))] md:bottom-0 left-0 right-0 bg-white border-t border-brand-cream-dark p-4 pb-[calc(1rem+env(safe-area-inset-bottom))">
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
              onClick={() => setQuantity(Math.min(selectedVariant?.stock ?? 99, Math.min(99, quantity + 1)))}
              className="w-11 h-11 flex items-center justify-center text-brand-red"
              disabled={quantity >= Math.min(99, selectedVariant?.stock ?? 99)}
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

      {/* Lightbox */}
      {lightboxOpen && (
        <div
          className="fixed inset-0 z-[100] bg-black/90 flex items-center justify-center p-4"
          onClick={() => setLightboxOpen(false)}
        >
          <div className="relative w-full max-w-3xl aspect-[4/3]">
            <Image
              src={product.images[selectedImageIndex]?.cloudinaryUrl || ''}
              alt={product.nameId}
              fill
              className="object-contain"
              sizes="100vw"
            />
            <button
              onClick={() => setLightboxOpen(false)}
              className="absolute top-4 right-4 w-10 h-10 bg-white/80 backdrop-blur rounded-full flex items-center justify-center text-text-primary text-2xl font-bold"
              aria-label="Tutup"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </div>
  );
}