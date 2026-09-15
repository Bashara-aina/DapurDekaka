'use client';

import { useState } from 'react';
import Image from 'next/image';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Edit2, Trash2, X } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import CloudinaryUploader from '@/components/admin/common/CloudinaryUploader';

type GalleryUsage = 'instagram_feed' | 'about_hero' | 'og' | 'general';

interface GalleryImage {
  id: string;
  publicId: string;
  altId: string | null;
  altEn: string | null;
  sortOrder: number;
  isActive: boolean;
  usage: GalleryUsage;
  createdAt: string;
}

const USAGE_LABELS: Record<GalleryUsage, string> = {
  instagram_feed: 'Instagram Feed',
  about_hero: 'About Hero',
  og: 'OG Image',
  general: 'Umum',
};

function cloudinaryThumb(publicId: string): string {
  const cloud = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
  return `https://res.cloudinary.com/${cloud}/image/upload/c_fill,w_120,h_80/${publicId}`;
}

function GalleryModal({
  image,
  onClose,
  onSuccess,
}: {
  image?: GalleryImage;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    publicId: image?.publicId ?? '',
    altId: image?.altId ?? '',
    altEn: image?.altEn ?? '',
    sortOrder: image?.sortOrder ?? 0,
    isActive: image?.isActive ?? true,
    usage: (image?.usage ?? 'general') as GalleryUsage,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const url = image ? `/api/admin/gallery/${image.id}` : '/api/admin/gallery';
      const res = await fetch(url, {
        method: image ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          altId: form.altId || null,
          altEn: form.altEn || null,
        }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gallery'] });
      toast.success(image ? 'Gambar diperbarui' : 'Gambar ditambahkan');
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-admin-border">
          <h2 className="font-semibold">{image ? 'Edit Gambar' : 'Tambah Gambar'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <CloudinaryUploader
            label="Gambar Galeri"
            value={form.publicId}
            folder="gallery"
            onChange={(publicId) => setForm({ ...form, publicId })}
          />
          {!form.publicId && (
            <p className="text-xs text-text-muted -mt-1">Unggah gambar untuk mengisi public ID otomatis</p>
          )}
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Alt (ID)</label>
            <input
              type="text"
              value={form.altId}
              onChange={(e) => setForm({ ...form, altId: e.target.value })}
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Alt (EN)</label>
            <input
              type="text"
              value={form.altEn}
              onChange={(e) => setForm({ ...form, altEn: e.target.value })}
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Usage</label>
            <select
              value={form.usage}
              onChange={(e) => setForm({ ...form, usage: e.target.value as GalleryUsage })}
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm"
            >
              {(Object.keys(USAGE_LABELS) as GalleryUsage[]).map((key) => (
                <option key={key} value={key}>{USAGE_LABELS[key]}</option>
              ))}
            </select>
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
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
            />
            Aktif
          </label>
        </div>
        <div className="flex gap-3 p-4 border-t border-admin-border">
          <button onClick={onClose} className="flex-1 h-10 border border-admin-border rounded-lg text-sm">Batal</button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending || !form.publicId}
            className="flex-1 h-10 bg-brand-red text-white rounded-lg text-sm font-bold disabled:opacity-50"
          >
            {mutation.isPending ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function GalleryClient() {
  const queryClient = useQueryClient();
  const [usageFilter, setUsageFilter] = useState<GalleryUsage | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<GalleryImage | undefined>();

  const queryUrl =
    usageFilter === 'all' ? '/api/admin/gallery' : `/api/admin/gallery?usage=${usageFilter}`;

  const { data: images, isLoading } = useQuery<GalleryImage[]>({
    queryKey: ['admin-gallery', usageFilter],
    queryFn: async () => {
      const res = await fetch(queryUrl);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async ({ id, hard }: { id: string; hard: boolean }) => {
      const res = await fetch(`/api/admin/gallery/${id}?hard=${hard}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-gallery'] });
      toast.success('Gambar dihapus');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Galeri</h1>
          <p className="text-sm text-text-secondary mt-0.5">Kelola gambar CMS (Cloudinary public ID)</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-red text-white text-sm font-bold rounded-lg"
        >
          <Plus className="w-4 h-4" /> Tambah
        </button>
      </div>

      <select
        value={usageFilter}
        onChange={(e) => setUsageFilter(e.target.value as GalleryUsage | 'all')}
        className="h-10 px-3 border border-admin-border rounded-lg text-sm bg-white"
      >
        <option value="all">Semua usage</option>
        {(Object.keys(USAGE_LABELS) as GalleryUsage[]).map((key) => (
          <option key={key} value={key}>{USAGE_LABELS[key]}</option>
        ))}
      </select>

      {isLoading ? (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-32 bg-white rounded-xl border border-admin-border animate-pulse" />
          ))}
        </div>
      ) : images?.length === 0 ? (
        <div className="bg-white rounded-xl border border-admin-border p-12 text-center text-text-secondary">
          Belum ada gambar galeri
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {images?.map((img) => (
            <div
              key={img.id}
              className={cn(
                'bg-white rounded-xl border border-admin-border overflow-hidden',
                !img.isActive && 'opacity-60'
              )}
            >
              <div className="relative h-32 bg-slate-100">
                {process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ? (
                  <Image
                    src={cloudinaryThumb(img.publicId)}
                    alt={img.altId ?? img.publicId}
                    fill
                    className="object-cover"
                    sizes="200px"
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-xs text-text-muted px-2 text-center">
                    {img.publicId}
                  </div>
                )}
              </div>
              <div className="p-3 space-y-1">
                <p className="text-xs font-medium truncate">{img.publicId}</p>
                <p className="text-xs text-text-secondary">{USAGE_LABELS[img.usage]}</p>
                <div className="flex gap-1 pt-2">
                  <button
                    onClick={() => { setEditing(img); setShowModal(true); }}
                    className="p-2 hover:bg-gray-100 rounded-lg"
                    aria-label="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteMutation.mutate({ id: img.id, hard: false })}
                    className="p-2 hover:bg-red-50 rounded-lg text-red-500"
                    aria-label="Nonaktifkan"
                    title="Nonaktifkan (soft delete)"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <GalleryModal
          image={editing}
          onClose={() => setShowModal(false)}
          onSuccess={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
