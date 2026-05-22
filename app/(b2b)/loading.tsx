'use client';

import { useEffect, useState } from 'react';

export default function B2BLoading() {
  const [MotionComp, setMotionComp] = useState<typeof import('framer-motion') | null>(null);

  useEffect(() => {
    import('framer-motion').then((m) => setMotionComp(m));
  }, []);

  if (!MotionComp) {
    return (
      <div className="container py-8 px-4 animate-pulse">
        <div className="h-8 bg-brand-cream rounded w-40 mb-6" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-card p-6 shadow-card">
              <div className="h-12 w-12 bg-brand-cream rounded-full mb-4" />
              <div className="h-5 bg-brand-cream rounded w-3/4 mb-2" />
              <div className="h-4 bg-brand-cream rounded w-full mb-1" />
              <div className="h-4 bg-brand-cream rounded w-2/3" />
            </div>
          ))}
        </div>
        <div className="h-64 bg-brand-cream rounded-card" />
      </div>
    );
  }

  const { motion: MotionFn } = MotionComp;

  return (
    <div className="container py-8 px-4">
      <MotionFn.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        <div className="h-8 bg-brand-cream rounded w-40 mb-6 animate-pulse" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="bg-white rounded-card p-6 shadow-card">
              <div className="h-12 w-12 bg-brand-cream rounded-full mb-4 animate-pulse" />
              <div className="h-5 bg-brand-cream rounded w-3/4 mb-2 animate-pulse" />
              <div className="h-4 bg-brand-cream rounded w-full mb-1 animate-pulse" />
              <div className="h-4 bg-brand-cream rounded w-2/3 animate-pulse" />
            </div>
          ))}
        </div>
        <div className="h-64 bg-brand-cream rounded-card animate-pulse" />
      </MotionFn.div>
    </div>
  );
}