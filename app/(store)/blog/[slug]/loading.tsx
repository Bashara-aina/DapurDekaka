'use client';

import { useEffect, useState } from 'react';

export default function BlogSlugLoading() {
  const [MotionComp, setMotionComp] = useState<typeof import('framer-motion') | null>(null);

  useEffect(() => {
    import('framer-motion').then((m) => setMotionComp(m));
  }, []);

  if (!MotionComp) {
    return (
      <div className="animate-pulse">
        <div className="h-64 bg-brand-cream" />
        <div className="container py-8 px-4">
          <div className="h-8 bg-brand-cream rounded w-32 mb-4" />
          <div className="h-4 bg-brand-cream rounded w-full mb-2" />
          <div className="h-4 bg-brand-cream rounded w-3/4 mb-2" />
          <div className="h-4 bg-brand-cream rounded w-1/2" />
        </div>
      </div>
    );
  }

  const { motion: MotionFn } = MotionComp;

  return (
    <MotionFn.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      <div className="h-64 bg-brand-cream animate-pulse" />
      <div className="container py-8 px-4 space-y-4">
        <div className="h-8 bg-brand-cream rounded w-32 animate-pulse" />
        <div className="space-y-3">
          <div className="h-4 bg-brand-cream rounded w-full animate-pulse" />
          <div className="h-4 bg-brand-cream rounded w-3/4 animate-pulse" />
          <div className="h-4 bg-brand-cream rounded w-2/3 animate-pulse" />
        </div>
      </div>
    </MotionFn.div>
  );
}