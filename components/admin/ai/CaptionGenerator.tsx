'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Loader2, Copy, Check } from 'lucide-react';

const CaptionSchema = z.object({
  productName: z.string().min(1, 'Nama produk wajib diisi'),
  productDescription: z.string().min(10, 'Deskripsi minimal 10 karakter'),
  language: z.enum(['id', 'en']).default('id'),
  tone: z.enum(['professional', 'playful', 'luxurious', 'warm']).default('warm'),
  regenerate: z.boolean().default(false),
});

type CaptionFormData = z.infer<typeof CaptionSchema>;

interface CaptionGeneratorProps {
  onCaptionGenerated?: (caption: string) => void;
}

export function CaptionGenerator({ onCaptionGenerated }: CaptionGeneratorProps) {
  const [caption, setCaption] = useState<string | null>(null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [isCopied, setIsCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const form = useForm<CaptionFormData>({
    resolver: zodResolver(CaptionSchema),
    defaultValues: {
      productName: '',
      productDescription: '',
      language: 'id',
      tone: 'warm',
      regenerate: false,
    },
  });

  async function onSubmit(data: CaptionFormData) {
    setIsGenerating(true);
    setError(null);
    setCaption(null);

    try {
      const response = await fetch('/api/ai/caption', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          productName: data.productName,
          productDescription: data.productDescription,
          language: data.language,
          tone: data.tone,
        }),
      });

      if (!response.ok) {
        const result = await response.json();
        throw new Error(result.error || 'Failed to generate caption');
      }

      const result = await response.json();
      setCaption(result.data.caption);
      onCaptionGenerated?.(result.data.caption);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Gagal membuat caption');
    } finally {
      setIsGenerating(false);
    }
  }

  async function copyToClipboard() {
    if (!caption) return;
    await navigator.clipboard.writeText(caption);
    setIsCopied(true);
    setTimeout(() => setIsCopied(false), 2000);
  }

  return (
    <div className="space-y-6">
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="space-y-2">
            <Label htmlFor="productName">Nama Produk</Label>
            <input
              id="productName"
              {...form.register('productName')}
              className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm"
              placeholder="Dimsum Crabstick"
            />
            {form.formState.errors.productName && (
              <p className="text-sm text-red-500">{form.formState.errors.productName.message}</p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="language">Bahasa</Label>
            <select
              id="language"
              {...form.register('language')}
              className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm"
            >
              <option value="id">Bahasa Indonesia</option>
              <option value="en">English</option>
            </select>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="productDescription">Deskripsi Produk</Label>
          <Textarea
            id="productDescription"
            {...form.register('productDescription')}
            placeholder="Dimsum crabstick dengan isian daging kepiting pilihan, dibalut dengan lapisan berwarna merah..."
            className="min-h-[100px]"
          />
          {form.formState.errors.productDescription && (
            <p className="text-sm text-red-500">{form.formState.errors.productDescription.message}</p>
          )}
        </div>

        <div className="space-y-2">
          <Label htmlFor="tone"> Tone</Label>
          <select
            id="tone"
            {...form.register('tone')}
            className="w-full h-10 px-3 rounded-md border border-input bg-white text-sm"
          >
            <option value="professional">Professional</option>
            <option value="playful">Playful</option>
            <option value="luxurious">Luxurious</option>
            <option value="warm">Warm</option>
          </select>
        </div>

        <Button type="submit" disabled={isGenerating} className="w-full md:w-auto">
          {isGenerating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Membuat Caption...
            </>
          ) : (
            'Buat Caption'
          )}
        </Button>
      </form>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-lg">
          {error}
        </div>
      )}

      {caption && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <Label>Hasil Caption</Label>
            <Button variant="outline" size="sm" onClick={copyToClipboard}>
              {isCopied ? (
                <>
                  <Check className="w-4 h-4 mr-1" />
                  Tersalin
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4 mr-1" />
                  Salin
                </>
              )}
            </Button>
          </div>
          <div className="p-4 bg-brand-cream border border-brand-cream-dark rounded-lg whitespace-pre-wrap text-sm">
            {caption}
          </div>
        </div>
      )}
    </div>
  );
}