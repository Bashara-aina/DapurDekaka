'use client';

import { useEffect, useState } from 'react';

export default function BlogLoading() {
  const [MotionComp, setMotionComp] = useState<typeof import('framer-motion') | null>(null);

  useEffect(() => {
    import('framer-motion').then((m) => setMotionComp(m));
  }, []);

  const shimmerBars = (
    <div className="space-y-4">
      {[...Array(6)].map((_, i) => (
        <div key={i} className="bg-white rounded-card p-4 shadow-card animate-pulse">
          <div className="flex gap-4">
            <div className="w-24 h-24 bg-brand-cream rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-3">
              <div className="h-4 bg-brand-cream rounded w-3/4" />
              <div className="h-3 bg-brand-cream rounded w-1/2" />
              <div className="h-3 bg-brand-cream rounded w-2/3" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );

  if (!MotionComp) {
    return <div className="container py-8 px-4">{shimmerBars}</div>;
  }

  const { motion: MotionFn } = MotionComp;

  return (
    <div className="container py-8 px-4">
      {/* Header skeleton */}
      <div className="mb-8 animate-pulse">
        <div className="h-8 bg-brand-cream rounded w-32 mb-2" />
        <div className="h-4 bg-brand-cream rounded w-64" />
      </div>

      {/* Filter skeleton */}
      <div className="flex gap-2 mb-8">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="h-11 w-20 bg-brand-cream rounded-pill animate-pulse" />
        ))}
      </div>

      {/* Grid skeleton */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <MotionFn.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: i * 0.1 }}
          >
            <div className="bg-white rounded-card overflow-hidden shadow-card">
              <div className="aspect-video bg-brand-cream animate-pulse" />
              <div className="p-4 space-y-3">
                <div className="h-5 bg-brand-cream rounded w-3/4" />
                <div className="h-4 bg-brand-cream rounded w-1/2" />
                <div className="h-3 bg-brand-cream rounded w-2/3" />
              </div>
            </div>
          </MotionFn.div>
        ))}
      </div>
    </div>
  );
}