'use client';

import { useState, useEffect } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';
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
  const [current, setCurrent] = useState(0);
  const [isPaused, setIsPaused] = useState(false);
  const [testimonials, setTestimonials] = useState<Testimonial[]>([]);

  useEffect(() => {
    async function fetchTestimonials() {
      try {
        const res = await fetch('/api/testimonials/public');
        const json = await res.json();
        if (json.success && json.data?.length > 0) {
          setTestimonials(json.data);
        }
      } catch {
        // Fallback: use empty array (component shows nothing)
      }
    }
    fetchTestimonials();
  }, []);

  const next = () => setCurrent((prev) => (prev + 1) % testimonials.length);
  const prev = () => setCurrent((prev) => (prev - 1 + testimonials.length) % testimonials.length);

  useEffect(() => {
    if (isPaused || testimonials.length === 0) return;
    const timer = setInterval(next, 5000);
    return () => clearInterval(timer);
  }, [isPaused, testimonials.length]);

  if (testimonials.length === 0) {
    return null;
  }

  const t = testimonials[current];

  return (
    <section
      className="py-12 px-4 bg-white"
      onMouseEnter={() => setIsPaused(true)}
      onMouseLeave={() => setIsPaused(false)}
    >
      <div className="container mx-auto">
        <h2 className="font-display text-xl md:text-2xl font-semibold text-center mb-8">
          Kata Mereka yang Sudah Percaya
        </h2>

        <div className="relative max-w-2xl mx-auto">
          <div className="overflow-hidden">
            <div
              className="flex transition-transform duration-500 ease-out"
              style={{ transform: `translateX(-${current * 100}%)` }}
            >
              {testimonials.map((t) => (
                <div key={t.id} className="w-full flex-shrink-0 px-4">
                  <div className="bg-brand-cream rounded-card p-6 text-center">
                    <div className="flex gap-1 justify-center mb-3">
                      {Array.from({ length: t.rating }).map((_, i) => (
                        <span key={i} className="text-brand-gold text-lg">
                          ★
                        </span>
                      ))}
                    </div>
                    <p className="text-text-primary mb-4 italic">&quot;{t.contentId}&quot;</p>
                    <p className="font-semibold text-brand-red">
                      {t.customerName}
                      {t.customerLocation && <span className="font-normal text-text-secondary text-sm">, {t.customerLocation}</span>}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Navigation arrows */}
          <button
            onClick={prev}
            className="absolute left-0 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow flex items-center justify-center text-brand-red hover:bg-brand-cream transition-colors"
            aria-label="Previous testimonial"
          >
            <ChevronLeft className="w-5 h-5" />
          </button>
          <button
            onClick={next}
            className="absolute right-0 top-1/2 -translate-y-1/2 w-10 h-10 bg-white rounded-full shadow flex items-center justify-center text-brand-red hover:bg-brand-cream transition-colors"
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