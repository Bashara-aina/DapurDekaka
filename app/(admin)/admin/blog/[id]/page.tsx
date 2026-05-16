'use client';

import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft, Upload } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import TiptapEditor from '@/components/admin/blog/TiptapEditor';
import type { BlogPost } from '@/lib/db/schema';
import { CoverImageUploader } from '@/components/admin/blog/CoverImageUploader';

const blogSchema = z.object({
  titleId: z.string().min(1),
  titleEn: z.string().min(1),
  slug: z.string().min(1),
  excerptId: z.string().optional(),
  excerptEn: z.string().optional(),
  contentId: z.string().min(1),
  contentEn: z.string().min(1),
  coverImageUrl: z.string().optional(),
  coverImagePublicId: z.string().optional(),
  blogCategoryId: z.string().uuid().optional().nullable(),
  isPublished: z.boolean(),
  isAiAssisted: z.boolean(),
  metaTitleId: z.string().optional(),
  metaTitleEn: z.string().optional(),
  metaDescriptionId: z.string().optional(),
  metaDescriptionEn: z.string().optional(),
});

type BlogFormData = z.infer<typeof blogSchema>;

type Props = { params: Promise<{ id: string }> };

export default function AdminBlogEditPage({ params }: Props) {
  const [postId, setPostId] = useState<string>('');
  const [isClientReady, setIsClientReady] = useState(false);

  useEffect(() => {
    params.then(p => {
      setPostId(p.id);
      setIsClientReady(true);
    });
  }, [params]);

  if (!isClientReady) {
    return <div className="p-6">Loading...</div>;
  }

  return <AdminBlogEditClient postId={postId} />;
}

function AdminBlogEditClient({ postId }: { postId: string }) {
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [post, setPost] = useState<BlogPost | null>(null);
  const [loading, setLoading] = useState(true);
  const [contentId, setContentId] = useState('');
  const [contentEn, setContentEn] = useState('');

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

  useEffect(() => {
    async function fetchPost() {
      try {
        const response = await fetch(`/api/admin/blog/${postId}`);
        if (!response.ok) {
          throw new Error('Failed to fetch post');
        }
        const result = await response.json();
        setPost(result.data);
        setContentId(result.data.contentId || '');
        setContentEn(result.data.contentEn || '');
        form.reset({
          titleId: result.data.titleId,
          titleEn: result.data.titleEn,
          slug: result.data.slug,
          excerptId: result.data.excerptId ?? '',
          excerptEn: result.data.excerptEn ?? '',
          coverImageUrl: result.data.coverImageUrl ?? '',
          coverImagePublicId: result.data.coverImagePublicId ?? '',
          blogCategoryId: result.data.blogCategoryId ?? null,
          isPublished: result.data.isPublished,
          isAiAssisted: result.data.isAiAssisted,
          metaTitleId: result.data.metaTitleId ?? '',
          metaTitleEn: result.data.metaTitleEn ?? '',
          metaDescriptionId: result.data.metaDescriptionId ?? '',
          metaDescriptionEn: result.data.metaDescriptionEn ?? '',
        });
      } catch (error) {
        alert('Failed to load post');
        router.push('/admin/blog');
      } finally {
        setLoading(false);
      }
    }
    fetchPost();
  }, [postId, router, form]);

  async function onSubmit(data: BlogFormData) {
    setIsSubmitting(true);
    try {
      const response = await fetch(`/api/admin/blog/${postId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...data,
          contentId,
          contentEn,
          coverImageUrl: data.coverImageUrl || null,
          coverImagePublicId: data.coverImagePublicId || null,
          blogCategoryId: data.blogCategoryId || null,
        }),
      });

      if (!response.ok) {
        const error = await response.json();
        throw new Error(error.error || 'Failed to update post');
      }

      router.push('/admin/blog');
      router.refresh();
    } catch (error) {
      alert(error instanceof Error ? error.message : 'Failed to update post');
    } finally {
      setIsSubmitting(false);
    }
  }

  if (loading) {
    return <div className="p-6">Loading...</div>;
  }

  if (!post) {
    return <div className="p-6">Post tidak ditemukan</div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/blog" className="p-2 hover:bg-admin-content rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Edit Post</h1>
      </div>

      <div className="bg-white rounded-lg border border-admin-border p-6">
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="titleId">Judul (Bahasa Indonesia)</Label>
              <Input id="titleId" {...form.register('titleId')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="titleEn">Title (English)</Label>
              <Input id="titleEn" {...form.register('titleEn')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="slug">Slug</Label>
              <Input id="slug" {...form.register('slug')} />
            </div>

            <div className="space-y-2">
              <Label htmlFor="coverImageUrl">Cover Image</Label>
              <div className="flex gap-2">
                <Input
                  id="coverImageUrl"
                  {...form.register('coverImageUrl')}
                  placeholder="https://res.cloudinary.com/..."
                  className="flex-1"
                />
                <CoverImageUploader
                  onUpload={(url, publicId) => {
                    form.setValue('coverImageUrl', url);
                    form.setValue('coverImagePublicId', publicId);
                  }}
                />
              </div>
              {form.watch('coverImageUrl') && (
                <div className="mt-2 rounded-lg overflow-hidden border border-admin-border">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={form.watch('coverImageUrl')}
                    alt="Cover preview"
                    className="h-24 object-cover"
                  />
                </div>
              )}
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
            {isSubmitting ? 'Menyimpan...' : 'Update Post'}
          </Button>
        </form>
      </div>
    </div>
  );
}