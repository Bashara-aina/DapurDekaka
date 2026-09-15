'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, ChevronLeft, X, Pencil, Trash2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface BlogCategory {
  id: string;
  nameId: string;
  nameEn: string;
  slug: string;
  sortOrder: number;
}

function slugify(value: string): string {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .trim();
}

function CategoryModal({
  category,
  onClose,
  onSuccess,
}: {
  category?: BlogCategory;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const isEdit = Boolean(category);
  const [form, setForm] = useState({
    nameId: category?.nameId ?? '',
    nameEn: category?.nameEn ?? '',
    slug: category?.slug ?? '',
    sortOrder: category?.sortOrder ?? 0,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const url = category
        ? `/api/admin/blog/categories/${category.id}`
        : '/api/admin/blog/categories';
      const res = await fetch(url, {
        method: category ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-categories'] });
      toast.success(isEdit ? 'Kategori blog diupdate' : 'Kategori blog dibuat');
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-admin-border">
          <h2 className="font-semibold">{isEdit ? 'Edit Kategori Blog' : 'Kategori Blog Baru'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Nama (ID)</label>
            <input
              type="text"
              value={form.nameId}
              onChange={(e) => {
                const nameId = e.target.value;
                setForm((prev) => ({
                  ...prev,
                  nameId,
                  slug: prev.slug && isEdit ? prev.slug : slugify(nameId),
                }));
              }}
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Nama (EN)</label>
            <input
              type="text"
              value={form.nameEn}
              onChange={(e) => setForm({ ...form, nameEn: e.target.value })}
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value })}
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Urutan</label>
            <input
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value, 10) || 0 })}
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="flex gap-3 p-4 border-t border-admin-border">
          <button onClick={onClose} className="flex-1 h-10 border border-admin-border rounded-lg text-sm">Batal</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.nameId || !form.nameEn || !form.slug}
            className="flex-1 h-10 bg-brand-red text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {mutation.isPending ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function BlogCategoriesClient() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<BlogCategory | undefined>(undefined);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [targetDelete, setTargetDelete] = useState<BlogCategory | null>(null);

  const { data: categories, isLoading } = useQuery<BlogCategory[]>({
    queryKey: ['admin-blog-categories'],
    queryFn: async () => {
      const res = await fetch('/api/admin/blog/categories');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/blog/categories/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-categories'] });
      toast.success('Kategori dihapus');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center gap-3">
        <Link href="/admin/blog" className="p-2 hover:bg-white rounded-lg border border-admin-border">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-text-primary">Kategori Blog</h1>
          <p className="text-sm text-text-secondary mt-0.5">Kelola kategori artikel blog</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-red text-white text-sm font-bold rounded-lg"
        >
          <Plus className="w-4 h-4" /> Tambah
        </button>
      </div>

      {isLoading ? (
        <div className="h-40 bg-white rounded-xl border border-admin-border animate-pulse" />
      ) : (
        <div className="bg-white rounded-xl border border-admin-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-admin-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Urutan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Nama (ID)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Nama (EN)</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Slug</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {categories?.map((cat) => (
                <tr key={cat.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm">{cat.sortOrder}</td>
                  <td className="px-4 py-3 text-sm font-medium">{cat.nameId}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{cat.nameEn}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{cat.slug}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => { setEditing(cat); setShowModal(true); }}
                        className="p-1.5 hover:bg-gray-100 rounded text-text-secondary hover:text-text-primary"
                        aria-label="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => { setTargetDelete(cat); setShowDeleteDialog(true); }}
                        disabled={deleteMutation.isPending}
                        className="p-1.5 hover:bg-red-50 rounded text-red-400 hover:text-red-600 disabled:opacity-50"
                        aria-label="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories?.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-12 text-center text-text-secondary">
                    Belum ada kategori
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {showModal && (
        <CategoryModal
          category={editing}
          onClose={() => setShowModal(false)}
          onSuccess={() => setShowModal(false)}
        />
      )}

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Kategori?</DialogTitle>
            <DialogDescription>
              Kategori &quot;{targetDelete?.nameId}&quot; akan dihapus. Post pada kategori ini akan kehilangan kategorinya. Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3">
            <button
              type="button"
              onClick={() => { setShowDeleteDialog(false); setTargetDelete(null); }}
              className="flex-1 h-10 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                if (targetDelete) deleteMutation.mutate(targetDelete.id);
                setShowDeleteDialog(false);
                setTargetDelete(null);
              }}
              disabled={deleteMutation.isPending}
              className="flex-1 h-10 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Hapus
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}