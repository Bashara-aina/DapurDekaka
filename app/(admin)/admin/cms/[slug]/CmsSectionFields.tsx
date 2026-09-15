'use client';

import { GripVertical, Trash2 } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import CloudinaryUploader from '@/components/admin/common/CloudinaryUploader';
import TiptapEditor from '@/components/admin/common/TiptapEditor';

export interface CmsSectionForm {
  sectionKey: string;
  sortOrder: number;
  titleId: string;
  titleEn: string;
  bodyId: string;
  bodyEn: string;
  ctaLabelId: string;
  ctaLabelEn: string;
  ctaHref: string;
  imagePublicId: string;
  _isNew?: boolean;
}

interface Props {
  section: CmsSectionForm;
  index: number;
  onChange: (index: number, field: keyof CmsSectionForm, value: string | number) => void;
  onRemove: (index: number) => void;
  onDragStart: (index: number) => void;
  onDragOver: (index: number) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  isDropTarget: boolean;
}

export function CmsSectionFields({
  section,
  index,
  onChange,
  onRemove,
  onDragStart,
  onDragOver,
  onDragEnd,
  isDragging,
  isDropTarget,
}: Props) {
  const text = (
    key: keyof CmsSectionForm,
    label: string,
    placeholder?: string,
    type: 'text' | 'number' = 'text'
  ) => (
    <div>
      <label className="block text-xs font-medium text-text-secondary mb-1">{label}</label>
      <input
        type={type}
        min={type === 'number' ? 0 : undefined}
        value={section[key] as string | number}
        placeholder={placeholder}
        onChange={(e) =>
          onChange(
            index,
            key,
            type === 'number' ? parseInt(e.target.value, 10) || 0 : e.target.value
          )
        }
        className="w-full h-10 px-3 border border-admin-border rounded-lg text-sm"
      />
    </div>
  );

  return (
    <div
      className={cn(
        'bg-white rounded-xl border border-admin-border p-5 space-y-3 transition-all',
        isDragging && 'opacity-50',
        isDropTarget && 'border-brand-red ring-2 ring-brand-red/20'
      )}
      onDragOver={(e) => {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        onDragOver(index);
      }}
    >
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            draggable
            onDragStart={(e) => {
              e.dataTransfer.effectAllowed = 'move';
              e.dataTransfer.setData('text/plain', String(index));
              onDragStart(index);
            }}
            onDragEnd={onDragEnd}
            className="cursor-grab active:cursor-grabbing text-text-muted hover:text-text-primary p-1 -ml-1 rounded"
            aria-label="Drag untuk reorder"
            title="Tahan dan geser untuk reorder"
          >
            <GripVertical className="w-5 h-5" />
          </button>
          <p className="text-sm font-medium">
            Section #{index + 1}
            {section.sectionKey ? (
              <span className="ml-2 text-xs text-text-secondary">({section.sectionKey})</span>
            ) : null}
          </p>
        </div>
        <button
          type="button"
          onClick={() => onRemove(index)}
          className="inline-flex items-center gap-1 px-2 h-8 text-xs font-medium text-red-600 hover:bg-red-50 rounded"
          aria-label="Hapus section"
        >
          <Trash2 className="w-4 h-4" />
          Hapus Section
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {text('sectionKey', 'Section Key', 'mis. intro, faq-1, cta')}
        {text('sortOrder', 'Urutan', undefined, 'number')}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {text('titleId', 'Judul (ID)')}
        {text('titleEn', 'Judul (EN)')}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Isi (ID)</label>
          <TiptapEditor
            value={section.bodyId}
            onChange={(html) => onChange(index, 'bodyId', html)}
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-text-secondary mb-1">Isi (EN)</label>
          <TiptapEditor
            value={section.bodyEn}
            onChange={(html) => onChange(index, 'bodyEn', html)}
          />
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {text('ctaLabelId', 'CTA Label (ID)', 'mis. Belanja Sekarang')}
        {text('ctaLabelEn', 'CTA Label (EN)', 'e.g. Shop Now')}
      </div>

      {text('ctaHref', 'CTA Href', '/products')}

      <CloudinaryUploader
        label="Gambar Section"
        value={section.imagePublicId}
        folder="cms"
        onChange={(publicId) => onChange(index, 'imagePublicId', publicId)}
      />
    </div>
  );
}
