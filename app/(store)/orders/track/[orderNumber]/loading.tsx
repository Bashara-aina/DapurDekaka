export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-cream pb-20 md:pb-0 animate-pulse">
      <div className="container mx-auto px-4 py-8 max-w-lg space-y-4">
        <div className="h-8 w-2/3 rounded bg-brand-cream-dark" />
        <div className="h-40 rounded-card bg-brand-cream-dark" />
        <div className="h-24 rounded-card bg-brand-cream-dark" />
      </div>
    </div>
  );
}
