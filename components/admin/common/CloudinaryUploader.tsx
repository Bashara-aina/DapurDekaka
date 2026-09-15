'use client';

import { useRef, useState } from 'react';
import Image from 'next/image';
import { Upload, X } from 'lucide-react';
import { toast } from 'sonner';
import { cn } from '@/lib/utils/cn';
import { logger } from '@/lib/utils/logger';

interface CloudinaryUploaderProps {
  value: string;
  onChange: (publicId: string) => void;
  folder: 'cms' | 'gallery' | 'carousel' | 'blog' | 'products' | 'avatars' | 'sauces';
  label?: string;
  className?: string;
}

export default function CloudinaryUploader({
  value,
  onChange,
  folder,
  label,
  className,
}: CloudinaryUploaderProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);

  const cloudName = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME ?? '';
  const thumbUrl = value
    ? `https://res.cloudinary.com/${cloudName}/image/upload/c_fill,w_160,h_160,q_auto,f_auto/${value}`
    : '';

  const handleSelect = () => {
    if (uploading) return;
    inputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', folder);

      const res = await fetch('/api/admin/upload', {
        method: 'POST',
        body: formData,
      });
      const json = await res.json();

      if (!json.success || !json.data?.publicId) {
        throw new Error(json.error ?? 'Upload gagal');
      }
      onChange(json.data.publicId);
      toast.success('Gambar berhasil diunggah');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Upload gagal';
      logger.error('[CloudinaryUploader]', { message, folder });
      toast.error(message);
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleRemove = () => {
    onChange('');
  };

  return (
    <div className={cn('space-y-2', className)}>
      {label && (
        <label className="block text-xs font-medium text-text-secondary">{label}</label>
      )}
      <div className="flex items-start gap-3">
        <div className="relative h-24 w-24 rounded-lg overflow-hidden border border-admin-border bg-slate-50 flex items-center justify-center">
          {value ? (
            cloudName ? (
              <Image
                src={thumbUrl}
                alt={value}
                fill
                className="object-cover"
                sizes="96px"
              />
            ) : (
              <span className="text-[10px] text-text-secondary px-1 text-center break-all">
                {value}
              </span>
            )
          ) : (
            <span className="text-xs text-text-muted">Belum ada</span>
          )}
          {uploading && (
            <div className="absolute inset-0 bg-white/80 flex items-center justify-center text-xs font-medium text-text-secondary">
              Mengunggah…
            </div>
          )}
        </div>
        <div className="flex flex-col gap-2">
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            className="hidden"
            disabled={uploading}
            onChange={handleFileChange}
          />
          <button
            type="button"
            onClick={handleSelect}
            disabled={uploading}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium bg-brand-red text-white hover:bg-brand-red-dark disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {value ? 'Ganti' : 'Unggah'}
          </button>
          {value && (
            <button
              type="button"
              onClick={handleRemove}
              disabled={uploading}
              className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg text-sm font-medium border border-admin-border text-red-600 hover:bg-red-50 disabled:opacity-50"
            >
              <X className="w-4 h-4" /> Hapus
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
