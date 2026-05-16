'use client';

import { useState } from 'react';
import { Upload } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

interface CoverImageUploaderProps {
  onUpload: (url: string, publicId: string) => void;
  className?: string;
}

export function CoverImageUploader({ onUpload, className }: CoverImageUploaderProps) {
  const [uploading, setUploading] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('folder', 'dapurdekaka/blog');

      const res = await fetch('/api/admin/upload', { method: 'POST', body: formData });
      const result = await res.json();

      if (!result.success) throw new Error(result.error);
      onUpload(result.data.url, result.data.publicId);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Upload gagal');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  return (
    <div className={cn('flex items-center gap-2', className)}>
      <label
        htmlFor="blog-cover-upload"
        className={cn(
          'cursor-pointer inline-flex items-center justify-center gap-2 h-10 px-4 rounded-lg font-medium text-sm transition-colors',
          'bg-brand-red text-white hover:bg-brand-red-dark',
          uploading && 'opacity-50 pointer-events-none'
        )}
      >
        <Upload className="w-4 h-4" />
        {uploading ? 'Mengunggah...' : 'Upload'}
      </label>
      <input
        id="blog-cover-upload"
        type="file"
        accept="image/*"
        className="hidden"
        disabled={uploading}
        onChange={handleFileChange}
      />
    </div>
  );
}