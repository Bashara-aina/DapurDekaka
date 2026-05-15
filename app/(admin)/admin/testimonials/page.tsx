'use client';

import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Star, Trash2, Edit2, Plus, X, Check } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface Testimonial {
  id: string;
  customerName: string;
  customerLocation: string | null;
  avatarUrl: string | null;
  rating: number;
  contentId: string;
  contentEn: string | null;
  isActive: boolean;
  sortOrder: number;
  createdAt: string;
}

function StarRating({ rating }: { rating: number }) {
  return (
    <div className="flex gap-0.5">
      {[1, 2, 3, 4, 5].map((n) => (
        <Star
          key={n}
          className={cn('w-3.5 h-3.5', n <= rating ? 'fill-brand-gold text-brand-gold' : 'text-gray-300')}
        />
      ))}
    </div>
  );
}

function TestimonialModal({
  testimonial,
  onClose,
  onSuccess,
}: {
  testimonial?: Testimonial;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const queryClient = useQueryClient();
  const [form, setForm] = useState({
    customerName: testimonial?.customerName ?? '',
    customerLocation: testimonial?.customerLocation ?? '',
    avatarUrl: testimonial?.avatarUrl ?? '',
    rating: testimonial?.rating ?? 5,
    contentId: testimonial?.contentId ?? '',
    contentEn: testimonial?.contentEn ?? '',
    isActive: testimonial?.isActive ?? true,
    sortOrder: testimonial?.sortOrder ?? 0,
  });

  const mutation = useMutation({
    mutationFn: async () => {
      const url = testimonial
        ? `/api/admin/testimonials/${testimonial.id}`
        : '/api/admin/testimonials';
      const res = await fetch(url, {
        method: testimonial ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-testimonials'] });
      toast.success(testimonial ? 'Testimoni diupdate' : 'Testimoni dibuat');
      onSuccess();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b border-admin-border">
          <h2 className="font-semibold">{testimonial ? 'Edit Testimoni' : 'Tambah Testimoni'}</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Nama Pelanggan</label>
            <input
              type="text"
              value={form.customerName}
              onChange={(e) => setForm({ ...form, customerName: e.target.value })}
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
              placeholder="Nama lengkap"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Lokasi</label>
            <input
              type="text"
              value={form.customerLocation}
              onChange={(e) => setForm({ ...form, customerLocation: e.target.value })}
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
              placeholder="Bandung, Jawa Barat"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">URL Avatar (opsional)</label>
            <input
              type="url"
              value={form.avatarUrl}
              onChange={(e) => setForm({ ...form, avatarUrl: e.target.value })}
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Rating</label>
            <div className="flex gap-2">
              {[1, 2, 3, 4, 5].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => setForm({ ...form, rating: n })}
                  className="p-1 hover:scale-110 transition-transform"
                  aria-label={`Rating ${n}`}
                >
                  <Star
                    className={cn('w-6 h-6', n <= form.rating ? 'fill-brand-gold text-brand-gold' : 'text-gray-300')}
                  />
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Testimoni (ID)</label>
            <textarea
              value={form.contentId}
              onChange={(e) => setForm({ ...form, contentId: e.target.value })}
              rows={3}
              className="w-full px-3 py-2 border border-admin-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30 resize-none"
              placeholder="Testimoni dalam Bahasa Indonesia"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Testimoni (EN) — opsional</label>
            <textarea
              value={form.contentEn}
              onChange={(e) => setForm({ ...form, contentEn: e.target.value })}
              rows={2}
              className="w-full px-3 py-2 border border-admin-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30 resize-none"
              placeholder="English translation (optional)"
            />
          </div>
          <div className="flex items-center justify-between">
            <label className="text-xs font-medium text-text-secondary">Aktif</label>
            <button
              type="button"
              onClick={() => setForm({ ...form, isActive: !form.isActive })}
              className={cn(
                'w-10 h-6 rounded-full transition-colors relative',
                form.isActive ? 'bg-brand-red' : 'bg-gray-300'
              )}
              aria-pressed={form.isActive}
            >
              <span
                className={cn(
                  'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                  form.isActive ? 'translate-x-5' : 'translate-x-1'
                )}
              />
            </button>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Urutan</label>
            <input
              type="number"
              min={0}
              value={form.sortOrder}
              onChange={(e) => setForm({ ...form, sortOrder: parseInt(e.target.value) || 0 })}
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/30"
            />
          </div>
        </div>
        <div className="flex gap-3 p-4 border-t border-admin-border">
          <button
            onClick={onClose}
            className="flex-1 h-10 border border-admin-border rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
          >
            Batal
          </button>
          <button
            onClick={() => mutation.mutate()}
            disabled={mutation.isPending}
            className="flex-1 h-10 bg-brand-red text-white rounded-lg text-sm font-bold hover:bg-brand-red-dark transition-colors disabled:opacity-50"
          >
            {mutation.isPending ? 'Menyimpan...' : 'Simpan'}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TestimonialsAdminPage() {
  const queryClient = useQueryClient();
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<Testimonial | undefined>(undefined);

  const { data: testimonials, isLoading } = useQuery<Testimonial[]>({
    queryKey: ['admin-testimonials'],
    queryFn: async () => {
      const res = await fetch('/api/admin/testimonials');
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/testimonials/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-testimonials'] });
      toast.success('Testimoni dihapus');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  const toggleMutation = useMutation({
    mutationFn: async ({ id, isActive }: { id: string; isActive: boolean }) => {
      const res = await fetch(`/api/admin/testimonials/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive }),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-testimonials'] });
      toast.success('Status diperbarui');
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1A1A]">Testimoni</h1>
          <p className="text-sm text-[#6B6B6B] mt-0.5">Kelola testimoni pelanggan di halaman utama</p>
        </div>
        <button
          onClick={() => { setEditing(undefined); setShowModal(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-red text-white text-sm font-bold rounded-lg hover:bg-brand-red-dark transition-colors"
        >
          <Plus className="w-4 h-4" /> Tambah
        </button>
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 bg-white rounded-xl border border-admin-border animate-pulse" />
          ))}
        </div>
      ) : testimonials?.length === 0 ? (
        <div className="bg-white rounded-xl border border-admin-border p-12 text-center">
          <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-4">
            <Star className="w-6 h-6 text-gray-400" />
          </div>
          <p className="text-[#6B6B6B]">Belum ada testimoni</p>
          <button
            onClick={() => { setEditing(undefined); setShowModal(true); }}
            className="mt-4 text-sm text-brand-red font-medium hover:underline"
          >
            Tambah testimoni pertama
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {testimonials?.map((t) => (
            <div
              key={t.id}
              className={cn(
                'bg-white rounded-xl border border-admin-border p-5 transition-opacity',
                !t.isActive && 'opacity-60'
              )}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex items-start gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-full bg-brand-cream flex items-center justify-center shrink-0 text-lg font-bold text-brand-red">
                    {t.customerName.charAt(0).toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm text-[#1A1A1A]">{t.customerName}</p>
                      {t.customerLocation && (
                        <span className="text-xs text-[#8A8A8A]">{t.customerLocation}</span>
                      )}
                      <StarRating rating={t.rating} />
                    </div>
                    <p className="text-sm text-[#4A4A4A] mt-1 leading-relaxed">{t.contentId}</p>
                    {t.contentEn && (
                      <p className="text-xs text-[#8A8A8A] mt-1 italic">{t.contentEn}</p>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button
                    onClick={() => toggleMutation.mutate({ id: t.id, isActive: !t.isActive })}
                    className={cn(
                      'px-2 py-1 rounded text-xs font-medium transition-colors',
                      t.isActive
                        ? 'bg-green-100 text-green-700 hover:bg-green-200'
                        : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                    )}
                    aria-label={t.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                  >
                    {t.isActive ? 'Aktif' : 'Nonaktif'}
                  </button>
                  <button
                    onClick={() => { setEditing(t); setShowModal(true); }}
                    className="p-2 hover:bg-gray-100 rounded-lg transition-colors text-[#6B6B6B] hover:text-[#1A1A1A]"
                    aria-label="Edit"
                  >
                    <Edit2 className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => {
                      if (confirm('Hapus testimoni ini?')) deleteMutation.mutate(t.id);
                    }}
                    disabled={deleteMutation.isPending}
                    className="p-2 hover:bg-red-50 rounded-lg transition-colors text-red-400 hover:text-red-600"
                    aria-label="Hapus"
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
        <TestimonialModal
          testimonial={editing}
          onClose={() => setShowModal(false)}
          onSuccess={() => setShowModal(false)}
        />
      )}
    </div>
  );
}