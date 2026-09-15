'use client';

import { useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Plus, Trash2 } from 'lucide-react';
import type { BlogPost } from '@/lib/db/schema';
import { formatWIB } from '@/lib/utils/format-date';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface Props {
  posts: BlogPost[];
}

export default function BlogTableClient({ posts }: Props) {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [targetDelete, setTargetDelete] = useState<BlogPost | null>(null);

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const res = await fetch(`/api/admin/blog/${id}`, { method: 'DELETE' });
      const json = await res.json();
      if (!json.success) throw new Error(json.error);
      return json.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['admin-blog-posts'] });
      toast.success('Post dihapus');
      router.refresh();
    },
    onError: (err: Error) => toast.error(err.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Blog</h1>
        <Link
          href="/admin/blog/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-red text-white rounded-lg hover:bg-brand-red-dark transition-colors text-sm font-medium"
        >
          <Plus className="w-4 h-4" /> Buat Post
        </Link>
      </div>

      <div className="bg-white rounded-lg border border-admin-border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-admin-content">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Judul</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Slug</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Cover</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {posts.map((post) => (
                <tr key={post.id} className="hover:bg-admin-content">
                  <td className="px-6 py-4">
                    <div className="font-medium text-sm">{post.titleId}</div>
                    <div className="text-xs text-gray-500">{post.titleEn}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">/{post.slug}</td>
                  <td className="px-6 py-4">
                    <div className="flex gap-2">
                      <span className={`inline-flex px-2 py-1 text-xs font-semibold rounded ${
                        post.isPublished
                          ? 'bg-green-100 text-green-800'
                          : 'bg-gray-100 text-gray-800'
                      }`}>
                        {post.isPublished ? 'Published' : 'Draft'}
                      </span>
                      {post.isAiAssisted && (
                        <span className="inline-flex px-2 py-1 text-xs font-semibold rounded bg-purple-100 text-purple-800">
                          AI
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {post.coverImageUrl ? (
                      <div className="w-12 h-8 rounded overflow-hidden bg-gray-100">
                        <Image
                          src={post.coverImageUrl}
                          alt=""
                          width={48}
                          height={32}
                          className="w-full h-full object-cover"
                        />
                      </div>
                    ) : (
                      <span className="text-xs text-gray-400">No cover</span>
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {post.publishedAt
                      ? formatWIB(new Date(post.publishedAt))
                      : post.createdAt
                      ? formatWIB(new Date(post.createdAt))
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <div className="flex items-center gap-3">
                      <Link
                        href={`/admin/blog/${post.id}`}
                        className="text-brand-red hover:underline"
                      >
                        Edit
                      </Link>
                      <button
                        type="button"
                        onClick={() => { setTargetDelete(post); setShowDeleteDialog(true); }}
                        disabled={deleteMutation.isPending}
                        className="p-1 hover:bg-red-50 rounded transition-colors text-red-400 hover:text-red-600 disabled:opacity-50"
                        aria-label="Hapus"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {posts.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-gray-500">
                    Belum ada post
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      <Dialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Hapus Post?</DialogTitle>
            <DialogDescription>
              Post &quot;{targetDelete?.titleId}&quot; akan dihapus. Tindakan ini tidak bisa dibatalkan.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-3">
            <button
              type="button"
              onClick={() => { setShowDeleteDialog(false); setTargetDelete(null); }}
              className="flex-1 h-10 border border-gray-200 text-gray-600 rounded-lg text-sm font-medium hover:bg-gray-50 transition-colors"
            >
              Batal
            </button>
            <button
              type="button"
              onClick={() => {
                if (targetDelete) deleteMutation.mutate(targetDelete.id);
                setShowDeleteDialog(false);
                setTargetDelete(null);
              }}
              disabled={deleteMutation.isPending}
              className="flex-1 h-10 bg-red-600 text-white rounded-lg text-sm font-bold hover:bg-red-700 transition-colors disabled:opacity-50"
            >
              Hapus
            </button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}