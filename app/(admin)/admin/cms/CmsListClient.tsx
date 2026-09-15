'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, FileText, X, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { isLegalCmsSlug } from '@/lib/cms/legal-slugs';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface CmsPageRow {
  id: string;
  slug: string;
  title: string;
  isPublished: boolean;
  sectionCount: number;
  createdAt: string;
  updatedAt: string | null;
}

function CreatePageModal({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({ slug: '', title: '', isPublished: true });

  const mutation = useMutation({
    mutationFn: async () => {
      const res = await fetch('/api/admin/cms', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data as CmsPageRow;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cms-pages'] });
      toast.success('Halaman CMS dibuat');
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-admin-border">
          <h2 className="font-semibold">Halaman CMS Baru</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Slug</label>
            <input
              type="text"
              value={form.slug}
              onChange={(e) => setForm({ ...form, slug: e.target.value.toLowerCase() })}
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm"
              placeholder="about"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Judul</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm({ ...form, title: e.target.value })}
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm"
              placeholder="Tentang Kami"
            />
          </div>
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isPublished}
              onChange={(e) => setForm({ ...form, isPublished: e.target.checked })}
            />
            Publikasikan
          </label>
        </div>
        <div className="flex gap-3 p-4 border-t border-admin-border">
          <button
            onClick={onClose}
            className="flex-1 h-10 border border-admin-border rounded-lg text-sm font-medium"
          >
            Batal
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.slug || !form.title}
            className="flex-1 h-10 bg-brand-red text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {mutation.isPending ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CmsListClient() {
  const queryClient = useQueryClient();
  const [showCreate, setShowCreate] = useState(false);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [targetDelete, setTargetDelete] = useState<CmsPageRow | null>(null);

  const { data: pages, isLoading } = useQuery<CmsPageRow[]>({
    queryKey: ['admin-cms-pages'],
    queryFn: async () => {
      const res = await fetch('/api/admin/cms');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (slug: string) => {
      const res = await fetch(`/api/admin/cms/${slug}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-cms-pages'] });
      toast.success('Halaman CMS dihapus');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">CMS Halaman</h1>
          <p className="text-sm text-text-secondary mt-0.5">Kelola konten halaman statis toko</p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-red text-white text-sm font-bold rounded-lg hover:bg-brand-red-dark"
        >
          <Plus className="w-4 h-4" /> Halaman Baru
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-16 bg-white rounded-xl border border-admin-border animate-pulse" />
          ))}
        </div>
      ) : pages?.length === 0 ? (
        <div className="bg-white rounded-xl border border-admin-border p-12 text-center">
          <FileText className="w-10 h-10 text-gray-400 mx-auto mb-3" />
          <p className="text-text-secondary">Belum ada halaman CMS</p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-admin-border overflow-hidden">
          <table className="w-full">
            <thead className="bg-slate-50 border-b border-admin-border">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Judul</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Slug</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Section</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-text-secondary uppercase">Status</th>
                <th className="px-4 py-3 text-right text-xs font-medium text-text-secondary uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {pages?.map((page) => (
                <tr key={page.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3 text-sm font-medium text-text-primary">{page.title}</td>
                  <td className="px-4 py-3 text-sm text-text-secondary">
                    {page.slug}
                    {isLegalCmsSlug(page.slug) && (
                      <span className="ml-2 text-xs bg-amber-100 text-amber-800 px-1.5 py-0.5 rounded">Legal</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-sm text-text-secondary">{page.sectionCount}</td>
                  <td className="px-4 py-3">
                    <span
                      className={cn(
                        'text-xs font-medium px-2 py-0.5 rounded',
                        page.isPublished ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      )}
                    >
                      {page.isPublished ? 'Publik' : 'Draft'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="inline-flex items-center gap-2 justify-end">
                      <Link
                        href={`/admin/cms/${page.slug}`}
                        className="text-brand-red text-sm font-medium hover:underline"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => { setTargetDelete(page); setShowDeleteDialog(true); }}
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
            </tbody>
          </table>
        </div>
      )}

      {showCreate && (
        <CreatePageModal onClose={() => setShowCreate(false)} onSuccess={() => setShowCreate(false)} />
      )}

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Halaman CMS?</DialogTitle>
            <DialogDescription>
              Halaman &quot;{targetDelete?.title}&quot; akan dihapus beserta seluruh section-nya. Tindakan ini tidak bisa dibatalkan.
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
                if (targetDelete) deleteMutation.mutate(targetDelete.slug);
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
