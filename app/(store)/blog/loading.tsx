export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-cream" aria-busy="true" aria-label="Memuat artikel">
      <div className="border-b border-brand-cream-dark bg-white">
        <div className="container mx-auto px-4 md:px-6 py-8 md:py-12">
          <div className="h-4 w-32 animate-pulse rounded bg-brand-cream-dark" />
          <div className="mt-4 h-9 w-48 animate-pulse rounded-lg bg-brand-cream-dark" />
          <div className="mt-2 h-5 w-full max-w-xl animate-pulse rounded bg-brand-cream-dark/70" />
        </div>
      </div>

      <div className="container mx-auto px-4 md:px-6 py-8">
        <div className="rounded-2xl border border-brand-cream-dark bg-white p-4 md:p-5 shadow-card">
          <div className="flex gap-2">
            <div className="h-11 flex-1 animate-pulse rounded-button bg-brand-cream" />
            <div className="h-11 w-20 animate-pulse rounded-button bg-brand-cream" />
          </div>
          <div className="mt-4 flex gap-2 overflow-hidden">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-9 w-28 shrink-0 animate-pulse rounded-full bg-brand-cream" />
            ))}
          </div>
        </div>

        <div className="mt-8 overflow-hidden rounded-2xl bg-white shadow-card">
          <div className="grid md:grid-cols-2">
            <div className="h-64 animate-pulse bg-brand-cream-dark/60 md:h-full md:min-h-[320px]" />
            <div className="space-y-3 p-6 md:p-10">
              <div className="h-6 w-32 animate-pulse rounded-full bg-brand-cream" />
              <div className="h-8 w-full animate-pulse rounded-lg bg-brand-cream" />
              <div className="h-8 w-3/4 animate-pulse rounded-lg bg-brand-cream" />
              <div className="h-5 w-full animate-pulse rounded bg-brand-cream/70" />
              <div className="h-5 w-2/3 animate-pulse rounded bg-brand-cream/70" />
            </div>
          </div>
        </div>

        <div className="mt-8 grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="overflow-hidden rounded-card bg-white shadow-card">
              <div className="aspect-[16/10] animate-pulse bg-brand-cream-dark/60" />
              <div className="space-y-2.5 p-5">
                <div className="h-5 w-20 animate-pulse rounded-full bg-brand-cream" />
                <div className="h-6 w-full animate-pulse rounded bg-brand-cream" />
                <div className="h-6 w-2/3 animate-pulse rounded bg-brand-cream" />
                <div className="h-4 w-full animate-pulse rounded bg-brand-cream/70" />
                <div className="h-4 w-1/2 animate-pulse rounded bg-brand-cream/70" />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
