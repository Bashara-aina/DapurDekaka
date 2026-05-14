'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ProductForm } from '@/components/admin/products/ProductForm';
import type { ProductFormData } from '@/components/admin/products/ProductForm';
import { ChevronLeft, Trash2 } from 'lucide-react';

interface ProductDetail {
  id: string;
  categoryId: string;
  nameId: string;
  nameEn: string;
  slug: string;
  descriptionId: string | null;
  descriptionEn: string | null;
  shortDescriptionId: string | null;
  shortDescriptionEn: string | null;
  weightGram: number;
  isHalal: boolean;
  isActive: boolean;
  isFeatured: boolean;
  isB2bAvailable: boolean;
  isPreOrder: boolean;
  sortOrder: number;
  metaTitleId: string | null;
  metaTitleEn: string | null;
  metaDescriptionId: string | null;
  metaDescriptionEn: string | null;
  shopeeUrl: string | null;
  variants: {
    id: string;
    nameId: string;
    nameEn: string;
    sku: string;
    price: number;
    b2bPrice: number;
    stock: number;
    weightGram: number;
    isActive: boolean;
  }[];
  images: {
    id: string;
    cloudinaryUrl: string;
    cloudinaryPublicId: string;
    altTextId: string | null;
    altTextEn: string | null;
    sortOrder: number;
  }[];
  category: { id: string; nameId: string } | null;
}

export default function ProductEditPage({ params }: { params: Promise<{ id: string }> }) {
  const [productId, setProductId] = useState<string>('');
  const [isClientReady, setIsClientReady] = useState(false);
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [categories, setCategories] = useState<{ id: string; nameId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    params.then(p => {
      setProductId(p.id);
      setIsClientReady(true);
    });
  }, [params]);

  useEffect(() => {
    if (!productId) return;

    async function fetchData() {
      try {
        const [productRes, categoriesRes] = await Promise.all([
          fetch(`/api/admin/products/${productId}`),
          fetch('/api/admin/categories').catch(() => ({ ok: false, json: async () => ({ data: [] }) })),
        ]);

        if (!productRes.ok) {
          throw new Error('Failed to fetch product');
        }

        const productData = await productRes.json();
        const categoriesData = categoriesRes.ok ? await categoriesRes.json() : { data: [] };

        setProduct(productData.data);
        setCategories(categoriesData.data ?? []);
      } catch {
        setError('Gagal memuat data produk');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [productId]);

  async function handleSubmit(data: ProductFormData) {
    setIsSubmitting(true);
    try {
      const res = await fetch(`/api/admin/products/${productId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal mengupdate produk');
      }

      router.push('/admin/products');
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal mengupdate produk');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDelete() {
    if (!confirm('Yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan.')) return;

    try {
      const res = await fetch(`/api/admin/products/${productId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menghapus produk');
      }
      router.push('/admin/products');
      router.refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Gagal menghapus produk');
    }
  }

  if (!isClientReady) {
    return <div className="p-6 text-gray-500">Memuat...</div>;
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Memuat data produk...</div>;
  }

  if (error || !product) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link href="/admin/products" className="p-2 hover:bg-admin-content rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">Edit Produk</h1>
        </div>
        <div className="bg-white rounded-lg border border-admin-border p-6 text-center text-red-500">
          {error ?? 'Produk tidak ditemukan'}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Link href="/admin/products" className="p-2 hover:bg-admin-content rounded-lg">
            <ChevronLeft className="w-5 h-5" />
          </Link>
          <h1 className="text-2xl font-bold">Edit: {product.nameId}</h1>
        </div>
        <button
          onClick={handleDelete}
          className="inline-flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-sm font-medium rounded-lg hover:bg-red-700 transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          Hapus Produk
        </button>
      </div>

      <ProductForm
        initialData={{
          id: product.id,
          categoryId: product.categoryId,
          nameId: product.nameId,
          nameEn: product.nameEn,
          slug: product.slug,
          descriptionId: product.descriptionId ?? undefined,
          descriptionEn: product.descriptionEn ?? undefined,
          shortDescriptionId: product.shortDescriptionId ?? undefined,
          shortDescriptionEn: product.shortDescriptionEn ?? undefined,
          weightGram: product.weightGram,
          isHalal: product.isHalal,
          isActive: product.isActive,
          isFeatured: product.isFeatured,
          isB2bAvailable: product.isB2bAvailable,
          isPreOrder: product.isPreOrder,
          sortOrder: product.sortOrder,
          metaTitleId: product.metaTitleId ?? undefined,
          metaTitleEn: product.metaTitleEn ?? undefined,
          metaDescriptionId: product.metaDescriptionId ?? undefined,
          metaDescriptionEn: product.metaDescriptionEn ?? undefined,
          shopeeUrl: product.shopeeUrl ?? undefined,
          variants: product.variants.map(v => ({
            id: v.id,
            nameId: v.nameId,
            nameEn: v.nameEn,
            sku: v.sku,
            price: v.price,
            b2bPrice: v.b2bPrice,
            stock: v.stock,
            weightGram: v.weightGram,
            isActive: v.isActive,
          })),
          images: product.images.map(img => ({
            id: img.id,
            cloudinaryUrl: img.cloudinaryUrl,
            cloudinaryPublicId: img.cloudinaryPublicId,
            altTextId: img.altTextId ?? undefined,
            altTextEn: img.altTextEn ?? undefined,
            sortOrder: img.sortOrder,
          })),
        }}
        categories={categories.length > 0 ? categories : (product.category ? [{ id: product.category.id, nameId: product.category.nameId }] : [])}
        onSubmit={handleSubmit}
        isSubmitting={isSubmitting}
      />
    </div>
  );
}