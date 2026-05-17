'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { useTransition } from 'react';

export function BlogSearchForm({ defaultValue }: { defaultValue: string }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = formData.get('q') as string;
    startTransition(() => {
      router.push(q ? `/blog?q=${encodeURIComponent(q)}` : '/blog');
    });
  };

  return (
    <form onSubmit={handleSubmit} className="flex-1 flex gap-2">
      <input
        type="text"
        name="q"
        defaultValue={defaultValue}
        placeholder="Cari artikel..."
        className="flex-1 h-11 px-4 rounded-button border border-brand-cream-dark bg-white text-sm focus:outline-none focus:border-brand-red"
      />
      {isPending && <span className="text-xs text-text-secondary self-center">Mencari...</span>}
      <button
        type="submit"
        disabled={isPending}
        className="h-11 px-4 bg-brand-red text-white text-sm font-medium rounded-button hover:bg-brand-red-dark transition-colors disabled:opacity-50"
      >
        Cari
      </button>
    </form>
  );
}
