'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ChevronLeft } from 'lucide-react';
import BlogForm from './BlogForm';

type Props = { params: Promise<{ id: string }> };

export function BlogEditClient({ params }: Props) {
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

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <Link href="/admin/blog" className="p-2 hover:bg-admin-content rounded-lg">
          <ChevronLeft className="w-5 h-5" />
        </Link>
        <h1 className="text-2xl font-bold">Edit Post</h1>
      </div>

      <BlogForm postId={postId} />
    </div>
  );
}