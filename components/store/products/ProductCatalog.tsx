'use client';

import { useState, useMemo } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ProductCard } from '@/components/store/products/ProductCard';
import type { Product, ProductVariant } from '@/lib/db/schema';
import { productImages } from '@/lib/db/schema';

interface ProductWithVariantsAndImages {
  id: string;
  nameId: string;
  nameEn: string;
  slug: string;
  shortDescriptionId: string | null;
  isHalal: boolean;
  isActive: boolean;
  createdAt: Date;
  category: { id: string; nameId: string; slug: string } | null;
  variants: Array<{
    id: string;
    nameId: string;
    nameEn: string;
    sku: string;
    price: number;
    stock: number;
    weightGram: number;
    isActive: boolean;
    sortOrder: number;
  }>;
  images: Array<{ cloudinaryUrl: string; sortOrder: number }>;
}

interface ProductCatalogProps {
  products: ProductWithVariantsAndImages[];
  categories: { id: string; nameId: string; slug: string }[];
  initialCategory?: string;
  initialSearch?: string;
}

type SortOption = 'default' | 'price_asc' | 'price_desc' | 'newest';

const SORT_OPTIONS: { value: SortOption; label: string }[] = [
  { value: 'default', label: 'Sortir: Default' },
  { value: 'price_asc', label: 'Harga: Rendah → Tinggi' },
  { value: 'price_desc', label: 'Harga: Tinggi → Rendah' },
  { value: 'newest', label: 'Terbaru' },
];

export function ProductCatalog({ products, categories, initialCategory = '', initialSearch = '' }: ProductCatalogProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [sort, setSort] = useState<SortOption>('default');

  const category = searchParams.get('category') || initialCategory;
  const q = searchParams.get('q') || initialSearch;

  const filteredProducts = useMemo(() => {
    let result = [...products];

    // Category filter
    if (category) {
      result = result.filter(p => p.category?.slug === category);
    }

    // Search filter
    if (q) {
      const searchLower = q.toLowerCase();
      result = result.filter(p =>
        p.nameId.toLowerCase().includes(searchLower) ||
        p.nameEn.toLowerCase().includes(searchLower) ||
        p.category?.nameId.toLowerCase().includes(searchLower)
      );
    }

    // Sort: OOS items always go to end, then apply sort option
    const inStock: typeof result = [];
    const outOfStock: typeof result = [];

    result.forEach((p) => {
      const hasStock = p.variants.some((v) => v.stock > 0);
      if (hasStock) {
        inStock.push(p);
      } else {
        outOfStock.push(p);
      }
    });

    const sortFn = (a: ProductWithVariantsAndImages, b: ProductWithVariantsAndImages) => {
      switch (sort) {
        case 'price_asc':
          return (a.variants[0]?.price ?? 0) - (b.variants[0]?.price ?? 0);
        case 'price_desc':
          return (b.variants[0]?.price ?? 0) - (a.variants[0]?.price ?? 0);
        case 'newest':
          return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
        default:
          return (a.variants[0]?.sortOrder ?? 999) - (b.variants[0]?.sortOrder ?? 999);
      }
    };

    inStock.sort(sortFn);
    outOfStock.sort(sortFn);

    return [...inStock, ...outOfStock];
  }, [products, category, q, sort]);

  const handleCategoryChange = (slug: string | null) => {
    const params = new URLSearchParams(searchParams.toString());
    if (slug) {
      params.set('category', slug);
    } else {
      params.delete('category');
    }
    router.push(`/products?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="bg-brand-cream min-h-screen pb-20">
      {/* Header */}
      <div className="bg-white border-b border-brand-cream-dark py-6 px-4">
        <div className="container mx-auto">
          <h1 className="font-display text-2xl font-bold text-text-primary">Produk</h1>
          <p className="text-text-secondary text-sm mt-1">
            {filteredProducts.length} produk ditemukan
          </p>
        </div>
      </div>

      {/* Category Pills + Sort */}
      <div className="py-4 px-4">
        <div className="container mx-auto">
          <div className="flex items-center justify-between gap-4 mb-4">
            {/* Category Pills */}
            <div className="flex gap-2 min-w-0 overflow-x-auto pb-2">
              <button
                onClick={() => handleCategoryChange(null)}
                className={`flex-shrink-0 px-4 py-2 rounded-pill text-sm font-medium transition-colors ${
                  !category ? 'bg-brand-red text-white' : 'bg-white text-text-primary border border-brand-cream-dark'
                }`}
              >
                Semua
              </button>
              {categories.map((cat) => (
                <button
                  key={cat.id}
                  onClick={() => handleCategoryChange(cat.slug)}
                  className={`flex-shrink-0 px-4 py-2 rounded-pill text-sm font-medium transition-colors ${
                    category === cat.slug ? 'bg-brand-red text-white' : 'bg-white text-text-primary border border-brand-cream-dark'
                  }`}
                >
                  {cat.nameId}
                </button>
              ))}
            </div>

            {/* Sort Dropdown */}
            <div className="flex-shrink-0">
              <select
                value={sort}
                onChange={(e) => setSort(e.target.value as SortOption)}
                className="h-10 px-3 rounded-button border border-brand-cream-dark bg-white text-sm text-text-primary focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/10 cursor-pointer"
              >
                {SORT_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Product Grid */}
      <div className="px-4 container mx-auto">
        {filteredProducts.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 pb-8">
            {filteredProducts.map((product) => {
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
        ) : (
          <div className="text-center py-16 col-span-full">
            <p className="text-5xl mb-4">😕</p>
            <h3 className="font-display text-lg font-semibold text-text-primary mb-2">
              Produk tidak ditemukan
            </h3>
            <p className="text-text-secondary text-sm mb-4">
              Coba kategori lain atau hapus filter
            </p>
            <button
              onClick={() => handleCategoryChange(null)}
              className="px-4 py-2 bg-brand-red text-white text-sm font-bold rounded-button hover:bg-brand-red-dark transition-colors"
            >
              Tampilkan Semua Produk
            </button>
          </div>
        )}
      </div>
    </div>
  );
}