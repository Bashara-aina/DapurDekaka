'use client';

import { useRouter } from 'next/navigation';
import { useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import TiptapEditor from '@/components/admin/blog/TiptapEditor';
import { useSession } from 'next-auth/react';

const blogSchema = z.object({
  titleId: z.string().min(1, 'Judul ID wajib diisi'),
  titleEn: z.string().min(1, 'Judul EN wajib diisi'),
  slug: z.string().min(1, 'Slug wajib diisi'),
  excerptId: z.string().optional(),
  excerptEn: z.string().optional(),
  contentId: z.string().min(1, 'Konten ID wajib diisi'),
  contentEn: z.string().min(1, 'Konten EN wajib diisi'),
  coverImageUrl: z.string().optional(),
  coverImagePublicId: z.string().optional(),
  blogCategoryId: z.string().uuid().optional().nullable(),
  isPublished: z.boolean().default(false),
  isAiAssisted: z.boolean().default(false),
  metaTitleId: z.string().optional(),
  metaTitleEn: z.string().optional(),
  metaDescriptionId: z.string().optional(),
  metaDescriptionEn: z.string().optional(),
});

type BlogFormData = z.infer<typeof blogSchema>;

export default function AdminBlogNewPage() {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [contentId, setContentId] = useState('<p>Mulai tulis konten di sini...</p>');
  const [contentEn, setContentEn] = useState('<p>Start writing content here...</p>');

  const form = useForm<BlogFormData>({
    resolver: zodResolver(blogSchema),
    defaultValues: {
      titleId: '',
      titleEn: '',
      slug: '',
      excerptId: '',
      excerptEn: '',
      isPublished: false,
      isAiAssisted: false,
    },
  });

  async function generateSlug(title: string): Promise<string> {
    return title
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/(^-|-$)/g, '');
  }

  async function onSubmit(data: BlogFormData) {
    setIsSubmitting(true);
    try {
      const slug = data.slug || await generateSlug(data.titleId);
      
      const response = await fetch('/api/admin/blog', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          slug,
          contentId,
          contentEn,
          coverImageUrl: data.coverImageUrl || null,
          coverImagePublicId: data.coverImagePublicId || null,
          blogCategoryId: data.blogCategoryId || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to create post');
      }

      router.push('/admin/blog');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to create post');
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/blog" className="p-2 hover:bg-admin-content rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Buat Post Baru</h1>
      </div>

      <div className="bg-white rounded-lg border border-admin-border p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="titleId">Judul (Bahasa Indonesia)</Label>
              <Input id="titleId" {...form.register('titleId')} />
              {form.formState.errors.titleId && (
                <p className="text-sm text-red-500">{form.formState.errors.titleId.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="titleEn">Title (English)</Label>
              <Input id="titleEn" {...form.register('titleEn')} />
              {form.formState.errors.titleEn && (
                <p className="text-sm text-red-500">{form.formState.errors.titleEn.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug (URL)</Label>
              <Input id="slug" {...form.register('slug')} placeholder="auto-generated-from-title" />
              {form.formState.errors.slug && (
                <p className="text-sm text-red-500">{form.formState.errors.slug.message}</p>
              )}
            </div>

            <div className="space-y-2">
              <Label htmlFor="coverImageUrl">URL Cover Image</Label>
              <Input id="coverImageUrl" {...form.register('coverImageUrl')} placeholder="https://..." />
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="excerptId">Excerpt (ID)</Label>
              <textarea
                id="excerptId"
                {...form.register('excerptId')}
                className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-white text-sm"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="excerptEn">Excerpt (EN)</Label>
              <textarea
                id="excerptEn"
                {...form.register('excerptEn')}
                className="w-full min-h-[80px] px-3 py-2 rounded-md border border-input bg-white text-sm"
              />
            </div>
          </div>

          <div className="space-y-2">
            <Label>Konten Bahasa Indonesia</Label>
            <TiptapEditor content={contentId} onChange={setContentId} />
          </div>

          <div className="space-y-2">
            <Label>Konten English</Label>
            <TiptapEditor content={contentEn} onChange={setContentEn} />
          </div>

          <div className="flex items-center gap-8">
            <div className="flex items-center space-y-2">
              <Switch
                id="isPublished"
                checked={form.watch('isPublished')}
                onCheckedChange={(checked) => form.setValue('isPublished', checked)}
              />
              <Label htmlFor="isPublished">Publish</Label>
            </div>

            <div className="flex items-center space-y-2">
              <Switch
                id="isAiAssisted"
                checked={form.watch('isAiAssisted')}
                onCheckedChange={(checked) => form.setValue('isAiAssisted', checked)}
              />
              <Label htmlFor="isAiAssisted">AI-assisted</Label>
            </div>
          </div>

          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? 'Menyimpan...' : 'Buat Post'}
          </Button>
        </form>
      </div>
    </div>
  );
}