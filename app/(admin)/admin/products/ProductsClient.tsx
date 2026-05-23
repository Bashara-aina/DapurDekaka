'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { formatIDR } from '@/lib/utils/format-currency';
import { Plus, Power, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface ProductWithVariants {
  id: string;
  nameId: string;
  slug: string | null;
  categoryId: string | null;
  category?: { nameId: string } | null;
  isActive: boolean;
  isFeatured: boolean;
  createdAt: Date;
  variants: Array<{ id: string; price: number; stock: number; isActive: boolean }>;
  images: Array<{ cloudinaryUrl: string | null }>;
}

interface ProductsClientProps {
  allProducts: ProductWithVariants[];
}

export default function ProductsClient({ allProducts }: ProductsClientProps) {
  const [products, setProducts] = useState(allProducts);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkLoading, setBulkLoading] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [pendingDeleteCount, setPendingDeleteCount] = useState(0);

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (selectedIds.size === products.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(products.map(p => p.id)));
    }
  };

  const handleBulkDisable = async () => {
    if (selectedIds.size === 0) return;
    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/products/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds), action: 'disable' }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setProducts(prev => prev.map(p => selectedIds.has(p.id) ? { ...p, isActive: false } : p));
      toast.success(`${selectedIds.size} produk dinonaktifkan`);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menonaktifkan');
    } finally {
      setBulkLoading(false);
    }
  };

  const handleBulkDelete = async () => {
    if (selectedIds.size === 0) return;
    setShowDeleteDialog(true);
    setPendingDeleteCount(selectedIds.size);
  };

  const executeBulkDelete = async () => {
    setBulkLoading(true);
    try {
      const res = await fetch('/api/admin/products/bulk', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      setProducts(prev => prev.filter(p => !selectedIds.has(p.id)));
      toast.success(`${selectedIds.size} produk dihapus`);
      setSelectedIds(new Set());
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menghapus');
    } finally {
      setBulkLoading(false);
      setShowDeleteDialog(false);
    }
  };

  return (
    <>
      {/* Bulk Action Bar */}
      {selectedIds.size > 0 && (
        <div className="sticky top-14 z-10 bg-admin-sidebar text-white p-3 flex items-center gap-4 rounded-lg shadow-lg">
          <span className="text-sm font-medium">{selectedIds.size} dipilih</span>
          <button
            onClick={handleBulkDisable}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Power className="w-3.5 h-3.5" /> Nonaktifkan
          </button>
          <button
            onClick={handleBulkDelete}
            disabled={bulkLoading}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-red-600 hover:bg-red-700 rounded text-xs font-medium transition-colors disabled:opacity-50"
          >
            <Trash2 className="w-3.5 h-3.5" /> Hapus
          </button>
          <button
            onClick={() => setSelectedIds(new Set())}
            className="ml-auto text-xs hover:underline opacity-70 hover:opacity-100"
          >
            Batal
          </button>
        </div>
      )}

      <div className="bg-white rounded-lg border border-admin-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-admin-content">
              <tr>
                <th className="px-4 py-3 text-left">
                  <input
                    type="checkbox"
                    checked={selectedIds.size === products.length && products.length > 0}
                    onChange={toggleSelectAll}
                    className="w-4 h-4 accent-brand-red"
                  />
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Produk</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Kategori</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Harga Mulai</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {products.map((product) => {
                const lowestVariant = product.variants[0];
                const image = product.images[0];
                return (
                  <tr key={product.id} className="hover:bg-admin-content">
                    <td className="px-4 py-4 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={selectedIds.has(product.id)}
                        onChange={() => toggleSelect(product.id)}
                        className="w-4 h-4 accent-brand-red"
                      />
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-lg bg-brand-cream overflow-hidden flex-shrink-0">
                          {image?.cloudinaryUrl && (
                            <Image
                              src={image.cloudinaryUrl}
                              alt={product.nameId}
                              width={40}
                              height={40}
                              className="object-cover w-full h-full"
                            />
                          )}
                        </div>
                        <div>
                          <p className="font-medium text-sm">{product.nameId}</p>
                          <p className="text-xs text-gray-500">{product.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {product.category?.nameId ?? '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-brand-red">
                      {lowestVariant ? formatIDR(lowestVariant.price) : '-'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${product.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}>
                        {product.isActive ? 'Aktif' : 'Nonaktif'}
                      </span>
                      {product.isFeatured && (
                        <span className="ml-1 inline-flex px-2 py-1 text-xs font-semibold rounded bg-amber-100 text-amber-800">
                          Unggulan
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <Link
                        href={`/admin/products/${product.id}`}
                        className="text-brand-red hover:underline"
                      >
                        Edit
                      </Link>
                    </td>
                  </tr>
                );
              })}
              {products.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Belum ada produk
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Hapus Produk?</DialogTitle>
            <DialogDescription>
              {pendingDeleteCount} produk akan dihapus. Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3">
            <button
              onClick={() => setShowDeleteDialog(false)}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              Batal
            </button>
            <button
              onClick={executeBulkDelete}
              className="flex-1 px-4 py-2 text-sm font-medium rounded-lg bg-red-600 hover:bg-red-700 text-white"
            >
              Hapus
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}