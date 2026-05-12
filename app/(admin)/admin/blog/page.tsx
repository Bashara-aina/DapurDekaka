import Link from 'next/link';
import { db } from '@/lib/db';
import { blogPosts } from '@/lib/db/schema';
import { desc } from 'drizzle-orm';
import { formatWIB } from '@/lib/utils/format-date';

export const dynamic = 'force-dynamic';

export default async function AdminBlogPage() {
  const allPosts = await db.query.blogPosts.findMany({
    orderBy: [desc(blogPosts.createdAt)],
  });

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Blog</h1>
        <Link
          href="/admin/blog/new"
          className="inline-flex items-center gap-2 px-4 py-2 bg-brand-red text-white rounded-lg hover:bg-brand-red-dark transition-colors text-sm font-medium"
        >
          + Buat Post
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
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Tanggal</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">Aksi</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-admin-border">
              {allPosts.map((post) => (
                <tr key={post.id} className="hover:bg-admin-content">
                  <td className="px-6 py-4">
                    <div className="font-medium text-sm">{post.titleId}</div>
                    <div className="text-xs text-gray-500">{post.titleEn}</div>
                  </td>
                  <td className="px-6 py-4 text-sm text-gray-500 font-mono">/{post.slug}</td>
                  <td className="px-6 py-4 whitespace-nowrap">
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
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {post.publishedAt
                      ? formatWIB(new Date(post.publishedAt))
                      : post.createdAt
                      ? formatWIB(new Date(post.createdAt))
                      : '-'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm">
                    <Link
                      href={`/admin/blog/${post.id}`}
                      className="text-brand-red hover:underline"
                    >
                      Edit
                    </Link>
                  </td>
                </tr>
              ))}
              {allPosts.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-6 py-8 text-center text-gray-500">
                    Belum ada post
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}