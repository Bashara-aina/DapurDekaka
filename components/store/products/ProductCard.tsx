'use client';

import Image from 'next/image';
import Link from 'next/link';
import { ShoppingCart, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { useTranslations } from 'next-intl';
import { useSession } from 'next-auth/react';
import { useCartStore } from '@/store/cart.store';
import { useRouter } from 'next/navigation';
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
  const t = useTranslations('product');
  const tCart = useTranslations('cart');
  const { data: session } = useSession();
  const addItem = useCartStore((s) => s.addItem);
  const syncToDb = useCartStore((s) => s.syncToDb);
  const router = useRouter();
  const isOutOfStock = variant.stock === 0;
  const canQuickAdd = !isOutOfStock;

  const syncIfLoggedIn = async () => {
    if (session?.user) {
      await syncToDb();
    }
  };

  const handleQuickAdd = async (e: React.MouseEvent) => {
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
    toast.success(`${product.nameId} ${tCart('addedToCart')}`, {
      action: {
        label: tCart('viewCart'),
        onClick: () => router.push('/cart'),
      },
    });
    await syncIfLoggedIn();
  };

  const handleAddToCart = async (e: React.MouseEvent) => {
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
    toast.success(`${product.nameId} ${tCart('addedToCart')}`, {
      action: {
        label: tCart('viewCart'),
        onClick: () => router.push('/cart'),
      },
    });
    await syncIfLoggedIn();
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
        {!isOutOfStock && (
          <div className="absolute top-2 right-2 flex flex-col gap-1">
            <HalalBadge />
            {product.isHalal && (
              <span className="text-[8px] text-text-disabled bg-white/60 px-1 rounded text-center">
                MUI 001/2020
              </span>
            )}
          </div>
        )}
        {/* Out of stock overlay */}
        {isOutOfStock && (
          <div className="absolute inset-0 bg-black/50 flex items-center justify-center rounded-t-card">
            <span className="px-3 py-1.5 bg-white/90 text-text-primary text-xs font-bold rounded-badge tracking-wide">
              {t('outOfStock')}
            </span>
          </div>
        )}
        {!isOutOfStock && variant.stock < 5 && (
          <div className="absolute top-2 left-2">
            <StockBadge stock={variant.stock} />
          </div>
        )}
        {/* Quick Add Button */}
        {canQuickAdd && (
          <button
            onClick={handleQuickAdd}
            className="absolute bottom-2 right-2 w-11 h-11 bg-brand-red rounded-full flex items-center justify-center text-white shadow-lg hover:bg-brand-red-dark active:bg-brand-red-dark transition-colors"
            aria-label={t('addToCart')}
          >
            <Plus className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Content */}
      <div className="p-4">
        <h3 className="font-display font-medium text-base text-text-primary line-clamp-2 mb-1 leading-snug">
          {product.nameId}
        </h3>
        <p className="text-text-secondary text-xs mb-2">{variant.nameId}</p>

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
              'h-11 w-11 rounded-full flex items-center justify-center transition-colors active:bg-brand-red-dark',
              isOutOfStock
                ? 'bg-text-disabled text-white cursor-not-allowed'
                : 'bg-brand-red text-white hover:bg-brand-red-dark'
            )}
            aria-label={t('addToCart')}
          >
            <ShoppingCart className="w-5 h-5" />
          </button>
        </div>
      </div>
    </Link>
  );
}