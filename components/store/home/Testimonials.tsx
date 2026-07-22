'use client';

import { useState, useEffect, useCallback } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { useTranslations } from 'next-intl';
import { cn } from '@/lib/utils/cn';

interface Testimonial {
  id: string;
  customerName: string;
  customerLocation: string | null;
  avatarUrl: string | null;
  rating: number;
  contentId: string;
  contentEn: string | null;
  sortOrder: number;
}

export function Testimonials() {
  const t = useTranslations('testimonials');
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    async function fetchTestimonials() {
      try {
        const res = await fetch('/api/testimonials/public');
        const json = await res.json();
        if (json.success && json.data?.length > 0) {
          setTestimonials(json.data);
        }
      } catch {
        setHasError(true);
      }
    }
    fetchTestimonials();
  }, []);

  const next = useCallback(() => setCurrent((prev) => (prev + 1) % testimonials.length), [testimonials.length]);
  const prev = useCallback(() => setCurrent((prev) => (prev - 1 + testimonials.length) % testimonials.length), [testimonials.length]);

  useEffect(() => {
    if (isPaused || testimonials.length === 0) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [isPaused, testimonials.length, next]);

  if (testimonials.length === 0) {
    if (hasError) {
      return (
        <section className="py-12 px-4 bg-white">
          <div className="container mx-auto text-center">
            <h2 className="font-display text-2xl md:text-3xl font-semibold text-center mb-8">
              {t('errorTitle')}
            </h2>
            <p className="text-text-secondary text-sm">
              {t('errorDesc')}
            </p>
          </div>
        </section>
      );
    }
    return null;
  }

  const testimonial = testimonials[current];

  return (
    <section
      className="py-12 px-4 bg-white"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="container mx-auto">
        <h2 className="font-display text-2xl md:text-3xl font-semibold text-center mb-8">
          {t('title')}
        </h2>

        <div className="relative max-w-2xl mx-auto">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${current * 100}%)` }}
            >
              {testimonials.map((item) => (
                <div key={item.id} className="w-full flex-shrink-0 px-4">
                  <div className="bg-brand-cream rounded-card p-6 text-center">
                    <div className="flex gap-1 justify-center mb-3">
                      {Array.from({ length: item.rating }).map((_, i) => (
                        <span key={i} className="text-brand-gold text-lg">
                          ★
                        </span>
                      ))}
                    </div>
                    <p className="font-display text-text-primary mb-4 italic text-base leading-relaxed">&quot;{item.contentId}&quot;</p>
                    <p className="font-semibold text-brand-red">
                      {item.customerName?.split(' ')[0] ?? 'Customer'}
                      {item.customerLocation && <span className="font-normal text-text-secondary text-sm">, {item.customerLocation}</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation arrows */}
          <button
            onClick={prev}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-11 h-11 bg-white rounded-full shadow flex items-center justify-center text-brand-red hover:bg-brand-cream transition-colors"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-11 h-11 bg-white rounded-full shadow flex items-center justify-center text-brand-red hover:bg-brand-cream transition-colors"
            aria-label="Next testimonial"
          >
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Dots */}
        <div className="flex justify-center gap-2 mt-6">
          {testimonials.map((_, index) => (
            <button
              key={index}
              onClick={() => setCurrent(index)}
              className={cn(
                'w-2 h-2 rounded-full transition-all',
                index === current ? 'bg-brand-red w-4' : 'bg-brand-cream-dark'
              )}
              aria-label={`Go to testimonial ${index + 1}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
}