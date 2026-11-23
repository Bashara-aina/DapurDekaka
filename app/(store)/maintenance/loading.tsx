export default function MaintenanceLoading(): React.ReactElement {
  return (
    <div className="min-h-screen bg-brand-cream flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-4">
        <div className="h-10 w-3/4 mx-auto bg-brand-cream-dark rounded animate-pulse" />
        <div className="h-4 w-full bg-brand-cream-dark rounded animate-pulse" />
        <div className="h-12 w-full bg-brand-cream-dark rounded animate-pulse" />
      </div>
    </div>
  );
}
