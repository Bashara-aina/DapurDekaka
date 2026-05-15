'use client';

import { useState, useEffect } from 'react';
import { toast } from 'sonner';
import { formatWIB } from '@/lib/utils/format-date';
import { Plus, Edit2, X, Check, RefreshCw } from 'lucide-react';

interface CategoryItem {
  id: string;
  nameId: string;
  nameEn: string;
  slug: string;
  sortOrder: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string | null;
}

export default function CategoriesPage() {
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState({ nameId: '', nameEn: '', slug: '', sortOrder: 0 });
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    fetchCategories();
  }, []);

  async function fetchCategories() {
    try {
      const res = await fetch('/api/admin/categories');
      if (!res.ok) throw new Error('Failed to fetch');
      const result = await res.json();
      setCategories(result.data ?? []);
    } catch {
      toast.error('Gagal memuat kategori');
    } finally {
      setLoading(false);
    }
  }

  function openCreateModal() {
    setEditingId(null);
    setForm({ nameId: '', nameEn: '', slug: '', sortOrder: 0 });
    setShowModal(true);
  }

  function openEditModal(cat: CategoryItem) {
    setEditingId(cat.id);
    setForm({ nameId: cat.nameId, nameEn: cat.nameEn, slug: cat.slug, sortOrder: cat.sortOrder });
    setShowModal(true);
  }

  function generateSlug(name: string) {
    return name
      .toLowerCase()
      .replace(/[^a-z0-9\s-]/g, '')
      .replace(/\s+/g, '-')
      .replace(/-+/g, '-')
      .trim();
  }

  function handleFormChange(field: 'nameId' | 'nameEn' | 'slug' | 'sortOrder', value: string | number) {
    if (field === 'nameId') {
      const slug = generateSlug(value as string);
      setForm((prev) => ({ ...prev, nameId: value as string, slug }));
    } else {
      setForm((prev) => ({ ...prev, [field]: value }));
    }
  }

  async function handleSubmit() {
    if (!form.nameId || !form.nameEn || !form.slug) {
      toast.error('Lengkapi semua field');
      return;
    }

    setIsSubmitting(true);
    try {
      const url = editingId ? `/api/admin/categories/${editingId}` : '/api/admin/categories';
      const method = editingId ? 'PATCH' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Gagal menyimpan');

      toast.success(editingId ? 'Kategori diperbarui' : 'Kategori dibuat');
      setShowModal(false);
      fetchCategories();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Gagal menyimpan');
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleToggleActive(cat: CategoryItem) {
    try {
      const res = await fetch(`/api/admin/categories/${cat.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ isActive: !cat.isActive }),
      });

      if (!res.ok) throw new Error('Failed');
      fetchCategories();
    } catch {
      toast.error('Gagal update status');
    }
  }

  if (loading) {
    return <div className="p-6 text-gray-500">Memuat...</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Kategori</h1>
        <button
          onClick={openCreateModal}
          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#0F172A] text-white text-xs font-medium rounded-lg hover:bg-[#1E293B] transition-colors"
        >
          <Plus className="w-3.5 h-3.5" />
          Kategori Baru
        </button>
      </div>

      <div className="bg-white rounded-lg border border-admin-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-admin-content">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Urutan</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama (ID)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nama (EN)</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {categories.map((cat) => (
                <tr key={cat.id} className="hover:bg-admin-content">
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cat.sortOrder}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-800">{cat.nameId}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{cat.nameEn}</td>
                  <td className="px-6 py-4 whitespace-nowrap text-xs font-mono text-gray-400">{cat.slug}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                        cat.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'
                      }`}
                    >
                      {cat.isActive ? 'Aktif' : 'Nonaktif'}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => openEditModal(cat)}
                        className="p-1.5 text-gray-500 hover:text-gray-700 rounded hover:bg-admin-content"
                        title="Edit"
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleToggleActive(cat)}
                        className={`p-1.5 rounded hover:bg-admin-content ${
                          cat.isActive ? 'text-red-500' : 'text-green-600'
                        }`}
                        title={cat.isActive ? 'Nonaktifkan' : 'Aktifkan'}
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {categories.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Belum ada kategori
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Create/Edit Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-xl p-6 w-full max-w-md shadow-2xl">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-lg font-bold">
                {editingId ? 'Edit Kategori' : 'Kategori Baru'}
              </h2>
              <button
                onClick={() => setShowModal(false)}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama (Bahasa Indonesia)
                </label>
                <input
                  type="text"
                  value={form.nameId}
                  onChange={(e) => handleFormChange('nameId', e.target.value)}
                  placeholder="Dimsum Premium"
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Nama (English)
                </label>
                <input
                  type="text"
                  value={form.nameEn}
                  onChange={(e) => handleFormChange('nameEn', e.target.value)}
                  placeholder="Premium Dimsum"
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
                <input
                  type="text"
                  value={form.slug}
                  onChange={(e) => handleFormChange('slug', e.target.value)}
                  placeholder="dimsum-premium"
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Urutan</label>
                <input
                  type="number"
                  min="0"
                  value={form.sortOrder}
                  onChange={(e) => handleFormChange('sortOrder', parseInt(e.target.value, 10) || 0)}
                  className="w-full h-10 px-3 rounded-lg border border-gray-200 text-sm focus:outline-none focus:ring-2 focus:ring-brand-red/20 focus:border-brand-red"
                />
              </div>
            </div>

            <div className="flex gap-3 mt-6">
              <button
                onClick={() => setShowModal(false)}
                className="flex-1 h-10 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
              >
                Batal
              </button>
              <button
                onClick={handleSubmit}
                disabled={isSubmitting}
                className="flex-1 h-10 bg-[#0F172A] text-white rounded-lg text-sm font-medium hover:bg-[#1E293B] transition-colors disabled:opacity-50"
              >
                {isSubmitting ? 'Memproses...' : editingId ? 'Simpan' : 'Buat'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}