export default function TrustLoading(): React.ReactElement {
  return (
    <div className="min-h-screen bg-brand-cream pb-20 md:pb-0">
      <div className="container mx-auto px-4 py-10 max-w-3xl space-y-4">
        <div className="h-8 w-56 bg-brand-cream-dark rounded animate-pulse" />
        <div className="h-4 w-full bg-brand-cream-dark rounded animate-pulse" />
        <div className="h-4 w-5/6 bg-brand-cream-dark rounded animate-pulse" />
        <div className="h-4 w-4/6 bg-brand-cream-dark rounded animate-pulse" />
      </div>
    </div>
  );
}
