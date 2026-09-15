'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { ChevronLeft, Plus, X } from 'lucide-react';
import { isLegalCmsSlug } from '@/lib/cms/legal-slugs';
import { logger } from '@/lib/utils/logger';
import { CmsSectionFields, type CmsSectionForm } from './CmsSectionFields';

interface CmsPageDetail {
  page: { id: string; slug: string; title: string; isPublished: boolean };
  sections: Array<CmsSectionForm & { id: string }>;
}

function newSection(sortOrder: number): CmsSectionForm {
  return {
    sectionKey: '',
    sortOrder,
    titleId: '',
    titleEn: '',
    bodyId: '',
    bodyEn: '',
    ctaLabelId: '',
    ctaLabelEn: '',
    ctaHref: '',
    imagePublicId: '',
    _isNew: true,
  };
}

function mapSection(s: CmsPageDetail['sections'][number]): CmsSectionForm {
  return {
    sectionKey: s.sectionKey,
    sortOrder: s.sortOrder,
    titleId: s.titleId ?? '',
    titleEn: s.titleEn ?? '',
    bodyId: s.bodyId ?? '',
    bodyEn: s.bodyEn ?? '',
    ctaLabelId: s.ctaLabelId ?? '',
    ctaLabelEn: s.ctaLabelEn ?? '',
    ctaHref: s.ctaHref ?? '',
    imagePublicId: s.imagePublicId ?? '',
  };
}

interface Props {
  slug: string;
}

function NewSectionModal({
  onClose,
  onConfirm,
}: {
  onClose: () => void;
  onConfirm: (sectionKey: string, title: string) => void;
}) {
  const [sectionKey, setSectionKey] = useState('');
  const [title, setTitle] = useState('');

  const submit = () => {
    const key = sectionKey.trim().toLowerCase().replace(/[^a-z0-9-]/g, '-');
    if (!key) {
      toast.error('Section key wajib diisi');
      return;
    }
    onConfirm(key, title.trim());
  };

  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-xl w-full max-w-md">
        <div className="flex items-center justify-between p-4 border-b border-admin-border">
          <h2 className="font-semibold">Section Baru</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded" aria-label="Tutup">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 space-y-3">
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Section Key</label>
            <input
              type="text"
              autoFocus
              value={sectionKey}
              onChange={(e) => setSectionKey(e.target.value)}
              placeholder="intro, faq-1, cta"
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm"
            />
            <p className="text-xs text-text-muted mt-1">Hanya huruf kecil, angka, dan tanda hubung</p>
          </div>
          <div>
            <label className="block text-xs font-medium text-text-secondary mb-1">Judul Awal (ID)</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Judul section (opsional)"
              className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm"
            />
          </div>
        </div>
        <div className="flex gap-3 p-4 border-t border-admin-border">
          <button
            onClick={onClose}
            className="flex-1 h-10 border border-admin-border rounded-lg text-sm font-medium"
          >
            Batal
          </button>
          <button
            onClick={submit}
            className="flex-1 h-10 bg-brand-red text-white rounded-lg text-sm font-bold"
          >
            Tambah
          </button>
        </div>
      </div>
    </div>
  );
}

export default function CmsEditClient({ slug }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [title, setTitle] = useState('');
  const [isPublished, setIsPublished] = useState(true);
  const [sections, setSections] = useState<CmsSectionForm[]>([]);
  const [removedKeys, setRemovedKeys] = useState<string[]>([]);
  const [dragSource, setDragSource] = useState<number | null>(null);
  const [dragOver, setDragOver] = useState<number | null>(null);
  const [showNewSection, setShowNewSection] = useState(false);

  const { data, isLoading, error } = useQuery<CmsPageDetail>({
    queryKey: ['admin-cms-page', slug],
    queryFn: async () => {
      const res = await fetch(`/api/admin/cms/${slug}`);
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
  });

  useEffect(() => {
    if (!data) return;
    setTitle(data.page.title);
    setIsPublished(data.page.isPublished);
    setSections(data.sections.map(mapSection));
    setRemovedKeys([]);
  }, [data]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title,
        isPublished,
        sections: sections.map((s, i) => ({
          sectionKey: s.sectionKey,
          sortOrder: i,
          titleId: s.titleId || null,
          titleEn: s.titleEn || null,
          bodyId: s.bodyId || null,
          bodyEn: s.bodyEn || null,
          ctaLabelId: s.ctaLabelId || null,
          ctaLabelEn: s.ctaLabelEn || null,
          ctaHref: s.ctaHref || null,
          imagePublicId: s.imagePublicId || null,
        })),
        removeSectionKeys: removedKeys,
      };
      const res = await fetch(`/api/admin/cms/${slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      setRemovedKeys([]);
      queryClient.invalidateQueries({ queryKey: ['admin-cms-page', slug] });
      queryClient.invalidateQueries({ queryKey: ['admin-cms-pages'] });
      toast.success('Halaman disimpan');
      router.refresh();
    },
    onError: (err: Error) => {
      logger.error('[CmsEditClient save]', { message: err.message, slug });
      toast.error(err.message);
    },
  });

  function updateSection(index: number, field: keyof CmsSectionForm, value: string | number) {
    setSections((prev) => prev.map((s, i) => (i === index ? { ...s, [field]: value } : s)));
  }

  function removeSection(index: number) {
    const target = sections[index];
    if (target && !target._isNew && target.sectionKey) {
      setRemovedKeys((keys) => (keys.includes(target.sectionKey) ? keys : [...keys, target.sectionKey]));
    }
    setSections((prev) => prev.filter((_, i) => i !== index));
  }

  function reorderSections(fromIndex: number, toIndex: number) {
    if (fromIndex === toIndex) return;
    setSections((prev) => {
      const next = [...prev];
      const [moved] = next.splice(fromIndex, 1);
      if (moved) next.splice(toIndex, 0, moved);
      return next;
    });
  }

  function addSection(sectionKey: string, initialTitle: string) {
    setSections((prev) => [
      ...prev,
      {
        ...newSection(prev.length),
        sectionKey,
        titleId: initialTitle,
      },
    ]);
    setShowNewSection(false);
  }

  if (isLoading) return <div className="p-6 text-text-secondary">Memuat...</div>;

  if (error || !data) {
    return (
      <div className="p-6">
        <p className="text-red-600">Gagal memuat halaman CMS.</p>
        <Link href="/admin/cms" className="text-brand-red text-sm mt-2 inline-block hover:underline">
          Kembali
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5 max-w-3xl">
      <div className="flex items-center gap-3">
        <Link href="/admin/cms" className="p-2 hover:bg-white rounded-lg border border-admin-border">
          <ChevronLeft className="w-4 h-4" />
        </Link>
        <div>
          <h1 className="text-2xl font-bold text-text-primary">Edit: {slug}</h1>
          {isLegalCmsSlug(slug) && (
            <p className="text-xs text-amber-700 mt-0.5">Halaman legal — hanya superadmin dapat menyimpan</p>
          )}
        </div>
      </div>

      <div className="bg-white rounded-xl border border-admin-border p-5 space-y-4">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Judul Halaman</label>
          <input
            type="text"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm"
          />
        </div>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={isPublished}
            onChange={(e) => setIsPublished(e.target.checked)}
          />
          Publikasikan halaman
        </label>
      </div>

      <div className="flex items-center justify-between">
        <h2 className="font-semibold text-text-primary">Sections</h2>
        <button
          type="button"
          onClick={() => setShowNewSection(true)}
          className="inline-flex items-center gap-1 text-sm text-brand-red font-medium"
        >
          <Plus className="w-4 h-4" /> Tambah Section
        </button>
      </div>

      <div className="space-y-4">
        {sections.map((section, idx) => (
          <CmsSectionFields
            key={`${section._isNew ? 'new' : 's'}-${idx}-${section.sectionKey}`}
            section={section}
            index={idx}
            onChange={updateSection}
            onRemove={removeSection}
            onDragStart={(i) => setDragSource(i)}
            onDragOver={(i) => {
              if (dragSource !== null && i !== dragSource) setDragOver(i);
            }}
            onDragEnd={() => {
              if (dragSource !== null && dragOver !== null) {
                reorderSections(dragSource, dragOver);
              }
              setDragSource(null);
              setDragOver(null);
            }}
            isDragging={dragSource === idx}
            isDropTarget={dragOver === idx && dragSource !== idx}
          />
        ))}
        {sections.length === 0 && (
          <div className="bg-white rounded-xl border border-dashed border-admin-border p-8 text-center text-sm text-text-secondary">
            Belum ada section. Klik &quot;Tambah Section&quot; untuk membuat.
          </div>
        )}
      </div>

      <button
        type="button"
        onClick={() => saveMutation.mutate()}
        disabled={saveMutation.isPending}
        className="w-full md:w-auto px-6 h-11 bg-brand-red text-white rounded-lg font-bold hover:bg-brand-red-dark disabled:opacity-50"
      >
        {saveMutation.isPending ? 'Menyimpan...' : 'Simpan Perubahan'}
      </button>

      {showNewSection && (
        <NewSectionModal
          onClose={() => setShowNewSection(false)}
          onConfirm={addSection}
        />
      )}
    </div>
  );
}
