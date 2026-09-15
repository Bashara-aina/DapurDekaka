'use client';
import { useRouter } from 'next/navigation';
import { useTransition } from 'react';
import { Search, X } from 'lucide-react';

export function BlogSearchForm({
  defaultValue,
  categorySlug = '',
}: {
  defaultValue: string;
  categorySlug?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const formData = new FormData(e.currentTarget);
    const q = ((formData.get('q') as string) || '').trim();
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    if (categorySlug) params.set('category', categorySlug);
    startTransition(() => {
      const qs = params.toString();
      router.push(qs ? `/blog?${qs}` : '/blog');
    });
  };

  const handleClear = () => {
    startTransition(() => {
      router.push(categorySlug ? `/blog?category=${encodeURIComponent(categorySlug)}` : '/blog');
    });
  };

  return (
    <form onSubmit={handleSubmit} role="search" className="flex-1 flex gap-2 min-w-0">
      <label htmlFor="blog-search" className="sr-only">
        Cari artikel
      </label>
      <div className="relative flex-1 min-w-0">
        <Search
          className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-text-secondary"
          aria-hidden="true"
        />
        <input
          id="blog-search"
          type="search"
          name="q"
          key={defaultValue}
          defaultValue={defaultValue}
          placeholder="Cari artikel, tips, resep..."
          autoComplete="off"
          className="h-11 w-full rounded-button border border-brand-cream-dark bg-white pl-10 pr-9 text-sm text-text-primary placeholder:text-text-disabled focus:border-brand-red focus:outline-none focus:ring-2 focus:ring-brand-red/15"
        />
        {defaultValue && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-text-secondary transition-colors hover:bg-brand-cream hover:text-text-primary"
            aria-label="Hapus pencarian"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        )}
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="h-11 shrink-0 px-5 bg-brand-red text-white text-sm font-semibold rounded-button shadow-button hover:bg-brand-red-dark transition-colors disabled:opacity-50"
      >
        {isPending ? 'Mencari...' : 'Cari'}
      </button>
    </form>
  );
}
