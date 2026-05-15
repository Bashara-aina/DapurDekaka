export default function Loading() {
  return (
    <div className="min-h-screen bg-brand-cream pb-24 md:pb-0">
      <div className="bg-white border-b border-brand-cream-dark sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="h-6 w-24 bg-gray-200 rounded animate-pulse" />
          <div className="mt-4 h-2 w-full bg-gray-100 rounded" />
        </div>
      </div>
      <div className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2">
            <div className="bg-white rounded-card p-6 shadow-card space-y-4">
              <div className="h-6 w-32 bg-gray-200 rounded animate-pulse" />
              <div className="space-y-2">
                <div className="h-4 w-full bg-gray-100 rounded animate-pulse" />
                <div className="h-4 w-3/4 bg-gray-100 rounded animate-pulse" />
              </div>
            </div>
          </div>
          <div className="lg:col-span-1">
            <div className="bg-white rounded-card p-6 shadow-card">
              <div className="h-6 w-24 bg-gray-200 rounded animate-pulse mb-4" />
              <div className="space-y-3">
                <div className="flex justify-between">
                  <div className="h-4 w-20 bg-gray-100 rounded animate-pulse" />
                  <div className="h-4 w-16 bg-gray-100 rounded animate-pulse" />
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}