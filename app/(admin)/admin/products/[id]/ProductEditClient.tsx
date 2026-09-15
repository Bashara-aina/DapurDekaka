'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { toast } from 'sonner';
import { logger } from '@/lib/utils/logger';
import { ProductForm } from '@/components/admin/products/ProductForm';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
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
    lengthCm: number;
    widthCm: number;
    heightCm: number;
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

interface ProductEditClientProps {
  productId: string;
}

export default function ProductEditClient({ productId }: ProductEditClientProps) {
  const [product, setProduct] = useState<ProductDetail | null>(null);
  const [categories, setCategories] = useState<{ id: string; nameId: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const router = useRouter();

  useEffect(() => {
    if (!productId) return;

    async function fetchData() {
      try {
        // allSettled: categories are auxiliary — a failure must not mask
        // the product result (the old inline .catch fabricated a fake
        // Response object, which was type-unsafe).
        const [productResult, categoriesResult] = await Promise.allSettled([
          fetch(`/api/admin/products/${productId}`),
          fetch('/api/admin/categories'),
        ]);

        if (productResult.status === 'rejected' || !productResult.value.ok) {
          throw new Error('Failed to fetch product');
        }

        const productData = await productResult.value.json();
        const categoriesData =
          categoriesResult.status === 'fulfilled' && categoriesResult.value.ok
            ? await categoriesResult.value.json()
            : { data: [] };

        setProduct(productData.data);
        setCategories(categoriesData.data ?? []);
      } catch (err) {
        logger.warn('[admin/products] edit load failed', { productId, error: err instanceof Error ? err.message : String(err) });
        setError('Gagal memuat data produk');
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, [productId]);

  async function handleDelete() {
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/admin/products/${productId}`, { method: 'DELETE' });
      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error || 'Gagal menghapus produk');
      }
      toast.success('Produk dihapus');
      router.push('/admin/products');
      router.refresh();
    } catch (err) {
      // No alert() — non-blocking toast keeps admin context visible.
      logger.warn('[admin/products] delete failed', { productId, error: err instanceof Error ? err.message : String(err) });
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus produk');
    } finally {
      setIsDeleting(false);
      setShowDeleteConfirm(false);
    }
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
          type="button"
          onClick={() => setShowDeleteConfirm(true)}
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
            lengthCm: v.lengthCm,
            widthCm: v.widthCm,
            heightCm: v.heightCm,
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
      />

      {/* Destructive-action confirm — non-blocking Dialog, no confirm(). */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus produk?</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-600">
            Yakin ingin menghapus produk ini? Tindakan ini tidak dapat dibatalkan.
          </p>
          <DialogFooter className="flex gap-3">
            <button
              type="button"
              onClick={() => setShowDeleteConfirm(false)}
              className="flex-1 h-10 border border-gray-300 rounded-lg font-medium hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={handleDelete}
              disabled={isDeleting}
              className="flex-1 h-10 bg-red-600 text-white rounded-lg font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              {isDeleting ? 'Menghapus...' : 'Hapus'}
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}