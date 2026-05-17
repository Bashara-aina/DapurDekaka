'use client';
import { useState, useEffect } from 'react';
import { ArrowUp } from 'lucide-react';

export function BackToTop() {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const toggleVisibility = () => setVisible(window.scrollY > 400);
    window.addEventListener('scroll', toggleVisibility, { passive: true });
    return () => window.removeEventListener('scroll', toggleVisibility);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
      className="fixed bottom-24 right-4 md:bottom-8 z-40 w-10 h-10 bg-brand-red text-white rounded-full shadow-button flex items-center justify-center hover:bg-brand-red-dark transition-colors"
      aria-label="Kembali ke atas"
    >
      <ArrowUp className="w-5 h-5" />
    </button>
  );
}
