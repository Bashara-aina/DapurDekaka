'use client';

import { useState, useEffect, useCallback } from 'react';
import Image from 'next/image';
import Link from 'next/link';

const CLOUD_NAME = process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME || 'dsnhwfuxh';
const CLOUDINARY_BASE = `https://res.cloudinary.com/${CLOUD_NAME}/image/upload/f_webp,q_auto,w_1600`;

interface Slide {
  id: string;
  titleId: string;
  titleEn: string;
  subtitleId: string | null;
  subtitleEn: string | null;
  ctaLabelId: string | null;
  ctaLabelEn: string | null;
  ctaUrl: string | null;
  imageUrl: string;
  imagePublicId: string;
  type: string;
}

interface HeroCarouselProps {
  slides: Slide[];
  autoRotateSpeed?: number;
}

export function HeroCarousel({ slides, autoRotateSpeed = 5000 }: HeroCarouselProps) {
  const [currentSlide, setCurrentSlide] = useState(0);
  const [MotionComp, setMotionComp] = useState<typeof import('framer-motion') | null>(null);

  useEffect(() => {
    import('framer-motion').then((m) => setMotionComp(m));
  }, []);

  const activeSlides = slides.length > 0 ? slides : [];
  const nextSlide = useCallback(() => {
    setCurrentSlide((prev) => (prev + 1) % activeSlides.length);
  }, [activeSlides.length]);

  useEffect(() => {
    if (activeSlides.length <= 1) return;
    const timer = setInterval(nextSlide, autoRotateSpeed);
    return () => clearInterval(timer);
  }, [nextSlide, activeSlides.length, autoRotateSpeed]);

  const goToSlide = (index: number) => setCurrentSlide(index);

  if (!activeSlides.length) {
    return (
      <section className="relative h-[50vh] md:h-[70vh] bg-brand-red overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-10" />
        <div className="relative z-20 h-full flex flex-col items-center justify-center text-center px-6">
          <h1 className="font-display text-3xl md:text-6xl font-bold text-white mb-3 whitespace-pre-line">
            Cita Rasa Warisan,
            kini di Rumahmu
          </h1>
          <p className="text-white/90 text-base md:text-lg mb-6 max-w-xl">
            Dimsum, siomay, dan bakso frozen premium dari Bandung — langsung ke pintu rumah Anda
          </p>
          <Link
            href="/products"
            className="inline-flex items-center h-12 px-6 bg-white text-brand-red font-bold rounded-button shadow-lg hover:bg-brand-cream transition-colors"
          >
            Lihat Produk
          </Link>
        </div>
      </section>
    );
  }

  const activeSlide = activeSlides[currentSlide]!;
  const imageUrl = `${CLOUDINARY_BASE}/${activeSlide.imagePublicId}`;

  const slideContent = (
    <>
      <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/30 to-transparent z-10" />
      <Image
        src={imageUrl}
        alt={activeSlide.titleId}
        fill
        className="object-cover"
        priority={currentSlide === 0}
        sizes="100vw"
      />
      <div className="relative z-20 h-full flex flex-col items-center justify-center text-center px-6">
        <h1 className="font-display text-3xl md:text-6xl font-bold text-white mb-3 whitespace-pre-line">
          {activeSlide.titleId}
        </h1>
        {activeSlide.subtitleId && (
          <p className="text-white/90 text-base md:text-lg mb-6 max-w-xl">
            {activeSlide.subtitleId}
          </p>
        )}
        {activeSlide.ctaLabelId && activeSlide.ctaUrl && (
          <Link
            href={activeSlide.ctaUrl}
            className="inline-flex items-center h-12 px-6 bg-white text-brand-red font-bold rounded-button shadow-lg hover:bg-brand-cream transition-colors"
          >
            {activeSlide.ctaLabelId}
          </Link>
        )}
      </div>
    </>
  );

  return (
    <section className="relative h-[50vh] md:h-[70vh] bg-brand-red overflow-hidden">
      {MotionComp ? (
        <MotionComp.motion.div
          key={currentSlide}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.5 }}
          className="absolute inset-0"
        >
          {slideContent}
        </MotionComp.motion.div>
      ) : (
        <div className="absolute inset-0">{slideContent}</div>
      )}

      {activeSlides.length > 1 && (
        <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-20 flex gap-2">
          {activeSlides.map((_, index) => (
            <button
              key={index}
              onClick={() => goToSlide(index)}
              className={`w-2.5 h-2.5 rounded-full transition-all ${
                index === currentSlide
                  ? 'bg-white w-8'
                  : 'bg-white/50 hover:bg-white/70'
              }`}
              aria-label={`Go to slide ${index + 1}`}
            />
          ))}
        </div>
      )}
    </section>
  );
}